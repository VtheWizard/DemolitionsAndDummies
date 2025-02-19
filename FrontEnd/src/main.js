import { Application, Graphics, Text, TextStyle, Sprite, Assets } from "pixi.js";

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
const onlineCellTexture =  await Assets.load('/images/onlineCellSprite.png');
const onlineCellTexture2 = await Assets.load('/images/onlineCellSprite2.png');
const eventTarget = new EventTarget();
let p1velocityX = 0;
let p1velocityY = 0;
let lastSentPositionP1 = {row: -1, col: -1};
let lastSentPositionP2 = {row: -1, col: -1};
let p2velocityX = 0;
let p2velocityY = 0;
let speedmodifier = 1;
let connectionToServer = false;
let socket;
let gridDeleted = false;

//the grid
for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++){        
        const gridSprite = Sprite.from(gridTexture);
        gridSprite.x = col * (gridSpriteSize + 1);
        gridSprite.y = row * (gridSpriteSize + 1);
        app.stage.addChild(gridSprite);
        eventTarget.addEventListener('delete_grid', (event) => {
            app.stage.removeChild(gridSprite);
        });
    }
}
//unbreakable walls
for (let row = 1; row < gridSize; row+=2) {
    for (let col = 1; col < gridSize; col+=2){
        //still needs collision detection and similar restraints to player movement as with the borders of the grid       
        const gridSprite = Sprite.from(unbreakableGridTexture);
        gridSprite.x = col * (gridSpriteSize + 1);
        gridSprite.y = row * (gridSpriteSize + 1);
        app.stage.addChild(gridSprite);
        eventTarget.addEventListener('delete_grid', (event) => {
            app.stage.removeChild(gridSprite);
        });
    }
}

window.addEventListener("keydown", (event)=>{
    //player 1 is on arrow keys and player 2 on wasd
    switch (event.key) {
        case "ArrowUp": p1velocityY = -speed; break;
        case "ArrowDown": p1velocityY = speed; break;
        case "ArrowLeft": p1velocityX = -speed; break;
        case "ArrowRight": p1velocityX = speed; break;
        case "w": p2velocityY = -speed; break;
        case "s": p2velocityY = speed; break;
        case "a": p2velocityX = -speed; break;
        case "d": p2velocityX = speed; break;
    }
});

window.addEventListener("keyup", (event)=>{
    //player 1 on arrows and player 2 on wasd, bomb drops are on v and p keys respectively
    switch (event.key) {
        case "ArrowUp": p1velocityY = 0; break;
        case "ArrowDown": p1velocityY = 0; break;
        case "ArrowLeft": p1velocityX = 0; break;
        case "ArrowRight": p1velocityX = 0; break;
        case "w": p2velocityY = 0; break;
        case "s": p2velocityY = 0; break;
        case "a": p2velocityX = 0; break;
        case "d": p2velocityX = 0; break;
        case "p": localPlayerBombDrop(1); break;
        case "v": localPlayerBombDrop(2); break;
        case "i": connectToServer(); break;
        //case "o": deleteGrid(); break;
    }
});

function deleteGrid() {
    const event = new CustomEvent('delete_grid');
    eventTarget.dispatchEvent(event);
}

//creating new grid for online gamemode with smaller cellsizes based on server settings for game size
function createOnlineGrid(cells) {
    console.log("creating online grid from server settings");
    for (let row = 0; row < cells[0].length; row++) {
        for (let col = 0; col < cells.length; col++) {
            const onlineTexture = cells[row][col] === 1 ? onlineCellTexture : onlineCellTexture2;
            const onlineCell = Sprite.from(onlineTexture);
            onlineCell.x = col * (onlineCellSize);
            onlineCell.y = row * (onlineCellSize);
            app.stage.addChild(onlineCell);
        }
    }
    Player1.position.set(10, 10);
    Player2.position.set(350,350);
    
}

