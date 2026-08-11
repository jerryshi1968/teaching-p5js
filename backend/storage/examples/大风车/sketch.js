let rotateAngle = 30;

function setup() {
  createCanvas(600, 600);
  background(20);
  angleMode(DEGREES);
  noFill();
  strokeWeight(2);
}

function draw() {
  background(20, 15); // 拖尾残影效果
  translate(width / 2, height / 2); // 原点移到画布中心
  rotate(rotateAngle);

  // 外层for循环：画5组旋转方框
  for (let layer = 1; layer <= 5; layer++) {
    stroke(50 * layer, 180, 255); // 每层不同颜色

    // 内层for循环：同一层旋转出4个正方形
    for (let count = 0; count < 4; count++) {
      push();
      // 每次旋转固定90度
      rotate(90 * count);
      // 向外平移一段距离
      translate(layer * 40, 0);
      // 绘制正方形
      square(-15, -15, 30);
      pop();
    }
  }

  rotateAngle++;
}