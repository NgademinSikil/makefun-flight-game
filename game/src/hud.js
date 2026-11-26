// hud.js — the instrument panel: altitude, speed, heading, vertical speed, fuel,
// throttle and damage bars, mission banner, score, compass line and the centre
// message toast. Instruments are lit amber on dark glass so they read in a
// screenshot at a glance.
import { compassOf } from './physics.js';
import { missionTitle, missionObjective } from './missions.js';

const $ = (id) => document.getElementById(id);

export function makeHud() {
  const hud = {
    msgTimer: null,
  };

  hud.showMessage = function showMessage(text, ms) {
    const el = $('hud-msg');
    el.textContent = text;
    el.style.display = 'block';
    if (hud.msgTimer) clearTimeout(hud.msgTimer);
    hud.msgTimer = setTimeout(() => { el.style.display = 'none'; }, ms || 2600);
  };

  hud.update = function update(flight, missions, score, cameraMode) {
    $('hud-alt').textContent = `${Math.max(0, Math.round(flight.y))} m`;
    $('hud-spd').textContent = `${Math.round(flight.speed * 1.944)} kt`;
    $('hud-hdg').textContent = `${String(Math.round(compassOf(flight.heading))).padStart(3, '0')}°`;
    const vs = flight.verticalSpeed;
    $('hud-vert').textContent = `${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`;
    $('hud-fuel-pct').textContent = `${Math.round(flight.fuel)}%`;
    $('fuel-fill').style.width = `${Math.max(0, flight.fuel)}%`;
    $('hud-thr-pct').textContent = `${Math.round(flight.throttle * 100)}%`;
    $('thr-fill').style.width = `${flight.throttle * 100}%`;
    $('hud-dmg-pct').textContent = `${Math.round(flight.damage)}%`;
    $('dmg-fill').style.width = `${Math.min(100, flight.damage)}%`;
    $('hud-score-num').textContent = String(score);
    $('hud-leg').textContent = `Leg ${missions.leg} · ${missions.kind === 'cargo' ? 'Cargo' : missions.kind === 'rings' ? 'Ring Race' : 'Rescue'}`;
    $('hud-mission-title').textContent = missionTitle(missions);
    $('hud-mission-obj').textContent = missionObjective(missions);
    $('hud-compass-num').textContent = `${String(Math.round(compassOf(flight.heading))).padStart(3, '0')}°`;
    $('hud-cam').textContent = cameraMode === 'cockpit' ? 'COCKPIT CAM' : 'CHASE CAM';
    $('hud-gear').textContent = flight.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    $('hud-gear').style.color = flight.gearDown ? '#7ee2a8' : '#ffe9b0';
    $('fuel-fill').style.background = flight.fuel < 20
      ? 'linear-gradient(90deg, #ff5d5d, #c81e1e)'
      : 'linear-gradient(90deg, #ffb347, #ff7b2f)';
  };

  hud.showTitle = function showTitle(show) { $('title').style.display = show ? 'flex' : 'none'; };
  hud.showCrash = function showCrash(show, reason, score) {
    $('crash').style.display = show ? 'flex' : 'none';
    if (show) {
      $('crash-sub').textContent = reason ? `The plane ${reason}. The pilot walks away.` : 'The pilot walks away.';
      $('crash-score').textContent = `Score: ${score} — press R to fly again`;
    }
  };
  hud.announce = function announce(text) {
    $('status').textContent = text;
  };

  return hud;
}
