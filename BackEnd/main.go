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
	maxPlayers = 2 // 2 for easier testing
)

type GridMessage struct {
	Type  string  `json:"type"`
	Cells [][]int `json:"cells"` // 2D grid of cells, 1 is wall, 0 is empty
}

type PlayerUpdateMessage struct {
	Type           string     `json:"type"`
	PlayerID       string     `json:"player_id"`
	PlayerPosition [2]float64 `json:"playerPosition"`
}

type movedWronglyMessage struct {
	Type           string     `json:"type"`
	PlayerPosition [2]float64 `json:"playerPosition"`
}

type Bomb struct {
	Position [2]int
	Owner    *websocket.Conn
	Timer    time.Time
}

type GameRoom struct {
	Grid        [][]int
	Players     map[*websocket.Conn][2]float64
	PlayerNicks map[*websocket.Conn]string
	Spectators  map[*websocket.Conn]bool
	Bombs       []Bomb
	Mutex       sync.Mutex
	State       string
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
		if len(room.Players) < maxPlayers && room.State == "waiting" {
			room.Mutex.Unlock()
			return roomID
		}
		room.Mutex.Unlock()
	}

	roomID := fmt.Sprintf("room-%d", roomCount)
	roomCount++
	gameRooms[roomID] = &GameRoom{
		Grid:        createGrid(),
		Players:     make(map[*websocket.Conn][2]float64),
		PlayerNicks: make(map[*websocket.Conn]string),
		Spectators:  make(map[*websocket.Conn]bool),
		State:       "waiting",
	}
	return roomID
}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	log.Println("New connection from", conn.RemoteAddr())

	// assign room to new connection
	roomID := assignRoom()
	room := gameRooms[roomID]

	// send grid to new connection
	sendGrid(conn, room)

	// send player id to new connection
	sendPlayerID(conn)

	// send info of existing players to new connection
	sendExistingPlayers(conn, room)

	// send info of new player to everyone in room
	sendNewPlayerToRoom(conn, room)

	// start game when room is full
	startGameWhenFull(room, roomID)

	defer func() {
		broadcastPlayerDisconnect(room, conn)
		room.Mutex.Lock()
		delete(room.Players, conn)
		isEmpty := len(room.Players) == 0
		room.Mutex.Unlock()
		conn.Close()

		if isEmpty {
			removeRoom(roomID)
		}
	}()

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

func broadcastPlayerDisconnect(room *GameRoom, conn *websocket.Conn) {
	playerID := fmt.Sprintf("%p", conn)
	disconnectMessage := struct {
		Type     string `json:"type"`
		PlayerID string `json:"player_id"`
	}{
		Type:     "player_disconnected",
		PlayerID: playerID,
	}
	broadcastToRoom(room, disconnectMessage)
	log.Printf("Player %s disconnected\n", playerID)
}

func removeRoom(roomID string) {
	roomsLock.Lock()
	defer roomsLock.Unlock()
	delete(gameRooms, roomID)
	log.Printf("Room %s removed\n", roomID)
}

func startGameWhenFull(room *GameRoom, roomID string) {
	room.Mutex.Lock()
	if len(room.Players) == maxPlayers {
		room.State = "starting"
		log.Printf("Room %s state changed to starting\n", roomID)
		gameStartingMessage := struct {
			Type string `json:"type"`
		}{
			Type: "game_starting",
		}
		room.Mutex.Unlock()
		broadcastToRoom(room, gameStartingMessage)
		room.Mutex.Lock()
		go func(room *GameRoom) {
			time.Sleep(3 * time.Second)
			room.Mutex.Lock()
			room.State = "ongoing"
			room.Mutex.Unlock()
			log.Printf("Room %s state changed to ongoing\n", roomID)

			gameStartedMessage := struct {
				Type string `json:"type"`
			}{
				Type: "game_started",
			}
			broadcastToRoom(room, gameStartedMessage)
		}(room)
	}
	room.Mutex.Unlock()

	log.Printf("Room %s has %d players\n", roomID, len(room.Players))
}

