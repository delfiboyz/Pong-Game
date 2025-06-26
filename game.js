const canvas = document.getElementById('pong-canvas');
const ctx = canvas.getContext('2d');

// Game settings
const paddleWidth = 15;
const paddleHeight = 100;
const ballRadius = 12;
const playerX = 20;
const aiX = canvas.width - playerX - paddleWidth;
let playerY = canvas.height / 2 - paddleHeight / 2;
let aiY = canvas.height / 2 - paddleHeight / 2;
let playerScore = 0;
let aiScore = 0;

// Ball settings
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeed = 6;
let ballVelX = ballSpeed * (Math.random() > 0.5 ? 1 : -1);
let ballVelY = ballSpeed * (Math.random() * 2 - 1);

// Mouse control
canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    playerY = mouseY - paddleHeight / 2;
    // Clamp within canvas
    if (playerY < 0) playerY = 0;
    if (playerY > canvas.height - paddleHeight) playerY = canvas.height - paddleHeight;
});

// Main game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    // Ball movement
    ballX += ballVelX;
    ballY += ballVelY;

    // Top/bottom wall collision
    if (ballY - ballRadius < 0) {
        ballY = ballRadius;
        ballVelY *= -1;
    }
    if (ballY + ballRadius > canvas.height) {
        ballY = canvas.height - ballRadius;
        ballVelY *= -1;
    }

    // Left paddle collision
    if (
        ballX - ballRadius < playerX + paddleWidth &&
        ballY + ballRadius > playerY &&
        ballY - ballRadius < playerY + paddleHeight
    ) {
        ballX = playerX + paddleWidth + ballRadius;
        ballVelX *= -1;

        // Add effect based on hit position
        let collidePoint = ballY - (playerY + paddleHeight / 2);
        collidePoint /= paddleHeight / 2;
        let angle = collidePoint * Math.PI / 4;
        let direction = 1;
        ballVelX = direction * ballSpeed * Math.cos(angle);
        ballVelY = ballSpeed * Math.sin(angle);
    }

    // Right paddle collision (AI)
    if (
        ballX + ballRadius > aiX &&
        ballY + ballRadius > aiY &&
        ballY - ballRadius < aiY + paddleHeight
    ) {
        ballX = aiX - ballRadius;
        ballVelX *= -1;

        let collidePoint = ballY - (aiY + paddleHeight / 2);
        collidePoint /= paddleHeight / 2;
        let angle = collidePoint * Math.PI / 4;
        let direction = -1;
        ballVelX = direction * ballSpeed * Math.cos(angle);
        ballVelY = ballSpeed * Math.sin(angle);
    }

    // Score update & reset
    if (ballX - ballRadius < 0) {
        aiScore++;
        resetBall(-1);
    }
    if (ballX + ballRadius > canvas.width) {
        playerScore++;
        resetBall(1);
    }

    // Simple AI movement
    let targetY = ballY - paddleHeight / 2;
    let aiSpeed = Math.abs(ballVelX) > 7 ? 7 : 5;
    if (aiY + paddleHeight / 2 < targetY) aiY += aiSpeed;
    else if (aiY + paddleHeight / 2 > targetY) aiY -= aiSpeed;
    // Clamp AI paddle
    if (aiY < 0) aiY = 0;
    if (aiY > canvas.height - paddleHeight) aiY = canvas.height - paddleHeight;
}

// Reset ball to center after score
function resetBall(direction) {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballVelX = ballSpeed * direction;
    ballVelY = ballSpeed * (Math.random() * 2 - 1);
}

// Draw everything
function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw net
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = "#fff";
    ctx.fillRect(playerX, playerY, paddleWidth, paddleHeight);
    ctx.fillRect(aiX, aiY, paddleWidth, paddleHeight);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();

    // Draw scores
    ctx.font = "40px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(playerScore, canvas.width / 2 - 80, 50);
    ctx.fillText(aiScore, canvas.width / 2 + 50, 50);
}

// Start game
gameLoop();