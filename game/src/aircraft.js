// aircraft.js — the SENJA prop plane, built from three.js primitives so it looks
// built, not drawn: cream fuselage, sunset-orange nose and wingtips, glass canopy,
// spinning propeller with a blur disc, wingtip navigation lights, fixed landing gear.
import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'SenjaPlane';

  const cream = new THREE.MeshLambertMaterial({ color: 0xf5e6c8 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a2c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1c2f4a, shininess: 120, specular: 0x88aaff });
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a8f98 });

  // Fuselage: cylinder along Z (nose at -Z is forward in three.js lookAt terms;
  // we fly nose toward -Z of the plane's local frame and rotate the group by heading).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 4.6, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);

  // Nose cone, sunset orange.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 12), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.85;
  plane.add(nose);

  // Canopy: a squashed glass dome on top of the fuselage.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glass);
  canopy.scale.set(0.85, 0.75, 1.5);
  canopy.position.set(0, 0.62, -0.7);
  plane.add(canopy);

  // Main wing: one long box with orange tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 1.7), cream);
  wing.position.set(0, -0.1, -0.3);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.7), orange);
    tip.position.set(side * 4.55, -0.1, -0.3);
    plane.add(tip);
    // Navigation light: red on the left, green on the right.
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff2222 : 0x22ff66 }),
    );
    lamp.position.set(side * 5.05, -0.1, -0.3);
    plane.add(lamp);
  }

  // Tail: horizontal stabiliser + vertical fin.
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.13, 1.0), cream);
  tailWing.position.set(0, 0.15, 2.25);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.5, 1.2), orange);
  fin.position.set(0, 0.8, 2.25);
  plane.add(fin);

  // Propeller: hub + two blades, spinning around the forward axis.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -3.45);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 10), dark);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.08), bladeMat);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  // Translucent blur disc so the spinning prop reads at speed.
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 24),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
  );
  prop.add(blur);
  plane.add(prop);

  // Fixed landing gear: two wheels on struts + a tail wheel.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), metal);
    strut.position.set(side * 0.85, -0.95, -0.9);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.85, -1.45, -0.9);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, 2.2);
  plane.add(tailWheel);

  // A small orange stripe along the fuselage so the plane reads at a distance.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 3.4), orange);
  stripe.position.set(0, -0.35, -0.6);
  plane.add(stripe);

  return { group: plane, prop, canopy };
}

// Pose the plane group from a flight state: position, heading (yaw), pitch, roll.
export function poseAircraft(planeGroup, state) {
  planeGroup.position.set(state.x, state.y, state.z);
  planeGroup.rotation.order = 'YXZ';
  planeGroup.rotation.y = state.heading;
  planeGroup.rotation.x = state.pitch;
  planeGroup.rotation.z = state.roll;
}
