let x = 50, y = 50;
let vx = 4, vy = 2;
let r = 30; // 使用半径 r 代替 D/2，计算更直观

// 矩形盒子参数 (X, Y, 宽度, 高度)
const box = { x: 200, y: 120, w: 220, h: 150 };

function setup() {
  createCanvas(600, 400);
}

function draw() {
  background(220);

  // 1. 绘制中间盒子
  fill('yellow');
  stroke(0, 163, 215);
  strokeWeight(4);
  rect(box.x, box.y, box.w, box.h);

  // 2. 绘制小球
  noStroke();
  fill('red');
  circle(x, y, r * 2);

  // 3. 位置更新
  x += vx;
  y += vy;

  // 4. 外墙反弹逻辑（包含位置修正，防止震荡卡死）
  if (x - r <= 0) { x = r; vx = -vx; }
  if (x + r >= width) { x = width - r; vx = -vx; }
  if (y - r <= 0) { y = r; vy = -vy; }
  if (y + r >= height) { y = height - r; vy = -vy; }

  // 5. 中间盒子碰撞检测（圆与矩形 AABB 最近点碰撞）
  checkBoxCollision();
}

// 更加精准且简短的矩形碰撞函数（可完美处理四边及顶点碰撞）
function checkBoxCollision() {
  // 找到矩形上距离圆心最近的点 (cx, cy)
  let cx = constrain(x, box.x, box.x + box.w);
  let cy = constrain(y, box.y, box.y + box.h);

  // 计算圆心到最近点的距离
  let dx = x - cx;
  let dy = y - cy;
  let distSq = dx * dx + dy * dy;

  // 如果距离小于半径，说明发生碰撞
  if (distSq < r * r) {
    // 优先反弹距离最近的方向
    if (Math.abs(dx) > Math.abs(dy)) {
      vx = -vx;
      x = cx + Math.sign(dx) * r; // 位置推开
    } else {
      vy = -vy;
      y = cy + Math.sign(dy) * r; // 位置推开
    }
  }
}