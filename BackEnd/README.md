```json
{
  "type": "grid_init",
  "cells": [
    [...],
     ... ,
    [...],
  ]
}

{
  "type": "player_id",
  "player_id": "0xc0000c0160"
}

{
  "type": "spawn_player",
  "player_id": "0xc0000c0160",
  "playerPosition": [0, 10]
}

{
  "type": "set_player_nick",
  "player_id": "0xc0000c0160",
  "player_nick": "john"
}

{
  "type": "game_starting",
}

{
  "type": "game_started",
}

{
  "type": "players_hit",
  "player_ids": ["0xc0000c0160", "0xc0000c62c0"],
}

{
  "type": "game_won",
  "player_id": "0xc0000c0160",
}

{
  "type": "no_winner",
}

{
  "type": "new_player_position",
  "player_id": "0xc0000c0160",
  "playerPosition": [1, 10]
}

{
  "type": "bomb_set",
  "bombPosition": [2, 10]
}

{
  "type": "bomb_explode",
  "bombPosition": [2, 10]
}

{
  "type": "walls_destroyed",
  "destroyedCells": [
    [2, 9],
    [3, 10]
  ]
}

{ 
  "type": "moved_wrongly",
  "playerPosition": [ 1, 0 ] 
}

{ 
  "type": "player_disconnected",
  "player_id": "0xc0000c62c0"
}
​

```