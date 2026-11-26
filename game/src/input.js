// Skyline Harbor — keyboard and mouse input.
// One clear job: turn keys and pointer movement into flight commands.

export class FlightInput {
  constructor() {
    this.keys = new Set();
    this.mousePitch = 0;
    this.mouseRoll = 0;
    this.pointerLocked = false;
    this.onPause = null;
    this.onRestart = null;
    this.onToggleView = null;
    this.onToggleMute = null;
    this.onToggleHelp = null;
    this.onAnyGesture = null;
    this.onStart = null;
    this.canvas = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (this.onAnyGesture) this.onAnyGesture();
      if (event.code === 'KeyP') this.onPause?.();
      if (event.code === 'KeyR') this.onRestart?.();
      if (event.code === 'KeyC') this.onToggleView?.();
      if (event.code === 'KeyM') this.onToggleMute?.();
      if (event.code === 'KeyH') this.onToggleHelp?.();
      if (event.code === 'Enter' || event.code === 'Space') this.onStart?.();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (this.onAnyGesture) this.onAnyGesture();
      if (!this.pointerLocked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) return;
      // Fine aim: mouse nudges pitch and roll, then decays in the frame step.
      this.mouseRoll += event.movementX * 0.0016;
      this.mousePitch -= event.movementY * 0.0012;
      this.mouseRoll = Math.max(-0.6, Math.min(0.6, this.mouseRoll));
      this.mousePitch = Math.max(-0.5, Math.min(0.5, this.mousePitch));
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Per-frame flight commands, in -1..1 where it applies.
  readCommands() {
    const pitchUp = this.isDown('ArrowUp') || this.isDown('KeyW');
    const pitchDown = this.isDown('ArrowDown') || this.isDown('KeyS');
    const rollLeft = this.isDown('ArrowLeft') || this.isDown('KeyA');
    const rollRight = this.isDown('ArrowRight') || this.isDown('KeyD');
    const commands = {
      pitch: (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0),
      roll: (rollRight ? 1 : 0) - (rollLeft ? 1 : 0),
      yaw: (this.isDown('KeyE') ? 1 : 0) - (this.isDown('KeyQ') ? 1 : 0),
      throttleUp: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      throttleDown: this.isDown('ControlLeft') || this.isDown('ControlRight'),
      boost: this.isDown('Space'),
      mousePitch: this.mousePitch,
      mouseRoll: this.mouseRoll,
    };
    // Mouse trim decays so a flick steers briefly instead of latching.
    this.mousePitch *= 0.86;
    this.mouseRoll *= 0.86;
    return commands;
  }
}
