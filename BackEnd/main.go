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

type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Message struct {
	Type     string   `json:"type"`
	Position Position `json:"position"`
}

type GridMessage struct {
	Type  string  `json:"type"`
	Cells [][]int `json:"cells"` // 2D grid of cells, 1 is wall, 0 is empty
}

type PlayerUpdateMessage struct {
	Type        string   `json:"type"`
	PlayerID    string   `json:"player_id"`
	NewPosition Position `json:"new_position"`
}

type Bomb struct {
	Position Position
	Owner    *websocket.Conn
	Timer    time.Time
}

type GameRoom struct {
	Grid    [][]int
	Players map[*websocket.Conn]Position
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

func isAdjacentToCorner(row, col int) bool {
	cornerPositions := []Position{
		{0, 0}, {0, cols - 1},
		{rows - 1, 0}, {rows - 1, cols - 1},
	}
	for _, corner := range cornerPositions {
		if (row == corner.X && abs(col-corner.Y) == 1) || (col == corner.Y && abs(row-corner.X) == 1) {
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
				isAdjacentToCorner(row, col) {
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
		Players: make(map[*websocket.Conn]Position),
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
	log.Println("New connection from:", conn.RemoteAddr())

	room := gameRooms[roomID]
	room.Mutex.Lock()
	room.Players[conn] = Position{X: 0, Y: 0}
	room.Mutex.Unlock()

	defer func() {
		room.Mutex.Lock()
		delete(room.Players, conn)
		room.Mutex.Unlock()
		conn.Close()
	}()

	conn.WriteJSON(GridMessage{Type: "grid_init", Cells: room.Grid})
	playerUpdate := PlayerUpdateMessage{Type: "new_player_position", PlayerID: fmt.Sprintf("%p", conn), NewPosition: Position{X: 0, Y: 0}}
	broadcastToRoom(room, playerUpdate)

	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error from", conn.RemoteAddr(), ":", err)
			break
		}
		log.Printf("Received data from %s, size: %d bytes\n", conn.RemoteAddr(), len(p))
		handleMessage(conn, room, p)
	}
}

func handleMovePlayer(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var moveMsg struct {
		PlayerPosition struct {
			Row int `json:"row"`
			Col int `json:"col"`
		} `json:"playerPosition"`
	}

	if err := json.Unmarshal(messageData, &moveMsg); err != nil {
		log.Println("Error decoding move message:", err)
		return
	}

	room.Mutex.Lock()
	room.Players[conn] = Position{X: moveMsg.PlayerPosition.Row, Y: moveMsg.PlayerPosition.Col}
	room.Mutex.Unlock()

	broadcastPlayerUpdate(room, conn, room.Players[conn])
}

func handleBombSet(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var bombMsg struct {
		BombLocation [2]int `json:"bomb_location"`
	}

	if err := json.Unmarshal(messageData, &bombMsg); err != nil {
		log.Println("Error decoding bomb message:", err)
		return
	}

	room.Mutex.Lock()
	newBomb := Bomb{
		Position: Position{X: bombMsg.BombLocation[0], Y: bombMsg.BombLocation[1]},
		Owner:    conn,
		Timer:    time.Now().Add(3 * time.Second),
	}
	room.Bombs = append(room.Bombs, newBomb)
	room.Mutex.Unlock()

	broadcastBombUpdate(room, newBomb.Position)
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

func broadcastPlayerUpdate(room *GameRoom, sender *websocket.Conn, position Position) {
	updateMessage := PlayerUpdateMessage{
		Type:        "new_player_position",
		PlayerID:    fmt.Sprintf("%p", sender),
		NewPosition: position,
	}
	broadcastToRoom(room, updateMessage)
}

func broadcastBombUpdate(room *GameRoom, position Position) {
	msg := struct {
		Type         string   `json:"type"`
		BombPosition Position `json:"bombPosition"`
	}{
		Type:         "bomb_set",
		BombPosition: position,
	}

	broadcastToRoom(room, msg)
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
