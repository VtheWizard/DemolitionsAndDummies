import { Application, Graphics, Text, TextStyle, Sprite, Assets } from "pixi.js";

(async() => {

const app = new Application();

await app.init({
    //width: 800,
    //height: 600,
    resizeTo: window,
    backgroundColor: 0x1099bb,
    backgroundAlpha: 0.9
});
app.stage.sortableChildren = true;
app.canvas.style.position = "absolute";
document.body.appendChild(app.canvas);

const maxHeight = window.innerHeight - 5;
const maxWidht = window.innerWidth - 5;
const speed = 3;
const gridSize = 50;
const gridRows = 10;
const gridCols = 10;
let p1velocityX = 0;
let p1velocityY = 0;
let p2velocityX = 0;
let p2velocityY = 0;
let speedmodifier = 1;
let localPlayerCount = 1;

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
    //player 1 on arrows and player 2 on wasd
    switch (event.key) {
        case "ArrowUp": p1velocityY = 0; break;
        case "ArrowDown": p1velocityY = 0; break;
        case "ArrowLeft": p1velocityX = 0; break;
        case "ArrowRight": p1velocityX = 0; break;
        case "w": p2velocityY = 0; break;
        case "s": p2velocityY = 0; break;
        case "a": p2velocityX = 0; break;
        case "d": p2velocityX = 0; break;
    }
});

const style = new TextStyle({
    fontFamily: "Comic Sans MS",
    fontSize: 34,
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 3
});

const text = new Text({
    text: "window.width = " + maxWidht + " / window.height = " + maxHeight,
    style: style,
    position: {
        x: 50,
        y: 0
    }
});
app.stage.addChild(text);

const Player1 = new Graphics()
    .rect(0, 0, 50, 75) //x,y,width,height
    .fill({
    color: 0xff0000,
    alpha: 0.9
    })
    .stroke({
    color: 0x000000,
    width: 6
    });
app.stage.addChild(Player1);

const Player2 = new Graphics()
        .rect(0, 0, 50, 75) //x,y,width,height
        .fill({
        color: 0x00ff00,
        alpha: 0.9
        })
        .stroke({
        color: 0x000000,
        width: 6
        });
app.stage.addChild(Player2);

//testing how to slap an image on a sprite        
const texture = await Assets.load('/images/sesu.png');
const sprite = Sprite.from(texture);
sprite.scale = 0.2
sprite.position._x = 250;
sprite.position._y = 250;
app.stage.addChild(sprite);

//the grid
const grid = new Graphics();
    grid.lineStyle(3, 0x000000, 0.9);
    for (let i = 0; i <= gridCols; i++) {
        grid.moveTo(i * gridSize, 0);
        grid.lineTo(i * gridSize, gridRows * gridSize);
    }
    for (let j = 0; j <= gridRows; j++) {
        grid.moveTo(0, j * gridSize);
        grid.lineTo(gridCols * gridSize, j * gridSize);
    }
app.stage.addChild(grid);

//borders
const borders = new Graphics();
    borders.lineStyle(4, 0x000000);
    borders.drawRect(0, 0, gridCols, gridSize, gridRows * gridSize);
app.stage.addChild(borders);

document.body.appendChild(app.canvas);

    //ticker
app.ticker.add(() => {
    //player 1 movement
    Player1.x += p1velocityX * speedmodifier;
    Player1.y += p1velocityY * speedmodifier;
    if (Player1.x < 0){
        Player1.x = maxWidht / 2 - Player1.width / 2;
    }
    if (Player1.x > maxWidht - Player1.width){
        Player1.x = maxWidht / 2 - Player1.width / 2;
    }
    if (Player1.y < 0){
        Player1.y = maxHeight/2 - Player1.height/2;
    }
    if (Player1.y > maxHeight- Player1.height){
        Player1.y = maxHeight/2 - Player1.height/2;
    } 

    //player 2 movement
    Player2.x += p2velocityX * speedmodifier;
    Player2.y += p2velocityY * speedmodifier;
    if (Player2.x < 0){
        Player2.x = maxWidht / 2 - Player2.width / 2;
    }
    if (Player2.x > maxWidht - Player2.width){
        Player2.x = maxWidht / 2 - Player2.width / 2;
    }
    if (Player2.y < 0){
        Player2.y = maxHeight/2 - Player2.height/2;
    }
    if (Player2.y > maxHeight- Player2.height){
        Player2.y = maxHeight/2 - Player2.height/2;
    } 
    
});

})();