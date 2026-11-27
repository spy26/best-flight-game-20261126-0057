// Skyline Harbor — the MSFS-style airliner cockpit.
// One clear job: build the cockpit the C key puts you in (wide panel with a
// live PFD, ND, FMC/CDU and EICAS, plus a throttle quadrant and a yoke),
// and keep every screen in step with the flight state.
//
// Screens are separate high-resolution canvases so the text stays sharp at
// 1280x720: the PFD and ND redraw every frame, the EICAS every frame, the
// FMC four times a second. The static panel face is drawn once.

import {
  FLAP_NAMES,
  RING_COURSE,
  RUNWAY,
  clamp,
  computeWarnings,
  formatHeading,
  formatTime,
  stallSpeedForFlaps,
} from './config.js';

const THREE = window.THREE;

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A faint diagonal glass reflection, so the screens read as glass, not paper.
function glassSheen(g, w, h) {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.07)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.015)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- PFD ----
// Attitude indicator with pitch ladder, airspeed tape, altitude tape, VSI,
// heading strip and ILS localizer / glideslope diamonds on final approach.
function drawPFD(g, flight, game, time) {
  const W = 480;
  const H = 480;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070c';
  g.fillRect(0, 0, W, H);

  const knots = Math.round(flight.speed * 1.94);
  const altFt = Math.max(0, Math.round((flight.position.y - 2) * 3.28));
  const vsFpm = Math.round(flight.verticalSpeed * 3.28 * 60);
  const headingDeg = ((-flight.heading * 180) / Math.PI % 360 + 360) % 360;
  const pitchDeg = (flight.pitch * 180) / Math.PI;
  const stallKt = Math.round(stallSpeedForFlaps(flight.flaps) * 1.94);

  // Flight-mode annunciator.
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = 'bold 20px monospace';
  g.fillStyle = '#7dff9a';
  g.fillText('A/T', 14, 30);
  g.fillStyle = '#e8e8e8';
  g.fillText('HDG', 110, 30);
  g.fillText('ALT', 210, 30);
  g.fillStyle = game.onApproach ? '#ff7dff' : '#7dff9a';
  g.fillText(game.onApproach ? 'APPR' : 'NAV', 320, 30);

  // ---- Attitude ball ----
  const cx = 240;
  const cy = 252;
  const R = 178;
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.translate(cx, cy);
  g.rotate(flight.roll);
  g.translate(0, pitchDeg * 3.2);
  const sky = g.createLinearGradient(0, -320, 0, 0);
  sky.addColorStop(0, '#2f7fd0');
  sky.addColorStop(1, '#8ec4ee');
  g.fillStyle = sky;
  g.fillRect(-320, -320, 640, 320);
  const ground = g.createLinearGradient(0, 0, 0, 320);
  ground.addColorStop(0, '#8a5a28');
  ground.addColorStop(1, '#3d2410');
  g.fillStyle = ground;
  g.fillRect(-320, 0, 640, 320);
  // Horizon line.
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-320, 0);
  g.lineTo(320, 0);
  g.stroke();
  // Pitch ladder, every 10 degrees.
  g.font = 'bold 20px monospace';
  g.textAlign = 'center';
  for (let p = -30; p <= 30; p += 10) {
    if (p === 0) continue;
    const y = -p * 3.2;
    const half = Math.abs(p) === 20 ? 74 : 52;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-half, y);
    g.lineTo(half, y);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillText(String(Math.abs(p)), -half - 26, y + 7);
    g.fillText(String(Math.abs(p)), half + 26, y + 7);
  }
  g.restore();
  // Attitude rim + bank pointer (rides with the ball).
  g.strokeStyle = '#c8ccd2';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  const px = cx + R * Math.sin(flight.roll);
  const py = cy - R * Math.cos(flight.roll);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(px, py + 4);
  g.lineTo(px - 9, py + 20);
  g.lineTo(px + 9, py + 20);
  g.closePath();
  g.fill();
  // Fixed lubber marker at the top.
  g.fillStyle = '#ffc93c';
  g.beginPath();
  g.moveTo(cx, cy - R - 2);
  g.lineTo(cx - 8, cy - R - 16);
  g.lineTo(cx + 8, cy - R - 16);
  g.closePath();
  g.fill();
  // Fixed aircraft symbol: yellow wings + dot.
  g.strokeStyle = '#ffd21a';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 72, cy);
  g.lineTo(cx - 16, cy);
  g.moveTo(cx + 16, cy);
  g.lineTo(cx + 72, cy);
  g.stroke();
  g.fillStyle = '#ffd21a';
  g.beginPath();
  g.arc(cx, cy, 7, 0, Math.PI * 2);
  g.fill();

  // ---- Airspeed tape (left) ----
  const tapeTop = 62;
  const tapeBot = 442;
  const tapeMid = (tapeTop + tapeBot) / 2;
  g.fillStyle = '#0a121c';
  g.fillRect(8, tapeTop, 66, tapeBot - tapeTop);
  g.strokeStyle = '#3a4550';
  g.lineWidth = 2;
  g.strokeRect(8, tapeTop, 66, tapeBot - tapeTop);
  // Green operating band, red stall marker.
  const ktToY = (kt) => tapeMid - (kt - knots) * 2.4;
  g.fillStyle = 'rgba(125,255,154,0.25)';
  g.fillRect(12, ktToY(160), 8, ktToY(60) - ktToY(160));
  g.strokeStyle = '#ff5a4e';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(12, ktToY(stallKt));
  g.lineTo(20, ktToY(stallKt));
  g.stroke();
  g.save();
  g.beginPath();
  g.rect(8, tapeTop, 66, tapeBot - tapeTop);
  g.clip();
  g.font = 'bold 19px monospace';
  g.textAlign = 'right';
  for (let kt = Math.max(0, Math.floor((knots - 80) / 20) * 20); kt <= knots + 80; kt += 20) {
    const y = ktToY(kt);
    if (y < tapeTop + 6 || y > tapeBot - 6) continue;
    g.strokeStyle = '#c8ccd2';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(58, y);
    g.lineTo(72, y);
    g.stroke();
    g.fillStyle = '#e8e8e8';
    g.fillText(String(kt), 54, y + 6);
  }
  g.restore();
  // Current speed box.
  g.fillStyle = '#101c28';
  g.strokeStyle = '#7fe0ff';
  g.lineWidth = 2;
  roundRect(g, 8, tapeMid - 22, 92, 44, 5);
  g.fill();
  g.stroke();
  g.fillStyle = '#7fe0ff';
  g.font = 'bold 28px monospace';
  g.textAlign = 'center';
  g.fillText(String(knots), 54, tapeMid + 10);
  g.fillStyle = '#7fe0ff';
  g.font = 'bold 15px monospace';
  g.fillText('KT', 54, tapeMid + 62);

  // ---- Altitude tape (right) ----
  g.fillStyle = '#0a121c';
  g.fillRect(406, tapeTop, 66, tapeBot - tapeTop);
  g.strokeStyle = '#3a4550';
  g.lineWidth = 2;
  g.strokeRect(406, tapeTop, 66, tapeBot - tapeTop);
  const ftToY = (ft) => tapeMid - (ft - altFt) * 0.16;
  g.save();
  g.beginPath();
  g.rect(406, tapeTop, 66, tapeBot - tapeTop);
  g.clip();
  g.font = 'bold 19px monospace';
  g.textAlign = 'left';
  for (let ft = Math.max(0, Math.floor((altFt - 600) / 100) * 100); ft <= altFt + 600; ft += 100) {
    const y = ftToY(ft);
    if (y < tapeTop + 6 || y > tapeBot - 6) continue;
    g.strokeStyle = '#c8ccd2';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(408, y);
    g.lineTo(422, y);
    g.stroke();
    g.fillStyle = '#e8e8e8';
    g.fillText(String(ft), 426, y + 6);
  }
  g.restore();
  g.fillStyle = '#101c28';
  g.strokeStyle = '#ffd27a';
  g.lineWidth = 2;
  roundRect(g, 380, tapeMid - 22, 92, 44, 5);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffd27a';
  g.font = 'bold 26px monospace';
  g.textAlign = 'center';
  g.fillText(String(altFt), 426, tapeMid + 9);
  g.fillStyle = '#ffd27a';
  g.font = 'bold 15px monospace';
  g.fillText('FT', 426, tapeMid + 62);

  // ---- VSI readout ----
  g.textAlign = 'center';
  g.font = 'bold 20px monospace';
  g.fillStyle = vsFpm >= 0 ? '#7dff9a' : '#ff9a7a';
  g.fillText(`VS ${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`, cx, 462);

  // ---- Heading strip (bottom of the ball) ----
  g.fillStyle = '#0a121c';
  g.fillRect(cx - 130, 408, 260, 30);
  g.save();
  g.beginPath();
  g.rect(cx - 130, 408, 260, 30);
  g.clip();
  g.font = 'bold 18px monospace';
  g.textAlign = 'center';
  for (let d = Math.floor((headingDeg - 60) / 10) * 10; d <= headingDeg + 60; d += 10) {
    const dd = ((d % 360) + 360) % 360;
    const x = cx + (dd - headingDeg) * 2.2;
    if (x < cx - 130 || x > cx + 130) continue;
    g.fillStyle = dd % 30 === 0 ? '#ffffff' : '#8a929c';
    const label = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd / 10);
    g.fillText(label, x, 430);
  }
  g.restore();
  g.strokeStyle = '#ffc93c';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, 408);
  g.lineTo(cx, 418);
  g.stroke();

  // ---- ILS diamonds on final approach ----
  if (game.onApproach) {
    g.fillStyle = '#ff7dff';
    g.font = 'bold 20px monospace';
    g.textAlign = 'left';
    g.fillText('ILS', 14, 66);
    // Localizer: fly toward the diamond. Left/right of centerline.
    const locX = cx - clamp(game.locDev, -1, 1) * 78;
    g.beginPath();
    g.moveTo(locX, 420);
    g.lineTo(locX - 9, 431);
    g.lineTo(locX + 9, 431);
    g.closePath();
    g.fill();
    // Glideslope: above the slope puts the diamond low, fly down to it.
    const gsY = cy + clamp(game.gsDev, -1, 1) * 78;
    g.beginPath();
    g.moveTo(414, gsY);
    g.lineTo(403, gsY - 9);
    g.lineTo(403, gsY + 9);
    g.closePath();
    g.fill();
  }

  // ---- Warnings ----
  if (flight.fuel < 25) {
    if (Math.floor(time * 2) % 2 === 0) {
      g.fillStyle = '#ffb347';
      g.font = 'bold 26px monospace';
      g.textAlign = 'center';
      g.fillText('FUEL LOW', cx, 96);
    }
  }
  if (flight.stalled) {
    g.fillStyle = '#ff5a4e';
    g.font = 'bold 26px monospace';
    g.textAlign = 'center';
    g.fillText('STALL', cx, 128);
  }
  glassSheen(g, W, H);
}

