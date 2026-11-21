// Keyboard + mouse input: a held-key set, edge-triggered presses, and mouse aim.
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  return {
    held, mouse,
    down: (...codes) => codes.some((c) => held.has(c)),
    wasPressed: (...codes) => codes.some((c) => pressed.has(c)),
    // Remove a press so later fixed-steps in the same frame don't re-fire it
    // (one E press must never both enter and exit a vehicle).
    consume(code) { pressed.delete(code); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
