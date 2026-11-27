// Skyline Harbor — game loop, states, scoring, camera and ring logic.
// One clear job: run the flight game from boot to game-over.

import {
  BEST_SCORE_KEY,
  FLAP_NAMES,
  RING_COURSE,
  RING_POINTS,
  RING_RADIUS,
  RING_TIME_BONUS,
  RING_FUEL_BONUS,
  RUN_TIME_SECONDS,
  SUN_POS,
  clamp,
  formatTime,
  stallSpeedForFlaps,
} from './config.js';
import { HarborWorld } from './world.js';
import {
  buildPlaneMesh,
  createFlightState,
  resetFlight,
  updateFlight,
  posePlane,
} from './plane.js';
import { updateCockpit } from './cockpit.js';
import { FlightInput } from './input.js';
import { SkyHud } from './hud.js';
import { SkyAudio } from './audio.js';
import { applyShot, shotFromUrl } from './shots.js';

const THREE = window.THREE;

class SkylineHarborGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4200);
    this.camera.position.set(0, 70, 420);
    this.world = new HarborWorld(this.scene);
    this.plane = buildPlaneMesh();
    this.scene.add(this.plane.group);
    this.flight = createFlightState();
    this.input = new FlightInput();
    this.hud = new SkyHud();
    this.audio = new SkyAudio();
    this.phase = 'menu';
    this.cameraMode = 'chase';
    this.shotMode = 0;
    this.shotCamera = null;
    this.score = 0;
    this.ringsHit = 0;
    this.nextRingIndex = 0;
    this.timeLeft = RUN_TIME_SECONDS;
    this.best = Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) || '0', 10) || 0;
    this.landingBonus = 0;
    this.timeBonus = 0;
    this.onApproach = false;
    this.locDev = 0;
    this.gsDev = 0;
    this.approachAnnounced = false;
    this.glareEl = document.getElementById('sunGlare');
    this.lastTime = performance.now();
    this.cameraPos = new THREE.Vector3(0, 70, 420);
    this.beacon = this.buildBeacon();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildBeacon() {
    // Floating arrow ahead of the plane, always pointing at the next ring.
    const group = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 4.5, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }),
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = -2.5;
    group.add(cone);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }),
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 1.5;
    group.add(shaft);
    // Small on screen: it floats ahead of the nose, never on top of it.
    group.scale.setScalar(0.55);
    this.scene.add(group);
    return group;
  }

  bindInput() {
    this.input.attach(this.canvas);
    this.input.onAnyGesture = () => this.audio.ensureStarted();
    this.input.onStart = () => {
      if (this.phase === 'menu') this.startRun();
    };
    this.input.onPause = () => {
      if (this.phase === 'playing') this.pauseGame();
      else if (this.phase === 'paused') this.resumeGame();
    };
    this.input.onRestart = () => {
      if (this.phase !== 'menu') this.startRun();
    };
    this.input.onToggleView = () => {
      if (this.phase === 'playing' || this.phase === 'paused') {
        this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
        this.plane.panel.visible = this.cameraMode === 'cockpit';
        this.hud.toast(this.cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view');
      }
    };
    this.input.onToggleMute = () => {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? 'Sound muted (M)' : 'Sound on (M)');
    };
    this.input.onFlaps = () => {
      if (this.phase === 'playing' || this.phase === 'paused') {
        this.flight.flaps = (this.flight.flaps + 1) % FLAP_NAMES.length;
        this.hud.toast(
          `Flaps ${FLAP_NAMES[this.flight.flaps]} — stall ${Math.round(stallSpeedForFlaps(this.flight.flaps) * 1.94)} kt, more drag`,
        );
      }
    };
    this.input.onToggleHelp = () => {
      const help = document.getElementById('helpScreen');
      help.classList.toggle('hidden');
    };
    document.getElementById('startButton').addEventListener('click', () => this.startRun());
    document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
    document.getElementById('restartButton').addEventListener('click', () => this.startRun());
    document.getElementById('overRestartButton').addEventListener('click', () => this.startRun());
    document.getElementById('helpButton').addEventListener('click', () => {
      document.getElementById('helpScreen').classList.remove('hidden');
    });
    document.getElementById('closeHelpButton').addEventListener('click', () => {
      document.getElementById('helpScreen').classList.add('hidden');
    });
    document.getElementById('menuButton').addEventListener('click', () => this.toMenu());
    document.getElementById('overMenuButton').addEventListener('click', () => this.toMenu());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  startRun() {
    this.audio.ensureStarted();
    resetFlight(this.flight);
    this.score = 0;
    this.ringsHit = 0;
    this.nextRingIndex = 0;
    this.timeLeft = RUN_TIME_SECONDS;
    this.landingBonus = 0;
    this.timeBonus = 0;
    this.onApproach = false;
    this.locDev = 0;
    this.gsDev = 0;
    this.approachAnnounced = false;
    this.cameraMode = 'chase';
    this.plane.panel.visible = false;
    this.phase = 'playing';
    this.hud.showHud();
    this.hud.toast('Fly the rings — land on the runway to bank the bonus.');
    this.snapCameraBehind();
  }

  pauseGame() {
    this.phase = 'paused';
    this.hud.showPause();
    this.audio.setSilent();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resumeGame() {
    this.phase = 'playing';
    this.hud.hidePause();
    this.lastTime = performance.now();
  }

  toMenu() {
    resetFlight(this.flight);
    this.phase = 'menu';
    this.cameraMode = 'chase';
    this.plane.panel.visible = false;
    this.hud.showMenu(this.best);
    this.audio.setSilent();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  snapCameraBehind() {
    const f = this.flight;
    const back = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
    this.cameraPos.copy(f.position).addScaledVector(back, 15).add(new THREE.Vector3(0, 4.5, 0));
  }

  ringPassed() {
    const ring = RING_COURSE[this.nextRingIndex];
    const d = this.flight.position.distanceTo(new THREE.Vector3(ring.x, ring.y, ring.z));
    return d < RING_RADIUS;
  }

  collectRing() {
    const ring = RING_COURSE[this.nextRingIndex];
    this.score += RING_POINTS;
    this.ringsHit += 1;
    this.timeLeft = Math.min(RUN_TIME_SECONDS, this.timeLeft + RING_TIME_BONUS);
    this.flight.fuel = clamp(this.flight.fuel + RING_FUEL_BONUS, 0, 100);
    this.audio.chime();
    this.hud.toast(`◈ ${ring.name} — +${RING_POINTS} pts, +${RING_TIME_BONUS}s, +fuel`);
    this.nextRingIndex = (this.nextRingIndex + 1) % RING_COURSE.length;
    if (this.nextRingIndex === 0) {
      this.score += 50;
      this.hud.toast('Course complete — +50 pts, the gates reset!');
    }
  }

  endRun(title, reason) {
    const isBest = this.score > this.best;
    if (isBest) {
      this.best = this.score;
      window.localStorage.setItem(BEST_SCORE_KEY, String(this.best));
    }
    this.timeBonus = this.flight.landed ? Math.round(this.timeLeft) * 2 : 0;
    const total = this.score + this.landingBonus + this.timeBonus;
    const breakdown = [
      { label: `Rings flown × ${this.ringsHit}`, value: `${this.ringsHit * RING_POINTS} pts` },
      { label: 'Course completions', value: `${Math.floor(this.ringsHit / RING_COURSE.length) * 50} pts` },
      { label: 'Landing bonus', value: `${this.landingBonus} pts` },
      { label: 'Time bonus', value: `${this.timeBonus} pts` },
    ];
    this.score = total;
    this.phase = 'over';
    this.audio.setSilent();
    if (this.flight.landed) this.audio.jingle();
    else this.audio.thud();
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showGameOver({
      title,
      reason,
      breakdown,
      score: total,
      best: this.best,
      isBest,
    });
  }

  // Final approach: lined up on the runway centerline, low, northbound.
  // Drives the ILS diamonds on the PFD and the APPR annunciator.
  updateApproach() {
    const f = this.flight;
    const headingDeg = ((-f.heading * 180) / Math.PI % 360 + 360) % 360;
    const aligned = headingDeg < 30 || headingDeg > 330;
    this.onApproach =
      aligned &&
      Math.abs(f.position.x) < 150 &&
      f.position.z > -100 &&
      f.position.z < 350 &&
      f.position.y < 280;
    if (this.onApproach) {
      this.locDev = clamp(f.position.x / 150, -1, 1);
      const idealY = 2.2 + (f.position.z + 100) * 0.0524;
      this.gsDev = clamp((f.position.y - idealY) / 60, -1, 1);
      if (!this.approachAnnounced) {
        this.approachAnnounced = true;
        this.hud.toast('FINAL APPROACH — fly toward the magenta ILS diamonds.');
      }
    } else {
      this.approachAnnounced = false;
    }
  }

  // Golden-hour sun glare through the windshield, cockpit view only.
  // The DOM flare tracks the real sun's projected screen position and
  // brightens as the nose swings toward it; a warm wash stays on the
  // panel even when the sun itself is just out of frame.
  updateGlare() {
    const el = this.glareEl;
    if (this.cameraMode !== 'cockpit' || this.phase === 'menu' || this.phase === 'over') {
      el.style.opacity = '0';
      return;
    }
    const f = this.flight;
    const cp = Math.cos(f.pitch);
    const forward = new THREE.Vector3(
      -Math.sin(f.heading) * cp,
      Math.sin(f.pitch),
      -Math.cos(f.heading) * cp,
    );
    const sunDir = new THREE.Vector3(SUN_POS.x, SUN_POS.y, SUN_POS.z)
      .sub(this.camera.position)
      .normalize();
    const facing = forward.dot(sunDir);
    this.camera.updateMatrixWorld();
    const p = new THREE.Vector3(SUN_POS.x, SUN_POS.y, SUN_POS.z).project(this.camera);
    const inFrame = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
    const glare = inFrame
      ? clamp((facing - 0.2) / 0.7, 0, 1)
      : clamp((facing - 0.55) / 0.45, 0, 0.5);
    el.style.opacity = String(0.3 + glare * 0.7);
    if (inFrame) {
      el.style.setProperty('--gx', `${((p.x * 0.5 + 0.5) * window.innerWidth).toFixed(0)}px`);
      el.style.setProperty('--gy', `${((-p.y * 0.5 + 0.5) * window.innerHeight).toFixed(0)}px`);
    }
  }

  updateCamera(dt) {
    const f = this.flight;
    if (this.shotMode === 1 && this.shotCamera) {
      this.camera.position.set(
        this.shotCamera.offset.x,
        this.shotCamera.offset.y,
        this.shotCamera.offset.z,
      );
      this.camera.lookAt(
        this.shotCamera.look.x,
        this.shotCamera.look.y,
        this.shotCamera.look.z,
      );
      return;
    }
    const cp = Math.cos(f.pitch);
    const forward = new THREE.Vector3(
      -Math.sin(f.heading) * cp,
      Math.sin(f.pitch),
      -Math.cos(f.heading) * cp,
    );
    if (this.cameraMode === 'cockpit') {
      this.plane.panel.visible = true;
      // From inside, the canopy bubble and the prop would block the view,
      // so they are hidden here (the translucent prop disc stays).
      this.plane.canopy.visible = false;
      this.plane.propeller.visible = false;
      // Sit in the seat, looking over the nose at the panel below.
      // Eye a touch higher than the cowling so the raised panel reads
      // fully below the windscreen instead of behind the nose.
      const eye = f.position.clone().addScaledVector(forward, 0.2).add(new THREE.Vector3(0, 1.15, 0));
      this.camera.position.copy(eye);
      const target = f.position.clone().addScaledVector(forward, 40);
      this.camera.lookAt(target);
      this.cameraPos.copy(eye);
      return;
    }
    this.plane.panel.visible = false;
    this.plane.canopy.visible = true;
    this.plane.propeller.visible = true;
    const desired = f.position
      .clone()
      .addScaledVector(forward, -15)
      .add(new THREE.Vector3(0, 4.6, 0));
    const k = 1 - Math.exp(-5.5 * dt);
    this.cameraPos.lerp(desired, k);
    this.camera.position.copy(this.cameraPos);
    const target = f.position.clone().addScaledVector(forward, 26).add(new THREE.Vector3(0, 1.5, 0));
    this.camera.lookAt(target);
  }

  updateBeacon(time) {
    const ring = RING_COURSE[this.nextRingIndex];
    const f = this.flight;
    const cp = Math.cos(f.pitch);
    const forward = new THREE.Vector3(
      -Math.sin(f.heading) * cp,
      Math.sin(f.pitch),
      -Math.cos(f.heading) * cp,
    );
    const anchor = f.position.clone().addScaledVector(forward, 10).add(new THREE.Vector3(0, 2, 0));
    this.beacon.position.copy(anchor);
    const toRing = new THREE.Vector3(ring.x, ring.y, ring.z).sub(anchor);
    this.beacon.lookAt(anchor.clone().add(toRing));
    this.beacon.position.y += Math.sin(time * 2.4) * 0.15;
    // In the cockpit the HUD carries the next-ring callout; the 3D arrow
    // would sit on top of the windscreen.
    this.beacon.visible = this.phase === 'playing' && this.cameraMode !== 'cockpit';
  }

  step(now) {
    const dt = clamp((now - this.lastTime) / 1000, 0.001, 0.05);
    this.lastTime = now;
    const time = now / 1000;

    if (this.phase === 'playing') {
      const commands = this.input.readCommands();
      const result = updateFlight(this.flight, commands, dt, this.world.colliders);
      this.timeLeft -= dt;
      if (result === 'crashed') {
        this.endRun('CRASHED', this.flight.crashReason);
      } else if (result === 'landed') {
        const speedKnots = Math.round(this.flight.speed * 1.94);
        const headingErr = Math.abs(
          (((-this.flight.heading * 180) / Math.PI % 360) + 360) % 360,
        );
        const alignScore = Math.max(0, 100 - Math.round(headingErr * 4));
        this.landingBonus = 200 + Math.max(0, 40 - speedKnots) * 3 + alignScore;
        this.endRun(
          'LANDED — RUN COMPLETE',
          `Touchdown at ${speedKnots} kt, alignment ${alignScore}/100. The courier is home.`,
        );
      } else if (this.ringPassed()) {
        this.collectRing();
      } else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRun('TIME UP', 'Three minutes gone — the harbor keeps its schedule.');
      } else if (this.flight.fuel <= 0 && this.flight.speed < stallSpeedForFlaps(this.flight.flaps)) {
        this.endRun('OUT OF FUEL', 'The tank ran dry over the city. Rings top the tank up.');
      }
      this.audio.setFlight(this.flight.throttle, this.flight.speed / 96, this.flight.boosting);
    } else if (this.phase === 'menu') {
      // Idle orbit on the title screen: the plane sits on the runway, camera low.
      if (this.shotMode !== 1) {
        this.flight.position.set(0, 2.2, 320);
        this.flight.heading = 0;
        this.flight.pitch = 0;
        this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.throttle = 0;
      }
    }

    if (this.phase !== 'over') posePlane(this.plane, this.flight, dt);
    this.world.animate(dt, time);
    this.world.highlightRing(this.nextRingIndex, time);
    this.updateCamera(this.phase === 'playing' || this.phase === 'menu' ? dt : 0.016);
    this.updateBeacon(time);
    if (this.phase === 'playing') {
      this.updateApproach();
      this.hud.update(this.flight, this);
    }
    this.updateGlare();
    if (this.plane.panel.visible) {
      updateCockpit(this.plane.cockpit, this.flight, this, dt, time);
    }
    this.renderer.render(this.scene, this.camera);
  }

  run() {
    const loop = (now) => {
      this.step(now);
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }

  boot() {
    const shot = shotFromUrl();
    if (shot > 0) {
      applyShot(shot, this);
      if (shot === 1) {
        this.hud.showMenu(this.best);
      } else {
        this.hud.showHud();
      }
      this.audio.ensureStarted = () => {};
    } else {
      this.hud.showMenu(this.best);
    }
    this.run();
  }
}

function bootGame() {
  if (!window.THREE) {
    document.getElementById('menu').innerHTML =
      '<h1>SKYLINE HARBOR</h1><p>3D engine failed to load. Reload the page.</p>';
    return;
  }
  const game = new SkylineHarborGame();
  window.skylineHarbor = game;
  game.boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGame);
} else {
  bootGame();
}
