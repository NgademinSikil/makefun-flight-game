// main.js — SENJA: Sunset Archipelago Pilot. Glue: renderer, chase/cockpit cameras,
// the title → flying → crashed loop, mission wiring, and the ?shot= pose mode
// that stages each screenshot (cover = chase view over the islands at sunset).
import * as THREE from 'three';
import { buildWorld, ISLANDS, RING_COURSE, stripOf } from './world.js';
import { buildAircraft, poseAircraft } from './aircraft.js';
import { makeFlightState, stepFlight, forwardOf, compassOf } from './physics.js';
import { makeMissions, missionTitle, updateMissions, resetRings } from './missions.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { makeHud } from './hud.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // chase | cockpit | landing | rings

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
const world = buildWorld(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);

const flight = makeFlightState(ISLANDS[0]);
flight.throttle = 0;
const missions = makeMissions();
const input = makeInput();
const audio = makeAudio();
const hud = makeHud();

let gameState = SHOT ? 'shot' : 'title'; // title | flying | crashed | paused | shot
let cameraMode = 'chase';
let score = 0;
let crashTimer = 0;
let prevMissionKind = missions.kind;
let lookYaw = 0, lookPitch = 0;
const camPos = new THREE.Vector3(20, 20, 20);

function addScore(n) { score += n; }

// --- Screenshot poses: the plane staged mid-flight, HUD lit, rings/runway ahead. ---
function applyShotPose() {
  const home = stripOf(ISLANDS[0]);
  if (SHOT === 'cockpit') {
    Object.assign(flight, {
      x: -190, y: 46, z: 10, heading: (3 * Math.PI) / 2, pitch: -0.04, roll: 0,
      speed: 34, throttle: 0.62, fuel: 78, damage: 0, onGround: false, gearDown: true,
    });
    missions.kind = 'cargo'; missions.stage = 'deliver'; missions.target = ISLANDS[1];
    cameraMode = 'cockpit';
  } else if (SHOT === 'landing') {
    Object.assign(flight, {
      x: 150, y: 30, z: 6, heading: Math.PI / 2, pitch: -0.06, roll: 0,
      speed: 22, throttle: 0.32, fuel: 45, damage: 12, onGround: false, gearDown: true,
    });
    missions.kind = 'rescue'; missions.stage = 'return';
    cameraMode = 'chase';
  } else if (SHOT === 'rings') {
    Object.assign(flight, {
      x: 150, y: 66, z: -60, heading: -Math.PI / 4, pitch: 0.02, roll: -0.12,
      speed: 40, throttle: 0.78, fuel: 71, damage: 0, onGround: false, gearDown: false,
    });
    missions.kind = 'rings'; missions.stage = 'racing'; missions.ringsPassed = 0; missions.ringTimer = 142;
    cameraMode = 'chase';
  } else {
    // chase (cover): over the islands at sunset, rings ahead, plane banked slightly.
    Object.assign(flight, {
      x: 60, y: 62, z: 140, heading: -0.735, pitch: 0.02, roll: 0.1,
      speed: 38, throttle: 0.72, fuel: 82, damage: 0, onGround: false, gearDown: false,
    });
    missions.kind = 'rings'; missions.stage = 'racing'; missions.ringsPassed = 1; missions.ringTimer = 118;
    // Ring 1 is already behind us in this pose: show it as passed (green).
    world.rings[0].group.children[0].material = world.rings[0].group.children[0].material.clone();
    world.rings[0].group.children[0].material.color.set(0x7ee2a8);
    cameraMode = 'chase';
  }
  flight.verticalSpeed = Math.sin(flight.pitch) * flight.speed;
  hud.update(flight, missions, score, cameraMode);
}

function resetLeg() {
  // After a crash the current leg restarts: same leg number, score kept.
  if (missions.kind === 'cargo') missions.stage = 'pickup';
  if (missions.kind === 'rings') {
    missions.stage = 'racing'; missions.ringsPassed = 0; missions.ringTimer = 150;
    resetRings(world.rings);
  }
  if (missions.kind === 'rescue') missions.stage = 'outbound';
  missions.stageTimer = 0;
}

