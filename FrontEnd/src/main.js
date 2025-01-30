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
const speed = 1;
const gridSpriteSize = 50;
const gridSize = 10;
let p1velocityX = 0;
let p1velocityY = 0;
let p2velocityX = 0;
let p2velocityY = 0;
let speedmodifier = 1;
let localPlayerCount = 1;

//the grid
for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++){
        const gridTexture = await Assets.load('/images/gridSpritePng.png');
        const gridSprite = Sprite.from(gridTexture);
        gridSprite.x = col * (gridSpriteSize + 1);
        gridSprite.y = row * (gridSpriteSize + 1);
        app.stage.addChild(gridSprite);
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
        case "p": localPlayerBombDrop(1);
        case "v": localPlayerBombDrop(2);
    }
});

function localPlayerBombDrop(playerNumber) {
    if (playerNumber === 1){
        let bomb1 = new Sprite(Assets.get('/images/sesu.png'));
        bomb1.position.set(Player1.x + 20, Player1.y + 20);
        bomb1.anchor.set(0.5);
        bomb1.scale = 0.02;
        app.stage.addChild(bomb1);
    }else{
        if (playerNumber === 2){
            let bomb2 = new Sprite(Assets.get('/images/sesu.png'));
            bomb2.position.set(Player2.x + 20, Player2.y + 20);
            bomb2.anchor.set(0.5);
            bomb2.scale = 0.02;
            app.stage.addChild(bomb2);
        }
    }
}


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
    .rect(0, 0, 30, 30) //x,y,width,height
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
        .rect(0, 0, 30, 30) //x,y,width,height
        .fill({
        color: 0x00ff00,
        alpha: 0.9
        })
        .stroke({
        color: 0x000000,
        width: 6
        });
app.stage.addChild(Player2);

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
