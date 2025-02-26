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
```