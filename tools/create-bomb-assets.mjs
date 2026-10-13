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
const inkLight = material('blue steel facet', '#31435f', 0.46, 0.3);
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
const goo = material('glossy slime', '#4dcfa6', 0.04, 0.13, '#126d5c', 0.82);
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
function ring(group, radius, tube, mat, name, y, tilt = 0) {
  const obj = add(group, new THREE.TorusGeometry(radius, tube, 8, 32), mat, name, 0, y, 0);
  obj.rotation.x = Math.PI / 2 + tilt;
  return obj;
}
function radialStuds(group, mat, count = 8, radius = 0.31, y = 0.43, size = 0.025) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    sphere(group, size, mat, `hammered rivet ${i + 1}`, Math.sin(angle) * radius, y, Math.cos(angle) * radius, 1);
  }
}
function base(group, mat = ink) {
  add(group, new THREE.CylinderGeometry(0.29, 0.32, 0.07, 12), charcoal, 'weighted foot', 0, 0.065, 0);
  ring(group, 0.3, 0.018, mat, 'lower edge', 0.12);
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
function eye(group, mat, name, z = 0.345, width = 0.16, height = 0.13) {
  rounded(group, width + 0.075, height + 0.055, 0.045, 0.025, charcoal, 'indicator bezel', 0, 0.43, z - 0.01);
  return rounded(group, width, height, 0.052, 0.022, mat, name, 0, 0.43, z + 0.025);
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
  base(g);
  sphere(g, 0.342, ink, 'midnight enamel shell');
  const visor = sphere(g, 0.25, inkLight, 'upper enamel facet', -0.09, 0.52, -0.08, 1);
  visor.scale.set(0.64, 0.42, 0.25);
  ring(g, 0.335, 0.027, copper, 'copper equator', 0.34);
  ring(g, 0.28, 0.019, warmSilver, 'silver shoulder', 0.62);
  radialStuds(g, brass, 8, 0.334, 0.34);
  eye(g, orange, 'indicator');
  for (const x of [-0.11, 0.11]) sphere(g, 0.026, iron, 'visor bolt', x, 0.43, 0.366, 1);
  cap(g); return g;
}

function boosted() {
  const g = newModel('Blastbound boost bomb');
  base(g, cyan);
  sphere(g, 0.345, cobalt, 'cobalt pressure vessel');
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = Math.sin(angle) * 0.305, z = Math.cos(angle) * 0.305;
    const fin = rounded(g, 0.13, 0.22, 0.058, 0.022, iron, 'armoured coolant rib', x, 0.45, z);
    fin.rotation.y = angle;
  }
  ring(g, 0.338, 0.037, cyan, 'luminous range ring', 0.35);
  ring(g, 0.282, 0.016, iron, 'upper trim', 0.61);
  radialStuds(g, pearl, 8, 0.334, 0.35, 0.02);
  eye(g, cyan, 'indicator');
  cap(g, iron); return g;
}

function power() {
  const g = newModel('Blastbound power bomb');
  base(g, brass);
  const body = sphere(g, 0.355, copper, 'octagonal gold charge', 0, 0.43, 0, 1);
  body.scale.set(1, 1.03, 1);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const plate = rounded(g, 0.21, 0.38, 0.07, 0.025, brass, 'gold shield plate', Math.sin(angle) * 0.34, 0.43, Math.cos(angle) * 0.34);
    plate.rotation.y = angle;
  }
  ring(g, 0.375, 0.042, cyan, 'maximum charge coil', 0.43);
  ring(g, 0.3, 0.023, warmSilver, 'upper gold rim', 0.62);
  eye(g, pearl, 'indicator', 0.395, 0.19, 0.17);
  for (const x of [-0.12, 0.12]) sphere(g, 0.033, cyan, 'cyan side crystal', x, 0.43, 0.397, 1);
  cap(g, brass); return g;
}

