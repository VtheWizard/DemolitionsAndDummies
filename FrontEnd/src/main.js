import { Application } from "pixi.js";

(async() => {

const app = new Application();

await app.init();

document.body.appendChild(app.canvas);


})();
