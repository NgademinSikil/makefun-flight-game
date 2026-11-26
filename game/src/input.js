// input.js — keyboard + mouse for SENJA. Arrow keys / WASD fly the plane,
// Shift / Ctrl work the throttle, C swaps the camera, G the gear, M the sound,
// P pauses. Mouse drag looks around the chase camera. Also tracks one-shot
// key presses (Enter, R, C, G, M, P) the game loop consumes each frame.
export function makeInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDX: 0, mouseDY: 0, dragging: false,
  };

  const KEYMAP = {
    ArrowUp: 'pitchUp', KeyW: 'pitchUp',
    ArrowDown: 'pitchDown', KeyS: 'pitchDown',
    ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
    ArrowRight: 'rollRight', KeyD: 'rollRight',
    ShiftLeft: 'thrUp', ShiftRight: 'thrUp',
    ControlLeft: 'thrDown', ControlRight: 'thrDown',
    KeyC: 'camera', KeyG: 'gear', KeyM: 'mute', KeyP: 'pause',
    Enter: 'start', KeyR: 'restart',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(action);
    input.keys.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.keys.delete(action);
  });
  window.addEventListener('blur', () => input.keys.clear());

  let lastX = 0, lastY = 0;
  window.addEventListener('mousedown', (e) => {
    input.dragging = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.mouseDX += e.clientX - lastX;
    input.mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });

  // Flight axes, -1..1, read by the physics step.
  input.axes = function axes() {
    const pitch = (input.keys.has('pitchUp') ? 1 : 0) - (input.keys.has('pitchDown') ? 1 : 0);
    const roll = (input.keys.has('rollRight') ? 1 : 0) - (input.keys.has('rollLeft') ? 1 : 0);
    const throttle = (input.keys.has('thrUp') ? 1 : 0) - (input.keys.has('thrDown') ? 1 : 0);
    return { pitch, roll, throttle };
  };

  input.consume = function consume(action) {
    if (input.pressed.has(action)) {
      input.pressed.delete(action);
      return true;
    }
    return false;
  };

  input.consumeLook = function consumeLook() {
    const look = { dx: input.mouseDX, dy: input.mouseDY };
    input.mouseDX = 0;
    input.mouseDY = 0;
    return look;
  };

  input.clearPressed = function clearPressed() { input.pressed.clear(); };
  return input;
}