// ----------------------------------------------------------------- ND ----
// Heading-up navigation display: rotating rose, range rings, the whole ring
// course plotted as waypoints, the runway, and a magenta line to the next gate.
function drawND(g, flight, game) {
  const W = 480;
  const H = 480;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070c';
  g.fillRect(0, 0, W, H);

  const headingDeg = ((-flight.heading * 180) / Math.PI % 360 + 360) % 360;
  const cx = 240;
  const cy = 252;
  const R = 188;
  const RANGE_M = 900; // outer ring
  const scale = R / RANGE_M;

  // Header.
  const ring = RING_COURSE[game.nextRingIndex];
  const dxN = ring.x - flight.position.x;
  const dzN = ring.z - flight.position.z;
  const distN = Math.hypot(dxN, dzN);
  g.textAlign = 'left';
  g.font = 'bold 20px monospace';
  g.fillStyle = '#e8e8e8';
  g.fillText(`HDG ${formatHeading(headingDeg)}`, 14, 30);
  g.fillStyle = '#ff7dff';
  g.fillText(`NEXT ${ring.name.toUpperCase()}`, 14, 56);
  g.fillStyle = '#e8e8e8';
  g.textAlign = 'right';
  g.fillText(`${(distN / 1852).toFixed(1)} NM`, W - 14, 56);

  // Rotating rose.
  g.save();
  g.translate(cx, cy);
  g.rotate(-flight.heading);
  g.strokeStyle = '#5a646e';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R / 2, 0, Math.PI * 2);
  g.stroke();
  g.font = 'bold 20px monospace';
  g.textAlign = 'center';
  for (let d = 0; d < 360; d += 10) {
    const a = (d * Math.PI) / 180;
    const r1 = d % 30 === 0 ? R - 18 : R - 10;
    g.strokeStyle = d % 30 === 0 ? '#c8ccd2' : '#5a646e';
    g.lineWidth = d % 30 === 0 ? 3 : 2;
    g.beginPath();
    g.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1);
    g.lineTo(Math.sin(a) * R, -Math.cos(a) * R);
    g.stroke();
    if (d % 30 === 0) {
      const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10);
      g.fillStyle = '#e8e8e8';
      g.save();
      g.translate(Math.sin(a) * (R - 34), -Math.cos(a) * (R - 34));
      g.rotate(a);
      g.fillText(label, 0, 7);
      g.restore();
    }
  }
  g.restore();
  // Range labels, tucked to the left inside the rings.
  g.fillStyle = '#8a929c';
  g.font = 'bold 15px monospace';
  g.textAlign = 'left';
  g.fillText('450m', cx - R + 8, cy - R / 2 + 16);
  g.fillText('900m', cx - R + 8, cy - R + 16);

  // Project a world point into rose coordinates (heading-up).
  const project = (x, z) => {
    const dx = x - flight.position.x;
    const dz = z - flight.position.z;
    const alongFwd = dx * -Math.sin(flight.heading) + dz * -Math.cos(flight.heading);
    const alongRight = dx * Math.cos(flight.heading) - dz * Math.sin(flight.heading);
    return { x: cx + alongRight * scale, y: cy - alongFwd * scale, dist: Math.hypot(dx, dz) };
  };

  // Runway, when in range.
  const rwA = project(RUNWAY.x, RUNWAY.zMin);
  const rwB = project(RUNWAY.x, RUNWAY.zMax);
  if (rwA.dist < RANGE_M * 1.2 || rwB.dist < RANGE_M * 1.2) {
    g.strokeStyle = '#f2f2e8';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(rwA.x, rwA.y);
    g.lineTo(rwB.x, rwB.y);
    g.stroke();
    g.fillStyle = '#f2f2e8';
    g.font = 'bold 16px monospace';
    g.textAlign = 'center';
    g.fillText('RWY', (rwA.x + rwB.x) / 2 + 26, (rwA.y + rwB.y) / 2);
  }

  // Magenta dashed line to the next gate.
  const next = project(ring.x, ring.z);
  if (next.dist < RANGE_M * 1.2) {
    g.strokeStyle = '#ff7dff';
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(next.x, next.y);
    g.stroke();
    g.setLineDash([]);
  }

  // Waypoints: the whole ring course.
  RING_COURSE.forEach((wp, i) => {
    const p = project(wp.x, wp.z);
    if (p.dist > RANGE_M * 1.05) return;
    const isNext = i === game.nextRingIndex;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.PI / 4);
    if (isNext) {
      g.fillStyle = '#ff7dff';
      g.fillRect(-7, -7, 14, 14);
    } else {
      g.strokeStyle = '#7fe0ff';
      g.lineWidth = 2;
      g.strokeRect(-5, -5, 10, 10);
    }
    g.restore();
    // Name labels only for the next gate and close ones, so the rose
    // stays readable instead of a pile of overlapping text.
    if (isNext || p.dist < 300) {
      g.fillStyle = isNext ? '#ff7dff' : '#7fe0ff';
      g.font = 'bold 15px monospace';
      g.textAlign = 'left';
      g.fillText(wp.name.toUpperCase(), p.x + 11, p.y + 5);
    }
  });

  // Ownship: white triangle + fixed heading lubber.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx, cy - 14);
  g.lineTo(cx - 10, cy + 10);
  g.lineTo(cx + 10, cy + 10);
  g.closePath();
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy - R - 8);
  g.lineTo(cx, cy - R + 8);
  g.stroke();

  // Footer.
  g.fillStyle = '#8a929c';
  g.font = 'bold 16px monospace';
  g.textAlign = 'center';
  g.fillText(`RANGE 900m  ·  WPT ${game.nextRingIndex + 1}/8  ·  ${game.ringsHit} FLOWN`, cx, 466);
  glassSheen(g, W, H);
}

