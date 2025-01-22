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

const maxHeight = window.innerHeight - 5;
const maxWidht = window.innerWidth - 5;
const speed = 3;
let p1velocityX = 0;
let p1velocityY = 0;
let p2velocityX = 0;
let p2velocityY = 0;
let speedmodifier = 1;
let playercount = 1;


window.addEventListener("keydown", (event)=>{
    
    //player 1 is on arrow keys
    if(event.key === "ArrowUp"){
        p1velocityY = -speed;
    }
    if(event.key === "ArrowDown"){        
        p1velocityY = speed;
    }
    if(event.key === "ArrowLeft"){        
        p1velocityX = -speed;
    }
    if(event.key === "ArrowRight"){        
        p1velocityX = speed;
    }

    //player 2 is on "wasd"
    if(event.key === "w"){
        p2velocityY = -speed;
    }
    if(event.key === "s"){        
        p2velocityY = speed;
    }
    if(event.key === "a"){        
        p2velocityX = -speed;
    }
    if(event.key === "d"){        
        p2velocityX = speed;
    }
});

function isColliding(rect, spr){
    const intersects = rect.x < spr.x + spr.width &&
        rect.x + rect.width > spr.x &&
        rect.y < spr.y + spr.height &&
        rect.y + rect.height > spr.y;
    return intersects;
}

function newPlayer(){
    app.stage.addChild(Player2);
}

window.addEventListener("keyup", (event)=>{
    //player 1 on arrows
    if(event.key === "ArrowUp"){        
        p1velocityY = 0;
    }
    if(event.key === "ArrowDown"){        
        p1velocityY = 0;
    }
    if(event.key === "ArrowLeft"){        
        p1velocityX = 0;
    }
    if(event.key === "ArrowRight"){        
        p1velocityX = 0;
    }
    //player 2 on wasd
    if(event.key === "w"){        
        p2velocityY = 0;
    }
    if(event.key === "s"){        
        p2velocityY = 0;
    }
    if(event.key === "a"){        
        p2velocityX = 0;
    }
    if(event.key === "d"){        
        p2velocityX = 0;
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

const rectangle = new Graphics()
    .rect(0, 0, 50, 75) //x,y,width,height
    .fill({
    color: 0xff0000,
    alpha: 0.9
    })
    .stroke({
    color: 0x000000,
    width: 6
    });
app.stage.addChild(rectangle);

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

const texture = await Assets.load('/images/sesu.png');
const sprite = Sprite.from(texture);
sprite.scale = 0.2
sprite.position._x = 250;
sprite.position._y = 250;
app.stage.addChild(sprite);

document.body.appendChild(app.canvas);

app.ticker.add(() => {

    /*if (isColliding(rectangle, sprite)) {
        rectangle.tint = 0x00ff00; // Change color on collision
    }else {
        rectangle.tint = 0xff0000; // Reset color
    }*/

    if (playercount==1){
        if (isColliding(rectangle, sprite)){
            console.log("colliding");
            playercount++;
            newPlayer();
        }else{
            console.log("not colliding");
        }
    }

    rectangle.x += p1velocityX * speedmodifier;
    rectangle.y += p1velocityY * speedmodifier;
    if (rectangle.x < 0){
        rectangle.x = maxWidht / 2 - rectangle.width / 2;
    }
    if (rectangle.x > maxWidht - rectangle.width){
        rectangle.x = maxWidht / 2 - rectangle.width / 2;
    }
    if (rectangle.y < 0){
        rectangle.y = maxHeight/2 - rectangle.height/2;
    }
    if (rectangle.y > maxHeight- rectangle.height){
        rectangle.y = maxHeight/2 - rectangle.height/2;
    } 

    if (playercount ==2){
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
    }
});

})();