function respawn() {
  const home = stripOf(ISLANDS[0]);
  Object.assign(flight, makeFlightState(ISLANDS[0]));
  flight.throttle = 0;
  resetLeg();
  hud.showCrash(false);
  hud.showMessage('Back on Pulau Senja — throttle up and fly');
  hud.announce('Respawned at Pulau Senja');
  gameState = 'flying';
}

function onCrash(reason) {
  gameState = 'crashed';
  crashTimer = 3.5;
  audio.crash();
  hud.showCrash(true, reason, score);
  hud.announce(`Crashed: ${reason}. Score ${score}.`);
}

function updateCamera(dt, time) {
  const fwd = forwardOf(flight);
  if (cameraMode === 'cockpit') {
    // Camera above the pilot's seat, looking forward over the nose. The glass
    // canopy is hidden in this view (it would fill the frame from inside);
    // the orange nose tip reads at the bottom, the islands ahead stay clear.
    aircraft.canopy.visible = false;
    const offset = new THREE.Vector3(0, 1.35, -0.5);
    offset.applyEuler(new THREE.Euler(flight.pitch, flight.heading, flight.roll, 'YXZ'));
    camera.position.set(flight.x + offset.x, flight.y + offset.y, flight.z + offset.z);
    const look = new THREE.Vector3(
      flight.x + fwd.x * 40, flight.y + fwd.y * 40 - 0.8, flight.z + fwd.z * 40,
    );
    camera.lookAt(look);
    camera.rotation.z += flight.roll * 0.55;
    return;
  }
  // Chase: behind and above the plane, eased so it never snaps or fights the pilot.
  aircraft.canopy.visible = true;
  const back = 13.5, up = 4.6;
  const desired = new THREE.Vector3(
    flight.x - fwd.x * back + Math.sin(flight.heading + lookYaw) * 0,
    flight.y - fwd.y * back + up,
    flight.z - fwd.z * back,
  );
  // Mouse look: orbit the chase camera a little around the plane, in the
  // plane's own frame (right = (cos hdg, 0, -sin hdg), up = +Y).
  const lookOffset = new THREE.Vector3(
    Math.cos(flight.heading) * lookYaw * 6,
    lookPitch * 4,
    -Math.sin(flight.heading) * lookYaw * 6,
  );
  desired.add(lookOffset);
  if (gameState === 'shot') {
    // Screenshots stage a fixed pose: snap the camera, never ease toward it,
    // or the shot is taken mid-convergence.
    camPos.copy(desired);
  } else {
    const k = 1 - Math.exp(-5.5 * dt);
    camPos.lerp(desired, k);
  }
  camera.position.copy(camPos);
  const look = new THREE.Vector3(
    flight.x + fwd.x * 14, flight.y + fwd.y * 14 + 0.5, flight.z + fwd.z * 14,
  );
  camera.lookAt(look);
  camera.rotation.z += flight.roll * 0.35;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  // Propeller spins with throttle; clouds drift; the next ring pulses.
  aircraft.prop.rotation.z -= dt * (6 + flight.throttle * 34);
  for (const cloud of world.clouds) {
    cloud.group.position.x += cloud.speed * dt;
    if (cloud.group.position.x > 1000) cloud.group.position.x = -1000;
  }
  if (missions.kind === 'rings' && missions.ringsPassed < RING_COURSE.length) {
    const next = world.rings[missions.ringsPassed];
    if (next) {
      const s = 1 + Math.sin(time * 3) * 0.045;
      next.group.scale.set(s, s, s);
    }
  }

  if (gameState === 'shot') {
    poseAircraft(aircraft.group, flight);
    updateCamera(dt, time);
    renderer.render(scene, camera);
    window.__senjaReady = true;
    return;
  }

  if (gameState === 'title') {
    if (input.consume('start')) {
      audio.ensure();
      hud.showTitle(false);
      hud.showMessage('Throttle up with Shift — fly!');
      hud.announce('Flying. Cargo run, leg 1.');
      gameState = 'flying';
    }
    // Title screen: slow orbit around the home island so the scene is alive.
    const a = time * 0.06;
    camera.position.set(Math.sin(a) * 260, 90, Math.cos(a) * 260);
    camera.lookAt(0, 12, 0);
    poseAircraft(aircraft.group, flight);
    renderer.render(scene, camera);
    return;
  }

  if (gameState === 'crashed') {
    crashTimer -= dt;
    if (input.consume('restart') || crashTimer <= 0) respawn();
    poseAircraft(aircraft.group, flight);
    updateCamera(dt, time);
    audio.update(flight, false);
    renderer.render(scene, camera);
    return;
  }

  if (gameState === 'paused') {
    if (input.consume('pause')) {
      gameState = 'flying';
      hud.showMessage('Flying');
    }
    renderer.render(scene, camera);
    return;
  }

  // --- Flying. ---
  if (input.consume('pause')) {
    gameState = 'paused';
    hud.showMessage('Paused — press P to fly');
    renderer.render(scene, camera);
    return;
  }
  if (input.consume('camera')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.showMessage(cameraMode === 'cockpit' ? 'Cockpit camera' : 'Chase camera');
  }
  if (input.consume('gear')) {
    flight.gearDown = !flight.gearDown;
    hud.showMessage(flight.gearDown ? 'Gear down' : 'Gear up');
  }
  if (input.consume('mute')) {
    const on = audio.toggle();
    hud.showMessage(on ? 'Sound on' : 'Sound off');
  }
  const look = input.consumeLook();
  lookYaw = Math.max(-0.9, Math.min(0.9, lookYaw - look.dx * 0.0035));
  lookPitch = Math.max(-0.5, Math.min(0.5, lookPitch + look.dy * 0.002));

  const axes = input.axes();
  const events = stepFlight(flight, axes, dt);

  // A fresh rings leg resets the ring visuals.
  if (prevMissionKind !== 'rings' && missions.kind === 'rings') resetRings(world.rings);
  prevMissionKind = missions.kind;

  const ctx = {
    addScore: (n) => { addScore(n); if (n >= 300) audio.delivered(); },
    showMessage: (t) => hud.showMessage(t),
    rings: world.rings,
  };
  updateMissions(missions, flight, events, dt, ctx);

  for (const ev of events) {
    if (ev.type === 'landed') {
      audio.landed();
      if (!flight.gearDown) {
        flight.damage += 20;
        hud.showMessage('Gear-up landing! +20 damage — lower the gear (G) next time');
        audio.warning();
        if (flight.damage >= 100) { onCrash('gear-up landing tore the plane apart'); break; }
      } else {
        hud.showMessage(`Landed on ${ev.strip.island.name} — fuel refills here`);
      }
      if (missions.kind === 'rings') {
        // Landing during a ring race ends the leg's clock politely.
        hud.showMessage('Nice landing — the rings are still waiting');
      }
    } else if (ev.type === 'takeoff') {
      hud.showMessage('Airborne!');
    } else if (ev.type === 'hard-landing') {
      audio.warning();
      hud.showMessage(`Hard landing! +${Math.round(ev.damage)} damage`);
    } else if (ev.type === 'fuel-empty') {
      audio.warning();
      hud.showMessage('FUEL EMPTY — glide to a runway!');
    } else if (ev.type === 'crash') {
      onCrash(ev.reason);
    }
  }

  if (flight.outOfBounds) hud.showMessage('Open sea ahead — turn back to the islands');
  if (flight.fuel > 0 && flight.fuel < 20 && Math.floor(time * 2) % 2 === 0) {
    hud.showMessage('LOW FUEL — land on a strip to refuel');
  }

  poseAircraft(aircraft.group, flight);
  updateCamera(dt, time);
  audio.update(flight, true);
  hud.update(flight, missions, score, cameraMode);
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
if (SHOT) {
  applyShotPose();
  hud.showTitle(false);
  hud.showMessage(missionTitle(missions));
} else {
  hud.showTitle(true);
  hud.update(flight, missions, score, cameraMode);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle for play-testing from the console.
window.__senja = { flight, missions, get score() { return score; } };

animate();
