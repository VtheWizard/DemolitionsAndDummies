package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	rows       = 11
	cols       = 11
	maxPlayers = 2
)

type GridMessage struct {
	Type  string  `json:"type"`
	Cells [][]int `json:"cells"` // 2D grid of cells, 1 is wall, 0 is empty
}

type PlayerUpdateMessage struct {
	Type           string `json:"type"`
	PlayerID       string `json:"player_id"`
	PlayerPosition [2]int `json:"playerPosition"`
}

type Bomb struct {
	Position [2]int
	Owner    *websocket.Conn
	Timer    time.Time
}

type GameRoom struct {
	Grid    [][]int
	Players map[*websocket.Conn][2]int
	Bombs   []Bomb
	Mutex   sync.Mutex
}

var upgrader = websocket.Upgrader{
	// allow all origins for development
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var (
	gameRooms = make(map[string]*GameRoom)
	roomsLock sync.Mutex
	roomCount int
)

func isAdjacentToCorner(row, col, rows, cols int) bool {
	cornerPositions := [][2]int{
		{0, 0}, {0, cols - 1},
		{rows - 1, 0}, {rows - 1, cols - 1},
	}
	for _, corner := range cornerPositions {
		if (row == corner[0] && abs(col-corner[1]) == 1) || (col == corner[1] && abs(row-corner[0]) == 1) {
			return true
		}
	}
	return false
}

func createGrid() [][]int {
	grid := make([][]int, rows)
	for i := range grid {
		grid[i] = make([]int, cols)
	}

	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			if (row == 0 && col == 0) ||
				(row == 0 && col == cols-1) ||
				(row == rows-1 && col == 0) ||
				(row == rows-1 && col == cols-1) ||
				isAdjacentToCorner(row, col, rows, cols) {
				grid[row][col] = 0 // empty
			} else if row%2 == 1 && col%2 == 1 {
				grid[row][col] = 2 // indestructible wall
			} else {
				grid[row][col] = 1 // destructible wall
			}
		}
	}
	return grid
}

func assignRoom() string {
	roomsLock.Lock()
	defer roomsLock.Unlock()

	for roomID, room := range gameRooms {
		room.Mutex.Lock()
		if len(room.Players) < maxPlayers {
			room.Mutex.Unlock()
			return roomID
		}
		room.Mutex.Unlock()
	}

	roomID := fmt.Sprintf("room-%d", roomCount)
	roomCount++
	gameRooms[roomID] = &GameRoom{
		Grid:    createGrid(),
		Players: make(map[*websocket.Conn][2]int),
	}
	return roomID
}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	roomID := assignRoom()
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	log.Println("New connection from", conn.RemoteAddr())
	room := gameRooms[roomID]
	gridMessage := GridMessage{
		Type:  "grid_init",
		Cells: room.Grid,
	}
	conn.WriteJSON(gridMessage)
	log.Printf("Sending grid message: %+v\n", gridMessage)

	type PlayerIDMessage struct {
		Type     string `json:"type"`
		PlayerID string `json:"player_id"`
	}

	// send new player their id
	playerID := fmt.Sprintf("%p", conn)
	message := PlayerIDMessage{
		Type:     "player_id",
		PlayerID: playerID,
	}

	log.Printf("Sending player ID message: %+v\n", message)

	err = conn.WriteJSON(message)
	if err != nil {
		log.Println("Error sending player ID:", err)
		return
	}

	// sends players that are in room to new connection.
	for existingConn, pos := range room.Players {
		playerUpdate := PlayerUpdateMessage{
			Type:           "spawn_player",
			PlayerID:       fmt.Sprintf("%p", existingConn),
			PlayerPosition: pos,
		}
		conn.WriteJSON(playerUpdate)
	}

	spawnPositions := [][2]int{
		{0, 0}, {0, 10},
		{10, 0}, {10, 10},
	}
	playerCount := len(room.Players)
	spawnPosition := spawnPositions[playerCount]

	room.Mutex.Lock()
	room.Players[conn] = spawnPosition
	room.Mutex.Unlock()

	defer func() {
		room.Mutex.Lock()
		delete(room.Players, conn)
		room.Mutex.Unlock()
		conn.Close()
	}()

	// sends info of new player to everyone in room.
	newPlayerUpdate := PlayerUpdateMessage{
		Type:           "spawn_player",
		PlayerID:       fmt.Sprintf("%p", conn),
		PlayerPosition: spawnPosition,
	}
	broadcastToRoom(room, newPlayerUpdate)

	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error from", conn.RemoteAddr(), ":", err)
			break
		}
		log.Printf("Received data from %s: %s (size: %d bytes)\n", conn.RemoteAddr(), string(p), len(p))
		handleMessage(conn, room, p)
	}
}