// --------------------------------------------------------------- FMC -----
// Flight-management computer: route page with the ring course, distances,
// ETAs and fuel at each waypoint, over a keypad that looks the part.
function drawFMC(g, flight, game) {
  const W = 512;
  const H = 384;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04140a';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1d5a2e';
  g.lineWidth = 2;
  g.strokeRect(2, 2, W - 4, H - 4);

  const drain = flight.throttle * 1.6 + (flight.boosting ? 7 : 0) + flight.flaps * 0.3;
  g.textAlign = 'left';
  g.font = 'bold 22px monospace';
  g.fillStyle = '#8dff9e';
  g.fillText('RTE 1 — SKYLINE HARBOR', 16, 34);
  g.textAlign = 'right';
  g.fillStyle = '#c8f5cf';
  g.fillText('1/1', W - 16, 34);
  g.strokeStyle = '#1d5a2e';
  g.beginPath();
  g.moveTo(12, 44);
  g.lineTo(W - 12, 44);
  g.stroke();

  // Route rows: next five waypoints, wrapping the course.
  g.font = 'bold 19px monospace';
  for (let row = 0; row < 5; row += 1) {
    const i = (game.nextRingIndex + row) % RING_COURSE.length;
    const wp = RING_COURSE[i];
    const d = Math.hypot(wp.x - flight.position.x, wp.z - flight.position.z);
    const eta = flight.speed > 2 ? d / flight.speed : 0;
    const fuelAt = clamp(flight.fuel - drain * eta, 0, 100);
    const y = 74 + row * 30;
    const active = row === 0;
    g.fillStyle = active ? '#ffc93c' : '#8dff9e';
    g.textAlign = 'left';
    g.fillText(`${active ? '>' : ' '}${i + 1} ${wp.name.toUpperCase()}`, 16, y);
    g.textAlign = 'right';
    g.fillText(`${(d / 1852).toFixed(1)} NM`, 330, y);
    g.fillText(eta > 0 ? formatTime(eta) : '--:--', 420, y);
    g.fillText(`${Math.round(fuelAt)}%`, W - 16, y);
  }
  g.strokeStyle = '#1d5a2e';
  g.beginPath();
  g.moveTo(12, 224);
  g.lineTo(W - 12, 224);
  g.stroke();
  g.textAlign = 'left';
  g.font = 'bold 18px monospace';
  g.fillStyle = '#c8f5cf';
  g.fillText(
    `FUEL ${Math.round(flight.fuel)}%  ·  TIME ${formatTime(game.timeLeft)}  ·  SCORE ${game.score}`,
    16,
    248,
  );

  // Keypad: letters, digits, EXEC / CLR.
  const keys = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
    ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
    ['V', 'W', 'X', 'Y', 'Z', '1', '2'],
    ['3', '4', '5', '6', '7', '8', '9'],
    ['0', '.', '-', '/', 'CLR', 'EXEC', 'DEL'],
  ];
  const kw = 62;
  const kh = 20;
  const gap = 6;
  g.font = 'bold 13px monospace';
  g.textAlign = 'center';
  keys.forEach((rowKeys, r) => {
    rowKeys.forEach((key, c) => {
      const x = 14 + c * (kw + gap);
      const y = 262 + r * (kh + 4);
      const exec = key === 'EXEC';
      const clr = key === 'CLR';
      g.fillStyle = exec ? '#0f5a22' : clr ? '#5a3a0f' : '#0a2412';
      g.strokeStyle = exec ? '#7dff9a' : '#2a7a3e';
      g.lineWidth = 1;
      roundRect(g, x, y, kw, kh, 3);
      g.fill();
      g.stroke();
      g.fillStyle = exec || clr ? '#ffd21a' : '#8dff9e';
      g.fillText(key, x + kw / 2, y + 14);
    });
  });
}

