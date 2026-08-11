// ==================== 游戏全局配置 ====================
let gameState = "playing"; // playing / win / lose
let restartDelay = 0;
let score = 0;
const canvasWidth = 1000;
const canvasHeight = 640;

// 火炮配置
let cannon;
let cannonImg;
const cannonWidth = 88;
const cannonHeight = 124;

// 飞机配置
let planes = [];
let planeImgs = [];
const planeTypes = [
  { life: 1, speed: 2, score: 10 },  // 轻型飞机
  { life: 2, speed: 1.5, score: 20 },// 中型飞机
  { life: 5, speed: 1, score: 50 }   // 重型飞机
];

// 子弹配置
let bullets = [];
const bulletSpeed = 8;
const bulletSize = 12;

// 特效配置
let explosions = [];
let explosionImg;
let shootSound, explosionSound, winSound, loseSound;
let bgMusic;

// ==================== 资源预加载 ====================
function preload() {
  // 火炮图片（占位图）
  cannonImg = loadImage('assets/cannon.png');
  
  // 飞机图片（三种不同飞机）
  planeImgs.push(loadImage('assets/plane1.png'));
  planeImgs.push(loadImage('assets/plane2.png'));
  planeImgs.push(loadImage('assets/plane3.png'));
  
  // 爆炸图片
  explosionImg = loadImage('assets/explosion.png');
  
  // 音效（在线音效链接）
  soundFormats('mp3', 'wav');
  shootSound = loadSound('assets/shoot.mp3');
  explosionSound = loadSound('assets/explosion.mp3');
  winSound = loadSound('/teaching-p5js/sound/children-cheer.mp3');
  loseSound = loadSound('/teaching-p5js/sound/failure.mp3');
  bgMusic = loadSound('assets/airplane-battle.mp3');
}

// ==================== 初始化游戏 ====================
function setup() {
  createCanvas(canvasWidth, canvasHeight);
  
  // 初始化火炮（底部中央）
  cannon = {
    x: canvasWidth / 2,
    y: canvasHeight - 60
  };
  
  // 生成初始飞机
  spawnPlanes();
  
  // 播放背景音乐
  bgMusic.loop();
}

// ==================== 生成飞机 ====================
function spawnPlanes() {
  // 生成5-8架随机飞机
  const planeCount = int(random(15, 28));
  for (let i = 0; i < planeCount; i++) {
    const type = int(random(3));
    planes.push({
      x: random(50, width - 50),
      y: random(-1200, -100),
      life: planeTypes[type].life,
      maxLife: planeTypes[type].life,
      speed: planeTypes[type].speed,
      score: planeTypes[type].score,
      img: planeImgs[type],
      width: planeImgs[type].width,
      height: planeImgs[type].height
    });
  }
}

// ==================== 游戏主循环 ====================
function draw() {
  // 深色星空背景
  background(10, 10, 26);
  drawStars();
  
  // 游戏进行中
  if (gameState === "playing") {
    updateGame();
    drawGame();
  } 
  // 游戏胜利
  else if (gameState === "win") {
    if (restartDelay > 0) {
      restartDelay--;
    }
    drawWinScreen();
  } 
  // 游戏失败
  else if (gameState === "lose") {
    if (restartDelay > 0) {
      restartDelay--;
    }
    drawLoseScreen();
  }
}

// ==================== 绘制星空背景 ====================
function drawStars() {
  fill(255);
  for (let i = 0; i < 100; i++) {
    const x = noise(i * 10, frameCount * 0.01) * width;
    const y = noise(i * 20, frameCount * 0.01) * height;
    ellipse(x, y, 2);
  }
}

// ==================== 更新游戏逻辑 ====================
function updateGame() {
  // 控制火炮：跟随鼠标/触摸位置旋转
  updateCannon();
  
  // 更新飞机位置
  updatePlanes();
  
  // 更新子弹
  updateBullets();
  
  // 更新爆炸特效
  updateExplosions();
  
  // 碰撞检测
  checkCollisions();
  
  // 游戏胜利判定：所有飞机被击落
  if (planes.length === 0) {
    gameState = "win";
    restartDelay = 60;
    winSound.play();
    bgMusic.stop();
  }
}

// ==================== 火炮控制 ====================
function updateCannon() {
  cannon.x = mouseX; // 水平跟随鼠标/触摸
  cannon.x = constrain(cannon.x, 50, width - 50); // 边界限制
}

// ==================== 更新飞机 ====================
function updatePlanes() {
  for (let i = planes.length - 1; i >= 0; i--) {
    const plane = planes[i];
    plane.y += plane.speed; // 向下飞行
    
    // 飞机突破防线：游戏失败
    if (plane.y > height) {
      gameState = "lose";
      restartDelay = 60;
      loseSound.play();
      bgMusic.stop();
      planes.splice(i, 1);
    }
  }
}

// ==================== 更新子弹 ====================
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y -= b.vy;
    
    // 超出屏幕移除
    if (b.y < 0 || b.x < 0 || b.x > width) {
      bullets.splice(i, 1);
    }
  }
}

