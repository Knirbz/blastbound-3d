import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Model the bomb family once and ship standalone GLBs. Runtime code only loads them.
globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(rootDir, '../public/assets/blastbound/bombs');
await fs.mkdir(outputDir, { recursive: true });

const material = (name, color, metalness = 0.2, roughness = 0.38, emissive = '#000000', opacity = 1) => {
  const m = new THREE.MeshStandardMaterial({
    name, color, metalness, roughness, emissive,
    transparent: opacity < 1, opacity, depthWrite: opacity === 1,
    flatShading: true,
  });
  return m;
};
const ink = material('midnight enamel', '#17253b', 0.38, 0.28);
const charcoal = material('charcoal armour', '#252a39', 0.4, 0.36);
const iron = material('brushed silver', '#a5b8c3', 0.7, 0.32);
const warmSilver = material('warm steel', '#e4d6bf', 0.38, 0.38);
const copper = material('polished copper', '#d88547', 0.54, 0.3);
const brass = material('brass', '#efbd68', 0.58, 0.31);
const rope = material('braided fuse', '#e8d0a3', 0.0, 0.92);
const orange = material('hot amber', '#ff9f39', 0.18, 0.24, '#a8420d');
const red = material('signal red', '#f24d52', 0.25, 0.26, '#7a1119');
const crimson = material('superbomb lacquer', '#b5273f', 0.43, 0.28);
const cyan = material('energy cyan', '#5ff2ef', 0.18, 0.2, '#158786');
const cobalt = material('cobalt enamel', '#27699b', 0.48, 0.31);
const violet = material('violet enamel', '#6956bd', 0.38, 0.28);
const lilac = material('remote signal', '#c3a6ff', 0.17, 0.24, '#4e3292');
const lime = material('slime light', '#b7f35b', 0.08, 0.23, '#3f8d19');
const goo = material('glossy green slime', '#31c76c', 0.04, 0.16, '#0c5c30');
const pink = material('rival flare', '#f680a0', 0.2, 0.28, '#7e213f');
const pearl = material('ivory light', '#fff5da', 0.1, 0.28, '#666044');

function add(group, geometry, mat, name, x = 0, y = 0, z = 0) {
  const obj = new THREE.Mesh(geometry, mat);
  obj.name = name;
  obj.position.set(x, y, z);
  group.add(obj);
  return obj;
}
function sphere(group, radius, mat, name, x = 0, y = 0.43, z = 0, detail = 2) {
  return add(group, new THREE.IcosahedronGeometry(radius, detail), mat, name, x, y, z);
}
function rounded(group, w, h, d, r, mat, name, x, y, z) {
  return add(group, new RoundedBoxGeometry(w, h, d, 3, r), mat, name, x, y, z);
}
function cap(group, mat = iron) {
  add(group, new THREE.CylinderGeometry(0.15, 0.19, 0.13, 12), mat, 'wick socket', 0, 0.745, 0);
  add(group, new THREE.CylinderGeometry(0.086, 0.11, 0.035, 12), brass, 'socket rim', 0, 0.82, 0);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.84, 0), new THREE.Vector3(0.035, 0.91, 0),
    new THREE.Vector3(0.11, 0.98, 0), new THREE.Vector3(0.15, 1.05, 0),
  ]);
  add(group, new THREE.TubeGeometry(curve, 14, 0.032, 8, false), rope, 'braided wick');
  sphere(group, 0.032, orange, 'ember tip', 0.15, 1.05, 0, 1);
}
function spike(group, angle, mat, length = 0.19, radius = 0.083, y = 0.43) {
  const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const cone = add(group, new THREE.ConeGeometry(radius, length, 5), mat, 'armoured fang');
  cone.position.copy(direction.clone().multiplyScalar(0.345 + length * 0.28));
  cone.position.y = y;
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}
function newModel(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

function normal() {
  const g = newModel('Blastbound classic bomb');
  sphere(g, 0.365, ink, 'single dark spherical shell', 0, 0.4, 0, 3);
  sphere(g, 0.11, orange, 'indicator', 0, 0.43, 0.345, 1).scale.set(0.85, 0.85, 0.28);
  add(g, new THREE.CylinderGeometry(0.125, 0.17, 0.11, 12), copper, 'copper fuse seat', 0, 0.78);
  cap(g, iron);
  return g;
}

function boosted() {
  const g = newModel('Blastbound tall cyan boost canister');
  const body = add(g, new THREE.CylinderGeometry(0.255, 0.305, 0.6, 10), cobalt, 'tall cobalt canister', 0, 0.43);
  body.rotation.y = Math.PI / 10;
  const top = sphere(g, 0.255, cyan, 'cyan upper dome', 0, 0.73, 0, 2);
  top.scale.set(1, 0.44, 1);
  add(g, new THREE.CylinderGeometry(0.26, 0.27, 0.08, 10), iron, 'steel heel', 0, 0.09);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const fin = rounded(g, 0.09, 0.32, 0.18, 0.025, cyan, 'coolant fin', Math.sin(angle) * 0.29, 0.38, Math.cos(angle) * 0.29);
    fin.rotation.y = angle;
  }
  rounded(g, 0.2, 0.23, 0.04, 0.03, pearl, 'indicator', 0, 0.47, 0.296);
  add(g, new THREE.CylinderGeometry(0.085, 0.1, 0.1, 10), iron, 'pressure valve', 0, 0.86);
  sphere(g, 0.04, orange, 'ember tip', 0.02, 0.93, 0, 1);
  return g;
}

