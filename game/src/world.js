// Skyline Harbor — the harbor city itself: terrain, sky, water, buildings,
// runway, bridge, piers, boats, trees and clouds. One clear job: build the
// world the plane flies over, deterministically from the config seed.

import {
  PALETTE,
  RING_COURSE,
  RING_RADIUS,
  RUNWAY,
  groundHeight,
  isOverRunway,
  isOverWater,
  mulberry32,
} from './config.js';

export class HarborWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.boats = [];
    this.clouds = [];
    this.rings = [];
    this.ringBeams = [];
    this.propellers = [];
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildCity();
    this.buildRunway();
    this.buildHarbor();
    this.buildBridge();
    this.buildTrees();
    this.buildClouds();
    this.buildRings();
  }

  buildSky() {
    const scene = this.scene;
    scene.background = new THREE.Color(PALETTE.skyHorizon);
    scene.fog = new THREE.Fog(PALETTE.fog, 500, 2600);
    // Low golden sun disc on the western horizon.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: 0xffdf9e, fog: false }),
    );
    sun.position.set(-1900, 190, -900);
    sun.lookAt(0, 60, 0);
    scene.add(sun);
    // Warm halo around the sun.
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(190, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffc06a,
        transparent: true,
        opacity: 0.28,
        fog: false,
      }),
    );
    halo.position.set(-1905, 190, -905);
    halo.lookAt(0, 60, 0);
    scene.add(halo);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xffe0b3, 0x3a5f7a, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
    sun.position.set(-800, 320, 500);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fb4d8, 0.35);
    fill.position.set(600, 400, -600);
    this.scene.add(fill);
  }

  buildTerrain() {
    const size = 2600;
    const segments = 96;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(PALETTE.grass);
    const hill = new THREE.Color(PALETTE.hill);
    const sand = new THREE.Color(PALETTE.sand);
    const city = new THREE.Color(0x8a8f96);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      if (isOverWater(x, z)) {
        tmp.copy(sand).lerp(new THREE.Color(0x2a4a55), 0.4);
      } else if (x > 420 && x < 520) {
        tmp.copy(sand);
      } else if (Math.abs(x) < 460 && z > -820 && z < 340) {
        tmp.copy(city);
      } else if (h > 25) {
        tmp.copy(hill);
      } else {
        tmp.copy(grass);
      }
      // Warm sunset tint on west-facing slopes.
      const warm = Math.max(0, -x / 1300) * 0.25;
      tmp.r = Math.min(1, tmp.r + warm);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    ground.receiveShadow = false;
    this.scene.add(ground);
  }

  buildWater() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 1700),
      new THREE.MeshLambertMaterial({
        color: PALETTE.water,
        transparent: true,
        opacity: 0.88,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(920, -1.2, -300);
    this.scene.add(water);
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 1700),
      new THREE.MeshLambertMaterial({ color: PALETTE.waterDeep }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(920, -3.4, -300);
    this.scene.add(deep);
  }

  buildCity() {
    const rand = mulberry32(20261126);
    const palette = [0xb8a88f, 0x9aa7b5, 0xc2b49a, 0x8fa3b0, 0xd8c9a8, 0x7e93a8, 0xc9a06a];
    const glassMat = new THREE.MeshLambertMaterial({
      color: PALETTE.buildingGlass,
      emissive: 0x664411,
      emissiveIntensity: 0.35,
    });
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let gx = -420; gx <= 420; gx += 70) {
      for (let gz = -780; gz <= 180; gz += 70) {
        // Keep the runway corridor and the apron clear.
        if (Math.abs(gx) < 60 && gz > -160) continue;
        if (rand() < 0.18) continue;
        const distCenter = Math.hypot(gx / 420, (gz + 300) / 480);
        const height = 18 + rand() * rand() * 130 * (1.25 - distCenter);
        const w = 34 + rand() * 18;
        const d = 34 + rand() * 18;
        const color = palette[Math.floor(rand() * palette.length)];
        const mat = new THREE.MeshLambertMaterial({ color });
        const building = new THREE.Mesh(box, mat);
        building.scale.set(w, height, d);
        building.position.set(gx, height / 2, gz);
        this.scene.add(building);
        // Lit rooftop beacon on the taller towers.
        if (height > 85) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(1.6, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff5544 }),
          );
          beacon.position.set(gx, height + 2, gz);
          this.scene.add(beacon);
        }
        // Glass crown on some towers catches the sunset.
        if (rand() < 0.4) {
          const crown = new THREE.Mesh(box, glassMat);
          crown.scale.set(w * 0.55, 4, d * 0.55);
          crown.position.set(gx, height + 2, gz);
          this.scene.add(crown);
        }
        this.colliders.push({
          minX: gx - w / 2 - 2,
          maxX: gx + w / 2 + 2,
          minZ: gz - d / 2 - 2,
          maxZ: gz + d / 2 + 2,
          topY: height + 4,
        });
      }
    }
    // Control tower beside the runway, with a lit cab.
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 9, 55, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }),
    );
    tower.position.set(64, 27.5, 330);
    this.scene.add(tower);
    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 8, 9, 10),
      new THREE.MeshLambertMaterial({
        color: 0x2a4a66,
        emissive: 0xffc860,
        emissiveIntensity: 0.55,
      }),
    );
    cab.position.set(64, 59, 330);
    this.scene.add(cab);
    this.colliders.push({ minX: 52, maxX: 76, minZ: 318, maxZ: 342, topY: 64 });
    // Low hangar on the apron.
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(46, 16, 34),
      new THREE.MeshLambertMaterial({ color: 0xa89068 }),
    );
    hangar.position.set(-64, 8, 330);
    this.scene.add(hangar);
    this.colliders.push({ minX: -89, maxX: -39, minZ: 311, maxZ: 349, topY: 16 });
  }

  buildRunway() {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 400),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(RUNWAY.x, 0.12, 100);
    this.scene.add(strip);
    // Centerline dashes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
    for (let z = -90; z <= 290; z += 30) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 12), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(RUNWAY.x, 0.2, z);
      this.scene.add(dash);
    }
    // Lit threshold markers and edge lights, green at the approach end.
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
    const threshMat = new THREE.MeshBasicMaterial({ color: 0x51ff7a });
    for (let z = -95; z <= 295; z += 26) {
      for (const sx of [-15.5, 15.5]) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), edgeMat);
        light.position.set(RUNWAY.x + sx, 0.8, z);
        this.scene.add(light);
      }
    }
    for (const sx of [-12, -4, 4, 12]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1.4), threshMat);
      marker.position.set(RUNWAY.x + sx, 0.4, -96);
      this.scene.add(marker);
      const marker2 = marker.clone();
      marker2.position.set(RUNWAY.x + sx, 0.4, 296);
      this.scene.add(marker2);
    }
    // Runway numbers, painted as a flat white "27" pair of bars at each end.
    const numMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
    for (const z of [-70, 270]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), numMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(RUNWAY.x, 0.2, z);
      this.scene.add(bar);
    }
    // Windsock on a pole by the apron.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 14, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
    );
    pole.position.set(28, 7, 320);
    this.scene.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xff7a3c, emissive: 0x662200, emissiveIntensity: 0.4 }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(32, 13.5, 320);
    this.scene.add(sock);
  }

  buildHarbor() {
    // Piers reaching out from the beach into the bay.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    for (const z of [-480, -300, -120]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(150, 3, 16), pierMat);
      pier.position.set(545, 1.2, z);
      this.scene.add(pier);
      for (let x = 500; x <= 610; x += 28) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, 5, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b543a }),
        );
        post.position.set(x, 0.5, z + 7);
        this.scene.add(post);
      }
    }
    // Boats: hull, cabin and mast, bobbing gently on the water.
    const rand = mulberry32(77003);
    const hullColors = [0xe8e2d2, 0xc94f3d, 0x3d7ac9, 0xe8b13c, 0x4aa88a];
    for (let i = 0; i < 7; i += 1) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(22, 4, 8),
        new THREE.MeshLambertMaterial({ color: hullColors[i % hullColors.length] }),
      );
      hull.position.y = 0.5;
      boat.add(hull);
      const bow = new THREE.Mesh(
        new THREE.ConeGeometry(4, 7, 4),
        new THREE.MeshLambertMaterial({ color: hullColors[i % hullColors.length] }),
      );
      bow.rotation.z = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(14, 0.5, 0);
      boat.add(bow);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(8, 4, 6),
        new THREE.MeshLambertMaterial({ color: 0xf2ede0 }),
      );
      cabin.position.set(-2, 4.5, 0);
      boat.add(cabin);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 14, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a8a8a }),
      );
      mast.position.set(-2, 11, 0);
      boat.add(mast);
      const bx = 560 + rand() * 480;
      const bz = -760 + rand() * 900;
      boat.position.set(bx, -0.5, bz);
      boat.rotation.y = rand() * Math.PI * 2;
      boat.userData.baseY = -0.5;
      boat.userData.phase = rand() * Math.PI * 2;
      this.scene.add(boat);
      this.boats.push(boat);
    }
  }

  buildBridge() {
    // Suspension bridge across the bay mouth at z = -650.
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x9a4a3c });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(700, 4, 22), deckMat);
    deck.position.set(820, 34, -650);
    this.scene.add(deck);
    this.colliders.push({ minX: 470, maxX: 1170, minZ: -662, maxZ: -638, topY: 38 });
    const towerMat = new THREE.MeshLambertMaterial({ color: 0xc96a4a });
    for (const tx of [650, 990]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 92, 14), towerMat);
      tower.position.set(tx, 46, -650);
      this.scene.add(tower);
      this.colliders.push({ minX: tx - 7, maxX: tx + 7, minZ: -659, maxZ: -641, topY: 92 });
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd27a }),
      );
      cap.position.set(tx, 94, -650);
      this.scene.add(cap);
    }
    // Suspension cables as line segments from tower tops to the deck.
    const cableMat = new THREE.LineBasicMaterial({ color: 0x5a3a30 });
    const points = [];
    for (let x = 480; x <= 1160; x += 20) {
      const nearest = x < 820 ? 650 : 990;
      const sag = 92 - Math.abs(x - nearest) * 0.14;
      points.push(new THREE.Vector3(x, Math.max(38, sag), -650));
    }
    const cableGeo = new THREE.BufferGeometry().setFromPoints(points);
    this.scene.add(new THREE.Line(cableGeo, cableMat));
    // Deck lamps.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let x = 500; x <= 1140; x += 80) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), lampMat);
      lamp.position.set(x, 38, -650);
      this.scene.add(lamp);
    }
  }

  buildTrees() {
    const rand = mulberry32(41507);
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.1, 5, 6);
    const crownGeo = new THREE.ConeGeometry(5, 13, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3e7a34 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, 160);
    const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, 160);
    const m = new THREE.Matrix4();
    let placed = 0;
    let guard = 0;
    while (placed < 160 && guard < 900) {
      guard += 1;
      const x = -1150 + rand() * 1600;
      const z = -1150 + rand() * 1450;
      if (Math.abs(x) < 470 && z > -820 && z < 340) continue;
      if (isOverWater(x, z)) continue;
      if (isOverRunway(x, z)) continue;
      const y = groundHeight(x, z);
      m.makeTranslation(x, y + 2.5, z);
      trunkMesh.setMatrixAt(placed, m);
      m.makeTranslation(x, y + 10, z);
      crownMesh.setMatrixAt(placed, m);
      placed += 1;
    }
    trunkMesh.count = placed;
    crownMesh.count = placed;
    this.scene.add(trunkMesh);
    this.scene.add(crownMesh);
  }

  buildClouds() {
    const rand = mulberry32(9911);
  // Clouds: flat-lit bright puffs so they read as cloud, not dirt.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff2dd,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 9; i += 1) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rand() * 3);
      for (let p = 0; p < puffs; p += 1) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rand() * 14, 8, 8), mat);
        s.position.set(p * 22 - puffs * 10, rand() * 6, rand() * 10 - 5);
        s.scale.y = 0.45;
        cloud.add(s);
      }
      cloud.position.set(-900 + rand() * 1900, 230 + rand() * 90, -1000 + rand() * 1300);
      cloud.userData.drift = 1.5 + rand() * 2;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildRings() {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc93c,
      transparent: true,
      opacity: 0.95,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffc93c,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    for (const def of RING_COURSE) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.4, 12, 40), ringMat.clone());
      ring.position.set(def.x, def.y, def.z);
      // Default torus faces +/-Z: the hole faces the northbound approach,
      // so the plane flies through it instead of across its edge.
      this.scene.add(ring);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(RING_RADIUS, RING_RADIUS, 260, 24, 1, true),
        beamMat,
      );
      beam.position.set(def.x, def.y, def.z);
      this.scene.add(beam);
      this.rings.push(ring);
      this.ringBeams.push(beam);
    }
  }

  // Next-ring pulse and the vertical light beam that marks it from afar.
  highlightRing(index, time) {
    this.rings.forEach((ring, i) => {
      const active = i === index;
      ring.material.opacity = active ? 0.7 + 0.3 * Math.sin(time * 5) : 0.45;
      ring.scale.setScalar(active ? 1 + 0.05 * Math.sin(time * 5) : 1);
    });
    this.ringBeams.forEach((beam, i) => {
      beam.material.opacity = i === index ? 0.16 : 0.03;
    });
  }

  animate(dt, time) {
    for (const boat of this.boats) {
      boat.position.y = boat.userData.baseY + Math.sin(time * 0.7 + boat.userData.phase) * 0.5;
      boat.rotation.z = Math.sin(time * 0.5 + boat.userData.phase) * 0.02;
    }
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 1300) cloud.position.x = -1300;
    }
  }
}
