const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
// const livesDisplay = document.getElementById('lives-display'); // HTML에서 제거됨

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;

let player;
let bullets = [];
let enemies = [];
let score = 0;
let lives = 3; 
let gameInterval;
let isGameOver = true;

const MIN_ENEMY_SPEED = 1;
const MAX_ENEMY_SPEED = 3.5;

// 키 입력 처리 (변경 없음)
const keys = {
    left: false,
    right: false,
    space: false
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === ' ') {
        if (!keys.space && !isGameOver) {
            player.shoot();
        }
        keys.space = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === ' ') keys.space = false;
});

// **UI 그리기 함수 (점수와 목숨을 캔버스에 직접 그림)**
function drawUI() {
    // 1. 점수 (왼쪽 상단)
    ctx.font = '20px Arial';
    ctx.fillStyle = 'yellow';
    ctx.textAlign = 'left'; 
    ctx.fillText(`점수: ${score}`, 10, 25); 

    // 2. 목숨 (오른쪽 상단)
    ctx.textAlign = 'right';
    let hearts = '';
    for (let i = 0; i < lives; i++) {
        hearts += '❤️'; // 빨간 하트 이모티콘 사용
    }
    ctx.fillText(hearts, CANVAS_WIDTH - 10, 25); // 오른쪽 끝에서 10px 떨어진 곳에 표시
}

// 플레이어 클래스 (변경 없음)
class Player {
    constructor() {
        this.width = 30;
        this.height = 10;
        this.x = (CANVAS_WIDTH - this.width) / 2;
        this.y = CANVAS_HEIGHT - this.height - 10;
        this.speed = 5;
        this.color = 'lime';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        if (keys.left && this.x > 0) {
            this.x -= this.speed;
        }
        if (keys.right && this.x < CANVAS_WIDTH - this.width) {
            this.x += this.speed;
        }
    }

    shoot() {
        bullets.push(new Bullet(this.x + this.width / 2 - 2.5, this.y));
    }
}

// 총알 클래스 (변경 없음)
class Bullet {
    constructor(x, y) {
        this.width = 5;
        this.height = 10;
        this.x = x;
        this.y = y;
        this.speed = 7;
        this.color = 'yellow';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y -= this.speed;
    }
}

// 적 클래스 (색상 및 점수 로직 유지)
class Enemy {
    constructor() {
        this.width = 30;
        this.height = 30;
        this.x = Math.random() * (CANVAS_WIDTH - this.width);
        this.y = -this.height;
        this.speed = Math.random() * (MAX_ENEMY_SPEED - MIN_ENEMY_SPEED) + MIN_ENEMY_SPEED;
        
        const speedRatio = (this.speed - MIN_ENEMY_SPEED) / (MAX_ENEMY_SPEED - MIN_ENEMY_SPEED);
        const red = Math.round(255 * speedRatio); 
        const blue = Math.round(255 * (1 - speedRatio)); 
        this.color = `rgb(${red}, 0, ${blue})`;
        
        if (this.speed < 1.8) {
            this.points = 10;
        } else if (this.speed < 2.8) {
            this.points = 20;
        } else {
            this.points = 30;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y += this.speed;
    }
}

// 게임 초기화 함수
function initGame() {
    player = new Player();
    bullets = [];
    enemies = [];
    score = 0;
    lives = 3;
    isGameOver = false;
    startButton.textContent = "다시 시작";
    startButton.style.display = 'none';

    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (!isGameOver) {
            enemies.push(new Enemy());
        }
    }, 1000);

    gameLoop();
}

// 충돌 감지 함수 (변경 없음)
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// 게임 루프
function gameLoop() {
    if (isGameOver) {
        displayGameOver();
        return;
    }

    // 1. 배경 지우기
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. 게임 객체 업데이트 및 그리기 (플레이어, 총알, 적)
    player.update();
    player.draw();

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.update();
        bullet.draw();

        if (bullet.y < 0) {
            bullets.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        enemy.draw();

        // **적과 플레이어 충돌 처리**
        if (checkCollision(player, enemy)) {
            lives--;
            enemies.splice(i, 1); // 충돌한 적 제거
            
            if (lives <= 0) {
                gameOver();
                return;
            } 
            // **이전 버전의 `bullets = []`와 `continue`를 제거하여 공격 가능하도록 수정**
            continue; 
        }

        if (enemy.y > CANVAS_HEIGHT) {
            enemies.splice(i, 1);
        }

        // 총알과 적 충돌 처리
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            if (checkCollision(bullet, enemy)) {
                bullets.splice(j, 1);
                enemies.splice(i, 1);
                score += enemy.points;
                break;
            }
        }
    }

    // 3. **UI 그리기 (가장 마지막에 호출하여 항상 위에 표시되도록 함)**
    drawUI(); 

    requestAnimationFrame(gameLoop);
}

// 게임 오버 처리 (점수 표시 로직은 drawUI가 처리하도록 변경)
function gameOver() {
    isGameOver = true;
    clearInterval(gameInterval);
    ctx.font = '32px Arial'; 
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('게임 오버!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillText(`최종 점수: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    startButton.style.display = 'block';
}

// 게임 오버 시 화면에 '게임 오버' 메시지 표시
function displayGameOver() {
    // UI를 제외한 나머지 화면을 지우고 게임 오버 메시지 표시
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); 
    
    ctx.font = '32px Arial'; 
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('게임 오버!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillText(`최종 점수: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    
    // 게임 오버 시에도 UI를 그려 최종 점수와 남은 목숨(0)을 표시
    drawUI(); 
}

// 시작 버튼 이벤트 리스너 (변경 없음)
startButton.addEventListener('click', initGame);

// 초기 게임 오버 상태 및 UI 표시
displayGameOver();
startButton.style.display = 'block';

