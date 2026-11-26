// missions.js — three sortie types with different goals, cycled in order:
// 1. CARGO: load at the home strip, deliver to another island's strip.
// 2. RINGS: fly the floating ring course in order against the clock.
// 3. RESCUE: land at Pulau Api, pick up a stranded pilot, bring them home.
// Landings are the mission's verbs: only a gentle, aligned landing on a strip counts.
import { ISLANDS, RING_COURSE, stripOf } from './world.js';

const HOME = ISLANDS[0];
const KARANG = ISLANDS[1];
const API = ISLANDS[2];

export function makeMissions() {
  return {
    leg: 1,
    kind: 'cargo',
    stage: 'pickup',      // cargo: pickup | loading | deliver ; rings: racing ; rescue: outbound | pickup | return
    stageTimer: 0,
    ringsPassed: 0,
    ringTimer: 150,
    target: KARANG,
    done: 0,
  };
}

function islandName(isl) { return isl.name; }

export function missionTitle(m) {
  if (m.kind === 'cargo') return `Cargo Run — Leg ${m.leg}`;
  if (m.kind === 'rings') return `Ring Race — Leg ${m.leg}`;
  return `Rescue — Leg ${m.leg}`;
}

export function missionObjective(m) {
  if (m.kind === 'cargo') {
    if (m.stage === 'pickup') return `Land on ${islandName(HOME)} strip to load the cargo`;
    if (m.stage === 'loading') return 'Loading cargo… hold still';
    return `Deliver to ${islandName(m.target)} — land on its strip`;
  }
  if (m.kind === 'rings') {
    return `Ring ${m.ringsPassed + 1} of ${RING_COURSE.length} — ${Math.ceil(m.ringTimer)}s left`;
  }
  if (m.stage === 'outbound') return `Fly to ${islandName(API)} — land to reach the stranded pilot`;
  if (m.stage === 'pickup') return 'Pilot climbing aboard… hold still';
  return 'Pilot aboard — fly home and land on Pulau Senja';
}

function nextMission(m) {
  m.leg += 1;
  m.done += 1;
  m.stageTimer = 0;
  if (m.kind === 'cargo') {
    m.kind = 'rings';
    m.stage = 'racing';
    m.ringsPassed = 0;
    m.ringTimer = 150;
  } else if (m.kind === 'rings') {
    m.kind = 'rescue';
    m.stage = 'outbound';
  } else {
    m.kind = 'cargo';
    m.stage = 'pickup';
    // Alternate the delivery island between Karang and Api.
    m.target = m.done % 2 === 1 ? API : KARANG;
  }
}

// React to flight events and the passage of time. ctx: { addScore, showMessage, rings }.
export function updateMissions(m, flight, events, dt, ctx) {
  // --- Ring proximity: flying through the next ring's disc counts. ---
  if (m.kind === 'rings' && m.stage === 'racing') {
    m.ringTimer -= dt;
    const ring = ctx.rings[m.ringsPassed];
    if (ring) {
      const d = Math.hypot(flight.x - ring.x, flight.y - ring.y, flight.z - ring.z);
      if (d < 9) {
        ring.group.children[0].material = ring.group.children[0].material.clone();
        ring.group.children[0].material.color.set(0x7ee2a8);
        m.ringsPassed += 1;
        ctx.addScore(100);
        ctx.showMessage(`Ring ${m.ringsPassed} of ${RING_COURSE.length}! +100`);
        if (m.ringsPassed >= RING_COURSE.length) {
          ctx.addScore(300);
          ctx.showMessage('Course complete! +300 bonus');
          nextMission(m);
          return;
        }
      }
    }
    if (m.ringTimer <= 0) {
      ctx.showMessage('Out of time — the rings reset for the next leg');
      nextMission(m);
      return;
    }
  }

  for (const ev of events) {
    if (ev.type !== 'landed') continue;
    const strip = ev.strip;
    const isl = strip.island;

    if (m.kind === 'cargo') {
      if (m.stage === 'pickup') {
        if (isl === HOME) {
          m.stage = 'loading';
          m.stageTimer = 2;
          ctx.showMessage('Cargo loading…');
        } else {
          ctx.showMessage(`Wrong strip — the cargo is at ${islandName(HOME)}`);
        }
      } else if (m.stage === 'deliver') {
        if (isl === m.target) {
          ctx.addScore(500);
          ctx.showMessage(`Delivered to ${islandName(m.target)}! +500`);
          nextMission(m);
        } else {
          ctx.showMessage(`Wrong strip — deliver to ${islandName(m.target)}`);
        }
      }
    } else if (m.kind === 'rescue') {
      if (m.stage === 'outbound') {
        if (isl === API) {
          m.stage = 'pickup';
          m.stageTimer = 3;
          ctx.showMessage('Found the pilot — hold still…');
        } else {
          ctx.showMessage(`Wrong strip — the pilot waits at ${islandName(API)}`);
        }
      } else if (m.stage === 'return') {
        if (isl === HOME) {
          ctx.addScore(600);
          ctx.showMessage('Pilot home safe! +600');
          nextMission(m);
        } else {
          ctx.showMessage(`Wrong strip — home is ${islandName(HOME)}`);
        }
      }
    }
  }

  // --- Timed stages: loading cargo, picking up the pilot. ---
  if ((m.stage === 'loading' || m.stage === 'pickup') && m.kind !== 'rings') {
    if (!flight.onGround) {
      // Took off early: the stage restarts.
      m.stage = m.kind === 'cargo' ? 'pickup' : 'outbound';
      ctx.showMessage('Too soon — land and hold still');
    } else {
      m.stageTimer -= dt;
      if (m.stageTimer <= 0) {
        if (m.kind === 'cargo') {
          m.stage = 'deliver';
          ctx.showMessage(`Cargo aboard — deliver to ${islandName(m.target)}`);
        } else {
          m.stage = 'return';
          ctx.showMessage('Pilot aboard — fly home!');
        }
      }
    }
  }
}

// Reset the ring visuals when a new leg starts.
export function resetRings(rings) {
  for (const ring of rings) {
    ring.group.children[0].material.color.set(0xffb347);
  }
}
