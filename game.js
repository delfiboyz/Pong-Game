/**
 * Modern Neon Pong
 * Refactored with OOP, State Machine, and Visual Effects
 */

const STATES = {
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
};

const COLORS = {
    BLUE: '#00f2ff',
    PINK: '#ff00ff',
    YELLOW: '#fff200',
    WHITE: '#e0e0e0'
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class Ball {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.radius = 8;
        this.reset();
        this.trail = [];
        this.maxTrail = 10;
    }

    reset(direction = 1) {
        this.x = this.canvasWidth / 2;
        this.y = this.canvasHeight / 2;
        this.baseSpeed = 7;
        this.speed = this.baseSpeed;
        
        const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
        this.velX = direction * this.speed * Math.cos(angle);
        this.velY = this.speed * Math.sin(angle);
        this.trail = [];
    }

    update(dt) {
        // Save trail
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) this.trail.pop();

        // Movement with Delta Time normalization (assumes 60fps base)
        const speedMultiplier = dt / 16.67;
        this.x += this.velX * speedMultiplier;
        this.y += this.velY * speedMultiplier;

        // Top/Bottom bounce
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.velY *= -1;
            return 'wall';
        }
        if (this.y + this.radius > this.canvasHeight) {
            this.y = this.canvasHeight - this.radius;
            this.velY *= -1;
            return 'wall';
        }
        return null;
    }

    draw(ctx) {
        // Draw Trail
        this.trail.forEach((pos, i) => {
            const alpha = 1 - (i / this.maxTrail);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.radius * (1 - i / this.maxTrail), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 242, 0, ${alpha * 0.3})`;
            ctx.fill();
        });

        // Draw Ball
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.YELLOW;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.YELLOW;
        ctx.fill();
        ctx.restore();
    }
}

class Paddle {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.score = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add a highlight line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(this.x + this.width/2 - 1, this.y, 2, this.height);
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('pong-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Fix canvas resolution
        this.width = 800;
        this.height = 500;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.state = STATES.START;
        this.lastTime = 0;
        this.shakeTime = 0;
        
        this.ball = new Ball(this.width, this.height);
        this.player = new Paddle(20, this.height/2 - 50, 12, 100, COLORS.BLUE);
        this.ai = new Paddle(this.width - 32, this.height/2 - 50, 12, 100, COLORS.PINK);
        
        this.particles = [];
        this.keys = {};

        this.initEventListeners();
        this.updateUI();
        requestAnimationFrame(this.loop.bind(this));
    }

    initEventListeners() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'Space') this.togglePause();
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        this.canvas.addEventListener('mousemove', e => {
            if (this.state !== STATES.PLAYING) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            this.player.y = mouseY - this.player.height / 2;
            this.clampPaddle(this.player);
        });

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('resume-btn').onclick = () => this.state = STATES.PLAYING;
        document.getElementById('restart-btn').onclick = () => this.start();
    }

    start() {
        this.player.score = 0;
        this.ai.score = 0;
        this.ball.reset();
        this.state = STATES.PLAYING;
        this.updateUI();
    }

    togglePause() {
        if (this.state === STATES.PLAYING) this.state = STATES.PAUSED;
        else if (this.state === STATES.PAUSED) this.state = STATES.PLAYING;
        this.updateUI();
    }

    clampPaddle(paddle) {
        if (paddle.y < 0) paddle.y = 0;
        if (paddle.y > this.height - paddle.height) paddle.y = this.height - paddle.height;
    }

    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    applyShake() {
        this.shakeTime = 10;
    }

    update(dt) {
        if (this.state !== STATES.PLAYING) return;

        // Player Keyboard Movement
        const paddleSpeed = 8;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.player.y -= paddleSpeed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.player.y += paddleSpeed;
        this.clampPaddle(this.player);

        // AI Movement (Improved with slight delay/smoothness)
        const aiTarget = this.ball.y - this.ai.height / 2;
        const aiSpeed = 5.5 + (this.player.score / 5); // Difficulty scales with score
        if (this.ai.y + this.ai.height / 2 < this.ball.y - 10) this.ai.y += aiSpeed;
        else if (this.ai.y + this.ai.height / 2 > this.ball.y + 10) this.ai.y -= aiSpeed;
        this.clampPaddle(this.ai);

        // Ball Logic
        const collision = this.ball.update(dt);
        if (collision === 'wall') {
            this.createParticles(this.ball.x, this.ball.y, COLORS.WHITE, 5);
        }

        // Paddle Collisions
        this.checkPaddleCollision(this.player, 1);
        this.checkPaddleCollision(this.ai, -1);

        // Scoring
        if (this.ball.x < 0) {
            this.ai.score++;
            this.handleScore(-1);
        } else if (this.ball.x > this.width) {
            this.player.score++;
            this.handleScore(1);
        }

        // Particles
        this.particles.forEach((p, i) => {
            p.update();
            if (p.alpha <= 0) this.particles.splice(i, 1);
        });

        if (this.shakeTime > 0) this.shakeTime--;
    }

    checkPaddleCollision(paddle, direction) {
        const b = this.ball;
        if (
            b.y + b.radius > paddle.y &&
            b.y - b.radius < paddle.y + paddle.height
        ) {
            if (direction === 1 && b.x - b.radius < paddle.x + paddle.width && b.x > paddle.x) {
                this.hitPaddle(paddle, direction);
            } else if (direction === -1 && b.x + b.radius > paddle.x && b.x < paddle.x + paddle.width) {
                this.hitPaddle(paddle, direction);
            }
        }
    }

    hitPaddle(paddle, direction) {
        const b = this.ball;
        b.x = direction === 1 ? paddle.x + paddle.width + b.radius : paddle.x - b.radius;
        
        // Angle calculation
        const collidePoint = (b.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
        const angle = collidePoint * (Math.PI / 3);
        
        b.speed += 0.5; // Dynamic Difficulty
        b.velX = direction * b.speed * Math.cos(angle);
        b.velY = b.speed * Math.sin(angle);

        this.createParticles(b.x, b.y, paddle.color, 15);
        this.applyShake();
    }

    handleScore(direction) {
        this.createParticles(this.ball.x, this.ball.y, direction === 1 ? COLORS.BLUE : COLORS.PINK, 30);
        this.applyShake();
        this.updateUI();
        
        if (this.player.score >= 10 || this.ai.score >= 10) {
            this.gameOver();
        } else {
            this.ball.reset(direction * -1);
        }
    }

    updateUI() {
        document.getElementById('player-score').innerText = this.player.score;
        document.getElementById('ai-score').innerText = this.ai.score;
        
        const overlay = document.getElementById('overlay');
        const screens = ['start-screen', 'pause-screen', 'game-over-screen'];
        
        overlay.classList.remove('visible');
        screens.forEach(id => document.getElementById(id).classList.add('hidden'));

        if (this.state === STATES.START) {
            overlay.classList.add('visible');
            document.getElementById('start-screen').classList.remove('hidden');
        } else if (this.state === STATES.PAUSED) {
            overlay.classList.add('visible');
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (this.state === STATES.GAMEOVER) {
            overlay.classList.add('visible');
            document.getElementById('game-over-screen').classList.remove('hidden');
            const win = this.player.score >= 10;
            document.getElementById('result-text').innerText = win ? "YOU WIN!" : "CPU WINS";
            document.getElementById('result-text').style.color = win ? COLORS.BLUE : COLORS.PINK;
            document.getElementById('final-score-text').innerText = `Final Score: ${this.player.score} - ${this.ai.score}`;
        }
    }

    gameOver() {
        this.state = STATES.GAMEOVER;
        this.updateUI();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.ctx.save();
        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * 10;
            const dy = (Math.random() - 0.5) * 10;
            this.ctx.translate(dx, dy);
        }

        // Draw Midline
        this.ctx.setLineDash([15, 20]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 0);
        this.ctx.lineTo(this.width / 2, this.height);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.player.draw(this.ctx);
        this.ai.draw(this.ctx);
        this.ball.draw(this.ctx);
        this.particles.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    loop(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

// Start Game
window.onload = () => new Game();