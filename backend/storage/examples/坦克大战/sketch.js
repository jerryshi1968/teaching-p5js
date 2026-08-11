// 坦克数据
let tank;
// 子弹数组
let bullets = [];
// 小怪数组
let enemies = [];
// 得分
let score = 500;
let gameState = "PLAYING"; // 游戏状态: PLAYING, WIN, LOSE

function setup() {
  createCanvas(800, 600);
  resetGame();
  // 每1.5秒生成一只小怪
  setInterval(spawnEnemy, 1500);
}

function resetGame() {
  tank = {
    x: width / 2,
    y: height / 2,
    angle: 0,
    speed: 0,
    rotateSpeed: 0.04 // 提高转向速度，比原来快一倍
  };
  bullets = [];
  enemies = [];
  score = 500;
  gameState = "PLAYING";
}

// 绘制分数
function drawScore() {
  fill(255);
  textSize(24);
  textAlign(LEFT, BASELINE);
  text("得分：" + score, 20, 35);
}

// 持续按住空格可连续发射子弹
function keyPressed() {
  if (gameState === "PLAYING" && keyCode === 32) {
    shootBullet();
  }
}
// 配合keyIsPressed实现按住连发
function keyIsDownCheck() {
  if (keyIsDown(32)) {
    shootBullet();
  }
}

function draw() {
  background(100, 140, 60);
  drawScore();

  if (gameState !== "PLAYING") {
    drawGameOver();
    return;
  }

  keyIsDownCheck(); // 每一帧检测空格实现连发

  // 坦克转向控制
  if (keyIsPressed && keyCode === LEFT_ARROW) {
    tank.angle -= tank.rotateSpeed;
  }
  if (keyIsPressed && keyCode === RIGHT_ARROW) {
    tank.angle += tank.rotateSpeed;
  }

  // 坦克前进后退
  if (keyIsPressed && keyCode === UP_ARROW) {
    tank.speed = 2.8;
  } else if (keyIsPressed && keyCode === DOWN_ARROW) {
    tank.speed = -2.8;
  } else {
    tank.speed = 0;
  }

  // 更新坦克位置
  let dx = cos(tank.angle) * tank.speed;
  let dy = sin(tank.angle) * tank.speed;
  tank.x += dx;
  tank.y += dy;
  // 画布边界约束
  tank.x = constrain(tank.x, 40, width - 40);
  tank.y = constrain(tank.y, 40, height - 40);

  // 更新&绘制子弹
  updateBullets();
  // 更新&绘制小怪 + 子弹碰撞检测
  updateEnemies();
  // 绘制坦克
  drawTank(tank.x, tank.y, tank.angle);

  // 判断胜负
  if (score <= 0) {
    score = 0;
    gameState = "LOSE";
  } else if (score >= 1000) {
    gameState = "WIN";
  }
}

// 绘制游戏结束界面及重新开始按钮
function drawGameOver() {
  fill(0, 0, 0, 160);
  rectMode(CORNER);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(36);
  if (gameState === "WIN") {
    text("挑战成功！最终得分: " + score, width / 2, height / 2 - 50);
  } else {
    text("游戏失败！", width / 2, height / 2 - 50);
  }

  // 重新开始按钮
  fill(70, 130, 180);
  rectMode(CENTER);
  rect(width / 2, height / 2 + 30, 160, 50, 10);
  fill(255);
  textSize(20);
  text("重新开始", width / 2, height / 2 + 30);
}

function mousePressed() {
  if (gameState !== "PLAYING") {
    if (mouseX > width / 2 - 80 && mouseX < width / 2 + 80 &&
        mouseY > height / 2 + 30 - 25 && mouseY < height / 2 + 30 + 25) {
      resetGame();
    }
  }
}

// 发射子弹函数
function shootBullet() {
  let bulletX = tank.x + cos(tank.angle) * 40;
  let bulletY = tank.y + sin(tank.angle) * 40;
  bullets.push({
    x: bulletX,
    y: bulletY,
    angle: tank.angle,
    speed: 7
  });
}

// 更新子弹位置，超出屏幕删除
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += cos(b.angle) * b.speed;
    b.y += sin(b.angle) * b.speed;

    // 子弹飞出画面，移除
    if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
      bullets.splice(i, 1);
    }

    // 绘制子弹
    fill(255, 220, 0);
    ellipse(b.x, b.y, 8);
  }
}

// 生成小怪（随机位置）
function spawnEnemy() {
  if (gameState !== "PLAYING") return;
  enemies.push({
    x: random(50, width - 50),
    y: random(50, height - 50),
    size: 30,
    speed: 1.2
  });
}

// 更新小怪、自动朝坦克移动、碰撞检测
function updateEnemies() {
  for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
    let enemy = enemies[eIdx];
    // 小怪朝向坦克移动
    let ang = atan2(tank.y - enemy.y, tank.x - enemy.x);
    enemy.x += cos(ang) * enemy.speed;
    enemy.y += sin(ang) * enemy.speed;

    // 绘制小怪（红色方块）
    fill(180, 30, 30);
    rectMode(CENTER);
    rect(enemy.x, enemy.y, enemy.size, enemy.size);

    // 小怪击中坦克判定（扣10分）
    let distToTank = dist(enemy.x, enemy.y, tank.x, tank.y);
    if (distToTank < enemy.size / 2 + 20) {
      enemies.splice(eIdx, 1);
      score -= 10;
      continue;
    }

    // 子弹击中小怪判定
    for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
      let bullet = bullets[bIdx];
      let distToEnemy = dist(bullet.x, bullet.y, enemy.x, enemy.y);
      if (distToEnemy < enemy.size / 2) {
        // 击中，删除子弹和小怪，加分
        bullets.splice(bIdx, 1);
        enemies.splice(eIdx, 1);
        score += 10;
        break;
      }
    }
  }
}

// 绘制坦克
function drawTank(x, y, angle) {
  push();
  translate(x, y);
  rotate(angle);

  // 履带车身
  fill(50, 60, 50);
  rectMode(CENTER);
  rect(0, 0, 60, 30, 6);
  // 炮塔
  fill(70, 85, 70);
  ellipse(0, 0, 32);
  // 炮管
  fill(40, 45, 40);
  rect(26, 0, 36, 8);
  pop();
}