// ------------------------------------------------------------- EICAS ------
// Engine strip: N1, fuel flow, fuel quantity, flaps and trim indicators.
function drawEICAS(g, flight, time) {
  const W = 384;
  const H = 480;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070c';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'left';
  g.font = 'bold 20px monospace';
  g.fillStyle = '#e8e8e8';
  g.fillText('EICAS', 14, 30);

  // N1 arc gauge.
  const cx = 192;
  const cy = 140;
  const R = 86;
  const start = Math.PI * 0.75;
  const end = Math.PI * 2.25;
  g.strokeStyle = '#3a4550';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(cx, cy, R, start, end);
  g.stroke();
  g.strokeStyle = '#7fe0ff';
  g.beginPath();
  g.arc(cx, cy, R, start, start + (end - start) * flight.throttle);
  g.stroke();
  for (let v = 0; v <= 100; v += 10) {
    const a = start + ((end - start) * v) / 100;
    const x1 = cx + Math.cos(a) * (R - 16);
    const y1 = cy + Math.sin(a) * (R - 16);
    const x2 = cx + Math.cos(a) * (R - 26);
    const y2 = cy + Math.sin(a) * (R - 26);
    g.strokeStyle = '#c8ccd2';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  const na = start + (end - start) * flight.throttle;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(na) * (R - 12), cy + Math.sin(na) * (R - 12));
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#7fe0ff';
  g.font = 'bold 30px monospace';
  g.fillText(`N1 ${Math.round(flight.throttle * 100)}%`, cx, cy + 52);

  // Fuel flow.
  const ff = flight.throttle * 1.6 + (flight.boosting ? 7 : 0) + flight.flaps * 0.3;
  g.textAlign = 'left';
  g.font = 'bold 22px monospace';
  g.fillStyle = '#e8e8e8';
  g.fillText(`FF  ${ff.toFixed(2)}`, 16, 268);
  g.fillStyle = '#9fe08a';
  g.fillText(flight.boosting ? 'BOOST' : '', 240, 268);

  // Fuel quantity bar.
  g.fillStyle = '#0a121c';
  roundRect(g, 16, 284, W - 32, 26, 5);
  g.fill();
  g.fillStyle = flight.fuel < 25 ? '#ff6a5e' : '#9fe08a';
  const fw = Math.max(0, (W - 32) * flight.fuel) / 100;
  if (fw > 4) {
    roundRect(g, 16, 284, fw, 26, 5);
    g.fill();
  }
  g.fillStyle = '#e8e8e8';
  g.font = 'bold 22px monospace';
  g.fillText(`FUEL  ${Math.round(flight.fuel)}%`, 16, 342);

  // Flaps indicator: three detents, active one lit.
  g.fillText('FLAPS', 16, 384);
  FLAP_NAMES.forEach((name, i) => {
    const x = 130 + i * 80;
    const active = flight.flaps === i;
    g.fillStyle = active ? '#7dff9a' : '#0a121c';
    g.strokeStyle = active ? '#7dff9a' : '#3a4550';
    g.lineWidth = 2;
    roundRect(g, x, 362, 70, 30, 4);
    g.fill();
    g.stroke();
    g.fillStyle = active ? '#04140a' : '#8a929c';
    g.font = 'bold 16px monospace';
    g.textAlign = 'center';
    g.fillText(name, x + 35, 383);
  });

  // Trim indicator.
  g.textAlign = 'left';
  g.fillStyle = '#e8e8e8';
  g.font = 'bold 22px monospace';
  g.fillText('TRIM', 16, 432);
  g.strokeStyle = '#3a4550';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(130, 424);
  g.lineTo(350, 424);
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.beginPath();
  g.moveTo(240, 414);
  g.lineTo(240, 434);
  g.stroke();
  const tx = 240 + flight.trim * 110;
  g.fillStyle = '#ffc93c';
  g.beginPath();
  g.moveTo(tx, 408);
  g.lineTo(tx - 8, 424);
  g.lineTo(tx + 8, 424);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffc93c';
  g.font = 'bold 18px monospace';
  g.textAlign = 'right';
  g.fillText(`${flight.trim >= 0 ? '+' : ''}${flight.trim.toFixed(2)}`, W - 16, 432);

  // Warnings.
  if (flight.fuel < 25 && Math.floor(time * 2) % 2 === 0) {
    g.fillStyle = '#ffb347';
    g.font = 'bold 24px monospace';
    g.textAlign = 'center';
    g.fillText('LOW FUEL', cx, 468);
  }
  glassSheen(g, W, H);
}

