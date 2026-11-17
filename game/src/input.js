// Keyboard and mouse state. Modules poll isDown / wasPressed each frame;
// the mouse position is kept in screen pixels and converted by main.js.

const down = new Set();
const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false };

export function initInput(canvas, onFirstGesture) {
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    onFirstGesture();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; onFirstGesture(); }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const isDown = (code) => down.has(code);
export function wasPressed(code) {
  if (!pressed.has(code)) return false;
  pressed.delete(code);
  return true;
}
export function endFrame() { pressed.clear(); }
