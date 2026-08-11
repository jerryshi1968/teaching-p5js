let castle;
let squirrel;
let fox;
let otter;
let tortoise;
let zebra;

function preload() {
  castle = loadImage('assets/images/城堡.png');
  squirrel = loadImage('assets/images/弹琴的松鼠.png');
  fox = loadImage('assets/images/狐狸.png');
  otter = loadImage('assets/images/看书的水獭.png');
  tortoise = loadImage('assets/images/乌龟.png');
  zebra = loadImage('assets/images/斑马.png');
}

function setup() {
  createCanvas(600, 400);
  background('#8df794');
}

function draw() {
  noStroke();
  fill('#00fffb');
  rect(0, 0, 600, 300);
  fill('red');
  circle(500, 100, 50);
  image(castle, 140, 0, 360, 360);
  image(squirrel, 400, 200, 123, 129);
  image(fox, 300, 200, 123, 123);
  image(otter, 250, 240, 70, 90);
  image(tortoise, 300, 300, 74, 61);
  push();
  imageMode(CENTER);
  translate(180, 240);
  scale(-1, 1)
  image(zebra, 0, 0, 200, 200);
  pop();
}