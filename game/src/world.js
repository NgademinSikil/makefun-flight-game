// world.js — the Senja archipelago: sunset sky, sea, volcanic islands with airstrips,
// floating rings, drifting clouds. One fixed layout (seed 7) so the world is the same
// for every player and every screenshot.
//
// Islands are named places with a flat top plateau; three of them carry an airstrip.
// heightAt(x, z) is the ground height the flight model and the landing checks use.
import * as THREE from 'three';
import { mulberry32, smoothstep } from './rng.js';

export const WORLD_SEED = 7;
export const SEA_LEVEL = 0;

// Hand-placed islands: name, centre, outer radius, plateau radius, plateau height,
// whether it is a volcano, whether it has an airstrip, strip heading in degrees.
export const ISLANDS = [
  { name: 'Pulau Senja',  x: 0,    z: 0,    r: 150, pr: 62, h: 9,  volcano: false, strip: true,  stripHdg: 90 },
  { name: 'Pulau Karang', x: 430,  z: -270, r: 130, pr: 55, h: 9,  volcano: false, strip: true,  stripHdg: 25 },
  { name: 'Pulau Api',    x: -390, z: -330, r: 145, pr: 58, h: 12, volcano: true,  strip: true,  stripHdg: 140 },
  { name: 'Pulau Hijau',  x: 310,  z: 390,  r: 120, pr: 48, h: 8,  volcano: false, strip: false, stripHdg: 0 },
  { name: 'Pulau Kabut',  x: -430, z: 250,  r: 110, pr: 44, h: 8,  volcano: false, strip: false, stripHdg: 0 },
  { name: 'Pulau Batu',   x: 720,  z: 120,  r: 95,  pr: 38, h: 10, volcano: true,  strip: false, stripHdg: 0 },
  { name: 'Pulau Ombak',  x: -660, z: -90,  r: 100, pr: 40, h: 7,  volcano: false, strip: false, stripHdg: 0 },
  { name: 'Pulau Terang', x: 130,  z: -570, r: 105, pr: 42, h: 8,  volcano: false, strip: false, stripHdg: 0 },
  { name: 'Pulau Kecil',  x: -150, z: 530,  r: 80,  pr: 32, h: 7,  volcano: false, strip: false, stripHdg: 0 },
];

// Ring race course: six floating rings strung between the islands.
export const RING_COURSE = [
  { x: 210,  y: 62, z: -120 },
  { x: 380,  y: 78, z: -180 },
  { x: 300,  y: 55, z: 120 },
  { x: 60,   y: 85, z: 260 },
  { x: -220, y: 60, z: 60 },
  { x: -180, y: 72, z: -210 },
];

export function heightAt(x, z) {
  let h = SEA_LEVEL;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d >= isl.r) continue;
    let ground;
    if (d <= isl.pr) {
      ground = isl.h;
    } else {
      // Slope from plateau edge down to the sea.
      ground = isl.h * (1 - smoothstep(isl.pr, isl.r, d));
    }
    if (isl.volcano && d < isl.pr * 0.55) {
      // Volcano cone rises above the plateau; its crater rim is the highest point.
      const cone = isl.h + (isl.pr * 0.55 - d) * 0.55;
      ground = Math.max(ground, cone);
    }
    h = Math.max(h, ground);
  }
  return h;
}

// The airstrip of an island: centre, heading, length. Strips sit on the plateau.
export function stripOf(island) {
  const hdg = (island.stripHdg * Math.PI) / 180;
  return {
    island,
    x: island.x,
    z: island.z,
    y: island.h + 0.6,
    hdg,
    length: 64,
    width: 11,
  };
}

