// Skyline Harbor — staged screenshot scenes (?shot=1..4).
// One clear job: put the plane, camera and game state where each named
// screenshot needs them, so every shot is reproducible from a URL alone.

import { RING_COURSE } from './config.js';

// Shot 1: title view — plane on the runway, runway and city ahead.
// Shot 2: chase view over downtown at golden hour.
// Shot 3: cockpit view, flying through the first ring.
// Shot 4: action view low over the harbor, bridge ahead.
export const SHOT_NAMES = {
  1: 'title',
  2: 'city-chase',
  3: 'cockpit-ring',
  4: 'harbor-bridge',
};

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = Number.parseInt(params.get('shot') || '', 10);
  return Number.isInteger(shot) && shot >= 1 && shot <= 4 ? shot : 0;
}

export function applyShot(shot, game) {
  const state = game.flight;
  const deg = (d) => (d * Math.PI) / 180;
  if (shot === 1) {
    // Parked on the runway for the title screen; the panel shifts left so
    // the plane and runway read on the right of the frame.
    document.body.classList.add('shot-title');
    state.position.set(0, 2.2, 320);
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    game.cameraMode = 'chase';
    game.shotCamera = { offset: { x: 0, y: 8, z: 348 }, look: { x: -8, y: 20, z: -160 } };
    game.phase = 'menu';
  } else if (shot === 2) {
    state.position.set(-60, 150, 120);
    state.heading = deg(8);
    state.pitch = -0.04;
    state.roll = 0.12;
    state.speed = 68;
    state.throttle = 0.72;
    state.fuel = 82;
    game.cameraMode = 'chase';
    game.shotCamera = null;
    game.phase = 'playing';
    game.score = 300;
    game.ringsHit = 3;
    game.nextRingIndex = 3;
    game.timeLeft = 142;
  } else if (shot === 3) {
    const ring = RING_COURSE[0];
    state.position.set(ring.x, ring.y, ring.z + 46);
    state.heading = 0;
    state.pitch = 0.02;
    state.roll = -0.05;
    state.speed = 62;
    state.throttle = 0.7;
    state.fuel = 88;
    game.cameraMode = 'cockpit';
    game.shotCamera = null;
    game.phase = 'playing';
    game.score = 100;
    game.ringsHit = 1;
    game.nextRingIndex = 1;
    game.timeLeft = 168;
  } else if (shot === 4) {
    document.body.classList.remove('shot-title');
    state.position.set(560, 95, -260);
    state.heading = deg(-24);
    state.pitch = -0.06;
    state.roll = 0.22;
    state.speed = 74;
    state.throttle = 0.8;
    state.fuel = 64;
    game.cameraMode = 'chase';
    game.shotCamera = null;
    game.phase = 'playing';
    game.score = 400;
    game.ringsHit = 4;
    game.nextRingIndex = 4;
    game.timeLeft = 121;
  }
  game.shotMode = shot;
}
