package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

const (
	rows       = 10
	cols       = 10
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

type PlayerMoveMessage struct {
	NewPlayerPosition struct {
		Row int `json:"row"`
		Col int `json:"col"`
	} `json:"new_player_position"`
}

type PlayerUpdateMessage struct {
	Type        string   `json:"type"`
	PlayerID    string   `json:"player_id"`
	NewPosition Position `json:"new_position"`
}

type GameRoom struct {
	Grid    [][]int
	Players map[*websocket.Conn]Position
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
			} else {
				grid[row][col] = 1 // wall
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
			log.Println("Read error:", err)
			break
		}
		movePlayer(conn, room, p)
	}
}

func movePlayer(conn *websocket.Conn, room *GameRoom, messageData []byte) {
	var moveMsg PlayerMoveMessage
	if err := json.Unmarshal(messageData, &moveMsg); err != nil {
		log.Println("Error decoding JSON:", err)
		return
	}
	room.Mutex.Lock()
	newPos := Position{X: moveMsg.NewPlayerPosition.Row, Y: moveMsg.NewPlayerPosition.Col}
	room.Players[conn] = newPos
	room.Mutex.Unlock()
	broadcastPlayerUpdate(room, conn, newPos)
}

func broadcastPlayerUpdate(room *GameRoom, sender *websocket.Conn, position Position) {
	updateMessage := PlayerUpdateMessage{
		Type:        "new_player_position",
		PlayerID:    fmt.Sprintf("%p", sender),
		NewPosition: position,
	}
	broadcastToRoom(room, updateMessage)
}

func broadcastToRoom(room *GameRoom, message interface{}) {
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
