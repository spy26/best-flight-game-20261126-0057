// Skyline Harbor — HUD, minimap and the menu / pause / game-over screens.
// One clear job: everything the pilot reads, drawn from the game state.

import { RING_COURSE, RUNWAY, formatHeading, formatTime } from './config.js';

export class SkyHud {
  constructor() {
    this.el = {};
    const ids = [
      'hud', 'alt', 'speed', 'heading', 'throttleFill', 'throttleLabel',
      'score', 'time', 'rings', 'fuelFill', 'fuelLabel', 'best', 'stall',
      'nextRing', 'beacon', 'minimap', 'toast',
      'menu', 'pauseScreen', 'overScreen', 'helpScreen',
      'overTitle', 'overReason', 'overBreakdown', 'overScore', 'overBest',
      'menuBest', 'menuScore',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
  }

  showMenu(best) {
    this.el.menu.classList.remove('hidden');
    this.el.pauseScreen.classList.add('hidden');
    this.el.overScreen.classList.add('hidden');
    this.el.helpScreen.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.menuBest.textContent = best > 0 ? `Best score: ${best}` : 'No flights logged yet — make this one count.';
  }

  showHud() {
    this.el.menu.classList.add('hidden');
    this.el.pauseScreen.classList.add('hidden');
    this.el.overScreen.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }

  showPause() {
    this.el.pauseScreen.classList.remove('hidden');
  }

  hidePause() {
    this.el.pauseScreen.classList.add('hidden');
  }

  showHelp(show) {
    this.el.helpScreen.classList.toggle('hidden', !show);
  }

  showGameOver({ title, reason, breakdown, score, best, isBest }) {
    this.el.hud.classList.add('hidden');
    this.el.overScreen.classList.remove('hidden');
    this.el.overTitle.textContent = title;
    this.el.overReason.textContent = reason;
    this.el.overBreakdown.innerHTML = breakdown
      .map((row) => `<div class="break-row"><span>${row.label}</span><b>${row.value}</b></div>`)
      .join('');
    this.el.overScore.textContent = `${score} pts`;
    this.el.overBest.textContent = isBest
      ? '★ New best score! ★'
      : `Best score: ${best}`;
  }

  toast(message, seconds = 2.4) {
    this.el.toast.textContent = message;
    this.el.toast.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.el.toast.classList.add('hidden');
    }, seconds * 1000);
  }

  // Per-frame instruments: altitude, airspeed, heading, throttle, fuel.
  update(state, game) {
    const altFt = Math.max(0, Math.round((state.position.y - 2) * 3.28));
    const knots = Math.round(state.speed * 1.94);
    const headingDeg = ((-state.heading * 180) / Math.PI % 360 + 360) % 360;
    this.el.alt.textContent = `${altFt.toLocaleString()} ft`;
    this.el.speed.textContent = `${knots} kt`;
    this.el.heading.textContent = formatHeading(headingDeg);
    this.el.throttleFill.style.width = `${Math.round(state.throttle * 100)}%`;
    this.el.throttleLabel.textContent = state.boosting
      ? `BOOST ${Math.round(state.throttle * 100)}%`
      : `THR ${Math.round(state.throttle * 100)}%`;
    this.el.fuelFill.style.width = `${Math.round(state.fuel)}%`;
    this.el.fuelLabel.textContent = `FUEL ${Math.round(state.fuel)}%`;
    this.el.fuelFill.classList.toggle('low', state.fuel < 25);
    this.el.score.textContent = String(game.score);
    this.el.time.textContent = formatTime(game.timeLeft);
    this.el.time.classList.toggle('urgent', game.timeLeft < 30);
    this.el.rings.textContent = `${game.ringsHit} / ${RING_COURSE.length}`;
    this.el.best.textContent = `BEST ${game.best}`;
    this.el.stall.classList.toggle('hidden', !state.stalled);
    const ring = RING_COURSE[game.nextRingIndex];
    this.el.nextRing.textContent = `NEXT: ${ring.name}`;
    const dx = ring.x - state.position.x;
    const dz = ring.z - state.position.z;
    const dist = Math.hypot(dx, dz);
    this.el.beacon.textContent = `◈ ${Math.round(dist)} m`;
    this.drawMinimap(state, game);
  }

  drawMinimap(state, game) {
    const ctx = this.mapCtx;
    const S = 168;
    const scale = S / 2600;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10, 18, 28, 0.72)';
    ctx.fillRect(0, 0, S, S);
    // Bay.
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(S / 2 + 470 * scale, 0, S / 2 - 470 * scale, S);
    // City blocks.
    ctx.fillStyle = '#8a8f96';
    for (let gx = -420; gx <= 420; gx += 70) {
      for (let gz = -780; gz <= 180; gz += 70) {
        if (Math.abs(gx) < 60 && gz > -160) continue;
        const [mx, mz] = toMap(gx - 17, gz - 17);
        ctx.fillRect(mx, mz, 34 * scale, 34 * scale);
      }
    }
    // Runway.
    const [rx, rz] = toMap(RUNWAY.x - 15, RUNWAY.zMin);
    ctx.fillStyle = '#f2f2e8';
    ctx.fillRect(rx, rz, 30 * scale, (RUNWAY.zMax - RUNWAY.zMin) * scale);
    // Rings: next one gold and pulsing, the rest dim.
    RING_COURSE.forEach((ring, i) => {
      const [mx, mz] = toMap(ring.x, ring.z);
      ctx.beginPath();
      ctx.arc(mx, mz, i === game.nextRingIndex ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === game.nextRingIndex ? '#ffc93c' : 'rgba(255, 201, 60, 0.45)';
      ctx.fill();
    });
    // Plane: a white triangle rotated to its heading.
    const [px, pz] = toMap(state.position.x, state.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