func sendNewPlayerToRoom(conn *websocket.Conn, room *GameRoom) {
	spawnPositions := [][2]float64{
		{0, 0}, {0, 10},
		{10, 0}, {10, 10},
	}
	playerCount := len(room.Players)
	spawnPosition := spawnPositions[playerCount]

	room.Mutex.Lock()
	room.Players[conn] = spawnPosition
	room.Mutex.Unlock()

	newPlayerUpdate := PlayerUpdateMessage{
		Type:           "spawn_player",
		PlayerID:       fmt.Sprintf("%p", conn),
		PlayerPosition: [2]float64{float64(spawnPosition[0]), float64(spawnPosition[1])},
	}
	broadcastToRoom(room, newPlayerUpdate)
}

func sendExistingPlayers(conn *websocket.Conn, room *GameRoom) {
	for existingConn, pos := range room.Players {
		playerUpdate := PlayerUpdateMessage{
			Type:           "spawn_player",
			PlayerID:       fmt.Sprintf("%p", existingConn),
			PlayerPosition: [2]float64{float64(pos[0]), float64(pos[1])},
		}
		conn.WriteJSON(playerUpdate)
	}
}

func sendPlayerID(conn *websocket.Conn) {
	type PlayerIDMessage struct {
		Type     string `json:"type"`
		PlayerID string `json:"player_id"`
	}

	playerID := fmt.Sprintf("%p", conn)
	message := PlayerIDMessage{
		Type:     "player_id",
		PlayerID: playerID,
	}
	err := conn.WriteJSON(message)
	if err != nil {
		log.Println("Error sending player ID:", err)
		return
	}

	log.Printf("Sending player ID message: %+v\n", message)

}

func sendGrid(conn *websocket.Conn, room *GameRoom) {
	gridMessage := GridMessage{
		Type:  "grid_init",
		Cells: room.Grid,
	}
	conn.WriteJSON(gridMessage)
	log.Printf("Sending grid message: %+v\n", gridMessage)
}

func handleMovePlayer(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var moveMsg struct {
		PlayerPosition [2]float64 `json:"playerPosition"`
	}

	if err := json.Unmarshal(messageData, &moveMsg); err != nil {
		log.Println("Error decoding move message:", err)
		return
	}

	newPosition := moveMsg.PlayerPosition
	playerPosition := room.Players[conn]
	intNewPosition := [2]int{int(newPosition[0]), int(newPosition[1])}
	intPlayerPosition := [2]int{int(playerPosition[0]), int(playerPosition[1])}

	if !isValidMove(room, intNewPosition, intPlayerPosition) {
		log.Println("Invalid move attempted:", newPosition)
		handleWrongMovement(conn, room.Players[conn])
		return
	}

	room.Mutex.Lock()
	room.Players[conn] = newPosition
	room.Mutex.Unlock()

	broadcastPlayerUpdate(room, conn, room.Players[conn])
}

func handleWrongMovement(sender *websocket.Conn, pos [2]float64) {
	movedWronglymessage := movedWronglyMessage{
		Type:           "moved_wrongly",
		PlayerPosition: pos,
	}
	sender.WriteJSON(movedWronglymessage)
	log.Printf("Sent movedWrongly message to %p, playerPosition: %v", sender, pos)
}

func isValidMove(room *GameRoom, position [2]int, currentPlayerPosition [2]int) bool {
	grid := room.Grid

	// check for out of bounds
	if position[0] < 0 || position[1] < 0 || position[1] >= len(grid) || position[0] >= len(grid[0]) {
		return false
	}

	// check for walls
	if grid[position[0]][position[1]] != 0 {
		return false
	}

	// check that new position is adjacent on player location
	if !isAdjacentOrSame(currentPlayerPosition, position) {
		return false
	}

	return true
}

func isAdjacentOrSame(current [2]int, next [2]int) bool {
	if current == next {
		return true
	}

	dx := abs(current[0] - next[0])
	dy := abs(current[1] - next[1])

	return (dx == 1 && dy == 0) || (dx == 0 && dy == 1)
}