// ==================== 更新爆炸特效 ====================
function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    exp.size += 4; // 爆炸扩散
    exp.alpha -= 5; // 渐隐
    
    if (exp.alpha <= 0) {
      explosions.splice(i, 1);
    }
  }
}

// ================== 子弹击落飞机判断 ==================
function checkCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    for (let j = planes.length - 1; j >= 0; j--) {
      const plane = planes[j];
      
      // 矩形碰撞检测
      if (
        bullet.x > plane.x - plane.width/2 &&
        bullet.x < plane.x + plane.width/2 &&
        bullet.y > plane.y - plane.height/2 &&
        bullet.y < plane.y + plane.height/2
      ) {
        // 飞机减血
        plane.life--;
        
        // 飞机被击毁
        if (plane.life <= 0) {
          // 添加爆炸特效
          explosions.push({
            x: plane.x,
            y: plane.y,
            size: 20,
            alpha: 255
          });
          explosionSound.play();
          score += plane.score;
          planes.splice(j, 1);
        }
        
        bullets.splice(i, 1);
        break;
      }
    }
  }
}

// ==================== 绘制游戏元素 ====================
function drawGame() {
  // 绘制子弹
  drawBullets();
  
  // 绘制飞机
  drawPlanes();
  
  // 绘制爆炸
  drawExplosions();
  
  // 绘制火炮
  drawCannon();
  
  // 绘制UI
  drawUI();
}

// ==================== 绘制火炮 ====================
function drawCannon() {
  push();
  translate(cannon.x, cannon.y);
  imageMode(CENTER);
  image(cannonImg, 0, 0, cannonWidth, cannonHeight);
  pop();
}

// ==================== 绘制子弹 ====================
function drawBullets() {
  for (let b of bullets) {
    // 子弹发光效果
    fill(0, 255, 255);
    noStroke();
    ellipse(b.x, b.y, bulletSize);
    
    // 子弹拖尾
    fill(0, 255, 255, 100);
    ellipse(b.x, b.y + 5, bulletSize * 0.8);
  }
}

// ==================== 绘制飞机 ====================
function drawPlanes() {
  for (let plane of planes) {
    push();
    translate(plane.x, plane.y);
    imageMode(CENTER);
    image(plane.img, 0, 0, plane.width, plane.height);
    
    // 绘制生命值条
    drawLifeBar(plane);
    pop();
  }
}

// ==================== 绘制飞机血条 ====================
function drawLifeBar(plane) {
  const barWidth = plane.width;
  const barHeight = 8;
  const lifePercent = plane.life / plane.maxLife;
  
  // 血条背景
  fill(50);
  rect(-barWidth/2, -25, barWidth, barHeight);
  
  // 血条前景
  fill(lifePercent > 0.6 ? "green" : lifePercent > 0.3 ? "yellow" : "red");
  rect(-barWidth/2, -25, barWidth * lifePercent, barHeight);
}

// ==================== 绘制爆炸 ====================
function drawExplosions() {
  for (let exp of explosions) {
    push();
    translate(exp.x, exp.y);
    tint(255, exp.alpha);
    imageMode(CENTER);
    image(explosionImg, 0, 0, exp.size, exp.size);
    pop();
  }
}

// ==================== 绘制UI ====================
function drawUI() {
  // 分数
  fill(255);
  textSize(28);
  textAlign(LEFT);
  text(`分数: ${score}`, 20, 40);
  
  // 剩余敌机
  text(`敌机: ${planes.length}`, 20, 70);
}

// ==================== 胜利界面 ====================
function drawWinScreen() {
  background(0, 100, 0);
  fill(255, 255, 0);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("🎉 胜利 🎉", width/2, height/2 - 50);
  textSize(36);
  text(`最终分数: ${score}`, width/2, height/2 + 20);
  textSize(24);
  text("点击鼠标重新开始", width/2, height/2 + 70);
}

// ==================== 失败界面 ====================
function drawLoseScreen() {
  background(100, 0, 0);
  fill(255, 0, 0);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("💀 失败 💀", width/2, height/2 - 50);
  textSize(36);
  text(`最终分数: ${score}`, width/2, height/2 + 20);
  textSize(24);
  text("点击鼠标重新开始", width/2, height/2 + 70);
}

// ==================== 发射子弹（鼠标/触摸） ====================
function mousePressed() {
  if (gameState === "playing") {
    // 添加子弹
    bullets.push({
      x: cannon.x,
      y: cannon.y,
      vy: bulletSpeed
    });
    
    // 播放射击音效
    shootSound.play();
  } else {
    // 游戏结束后等待1秒，可以点击重启
    if (restartDelay > 0) return;
    resetGame();
  }
}

// ==================== 重置游戏 ====================
function resetGame() {
  gameState = "playing";
  score = 0;
  planes = [];
  bullets = [];
  explosions = [];
  spawnPlanes();
  bgMusic.loop();
}

// 支持触屏发射
function touchStarted() {
  mousePressed();
  return false; // 阻止默认滚动行为
}