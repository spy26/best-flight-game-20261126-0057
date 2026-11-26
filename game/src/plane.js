// Skyline Harbor — the courier plane: its built-up mesh and its flight model.
// One clear job: how the aircraft looks, and how it flies, stalls and lands.

import { clamp, dampFactor, groundHeight, isOverRunway, isOverWater, SPAWN, STALL_SPEED, MAX_SPEED } from './config.js';

// Build the propeller courier from primitives: cream fuselage, red trim,
// glass canopy, spinning prop, wingtip lights and a lit cockpit panel.
export function buildPlaneMesh() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e6c8 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc94f3d });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e3438 });
  const glass = new THREE.MeshLambertMaterial({
    color: 0x2a4a66,
    emissive: 0xff9a3c,
    emissiveIntensity: 0.35,
  });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 5.6, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 12), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.5;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 10), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.5;
  group.add(tailCone);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), glass);
  canopy.scale.set(0.9, 0.75, 1.5);
  canopy.position.set(0, 0.75, -0.9);
  group.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, 2.1), red);
  wing.position.set(0, -0.1, -0.4);
  group.add(wing);
  const wingTipL = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  wingTipL.position.set(-5.5, 0, -0.4);
  group.add(wingTipL);
  const wingTipR = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x44ff88 }),
  );
  wingTipR.position.set(5.5, 0, -0.4);
  group.add(wingTipR);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.1), cream);
  hStab.position.set(0, 0.25, 3.9);
  group.add(hStab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.7, 1.3), red);
  fin.position.set(0, 0.9, 3.9);
  group.add(fin);

  // Propeller: hub plus two blades, spun by the flight model.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const sign of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.12), dark);
    blade.position.y = sign * 1.3;
    prop.add(blade);
  }
  prop.position.set(0, 0, -4.4);
  group.add(prop);

  // Fixed gear: two wheels and a tail wheel.
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(sx * 0.9, -0.9, -0.6);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.9, -1.45, -0.6);
    group.add(wheel);
  }

  // Lit cockpit panel, visible in cockpit view: gauges drawn on a canvas.
  // Sized to read as a dashboard at the bottom of the view, not a wall.
  const panel = makeInstrumentPanel();
  panel.position.set(0, 0.6, -2.2);
  panel.rotation.x = -0.35;
  panel.visible = false;
  group.add(panel);

  // Translucent prop disc: the spinning blur a real prop reads as.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disc.position.set(0, 0, -4.45);
  group.add(disc);

  return { group, propeller: prop, panel, canopy };
}

// Canvas-drawn instrument faces: airspeed, altitude, attitude and compass.
export function makeInstrumentPanel() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  g.fillStyle = '#101418';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#3a4550';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 152);
  const gauges = [
    { x: 80, label: 'AIRSPEED', color: '#7fe0ff' },
    { x: 200, label: 'ALTITUDE', color: '#ffd27a' },
    { x: 320, label: 'ATTITUDE', color: '#9fe08a' },
    { x: 436, label: 'HEADING', color: '#ff9a7a' },
  ];
  for (const gauge of gauges) {
    g.beginPath();
    g.arc(gauge.x, 66, 52, 0, Math.PI * 2);
    g.fillStyle = '#0c1a24';
    g.fill();
    g.strokeStyle = gauge.color;
    g.lineWidth = 3;
    g.stroke();
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(gauge.x + Math.cos(a) * 44, 66 + Math.sin(a) * 44);
      g.lineTo(gauge.x + Math.cos(a) * 52, 66 + Math.sin(a) * 52);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(gauge.x, 66);
    g.lineTo(gauge.x + 34, 66 - 30);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#ffb347';
    g.beginPath();
    g.arc(gauge.x, 66, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8e8e8';
    g.font = 'bold 15px monospace';
    g.textAlign = 'center';
    g.fillText(gauge.label, gauge.x, 146);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.75),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  return panel;
}

export function createFlightState() {
  return {
    position: new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z),
    heading: SPAWN.heading,
    pitch: SPAWN.pitch,
    roll: SPAWN.roll,
    speed: 42,
    throttle: 0.65,
    fuel: 100,
    boosting: false,
    stalled: false,
    verticalSpeed: 0,
    crashed: false,
    crashReason: '',
    landed: false,
  };
}

export function resetFlight(state) {
  const fresh = createFlightState();
  Object.assign(state, fresh);
  state.position.copy(fresh.position);
}