// ---------------------------------------------------------- annunciator ----
// Master caution + warning lamp strip: four airliner-style annunciator
// lamps in a row — MASTER CAUTION (amber, lit whenever any warning is
// active), LOW FUEL (amber), NEAR STALL (red) and OVERSPEED (red). Lit
// lamps are solid colour with dark legends; unlit lamps stay dim outlines.
// Red lamps flash at 2 Hz while active, amber lamps burn steady.
function drawAnnunciator(g, warnings, time) {
  const W = 768;
  const H = 56;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0a0d10';
  g.fillRect(0, 0, W, H);
  const lamps = [
    { label: 'MASTER CAUTION', w: 240, active: warnings.any, color: '#ffb347', flash: false },
    { label: 'LOW FUEL', w: 176, active: warnings.lowFuel, color: '#ffb347', flash: false },
    { label: 'NEAR STALL', w: 176, active: warnings.nearStall, color: '#ff5a4e', flash: true },
    { label: 'OVERSPEED', w: 176, active: warnings.overspeed, color: '#ff5a4e', flash: true },
  ];
  let x = 0;
  g.font = 'bold 20px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const lamp of lamps) {
    const lit = lamp.active && (!lamp.flash || Math.floor(time * 2) % 2 === 0);
    g.fillStyle = lit ? lamp.color : '#161b20';
    g.strokeStyle = lit ? lamp.color : '#2e353c';
    g.lineWidth = 2;
    roundRect(g, x + 3, 4, lamp.w - 6, H - 8, 5);
    g.fill();
    g.stroke();
    g.fillStyle = lit ? '#1a1206' : '#4a525a';
    g.fillText(lamp.label, x + lamp.w / 2, H / 2 + 1);
    x += lamp.w;
  }
  g.strokeStyle = '#3a4550';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
}