function power() {
  const g = newModel('Blastbound square gold power block');
  rounded(g, 0.66, 0.64, 0.66, 0.105, brass, 'solid gold charge', 0, 0.39, 0);
  for (const x of [-0.275, 0.275]) for (const z of [-0.275, 0.275]) {
    rounded(g, 0.09, 0.6, 0.09, 0.025, copper, 'corner armour', x, 0.4, z);
  }
  const crystal = add(g, new THREE.OctahedronGeometry(0.21, 0), cyan, 'indicator', 0, 0.43, 0.355);
  crystal.scale.set(0.75, 1.1, 0.36);
  rounded(g, 0.33, 0.06, 0.04, 0.02, warmSilver, 'upper status plate', 0, 0.68, 0.29);
  add(g, new THREE.CylinderGeometry(0.09, 0.14, 0.12, 8), copper, 'gold top socket', 0, 0.76);
  sphere(g, 0.04, orange, 'ember tip', 0, 0.86, 0, 1);
  return g;
}

function superBomb() {
  const g = newModel('Blastbound scarlet super bomb');
  const core = add(g, new THREE.DodecahedronGeometry(0.405, 0), crimson, 'solid scarlet faceted core', 0, 0.46);
  core.scale.set(1, 0.94, 1);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    spike(g, angle, red, 0.32, 0.11, 0.46);
  }
  for (const x of [-0.18, 0.18]) {
    const horn = add(g, new THREE.ConeGeometry(0.11, 0.3, 5), red, 'red crown horn', x, 0.87, 0);
    horn.rotation.z = x < 0 ? 0.2 : -0.2;
  }
  const gem = add(g, new THREE.OctahedronGeometry(0.14, 0), pearl, 'indicator', 0, 0.48, 0.4);
  gem.scale.set(0.82, 1.15, 0.38);
  sphere(g, 0.045, orange, 'ember tip', 0, 1.05, 0, 1);
  return g;
}

function remote() {
  const g = newModel('Blastbound violet remote transceiver');
  rounded(g, 0.69, 0.55, 0.5, 0.12, violet, 'violet radio body', 0, 0.38, 0);
  rounded(g, 0.47, 0.29, 0.045, 0.045, charcoal, 'front control panel', 0, 0.43, 0.26);
  rounded(g, 0.27, 0.16, 0.052, 0.02, lilac, 'indicator', -0.055, 0.49, 0.29);
  for (const x of [0.18, 0.27]) sphere(g, 0.035, cyan, 'control light', x, 0.34, 0.29, 1);
  for (const x of [-0.28, 0.28]) rounded(g, 0.11, 0.18, 0.6, 0.035, ink, 'radio foot', x, 0.13, 0);
  const aerial = add(g, new THREE.CylinderGeometry(0.019, 0.028, 0.4, 8), iron, 'raised remote aerial', 0.24, 0.84, 0);
  aerial.rotation.z = -0.18;
  sphere(g, 0.08, lilac, 'ember tip', 0.275, 1.03, 0, 1);
  return g;
}

function slime() {
  const g = newModel('Blastbound lime slime glob');
  const body = sphere(g, 0.37, goo, 'one bright slime body', 0, 0.39, 0, 3);
  body.scale.set(1.05, 1.02, 1.02);
  for (const [x, y, z, radius] of [[-0.27, 0.23, 0.16, 0.18], [0.28, 0.19, 0.08, 0.16], [0.06, 0.13, -0.29, 0.15]]) {
    sphere(g, radius, goo, 'slime body lobe', x, y, z, 2);
  }
  for (const [x, y, z, radius] of [[-0.27, 0.04, 0.18, 0.065], [0.32, 0.03, 0.09, 0.05]]) {
    sphere(g, radius, lime, 'hanging slime drop', x, y, z, 1);
  }
  const eye = sphere(g, 0.12, lime, 'indicator', 0, 0.43, 0.35, 1);
  eye.scale.set(1.1, 0.8, 0.45);
  sphere(g, 0.14, goo, 'crown bubble', -0.12, 0.77, -0.05, 2);
  sphere(g, 0.038, orange, 'ember tip', -0.16, 0.91, 0, 1);
  return g;
}

function enemy() {
  const g = newModel('Blastbound pink rival charge');
  const core = add(g, new THREE.OctahedronGeometry(0.44, 0), pink, 'pink diamond body', 0, 0.49, 0);
  core.scale.set(1, 0.88, 0.9);
  const mask = rounded(g, 0.34, 0.19, 0.045, 0.035, charcoal, 'rival black mask', 0, 0.49, 0.34);
  mask.rotation.x = -0.18;
  for (const x of [-0.085, 0.085]) sphere(g, 0.045, pearl, 'rival eye', x, 0.5, 0.375, 1);
  for (const x of [-0.24, 0.24]) {
    const horn = add(g, new THREE.ConeGeometry(0.1, 0.27, 5), pink, 'rival upper horn', x, 0.92);
    horn.rotation.z = x < 0 ? 0.3 : -0.3;
  }
  sphere(g, 0.05, red, 'indicator', 0, 0.7, 0.24, 1);
  sphere(g, 0.04, orange, 'ember tip', 0, 1.06, 0, 1);
  return g;
}

const variants = {
  normal: normal(), boosted: boosted(), power: power(), super: superBomb(),
  remote: remote(), slime: slime(), enemy: enemy(),
};
const exporter = new GLTFExporter();
for (const [name, model] of Object.entries(variants)) {
  const bytes = await exporter.parseAsync(model, { binary: true, onlyVisible: true, trs: false });
  const destination = path.join(outputDir, `${name}.glb`);
  await fs.writeFile(destination, Buffer.from(bytes));
  console.log(`${name}: ${Buffer.byteLength(Buffer.from(bytes))} bytes`);
}
