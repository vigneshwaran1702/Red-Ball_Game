// UI handling for the Red Ball web game

// ----- HUD ----- //
const scoreEl = document.getElementById('score');

export function loadScore() {
  const stored = localStorage.getItem('redBallScore');
  return stored ? parseInt(stored, 10) : 0;
}
export function saveScore(val) {
  localStorage.setItem('redBallScore', val);
}
export function setScore(val) {
  scoreEl.textContent = `Score: ${val}`;
}

// ----- Menu ----- //
const menuOverlay = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
let startCallback = null;

startBtn.addEventListener('click', () => {
  if (startCallback) startCallback();
  menuOverlay.style.display = 'none';
});

export function showMenu(cb) {
  startCallback = cb;
  menuOverlay.style.display = 'flex';
}