// ------------------------------------------------------- static panel -----
// The panel face itself: dark metal, screws, screen labels, placards and a
// warm golden wash from the low sun at the upper left.
function makePanelFace() {
  const { ctx: g, texture } = makeCanvas(2048, 560);
  g.fillStyle = '#12161c';
  g.fillRect(0, 0, 2048, 560);
  const wash = g.createLinearGradient(0, 0, 2048, 560);
  wash.addColorStop(0, 'rgba(255,170,80,0.30)');
  wash.addColorStop(0.45, 'rgba(255,170,80,0.08)');
  wash.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = wash;
  g.fillRect(0, 0, 2048, 560);
  // Brushed-metal streaks.
  g.strokeStyle = 'rgba(255,255,255,0.03)';
  g.lineWidth = 1;
  for (let x = 0; x < 2048; x += 14) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 560);
    g.stroke();
  }
  // Screws.
  g.fillStyle = '#3a4148';
  for (const [x, y] of [[24, 24], [1024, 24], [2024, 24], [24, 536], [1024, 536], [2024, 536]]) {
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0a0d10';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x + 6, y);
    g.stroke();
  }
  // Screen labels, under each screen.
  const labels = [
    [317, 'PRIMARY FLIGHT DISPLAY'],
    [790, 'NAVIGATION DISPLAY'],
    [1327, 'FMC / CDU'],
    [1806, 'EICAS'],
  ];
  g.font = 'bold 26px monospace';
  g.textAlign = 'center';
  g.fillStyle = '#c8a24a';
  for (const [x, label] of labels) g.fillText(label, x, 538);
  // Placards.
  g.font = 'bold 24px monospace';
  g.textAlign = 'center';
  g.strokeStyle = '#7a2a22';
  g.lineWidth = 3;
  g.strokeRect(560, 18, 170, 40);
  g.fillStyle = '#c94f3d';
  g.fillText('MASTER WARN', 645, 46);
  g.strokeStyle = '#7a2a22';
  g.strokeRect(1318, 18, 150, 40);
  g.fillStyle = '#c94f3d';
  g.fillText('FIRE WARN', 1393, 46);
  return texture;
}

