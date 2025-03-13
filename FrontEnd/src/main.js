import { Application, Graphics, Text, TextStyle, Sprite, Assets, Container } from "pixi.js";

(async() => {

const app = new Application();

await app.init({
    //width: 800,
    //height: 600,
    resizeTo: window,
    backgroundColor: 0x223344,
    backgroundAlpha: 0.9
});
app.stage.sortableChildren = true;
app.canvas.style.position = "absolute";
document.body.appendChild(app.canvas);

const menuSize = 200;
const speed = 1;
const gridSpriteSize = 50;
const onlineCellSize = 40;
const gridSize = 11;
const playerSize = 30;
const maxHeight = gridSize * (gridSpriteSize + 1);
const maxWidht = gridSize * (gridSpriteSize + 1);
const gridTexture = await Assets.load('/images/gridSpritePng.png');
const unbreakableGridTexture = await Assets.load('/images/gridSpriteUnbreakable.png');
const bombTexture = await Assets.load('/images/bomb.png');
const onlineCellTextureEmpty =  await Assets.load('/images/onlineCellSpriteEmpty.png');
const onlineCellTextureBreakable = await Assets.load('/images/onlineCellSpriteBreakable.png');
const onlineCellTextureUnbreakable = await Assets.load('/images/onlineCellSpriteUnbreakable.png');
const eventTarget = new EventTarget();
const playerList = {};
const textStyle = new TextStyle({
    fontSize: 32,
    fill: 0xffffff,
    fontWeight: 'bold'
})
const Player1 = new Graphics()
    .rect(0, 0, playerSize, playerSize) //x,y,width,height
    .fill({
    color: 0xff0000,
    alpha: 0.9
    })
    .stroke({
    color: 0x000000,
    width: 2
    });
Player1.zIndex = 999;
Player1.pivot.set(0.5, 0.5);

const Player2 = new Graphics()
    .rect(0, 0, playerSize, playerSize) //x,y,width,height
    .fill({
    color: 0x00ff00,
    alpha: 0.9
    })
    .stroke({
    color: 0x000000,
    width: 2
    });
Player2.zIndex = 998;
Player2.pivot.set(0.5, 0.5);

let playerName = "dummy";
let p1velocityX = 0;
let p1velocityY = 0;
let lastSentPosition = {row: 0, col: 0};
let p2velocityX = 0;
let p2velocityY = 0;
let speedmodifier = 0.9;
let connectionToServer = false;
let socket;
let onlineTexture;
let gridDeleted = false;
let myPlayerID = "0xc000000000";


//----------------------------------------------------------------

// creating grid for local game
function createLocalGrid(){
    const localGridSprites = [];
    for (let row = 0; row < gridSize; row++) {
        localGridSprites[row] = [];
        for (let col = 0; col < gridSize; col++) {
            const gridSprite = Sprite.from(gridTexture);
            gridSprite.x = col * (gridSpriteSize + 1);
            gridSprite.y = row * (gridSpriteSize + 1);
            app.stage.addChild(gridSprite);
            localGridSprites[row][col] = gridSprite; //add reference
            eventTarget.addEventListener('delete_grid', (event) => {
                app.stage.removeChild(gridSprite);
            });
        }
    }
    // loop for swapping unbreakable walls' textures
    for (let row = 1; row < gridSize; row+=2) {
        for (let col = 1; col < gridSize; col+=2){
            localGridSprites[row][col].texture = unbreakableGridTexture;
            eventTarget.addEventListener('delete_grid', (event) => {
                localGridSprites[row][col].texture = gridTexture;
            });
        }
    }
}


//function to remove a specific grid cell in local mode
function removeLocalCell(col, row){
    if (localGridSprites[row] && localGridSprites[row][col]){
        app.stage.removeChild(localGridSprites[row][col]);
        localGridSprites[row][col] = null; //clear reference
    }
}

window.addEventListener("keydown", (event)=>{
    //player 1 is on arrow keys and player 2 on wasd
    switch (event.key) {
        case "ArrowUp": p1velocityY = -speed;   break;
        case "ArrowDown": p1velocityY = speed;  break;
        case "ArrowLeft": p1velocityX = -speed; break;
        case "ArrowRight": p1velocityX = speed; break;
        case "w": p2velocityY = -speed;         break;
        case "s": p2velocityY = speed;          break;
        case "a": p2velocityX = -speed;         break;
        case "d": p2velocityX = speed;          break;
    }
});

window.addEventListener("keyup", (event)=>{
    //player 1 on arrows and player 2 on wasd, bomb drops are on v and p keys respectively
    switch (event.key) {
        case "ArrowUp": p1velocityY = 0;        break;
        case "ArrowDown": p1velocityY = 0;      break;
        case "ArrowLeft": p1velocityX = 0;      break;
        case "ArrowRight": p1velocityX = 0;     break;
        case "w": p2velocityY = 0;              break;
        case "s": p2velocityY = 0;              break;
        case "a": p2velocityX = 0;              break;
        case "d": p2velocityX = 0;              break;
        case "p": localPlayerBombDrop(1);       break;
        case "v": localPlayerBombDrop(2);       break;
        case "i": gameOver();            break;
    }
});

function deleteGrid() {
    const event = new CustomEvent('delete_grid');
    eventTarget.dispatchEvent(event);
    gridDeleted = true;
}

const onlineGridSprites =  [];
function createOnlineGrid(cells){
    console.log("creating online grid with arrays");
    for (let row = 0; row < cells.length; row++) {
        onlineGridSprites[row] = [];
        for (let col = 0; col < cells[row].length; col++){
            if (cells[row][col] === 0) {
                onlineTexture = onlineCellTextureEmpty;
            }else if (cells[row][col] === 1) {
                onlineTexture = onlineCellTextureBreakable;
            } else {
                onlineTexture = onlineCellTextureUnbreakable;
            }
            const onlineCell = Sprite.from(onlineTexture);
            onlineCell.x = col * (onlineCellSize);
            onlineCell.y = row * (onlineCellSize);
            app.stage.addChild(onlineCell);
            onlineGridSprites[row][col] = onlineCell; //add reference
        }
    }
    Player1.position.set(10, 10);
    //Player2.position.set(350,350);
}

//bomb dropping function. player center seems to be off by a few pixels for some reason...
function localPlayerBombDrop(playerNumber) {
    let snappedX = 0;
    let snappedY = 0;
    if (playerNumber === 1) {
        let playerX = Player1.x;
        let playerY = Player1.y;
        if (!connectionToServer) {
            snappedX = Math.round(playerX / gridSpriteSize) * gridSpriteSize + gridSpriteSize / 2;
            snappedY = Math.round(playerY / gridSpriteSize) * gridSpriteSize + gridSpriteSize / 2;            
        }else{
            snappedX = Math.round(playerX / onlineCellSize) * onlineCellSize + onlineCellSize / 2;
            snappedY = Math.round(playerY / onlineCellSize) * onlineCellSize + onlineCellSize / 2;            
            let p1Row = Math.floor((Player1.y + playerSize / 2) / onlineCellSize);
            let p1Col = Math.floor((Player1.x + playerSize / 2) / onlineCellSize);
            console.log("col: ", p1Col, " row: ", p1Row);
        }
        if (connectionToServer === true) {
            //send bomb position to server
            socket.send(JSON.stringify({ type: "bomb_set" }));
            //return; //commented out while not recieving bomb drop message from server
        }
    } else {
        let playerX = Player2.x;
        let playerY = Player2.y;
        if (connectionToServer === false) {
            snappedX = Math.round(playerX / gridSpriteSize) * gridSpriteSize + gridSpriteSize / 2;
            snappedY = Math.round(playerY / gridSpriteSize) * gridSpriteSize + gridSpriteSize / 2;
        }else{
            snappedX = Math.round(playerX / onlineCellSize) * onlineCellSize + onlineCellSize / 2;
            snappedY = Math.round(playerY / onlineCellSize) * onlineCellSize + onlineCellSize / 2;
        }
    }
    if (!connectionToServer) {
        dropBomb(snappedX, snappedY); 
    }
       
}
function onlineDropBomb(bombPosition) {
    let x = onlineCellSize * bombPosition[1]  + (onlineCellSize / 2);
    let y = onlineCellSize * bombPosition[0]  + (onlineCellSize / 2);
    dropBomb(x, y);
}

function destroyCells(destroyedCells) {
    for (let i = 0; i < destroyedCells.length; i++) {
        let col = destroyedCells[i][0];
        let row = destroyedCells[i][1];
        onlineGridSprites[col][row].texture = onlineCellTextureEmpty;
        console.log("destroyed cell; " + col + " " + row);
    }
}

function dropBomb(x,y) {
    const bomb = new Sprite(bombTexture);
    bomb.position.set(x, y);
    bomb.anchor.set(0.5, 0.5);
    app.stage.addChild(bomb);
    setTimeout(() => {
        app.stage.removeChild(bomb);
    }, 2000);
}

function spawnPlayer(playerID, playerPosition){
    console.log("spawning player at: ", playerPosition);
    if (!playerList[playerID]){ //if player doesn't exist
        const newPlayer = new Graphics()
        .rect(0, 0, playerSize, playerSize)
        .fill({ 
            color: 0x0000ff,
            alpha: 0.9
        })  
        .stroke({ 
            color: 0x000000, 
            width: 2 
        });
        newPlayer.zIndex =997;
        newPlayer.pivot.set(0.5, 0.5);
        newPlayer.position.set(playerPosition[1] * onlineCellSize, playerPosition[0] * onlineCellSize);
        app.stage.addChild(newPlayer);
        playerList[playerID] = newPlayer;
    }
    if (playerID === myPlayerID){
        Player1.position.set(playerPosition[1] * onlineCellSize, playerPosition[0] * onlineCellSize);
    } 
}

function movePlayer(playerID, newPosition){
    if (playerID !== myPlayerID){
        playerList[playerID].position.set(newPosition[1] * onlineCellSize, newPosition[0] * onlineCellSize);
    }
}

function wrongMove(wrongPosition){
    Player1.position.set(wrongPosition[1] * onlineCellSize, wrongPosition[0] * onlineCellSize);
}

function gameOver() {
    console.log("Game over");
    const menuContainer = new Container();
    app.stage.addChild(menuContainer);
    const menuBackground = new Graphics()
        .rect(0, 0, app.renderer.width, app.renderer.height)
        .fill({
        color: 0x000000,
        alpha: 0.5
        });
    menuContainer.addChild(menuBackground);
    menuBackground.zIndex = 1000;
    const newGameButton = createButton("Play again?", app.renderer.width / 10, app.renderer.height / 4 - 60, () => {
        console.log("player ready");
        createMenu();
        app.stage.removeChild(newGameButton);
    })
    app.stage.addChild(newGameButton);
}

function connectToServer() {
    if (!connectionToServer){
        socket = new WebSocket('ws://127.0.0.1:8080/ws');
        console.log('attempting to connect to server on port ' + socket);
        socket.onopen = () => {
            console.log('connection established');
            connectionToServer = true;
            deleteGrid();
            app.stage.removeChild(Player2);
        }
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log(message)
            if (message.type == "grid_init") {
                createOnlineGrid(message.cells);
            }
            if (message.type == "bomb_set") {
                onlineDropBomb(message.bombPosition);
            }
            if (message.type == "walls_destroyed") {
                destroyCells(message.destroyedCells)
            }
            if (message.type == "player_id") {
                myPlayerID = message.player_id;
                playerList[message.player_id] = Player1;
            }
            if (message.type == "spawn_player") {
                spawnPlayer(message.player_id, message.playerPosition);
            }
            if (message.type == "new_player_position") {
                movePlayer(message.player_id, message.playerPosition);
            }
            if (message.type == "moved_wrongly"){
                wrongMove(message.playerPosition);
            }
            if (message.type == "game_over") {
                console.log("Game over");
                gameOver();
            }


        }
    }else{
        console.log('already connected to server');
    }
}

//----------------------------------------------------------------

function createButton(label, x, y, callback) {
    const button = new Graphics()
        .rect(0, 0, 300, 60)
        .fill({
            color: 0xffffff,
            alpha: 0.5
        })
        .stroke({
            color: 0x000000,
            width: 2
        });
    button.position.set(x, y);
    button.eventMode = "static";
    button.cursor = "pointer";
    const buttonText = new Text({
        text: label,
        style:textStyle
    });
    buttonText.anchor.set(0.5, 0.5);
    buttonText.position.set(150, 30);
    button.zIndex = 1001;
    button.addChild(buttonText);
    button.on("pointerdown", callback);
    return button;
}

function createMenu(){
    const menuContainer = new Container();
    app.stage.addChild(menuContainer);
    const menuBackground = new Graphics()
        .rect(0, 0, app.renderer.width, app.renderer.height)
        .fill({
        color: 0x000000,
        alpha: 0.5
        });
    menuContainer.addChild(menuBackground);
    menuBackground.zIndex = 1000;
    const localButton = createButton("Local Multiplayer", app.renderer.width / 10, app.renderer.height / 4 - 60, () => {
        connectionToServer = false;
        createLocalGrid();
        app.stage.addChild(Player1);
        Player1.position.set(10,10);
        app.stage.addChild(Player2);
        Player2.position.set(gridSize * gridSpriteSize - 30,gridSize * gridSpriteSize - 30);
        app.stage.removeChild(menuContainer);
        document.body.removeChild(nameInput);
        }
    );
    const onlineButton = createButton("Online Multiplayer", app.renderer.width / 10, app.renderer.height / 4 + 60, () => {
            connectToServer();
            app.stage.removeChild(menuContainer);
            playerName = nameInput.value.trim();
            console.log("player name: ",playerName);
            document.body.removeChild(nameInput);
        }
    );
    menuContainer.addChild(localButton);
    menuContainer.addChild(onlineButton);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter your name";
    nameInput.style.position = "absolute";
    nameInput.style.top = `${app.renderer.height / 4}px`;
    nameInput.style.left = `${app.renderer.width / 10}px`;
    nameInput.style.width = "275px";
    nameInput.style.height = "30px";
    nameInput.style.fontSize = "24px";
    nameInput.style.textAlign = "center";
    nameInput.style.border = "3px solid #ffffff"; 
    nameInput.style.background = "rgba(0, 0, 0, 0.8)";
    nameInput.style.color = "#ffffff";
    nameInput.style.padding = "10px";
    nameInput.style.borderRadius = "10px";
    nameInput.style.outline = "none";
    nameInput.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.5)";
    nameInput.style.zIndex = "10000";
    document.body.appendChild(nameInput);

}
createMenu();

