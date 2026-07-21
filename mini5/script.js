const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ===== 공 설정 =====
const ballRadius = 8;
let x = canvas.width / 2;
let y = canvas.height - 30;
// 속도는 크기(스칼라)로 관리 → 반사 각도만 바꿔도 일정 속도 유지
const BALL_SPEED = 4.2;
let dx = BALL_SPEED * Math.cos(Math.PI / 4);
let dy = -BALL_SPEED * Math.sin(Math.PI / 4);

// ===== 패들 설정 =====
let paddleHeight = 10;
let paddleWidth = 80;
let paddleX = (canvas.width - paddleWidth) / 2;
let rightPressed = false;
let leftPressed = false;

// ===== 브릭 설정 =====
const brickRowCount = 5;
const brickColumnCount = 6; // 화면 넘침 방지용(가운데 정렬)
const brickPadding = 10;
const brickHeight = 20;
const brickOffsetTop = 40;
// 가운데 정렬: 총 가로폭 = col*(W+pad) - pad
const BRICK_WIDTH_GAP = 50; // 기준 폭(픽셀)
const brickWidth =
  Math.min(
    BRICK_WIDTH_GAP,
    Math.floor((canvas.width - brickPadding * (brickColumnCount - 1)) / brickColumnCount)
  );
const bricksTotalWidth = brickColumnCount * (brickWidth + brickPadding) - brickPadding;
const brickOffsetLeft = (canvas.width - bricksTotalWidth) / 2;

let bricks = [];
for (let c = 0; c < brickColumnCount; c++) {
  bricks[c] = [];
  for (let r = 0; r < brickRowCount; r++) {
    // hp: 1~3 랜덤
    const hp = Math.floor(Math.random() * 3) + 1;
    bricks[c][r] = { x: 0, y: 0, hp, alive: true };
  }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
canvas.addEventListener("touchmove", touchMoveHandler, { passive: true });

function keyDownHandler(e) {
  if (e.key === "Right" || e.key === "ArrowRight") rightPressed = true;
  else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = true;
}

function keyUpHandler(e) {
  if (e.key === "Right" || e.key === "ArrowRight") rightPressed = false;
  else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = false;
}

function touchMoveHandler(e) {
  const rect = canvas.getBoundingClientRect();
  let touchX = e.touches[0].clientX - rect.left;
  paddleX = touchX - paddleWidth / 2;
  // 캔버스 밖으로 못 나가게
  paddleX = Math.max(0, Math.min(canvas.width - paddleWidth, paddleX));
}

// 내구도별 색상
function brickColor(hp) {
  if (hp >= 3) return "#ff5252"; // 빨강(단단)
  if (hp === 2) return "#ffb74d"; // 주황
  return "#4dd0e1";               // 하늘색(약함)
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#0f0";
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.beginPath();
  ctx.rect(paddleX, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
  ctx.fillStyle = "#0f0";
  ctx.fill();
  ctx.closePath();
}

function drawBricks() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      const b = bricks[c][r];
      if (!b.alive) continue;
      const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
      const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
      b.x = brickX;
      b.y = brickY;
      ctx.beginPath();
      ctx.rect(brickX, brickY, brickWidth, brickHeight);
      ctx.fillStyle = brickColor(b.hp);
      ctx.fill();
      ctx.closePath();
    }
  }
}

function collisionWithBricks() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      const b = bricks[c][r];
      if (!b.alive) continue;

      // AABB 충돌
      const withinX = x + ballRadius > b.x && x - ballRadius < b.x + brickWidth;
      const withinY = y + ballRadius > b.y && y - ballRadius < b.y + brickHeight;

      if (withinX && withinY) {
        // 간단한 충돌 반응: 어디서 들어왔는지에 따라 축 반전
        const prevX = x - dx;
        const prevY = y - dy;
        const wasAbove = prevY + ballRadius <= b.y;
        const wasBelow = prevY - ballRadius >= b.y + brickHeight;
        if (wasAbove || wasBelow) {
          dy = -dy;
        } else {
          dx = -dx;
        }

        // 내구도 감소
        b.hp -= 1;
        if (b.hp <= 0) b.alive = false;

        // 약간의 속도 상한 유지 (너무 빨라지지 않게)
        const speed = Math.hypot(dx, dy);
        const limit = BALL_SPEED * 1.35;
        if (speed > limit) {
          dx = (dx / speed) * limit;
          dy = (dy / speed) * limit;
        }
        return; // 한 프레임에 하나만 처리
      }
    }
  }
}

function allCleared() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (bricks[c][r].alive) return false;
    }
  }
  return true;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBricks();
  drawBall();
  drawPaddle();
  collisionWithBricks();

  // 좌우 벽
  if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) dx = -dx;

  // 천장
  if (y + dy < ballRadius) dy = -dy;

  // 패들/바닥
  const paddleTop = canvas.height - paddleHeight - 10;
  if (y + dy > paddleTop - ballRadius) {
    // 패들 범위 체크
    if (x > paddleX && x < paddleX + paddleWidth) {
      // ====== (3) 반사 각도: 패들 히트 위치에 따라 ======
      // -1(왼쪽 끝) ~ 1(오른쪽 끝)
      const relative = ((x - paddleX) - paddleWidth / 2) / (paddleWidth / 2);
      const clamped = Math.max(-1, Math.min(1, relative));
      const MAX_ANGLE = (75 * Math.PI) / 180; // 최대 75도
      const angle = clamped * MAX_ANGLE;

      // 일정 속도 유지하며 방향만 변경
      const speed = Math.hypot(dx, dy);
      dx = speed * Math.sin(angle);
      dy = -speed * Math.cos(angle);

      // 공이 패들 안에 박히지 않도록 위치 보정
      y = paddleTop - ballRadius - 0.1;
    } else if (y + dy > canvas.height - ballRadius) {
      alert("게임 오버!");
      document.location.reload();
      return;
    }
  }

  // 위치 업데이트
  x += dx;
  y += dy;

  // 패들 이동
  const paddleSpeed = 6;
  if (rightPressed) paddleX = Math.min(canvas.width - paddleWidth, paddleX + paddleSpeed);
  else if (leftPressed) paddleX = Math.max(0, paddleX - paddleSpeed);

  // 클리어 체크
  if (allCleared()) {
    alert("클리어 🎉");
    document.location.reload();
    return;
  }

  requestAnimationFrame(draw);
}

draw();