func handleMovePlayer(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var moveMsg struct {
		PlayerPosition [2]int `json:"playerPosition"`
	}

	if err := json.Unmarshal(messageData, &moveMsg); err != nil {
		log.Println("Error decoding move message:", err)
		return
	}

	room.Mutex.Lock()
	room.Players[conn] = moveMsg.PlayerPosition
	room.Mutex.Unlock()

	broadcastPlayerUpdate(room, conn, room.Players[conn])
}

func handleBombSet(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	room.Mutex.Lock()
	playerPos, exists := room.Players[conn]
	if !exists {
		room.Mutex.Unlock()
		log.Println("Player not found in room")
		return
	}
	bomb := Bomb{
		Position: playerPos,
		Owner:    conn,
		Timer:    time.Now(),
	}
	room.Bombs = append(room.Bombs, bomb)
	room.Mutex.Unlock()

	bombMessage := struct {
		Type         string `json:"type"`
		BombPosition [2]int `json:"bombPosition"`
	}{
		Type:         "bomb_set",
		BombPosition: [2]int{playerPos[0], playerPos[1]},
	}

	broadcastToRoom(room, bombMessage)
	log.Printf("Bomb placed by %p at [%d, %d]\n", conn, playerPos[0], playerPos[1])

	go func(pos [2]int, room *GameRoom) {
		time.Sleep(3 * time.Second)
		explodeBomb(room, pos)
	}(playerPos, room)
}

func explodeBomb(room *GameRoom, pos [2]int) {
	log.Printf("Bomb exploded at [%d, %d]\n", pos[0], pos[1])

	explosionMessage := struct {
		Type         string `json:"type"`
		BombPosition [2]int `json:"bombPosition"`
	}{
		Type:         "bomb_explode",
		BombPosition: [2]int{pos[0], pos[1]},
	}
	broadcastToRoom(room, explosionMessage)
	destroyWalls(room, pos)
}

func destroyWalls(room *GameRoom, pos [2]int) {
	room.Mutex.Lock()
	directions := []struct{ dx, dy int }{{0, -1}, {0, 1}, {-1, 0}, {1, 0}}
	destroyedCells := [][2]int{}
	for _, d := range directions {
		newX, newY := pos[0]+d.dx, pos[1]+d.dy
		if newX >= 0 && newX < len(room.Grid) && newY >= 0 && newY < len(room.Grid[0]) {
			if room.Grid[newX][newY] == 1 {
				room.Grid[newX][newY] = 0
				destroyedCells = append(destroyedCells, [2]int{newX, newY})
			}
		}
	}
	room.Mutex.Unlock()
	if len(destroyedCells) > 0 {
		broadcastToRoom(room, struct {
			Type           string   `json:"type"`
			DestroyedCells [][2]int `json:"destroyedCells"`
		}{
			Type:           "walls_destroyed",
			DestroyedCells: destroyedCells,
		})
	}
}

func handleMessage(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var baseMsg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(messageData, &baseMsg); err != nil {
		log.Println("Error decoding JSON type:", err)
		return
	}

	switch baseMsg.Type {
	case "new_player_position":
		handleMovePlayer(conn, room, messageData)
	case "bomb_set":
		handleBombSet(conn, room, messageData)
	default:
		log.Println("Unknown message type:", baseMsg.Type)
	}
}

func broadcastPlayerUpdate(room *GameRoom, sender *websocket.Conn, pos [2]int) {
	updateMessage := PlayerUpdateMessage{
		Type:           "new_player_position",
		PlayerID:       fmt.Sprintf("%p", sender),
		PlayerPosition: pos,
	}
	broadcastToRoom(room, updateMessage)
}

func broadcastToRoom(room *GameRoom, message interface{}) {
	log.Printf("Broadcasting message: %+v\n", message)

	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	for player := range room.Players {
		player.WriteJSON(message)
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func main() {
	http.HandleFunc("/ws", handleConnection)
	log.Println("WebSocket server started at ws://127.0.0.1:8080/ws")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", nil))
}
