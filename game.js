// Main game loop (ES6 module)
import { Player, Enemy, Coin, rectIntersect } from './entities.js';
import { showMenu, loadScore, saveScore, setScore } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Input handling
const input = { left: false, right: false, up: false, down: false };
window.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': input.left = true; break;
    case 'ArrowRight': case 'd': input.right = true; break;
    case 'ArrowUp': case 'w': input.up = true; break;
    case 'ArrowDown': case 's': input.down = true; break;
  }
});
window.addEventListener('keyup', e => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': input.left = false; break;
    case 'ArrowRight': case 'd': input.right = false; break;
    case 'ArrowUp': case 'w': input.up = false; break;
    case 'ArrowDown': case 's': input.down = false; break;
  }
});

const levels = [
  // Level 1
  {
    player: { x: 80, y: 500 },
    enemies: [{ x: 400, y: 500 }],
    coins: [{ x: 250, y: 400 }]
  },
  // Level 2
  {
    player: { x: 80, y: 300 },
    enemies: [{ x: 300, y: 300 }, { x: 600, y: 300 }],
    coins: [{ x: 200, y: 200 }, { x: 500, y: 150 }]
  }
];

let currentLevel = 0;
let player, enemies, coins;
let score = loadScore();

function initLevel(idx) {
  const lvl = levels[idx];
  player = new Player(lvl.player.x, lvl.player.y);
  enemies = lvl.enemies.map(e => new Enemy(e.x, e.y));
  coins = lvl.coins.map(c => new Coin(c.x, c.y));
  setScore(score);
}

let lastTime = 0;
function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Update
  player.update(dt, input);
  enemies.forEach(e => e.update(dt));
  coins.forEach(c => c.update(dt));

  // Collision: player vs coin
  coins.forEach(c => {
    if (!c.collected && rectIntersect(player, c)) {
      c.collect();
      score += c.value;
      setScore(score);
      saveScore(score);
    }
  });

  // Render background
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#2b2b3d');
  grad.addColorStop(1, '#1e1e2f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Draw entities
  player.draw(ctx);
  enemies.forEach(e => e.draw(ctx));
  coins.forEach(c => c.draw(ctx));

  // Level transition
  if (coins.every(c => c.collected)) {
    currentLevel++;
    if (currentLevel < levels.length) {
      initLevel(currentLevel);
    } else {
      // Game complete – show menu again
      showMenu(() => {
        currentLevel = 0;
        initLevel(currentLevel);
      });
    }
  }

  requestAnimationFrame(loop);
}

// Start – show menu first
showMenu(() => {
  initLevel(currentLevel);
  requestAnimationFrame(loop);
});
