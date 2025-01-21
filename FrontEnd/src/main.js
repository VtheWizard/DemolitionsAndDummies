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
let speedmodifier = 1

app.ticker.add(() => {
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
});

window.addEventListener("keydown", (event)=>{
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
});

window.addEventListener("keyup", (event)=>{
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

const texture = await Assets.load('/images/sesu.png');
const sprite = Sprite.from(texture);
sprite.scale = 0.25
sprite.position._x = 50;
sprite.position._y = 50;
app.stage.addChild(sprite);

document.body.appendChild(app.canvas);
})();