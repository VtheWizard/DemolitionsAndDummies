package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

const (
	rows = 10
	cols = 10
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

var upgrader = websocket.Upgrader{
	// allow all origins for development
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var grid [][]int

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// new connection
	fmt.Printf("new connection\n")
	gridMessage := GridMessage{
		Type:  "grid_init",
		Cells: grid,
	}
	err = conn.WriteJSON(gridMessage)
	if err != nil {
		log.Println("Error sending grid message:", err)
	}

	playerSpawnPosition := Position{
		X: 0,
		Y: 0,
	}
	playerSpawnMessage := Message{
		Type:     "new_player_position",
		Position: playerSpawnPosition,
	}
	err = conn.WriteJSON(playerSpawnMessage)
	if err != nil {
		log.Printf("Error sending spawn position: %v\n", err)
	}

	defer conn.Close()
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		// when data is recevived
		fmt.Printf("Received: %s\n", p)
		movePlayer(conn)

		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Println("Error writing message:", err)
			break
		}
	}
}

func movePlayer(conn *websocket.Conn) {
	playerNewPosition := Position{
		X: 0,
		Y: 1,
	}
	message := Message{
		Type:     "new_player_position",
		Position: playerNewPosition,
	}
	err := conn.WriteJSON(message)
	if err != nil {
		log.Printf("Error sending spawn position: %v\n", err)
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

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

func createGrid() {
	grid = make([][]int, rows)
	for i := range grid {
		grid[i] = make([]int, cols)
	}

	// Fill the grid with 1 (wall) and 0 (empty) based on adjacency to corners
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
}

func main() {
	createGrid()

	http.HandleFunc("/ws", handleConnection)
	log.Println("WebSocket server started at ws://127.0.0.1:8080/ws")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", nil))
}