//bomb dropping function. player center seems to be off by a few pixels for some reason...
function localPlayerBombDrop(playerNumber) {
    const bomb = new Sprite(bombTexture);
    if (playerNumber === 1) {
        let playerX = Player1.x;
        let playerY = Player1.y;
        if (connectionToServer === false) {
            let snappedX = Math.round(playerX / (gridSpriteSize + 1)) * (gridSpriteSize + 1) + gridSpriteSize / 2;
            let snappedY = Math.round(playerY / (gridSpriteSize + 1)) * (gridSpriteSize + 1) + gridSpriteSize / 2;
            bomb.position.set(snappedX, snappedY);
        }else{
            let snappedX = Math.round(playerX / (onlineCellSize + 1)) * (onlineCellSize + 1) + onlineCellSize / 2;
            let snappedY = Math.round(playerY / (onlineCellSize + 1)) * (onlineCellSize + 1) + onlineCellSize / 2;
            bomb.position.set(snappedX - 2, snappedY - 2);
        }
        /*if (connectionToServer === true) {
            //send bomb position to server
            socket.send(JSON.stringify({
                type: 'bomb_set', bomb_location: [1, 0]
            }));
        }*/
    } else {
        let playerX = Player2.x;
        let playerY = Player2.y;
        if (connectionToServer === false) {
            let snappedX = Math.round(playerX / (gridSpriteSize + 1)) * (gridSpriteSize + 1) + gridSpriteSize / 2;
            let snappedY = Math.round(playerY / (gridSpriteSize + 1)) * (gridSpriteSize + 1) + gridSpriteSize / 2;
            bomb.position.set(snappedX, snappedY);
        }else{
            let snappedX = Math.round(playerX / (onlineCellSize + 1)) * (onlineCellSize + 1) + onlineCellSize / 2;
            let snappedY = Math.round(playerY / (onlineCellSize + 1)) * (onlineCellSize + 1) + onlineCellSize / 2;
            bomb.position.set(snappedX - 2, snappedY - 2);
        }
    }
    bomb.anchor.set(0.5);
    app.stage.addChild(bomb);
    setTimeout(() => {
        app.stage.removeChild(bomb);
    }, 2000);    
}
//in comments for now
function connectToServer() {
    if (connectionToServer === false){
        socket = new WebSocket('ws://127.0.0.1:8080/ws');
        console.log('attempting to connect to server on port ' + socket);
        socket.onopen = () => {
            console.log('connection established');
            connectionToServer = true;
            deleteGrid();
        }
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log(message)
            if (message.type == "grid_init") {
                createOnlineGrid(message.cells);
            }
        }
    }else{
        console.log('already connected to server');
    }
}

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
Player1.zIndex = 999
app.stage.addChild(Player1);
Player1.position.set(10,10)

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
Player2.zIndex = 998
app.stage.addChild(Player2);
Player2.position.set(gridSize * gridSpriteSize - 30,gridSize * gridSpriteSize - 30)

document.body.appendChild(app.canvas);

//ticker
app.ticker.add(() => {
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
    let p1Row = Math.floor((Player1.y + playerSize / 2) / onlineCellSize);
    let p1Col = Math.floor((Player1.x + playerSize / 2) / onlineCellSize);

    if (gridDeleted !==false) {
        if (p1Row !== lastSentPositionP1.row || p1Col !== lastSentPositionP1.col){
            socket.send(JSON.stringify({type: "new_player_position", playerPosition: lastSentPositionP1}));
            console.log(JSON.stringify(lastSentPositionP1));
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
    }/*else{
        //checking if player2 moved to another cell
        let p2Row = Math.floor((Player2.y + PlayerSize / 2) / onlineCellSize);
        let p2Col = Math.floor((Player2.x + PlayerSize / 2) / onlineCellSize);
        if (p2Row !== lastSentPositionP2.row || p2Col !== lastSentPositionP2.col){
            socket.send(JSON.stringify({type: "new_player_position", playerPosition: lastSentPositionP2}))
        }
    }*/ //commented out since there is no player 2 for online mode in the version of the backend i have as far as i know...
    
});
})();
