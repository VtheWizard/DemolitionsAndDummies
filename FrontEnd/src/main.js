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

const speed = 1;
const gridSpriteSize = 50;
const gridSize = 11;
const maxHeight = gridSize * (gridSpriteSize + 1);
const maxWidht = gridSize * (gridSpriteSize + 1);
const bombTexture = await Assets.load('/images/bomb.png');
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
//unbreakable walls
for (let row = 1; row < gridSize; row+=2) {
    for (let col = 1; col < gridSize; col+=2){
        //still needs collision detection and similar restraints to player movement as with the borders of the grid
        const gridTexture = await Assets.load('/images/gridSpriteUnbreakable.png');
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
        case "p": localPlayerBombDrop(1); break;
        case "v": localPlayerBombDrop(2); break;
    }
});

//bomb dropping function.
function localPlayerBombDrop(playerNumber) {
    const bomb = new Sprite(bombTexture);
    if (playerNumber === 1) {
        bomb.position.set(Player1.x + 20, Player1.y + 20);
        app.stage.addChild(bomb);
    } else {
        bomb.position.set(Player2.x + 20, Player2.y + 20);
    }
    bomb.anchor.set(0.5);
    app.stage.addChild(bomb);
    setTimeout(() => {
        app.stage.removeChild(bomb);
    }, 2000);    
}

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
Player1.position.set(10,10)

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
Player1.position.set(gridSize * gridSpriteSize - 30,gridSize * gridSpriteSize - 30)

document.body.appendChild(app.canvas);

//ticker
app.ticker.add(() => {
    //player 1 movement
    Player1.x += p1velocityX * speedmodifier;
    Player1.y += p1velocityY * speedmodifier;
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

    //player 2 movement
    Player2.x += p2velocityX * speedmodifier;
    Player2.y += p2velocityY * speedmodifier;
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
    
});
})();