//---------------------------------------------------------------

document.body.appendChild(app.canvas);

//ticker
app.ticker.add(() => {
    app.ticker.maxFPS = 60;
    app.ticker.minFPS = 60;
    //console.log("FPS at the time of last tick: ",app.ticker.FPS.toString()); //uncomment to show fps in console
    
    //player 1 movement
    Player1.x += p1velocityX * speedmodifier;
    Player1.y += p1velocityY * speedmodifier;
    //added if gridDeleted to unrestrict the local games boundaries
    if (gridDeleted === false) {
        if (Player1.x < 0){
            Player1.x -= p1velocityX * speedmodifier;
        }
        if (Player1.x > maxWidht - Player1.width){
            Player1.x -= p1velocityX * speedmodifier;
        }
        if (Player1.y < 0){
            Player1.y -= p1velocityY * speedmodifier;
        }
        if (Player1.y > maxHeight- Player1.height){
            Player1.y -= p1velocityY * speedmodifier;
        } 
    }
    //checking if player1 moved to another cell
    let p1Row = ((Player1.y) / onlineCellSize); //remove Math.round when server can handle floats
    let p1Col = ((Player1.x) / onlineCellSize);

    if (gridDeleted !==false) {
        if (p1Row !== lastSentPosition.row || p1Col !== lastSentPosition.col){
            let message = JSON.stringify({type: "new_player_position", playerPosition: [lastSentPosition.row, lastSentPosition.col]});
            socket.send(message);
            //console.log(message);
            lastSentPosition.row = p1Row;
            lastSentPosition.col = p1Col;
        }
    }
    
    //player 2 movement
    Player2.x += p2velocityX * speedmodifier;
    Player2.y += p2velocityY * speedmodifier;
    //added if gridDeleted to unrestrict the local games boundaries
    if (gridDeleted === false) {
        if (Player2.x < 0){
            Player2.x -= p2velocityX * speedmodifier;
        }
        if (Player2.x > maxWidht - Player2.width){
            Player2.x -= p2velocityX * speedmodifier;
        }
        if (Player2.y < 0){
            Player2.y = p2velocityY * speedmodifier;
        }
        if (Player2.y > maxHeight- Player2.height){
            Player2.y -= p2velocityY * speedmodifier;
        } 
    }    
});
})();