// One physics step. Returns 'flying', 'crashed' or 'landed'.
// input: { pitch, roll, yaw, throttleUp, throttleDown, boost, mousePitch, mouseRoll }
export function updateFlight(state, input, dt, colliders) {
  if (state.crashed || state.landed) return state.landed ? 'landed' : 'crashed';
  const prevY = state.position.y;

  if (input.throttleUp) state.throttle = clamp(state.throttle + 0.55 * dt, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - 0.55 * dt, 0, 1);

  const hasFuel = state.fuel > 0;
  state.boosting = Boolean(input.boost && hasFuel && state.throttle > 0.3);
  const fuelDrain = (state.throttle * 1.6 + (state.boosting ? 7 : 0)) * dt;
  state.fuel = clamp(state.fuel - fuelDrain, 0, 100);

  const control = state.speed < STALL_SPEED ? 0.45 : 1;
  const pitchRate = (input.pitch + input.mousePitch) * 0.85 * control;
  const rollRate = (input.roll + input.mouseRoll) * 1.7 * control;
  state.pitch = clamp(state.pitch + pitchRate * dt, -0.62, 0.62);
  state.roll = clamp(state.roll + rollRate * dt, -1.15, 1.15);

  // Gentle auto-level: hands off the stick and she settles wings-level.
  if (Math.abs(input.roll + input.mouseRoll) < 0.05) {
    state.roll *= Math.exp(-0.9 * dt);
  }
  if (Math.abs(input.pitch + input.mousePitch) < 0.05) {
    state.pitch *= Math.exp(-0.25 * dt);
  }

  // Banked turn plus a little direct rudder from Q/E.
  const turnRate = -Math.sin(state.roll) * 0.85 + input.yaw * 0.5;
  state.heading += turnRate * clamp(state.speed / 55, 0.35, 1.15) * dt;

  // Speed: throttle sets the target, climbing bleeds it, diving restores it.
  let targetSpeed = 16 + state.throttle * 80;
  if (state.boosting) targetSpeed += 26;
  if (!hasFuel) targetSpeed = 16;
  targetSpeed -= Math.sin(state.pitch) * 34;
  targetSpeed = clamp(targetSpeed, 0, MAX_SPEED + 26);
  state.speed += (targetSpeed - state.speed) * dampFactor(0.55, dt);

  state.stalled = state.speed < STALL_SPEED;
  if (state.stalled) {
    // The nose drops in a stall; hold speed and she recovers.
    state.pitch = clamp(state.pitch - 0.3 * dt, -0.62, 0.62);
  }

  // Soft service ceiling: above the harbor haze she gently noses back down.
  if (state.position.y > 380) {
    state.pitch = clamp(state.pitch - 0.25 * dt, -0.62, 0.62);
  }
  if (state.position.y > 600) state.position.y = 600;

  const cp = Math.cos(state.pitch);
  const forward = new THREE.Vector3(
    -Math.sin(state.heading) * cp,
    Math.sin(state.pitch),
    -Math.cos(state.heading) * cp,
  );
  state.position.addScaledVector(forward, state.speed * dt);
  state.verticalSpeed = (state.position.y - prevY) / Math.max(dt, 0.001);

  // Soft world edge: steer back rather than hitting an invisible wall.
  if (Math.abs(state.position.x) > 1220 || Math.abs(state.position.z) > 1220) {
    state.position.x = clamp(state.position.x, -1220, 1220);
    state.position.z = clamp(state.position.z, -1220, 1220);
    state.speed *= 0.98;
  }

  // Water: a splash is a crash.
  if (isOverWater(state.position.x, state.position.z) && state.position.y <= 0.8) {
    state.crashed = true;
    state.crashReason = 'Ditched in the harbor — the bay is not a runway.';
    return 'crashed';
  }

  // Terrain.
  const ground = groundHeight(state.position.x, state.position.z);
  if (state.position.y <= ground + 2.2) {
    if (isOverRunway(state.position.x, state.position.z)) {
      const aligned = Math.abs(((state.heading % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.26;
      const gentle = state.verticalSpeed > -9 && Math.abs(state.roll) < 0.35 && state.speed < 58;
      if (gentle && aligned) {
        state.landed = true;
        state.position.y = ground + 2.2;
        return 'landed';
      }
    }
    state.crashed = true;
    state.crashReason =
      state.speed > 60
        ? 'High-speed impact with the terrain.'
        : 'Clipped the ground — keep some altitude over the city.';
    return 'crashed';
  }

  // Buildings, bridge deck and towers, control tower, hangar.
  const p = state.position;
  for (const box of colliders) {
    if (p.x > box.minX && p.x < box.maxX && p.z > box.minZ && p.z < box.maxZ && p.y < box.topY + 2) {
      state.crashed = true;
      state.crashReason = 'Flew into a building — the skyline bites back.';
      return 'crashed';
    }
  }
  return 'flying';
}

// Keep the 3D mesh in step with the flight state.
export function posePlane(mesh, state, dt) {
  mesh.group.position.copy(state.position);
  mesh.group.rotation.set(state.pitch, state.heading, -state.roll);
  const spin = 6 + state.throttle * 34 + (state.boosting ? 14 : 0);
  mesh.propeller.rotation.z += spin * dt;
}