// ------------------------------------------------------------ builder -----
// Builds the whole cockpit as one group in plane-local coordinates:
// panel (with its four screens), glareshield, side consoles, center
// pedestal with throttle quadrant + flap lever + trim wheel, and the yoke.
export function buildCockpit() {
  const group = new THREE.Group();

  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1f24 });
  const darker = new THREE.MeshLambertMaterial({ color: 0x12161a });
  const metal = new THREE.MeshLambertMaterial({ color: 0x6a7076 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc94f3d });
  const white = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });

  // Main panel, tilted back like an airliner glareshield panel.
  // 4.2 m wide at 2.25 m from the eye: fills the lower frame with a
  // margin at both ends instead of running off the windscreen.
  const panelGroup = new THREE.Group();
  panelGroup.position.set(0, 0.98, -2.25);
  panelGroup.rotation.x = -0.42;
  group.add(panelGroup);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.15),
    new THREE.MeshBasicMaterial({ map: makePanelFace() }),
  );
  panelGroup.add(face);

  const pfd = makeCanvas(480, 480);
  const pfdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: pfd.texture }),
  );
  pfdMesh.position.set(-1.45, 0.02, 0.012);
  panelGroup.add(pfdMesh);

  const nd = makeCanvas(480, 480);
  const ndMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: nd.texture }),
  );
  ndMesh.position.set(-0.48, 0.02, 0.012);
  panelGroup.add(ndMesh);

  const fmc = makeCanvas(512, 384);
  const fmcMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.68),
    new THREE.MeshBasicMaterial({ map: fmc.texture }),
  );
  fmcMesh.position.set(0.62, -0.03, 0.012);
  panelGroup.add(fmcMesh);

  const eicas = makeCanvas(384, 480);
  const eicasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.95),
    new THREE.MeshBasicMaterial({ map: eicas.texture }),
  );
  eicasMesh.position.set(1.6, 0.02, 0.012);
  panelGroup.add(eicasMesh);

  // Master caution annunciator strip: four lamps across the top of the
  // panel, between the MASTER WARN and FIRE WARN placards — low enough
  // to clear the glareshield, just above the screens.
  const annunciator = makeCanvas(768, 56);
  const annunciatorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.084),
    new THREE.MeshBasicMaterial({ map: annunciator.texture }),
  );
  annunciatorMesh.position.set(0, 0.45, 0.02);
  panelGroup.add(annunciatorMesh);

  // Glareshield over the top of the panel: slim, flush with the panel's
  // top edge, so it reads as a strip instead of a black wall.
  const shield = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.14, 0.3), darker);
  shield.position.set(0, 1.52, -2.42);
  shield.rotation.x = -0.1;
  group.add(shield);

  // Side consoles closing the panel ends.
  for (const sx of [-1, 1]) {
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 1.1), dark);
    consoleBox.position.set(sx * 2.2, 0.9, -1.95);
    consoleBox.rotation.y = -sx * 0.5;
    group.add(consoleBox);
  }

  // Center pedestal, lower and further back so the levers read as
  // controls at the bottom of the frame instead of foreground giants —
  // but high enough to clear the cowling, which hides anything lower.
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 1.3), dark);
  pedestal.position.set(0, 0.42, -1.8);
  group.add(pedestal);
  const pedestalTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 1.35), darker);
  pedestalTop.position.set(0, 0.65, -1.8);
  group.add(pedestalTop);

  // Throttle quadrant: two levers that follow the throttle.
  const throttleLevers = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.19, 0.68, -1.85);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.04), metal);
    lever.position.y = 0.12;
    pivot.add(lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), sx < 0 ? red : white);
    knob.position.y = 0.26;
    pivot.add(knob);
    group.add(pivot);
    throttleLevers.push(pivot);
  }
  // Flap lever: three detents.
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0.32, 0.68, -1.62);
  const flapLever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.035), red);
  flapLever.position.y = 0.09;
  flapPivot.add(flapLever);
  const flapKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), white);
  flapKnob.position.y = 0.2;
  flapPivot.add(flapKnob);
  group.add(flapPivot);
  // Trim wheel.
  const trimGroup = new THREE.Group();
  trimGroup.position.set(-0.32, 0.68, -1.62);
  const trimWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 18), metal);
  trimWheel.rotation.z = Math.PI / 2;
  trimGroup.add(trimWheel);
  const trimMark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.3), red);
  trimGroup.add(trimMark);
  group.add(trimGroup);

  // Yoke: column + bar + grips, in front of the panel's lower center.
  // High enough to clear the cowling, which swallows anything lower, and
  // light grey so it reads against the dark pedestal and panel.
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0, 0.72, -1.35);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), metal);
  column.position.set(0, -0.22, 0.1);
  column.rotation.x = 0.35;
  yokeGroup.add(column);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), metal);
  yokeGroup.add(bar);
  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), metal);
    grip.position.set(sx * 0.28, 0.08, 0);
    yokeGroup.add(grip);
  }
  group.add(yokeGroup);

  return {
    group,
    pfd,
    nd,
    fmc,
    eicas,
    annunciator,
    throttleLevers,
    flapPivot,
    trimGroup,
    yokeGroup,
    fmcTimer: 1,
    redrawTimer: 1,
    eicasTick: 0,
  };
}