function superBomb() {
  const g = newModel('Blastbound super bomb');
  base(g, red);
  sphere(g, 0.35, charcoal, 'forged black armour');
  const armour = sphere(g, 0.335, crimson, 'red armour crown', 0, 0.46, 0, 1);
  armour.scale.set(1.04, 0.78, 1.04);
  for (let i = 0; i < 8; i++) spike(g, (i / 8) * Math.PI * 2, i % 2 ? warmSilver : red, 0.2, 0.09);
  ring(g, 0.35, 0.045, red, 'piercing charge ring', 0.37);
  ring(g, 0.285, 0.021, warmSilver, 'upper steel rim', 0.63);
  radialStuds(g, iron, 8, 0.36, 0.37, 0.028);
  const gem = add(g, new THREE.OctahedronGeometry(0.125, 0), red, 'indicator', 0, 0.44, 0.4);
  gem.scale.set(1.04, 1.3, 0.46);
  for (const x of [-0.16, 0.16]) {
    const fang = add(g, new THREE.ConeGeometry(0.063, 0.18, 5), crimson, 'crown fang', x, 0.77, 0);
    fang.rotation.z = x < 0 ? 0.2 : -0.2;
  }
  cap(g, iron); return g;
}

function remote() {
  const g = newModel('Blastbound remote bomb');
  base(g, lilac);
  sphere(g, 0.345, ink, 'receiver shell');
  ring(g, 0.342, 0.031, violet, 'violet signal band', 0.34);
  for (const x of [-0.3, 0.3]) {
    rounded(g, 0.105, 0.24, 0.18, 0.022, violet, 'receiver fin', x, 0.43, 0);
    sphere(g, 0.033, lilac, 'signal diode', x, 0.55, 0.082, 1);
  }
  eye(g, lilac, 'indicator', 0.35, 0.2, 0.14);
  rounded(g, 0.28, 0.075, 0.018, 0.012, iron, 'control panel', 0, 0.29, 0.33);
  for (const x of [-0.07, 0, 0.07]) sphere(g, 0.019, x === 0 ? cyan : orange, 'remote keypad light', x, 0.29, 0.348, 1);
  cap(g, violet);
  const aerial = add(g, new THREE.CylinderGeometry(0.015, 0.025, 0.22, 8), iron, 'remote aerial', -0.22, 0.81, 0);
  aerial.rotation.z = -0.25;
  sphere(g, 0.058, lilac, 'aerial beacon', -0.245, 0.925, 0, 1);
  return g;
}

function slime() {
  const g = newModel('Blastbound slime bomb');
  base(g, lime);
  sphere(g, 0.31, charcoal, 'sealed dark core');
  const body = sphere(g, 0.35, goo, 'translucent slime membrane', 0, 0.44, 0, 2);
  body.scale.set(1.05, 0.92, 1.05);
  for (const [x, z, scale] of [[-0.24, 0.21, 0.15], [0.25, 0.12, 0.13], [0.07, -0.29, 0.12]]) {
    sphere(g, scale, goo, 'hanging slime lobe', x, 0.25, z, 1);
    sphere(g, scale * 0.42, lime, 'slime droplet', x * 1.13, 0.1, z * 1.13, 1);
  }
  ring(g, 0.32, 0.03, lime, 'bioluminescent core ring', 0.37);
  const gem = sphere(g, 0.105, lime, 'indicator', 0, 0.44, 0.33, 1);
  gem.scale.set(1.25, 0.9, 0.48);
  cap(g, charcoal); return g;
}

function enemy() {
  const g = newModel('Blastbound rival bomb');
  base(g, pink);
  sphere(g, 0.34, charcoal, 'rival black shell', 0, 0.43, 0, 1);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const blade = add(g, new THREE.OctahedronGeometry(0.1, 0), pink, 'rival flare fin', Math.sin(angle) * 0.32, 0.43, Math.cos(angle) * 0.32);
    blade.scale.set(0.8, 1.55, 0.54);
  }
  ring(g, 0.338, 0.034, pink, 'rival ring', 0.35);
  eye(g, pink, 'indicator', 0.355, 0.19, 0.17);
  for (const x of [-0.12, 0.12]) sphere(g, 0.033, pearl, 'rival white stud', x, 0.43, 0.355, 1);
  cap(g, charcoal); return g;
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
