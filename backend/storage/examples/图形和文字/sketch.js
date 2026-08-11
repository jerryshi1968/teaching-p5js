function setup() {
  createCanvas(600, 400);
  background(220);
  textSize(20);
}

function draw() {
  stroke('red');
  strokeWeight(3);
  line(5, 10, 520, 330);

  stroke(120, 255, 240);
  strokeWeight(10);
  line(40, 320, 580, 30);

  stroke('black');
  strokeWeight(1);
  fill('green');
  square(10, 10, 80);
  text('正方形', 20, 120);

  rect(130, 10, 120, 80);
  text('长方形', 140, 120);

  fill(0, 255, 0);
  quad(310, 10, 440, 30, 460, 90, 280, 120);
  text('四边形', 380, 120);

  fill(255, 0, 0);
  circle(50, 200, 80);
  text('圆', 40, 270);

  ellipse(230, 200, 120, 80);
  text('椭圆', 210, 270);

  fill('yellow')
  triangle(360,150, 320,240, 480,250);
  text('三角形', 360, 270);

  noStroke();
  fill(0, 0, 255);
  arc(50, 330, 120, 80, -2 * PI/3, PI/6);
  text('圆弧(CHORD)', 40, 390);

  arc(200, 330, 120, 80, -2 * PI/3, PI/6, PIE);
  text('圆弧(PIE)', 200, 390);

  arc(380, 330, 120, 80, -2 * PI/3, PI/6, OPEN);
  text('圆弧(OPEN)', 340, 390);
}