export function buildWorld(scene) {
  const rand = mulberry32(WORLD_SEED);
  const group = new THREE.Group();
  group.name = 'SenjaArchipelago';

  // --- Sunset sky dome: a shader sphere, horizon amber to zenith indigo. ---
  const skyGeo = new THREE.SphereGeometry(3200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2b3a6e) },
      mid: { value: new THREE.Color(0xe86a8a) },
      low: { value: new THREE.Color(0xff9a3c) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = h < 0.12 ? mix(low, mid, h / 0.12) : mix(mid, top, (h - 0.12) / 0.55);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // --- Low sun disc and warm light. ---
  const sunDir = new THREE.Vector3(-0.55, 0.16, -0.82).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sun.position.copy(sunDir).multiplyScalar(2900);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(260, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.28, fog: false }),
  );
  sunGlow.position.copy(sunDir).multiplyScalar(2880);
  sunGlow.lookAt(0, 0, 0);
  group.add(sunGlow);

  const sunLight = new THREE.DirectionalLight(0xffb066, 2.1);
  sunLight.position.copy(sunDir).multiplyScalar(600);
  group.add(sunLight);
  group.add(new THREE.AmbientLight(0x8a7bb8, 0.85));
  const hemi = new THREE.HemisphereLight(0xff9a6a, 0x1d4a63, 0.7);
  group.add(hemi);

  scene.fog = new THREE.Fog(0xf2a56b, 260, 2100);

  // --- Sea: a wide plane with a warm sun glint. Lit enough to read as water. ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshPhongMaterial({ color: 0x1e6f92, shininess: 110, specular: 0xff9a50, emissive: 0x0a2a3a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL;
  group.add(sea);

  // --- Islands: sand ring, green cone slopes, volcano craters, airstrips. ---
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe0c090 });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a8a55 });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x5a4a52 });
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a1e });
  const stripMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });

  for (const isl of ISLANDS) {
    const islGroup = new THREE.Group();
    islGroup.position.set(isl.x, 0, isl.z);

    // Sand base: a squat cone from the sea up to the plateau rim.
    const base = new THREE.Mesh(new THREE.ConeGeometry(isl.r, isl.h + 6, 24), sandMat);
    base.position.y = (isl.h + 6) / 2 - 3;
    islGroup.add(base);
    // Green slopes: a slightly smaller, taller cone peeking above the sand.
    const green = new THREE.Mesh(new THREE.ConeGeometry(isl.r * 0.82, isl.h + 4, 24), grassMat);
    green.position.y = (isl.h + 4) / 2 - 1.5;
    islGroup.add(green);
    // Flat grass plateau on top.
    const top = new THREE.Mesh(new THREE.CylinderGeometry(isl.pr, isl.pr * 1.05, 2.4, 24), grassMat);
    top.position.y = isl.h - 0.4;
    islGroup.add(top);

    if (isl.volcano) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(isl.pr * 0.55, isl.pr * 0.32, 20), rockMat);
      cone.position.y = isl.h + isl.pr * 0.14;
      islGroup.add(cone);
      const crater = new THREE.Mesh(new THREE.CircleGeometry(isl.pr * 0.2, 20), lavaMat);
      crater.rotation.x = -Math.PI / 2;
      crater.position.y = isl.h + isl.pr * 0.30 + 0.2;
      islGroup.add(crater);
    }

    // A few palm-ish trees: trunk + canopy ball, scattered on the plateau.
    const trees = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < trees; i++) {
      const a = rand() * Math.PI * 2;
      const rr = rand() * (isl.pr - 14);
      const tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 5, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
      );
      trunk.position.set(tx, isl.h + 2.5, tz);
      islGroup.add(trunk);
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x2f6b35 }),
      );
      canopy.position.set(tx, isl.h + 6, tz);
      canopy.scale.y = 0.7;
      islGroup.add(canopy);
    }

    if (isl.strip) {
      const strip = stripOf(isl);
      const stripGroup = new THREE.Group();
      stripGroup.position.set(0, isl.h + 0.4, 0);
      stripGroup.rotation.y = -strip.hdg;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(strip.length, 0.7, strip.width), stripMat);
      pad.position.y = 0.1;
      stripGroup.add(pad);
      // Centre dashes.
      for (let d = -24; d <= 24; d += 8) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.7), lineMat);
        dash.position.set(d, 0.55, 0);
        stripGroup.add(dash);
      }
      // Threshold bars at both ends.
      for (const e of [-strip.length / 2 + 3, strip.length / 2 - 3]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, strip.width - 2), lineMat);
        bar.position.set(e, 0.55, 0);
        stripGroup.add(bar);
      }
      // Windsock beside the strip.
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
      );
      pole.position.set(0, 3.5, strip.width / 2 + 6);
      stripGroup.add(pole);
      const sock = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 3.4, 8),
        new THREE.MeshBasicMaterial({ color: 0xff7b2f }),
      );
      sock.rotation.z = Math.PI / 2;
      sock.position.set(1.8, 6.6, strip.width / 2 + 6);
      stripGroup.add(sock);
      islGroup.add(stripGroup);
    }
    group.add(islGroup);
  }

  // --- Floating rings for the ring race: glowing tori with a beacon light. ---
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const ringInner = new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.35 });
  const rings = [];
  for (const rc of RING_COURSE) {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(rc.x, rc.y, rc.z);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 10, 32), ringMat);
    ringGroup.add(torus);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.4, 32), ringInner);
    disc.material = ringInner.clone();
    ringGroup.add(disc);
    // The ring faces the home island so the pilot flies through it head-on.
    ringGroup.lookAt(0, rc.y, 0);
    group.add(ringGroup);
    rings.push({ group: ringGroup, x: rc.x, y: rc.y, z: rc.z, passed: false });
  }

  // --- Clouds: flattened white puffs drifting slowly. ---
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffe8d8, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rand() * 10, 10, 8), cloudMat);
      s.position.set((rand() - 0.5) * 34, (rand() - 0.5) * 5, (rand() - 0.5) * 14);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set((rand() - 0.5) * 1800, 130 + rand() * 90, (rand() - 0.5) * 1800);
    group.add(cloud);
    clouds.push({ group: cloud, speed: 1.2 + rand() * 1.6 });
  }

  scene.add(group);
  return { group, rings, clouds };
}