// Per-frame cockpit update. Call only while the cockpit is visible.
// The screens redraw at 30 Hz (EICAS 15 Hz, FMC 4 Hz): fast enough that
// every needle reads live, cheap enough to keep the frame rate smooth.
export function updateCockpit(cockpit, flight, game, dt, time) {
  cockpit.redrawTimer += dt;
  if (cockpit.redrawTimer >= 1 / 30) {
    cockpit.redrawTimer = 0;
    drawPFD(cockpit.pfd.ctx, flight, game, time);
    cockpit.pfd.texture.needsUpdate = true;
    drawND(cockpit.nd.ctx, flight, game);
    cockpit.nd.texture.needsUpdate = true;
    drawAnnunciator(cockpit.annunciator.ctx, computeWarnings(flight), time);
    cockpit.annunciator.texture.needsUpdate = true;
    cockpit.eicasTick = (cockpit.eicasTick + 1) % 2;
    if (cockpit.eicasTick === 0) {
      drawEICAS(cockpit.eicas.ctx, flight, time);
      cockpit.eicas.texture.needsUpdate = true;
    }
  }
  cockpit.fmcTimer += dt;
  if (cockpit.fmcTimer > 0.25) {
    cockpit.fmcTimer = 0;
    drawFMC(cockpit.fmc.ctx, flight, game);
    cockpit.fmc.texture.needsUpdate = true;
  }
  // Throttle levers: idle is back toward the pilot, max is forward.
  for (const lever of cockpit.throttleLevers) {
    lever.rotation.x = 0.5 - flight.throttle * 1.0;
  }
  // Flap lever detents: UP back, FULL forward.
  cockpit.flapPivot.rotation.x = 0.45 - flight.flaps * 0.45;
  // Trim wheel spins with the trim setting.
  cockpit.trimGroup.rotation.x = flight.trim * 6;
  // Yoke banks with roll and moves fore/aft with pitch.
  cockpit.yokeGroup.rotation.z = -flight.roll * 0.4;
  cockpit.yokeGroup.rotation.x = flight.pitch * 0.3;
}