func handleBombSet(conn *websocket.Conn, room *GameRoom) {
	room.Mutex.Lock()
	playerPos, exists := room.Players[conn]
	intPlayerPos := [2]int{int(playerPos[0]), int(playerPos[1])}
	if !exists {
		room.Mutex.Unlock()
		log.Println("Player not found in room")
		return
	}
	bomb := Bomb{
		Position: intPlayerPos,
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
		BombPosition: [2]int{intPlayerPos[0], intPlayerPos[1]},
	}

	broadcastToRoom(room, bombMessage)
	log.Printf("Bomb placed by %p at [%d, %d]\n", conn, intPlayerPos[0], intPlayerPos[1])

	go func(pos [2]int, room *GameRoom) {
		time.Sleep(3 * time.Second)
		explodeBomb(room, pos)
	}(intPlayerPos, room)
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
	checkPlayersHit(room, pos)
	destroyWalls(room, pos)
}

func checkPlayersHit(room *GameRoom, bombPos [2]int) {
	room.Mutex.Lock()
	hitPlayers := []string{}
	for playerConn, playerPos := range room.Players {
		intPlayerPos := [2]int{int(playerPos[0]), int(playerPos[1])}
		if isAdjacentOrSame(intPlayerPos, bombPos) {
			log.Printf("Player %p hit by bomb\n", playerConn)
			room.Spectators[playerConn] = true
			delete(room.Players, playerConn)
			hitPlayers = append(hitPlayers, fmt.Sprintf("%p", playerConn))
		}
	}
	remainingPlayers := len(room.Players)
	room.Mutex.Unlock()

	if len(hitPlayers) > 0 {
		hitPlayersMessage := struct {
			Type      string   `json:"type"`
			PlayerIDs []string `json:"player_ids"`
		}{
			Type:      "players_hit",
			PlayerIDs: hitPlayers,
		}
		broadcastToRoom(room, hitPlayersMessage)
	}

	if remainingPlayers == 1 {
		var winnerConn *websocket.Conn
		for playerConn := range room.Players {
			winnerConn = playerConn
			break
		}
		winnerMessage := struct {
			Type     string `json:"type"`
			PlayerID string `json:"player_id"`
		}{
			Type:     "game_won",
			PlayerID: fmt.Sprintf("%p", winnerConn),
		}
		broadcastToRoom(room, winnerMessage)
		log.Println("Player", fmt.Sprintf("%p", winnerConn), "won the game")
	} else if remainingPlayers == 0 {
		noWinnerMessage := struct {
			Type string `json:"type"`
		}{
			Type: "no_winner",
		}
		broadcastToRoom(room, noWinnerMessage)
		log.Println("No players remaining in the room, no one won")
	}
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
			}
			if room.Grid[newX][newY] != 2 {
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

	// ignore messages if room is not ongoing
	room.Mutex.Lock()
	if room.State != "ongoing" {
		room.Mutex.Unlock()
		log.Println("Room state is not ongoing, message ignored:", baseMsg.Type)
		return
	}
	room.Mutex.Unlock()

	// ignore messages from spectators
	if room.Spectators[conn] {
		log.Println("Spectator message ignored:", baseMsg.Type)
		return
	}

	switch baseMsg.Type {
	case "new_player_position":
		handleMovePlayer(conn, room, messageData)
	case "bomb_set":
		handleBombSet(conn, room)
	case "set_player_nick":
		handleSetPlayerNick(conn, room, messageData)
	default:
		log.Println("Unknown message type:", baseMsg.Type)
	}
}

func handleSetPlayerNick(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var nickMsg struct {
		Type       string `json:"type"`
		PlayerID   string `json:"player_id"`
		PlayerNick string `json:"player_nick"`
	}

	if err := json.Unmarshal(messageData, &nickMsg); err != nil {
		log.Println("Error decoding set player nick message:", err)
		return
	}

	room.Mutex.Lock()
	room.PlayerNicks[conn] = nickMsg.PlayerNick
	room.Mutex.Unlock()

	nickUpdate := struct {
		Type       string `json:"type"`
		PlayerID   string `json:"player_id"`
		PlayerNick string `json:"player_nick"`
	}{
		Type:       "set_player_nick",
		PlayerID:   nickMsg.PlayerID,
		PlayerNick: nickMsg.PlayerNick,
	}

	broadcastToRoom(room, nickUpdate)
	log.Printf("Player %s set their nickname to %s\n", nickMsg.PlayerID, nickMsg.PlayerNick)
}

func broadcastPlayerUpdate(room *GameRoom, sender *websocket.Conn, pos [2]float64) {
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
	for spectator := range room.Spectators {
		spectator.WriteJSON(message)
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
