import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);
scene.fog = new THREE.FogExp2(0x080808, 0.035);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0, 6);

// ─── Lights ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const keyLight = new THREE.DirectionalLight(0xfff8f0, 3.5);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xd0e8ff, 2.0);
rimLight.position.set(-5, 2, -4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffeedd, 2, 30);
fillLight.position.set(0, -3, 4);
scene.add(fillLight);

// ─── Scroll State ────────────────────────────────────────────────────────────
let scrollProgress = 0;
let targetProgress  = 0;
let totalScrollDelta = 0;
const MAX_SCROLL = 2500;

const progressFill = document.getElementById('progress-fill');
const loadingEl    = document.getElementById('loading');
const hintEl       = document.getElementById('scroll-hint');

window.addEventListener('wheel', (e) => {
  totalScrollDelta = Math.max(0, Math.min(MAX_SCROLL, totalScrollDelta + e.deltaY));
  targetProgress = totalScrollDelta / MAX_SCROLL;
}, { passive: true });

let touchStartY = 0;
window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchmove', (e) => {
  const dy = touchStartY - e.touches[0].clientY;
  touchStartY = e.touches[0].clientY;
  totalScrollDelta = Math.max(0, Math.min(MAX_SCROLL, totalScrollDelta + dy * 2.5));
  targetProgress = totalScrollDelta / MAX_SCROLL;
}, { passive: true });

// ─── Easing / Lerp ───────────────────────────────────────────────────────────
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Display group ────────────────────────────────────────────────────────────
const displayGroup = new THREE.Group();
scene.add(displayGroup);

let originalModel = null;
const feathers     = [];          // { mesh, assembledPos, shatteredPos, assembledRot, shatteredRot, delay, phase, speed }
const featherGroup = new THREE.Group();
featherGroup.visible = false;
displayGroup.add(featherGroup);

// ─── Feather Texture (local file) ────────────────────────────────────────────
const featherTex = new THREE.TextureLoader().load('feather.png');

// ─── Merge GLTF sub-meshes → single non-indexed BufferGeometry ───────────────
function mergeGLTFGeometries(gltfScene) {
  const posArrays = [], norArrays = [];
  let totalVerts = 0;

  gltfScene.traverse((node) => {
    if (!node.isMesh) return;
    const geo = node.geometry.clone();
    node.updateWorldMatrix(true, false);
    geo.applyMatrix4(node.matrixWorld);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const nonIdx = geo.index ? geo.toNonIndexed() : geo;
    posArrays.push(nonIdx.attributes.position.array);
    norArrays.push(nonIdx.attributes.normal.array);
    totalVerts += nonIdx.attributes.position.count;
  });

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNor = new Float32Array(totalVerts * 3);
  let off = 0;
  for (let i = 0; i < posArrays.length; i++) {
    mergedPos.set(posArrays[i], off);
    mergedNor.set(norArrays[i], off);
    off += posArrays[i].length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(mergedNor, 3));
  return merged;
}

// ─── Build Feathers ───────────────────────────────────────────────────────────
// Sample ~300 positions from the statue surface, place a feather plane at each,
// oriented so the feather face aligns with the local surface normal.
function buildFeathers(mergedGeo, count) {
  mergedGeo.computeBoundingSphere();
  const bsRadius = mergedGeo.boundingSphere.radius;
  const bsCenter = mergedGeo.boundingSphere.center.clone();

  const pos = mergedGeo.attributes.position;
  const nor = mergedGeo.attributes.normal;
  const totalVerts = pos.count;

  // feather.png: 522×563 px — feather is vertical, aspect ~1:1.08
  const fw = bsRadius * 1.04;
  const fh = bsRadius * 1.12;
  const planeGeo = new THREE.PlaneGeometry(fw, fh, 1, 1);

  // Evenly stride through vertices, with a small random jitter so feathers
  // don't all land on the same mesh seam
  const stride = Math.max(1, Math.floor(totalVerts / count));

  // Helper quaternion objects (reused)
  const qAlign  = new THREE.Quaternion();
  const qSpin   = new THREE.Quaternion();
  const zAxis   = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < count; i++) {
    const rawIdx = i * stride + Math.floor(Math.random() * stride * 0.5);
    const idx    = rawIdx % totalVerts;

    const px = pos.getX(idx), py = pos.getY(idx), pz = pos.getZ(idx);
    const nx = nor.getX(idx), ny = nor.getY(idx), nz = nor.getZ(idx);

    const position = new THREE.Vector3(px, py, pz);
    const normal   = new THREE.Vector3(nx, ny, nz).normalize();

    // Align plane's +Z to surface normal
    qAlign.setFromUnitVectors(zAxis, normal);
    // Random spin around that normal so feathers aren't all parallel
    qSpin.setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    const assembledQ = qSpin.clone().multiply(qAlign);
    const assembledRot = new THREE.Euler().setFromQuaternion(assembledQ, 'XYZ');

    // Shattered rotation: gentle tumble (feathers don't spin as hard as stone)
    const shatteredRot = new THREE.Euler(
      assembledRot.x + (Math.random() - 0.5) * Math.PI * 2.5,
      assembledRot.y + (Math.random() - 0.5) * Math.PI * 2.5,
      assembledRot.z + (Math.random() - 0.5) * Math.PI * 2.5
    );

    // Fly outward from bounding sphere center, with scatter
    const dir = position.clone().sub(bsCenter).normalize();
    const dist = bsRadius * (3.2 + Math.random() * 4.5);
    const shatteredPos = position.clone().add(
      dir.clone().multiplyScalar(dist).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * bsRadius * 2.2,
          (Math.random() - 0.5) * bsRadius * 2.2,
          (Math.random() - 0.5) * bsRadius * 2.2
        )
      )
    );

    const mat = new THREE.MeshStandardMaterial({
      map:         featherTex,
      transparent: true,
      alphaTest:   0.05,
      side:        THREE.DoubleSide,
      roughness:   0.8,
      metalness:   0.0,
      color:       0xffffff,
      depthWrite:  false,
    });

    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.copy(position);
    mesh.rotation.copy(assembledRot);
    featherGroup.add(mesh);

    feathers.push({
      mesh,
      assembledPos: position.clone(),
      shatteredPos,
      assembledRot,
      shatteredRot,
      delay: Math.random() * 0.28,
      phase: Math.random() * Math.PI * 2,   // flutter phase offset
      speed: 1.8 + Math.random() * 2.8,     // flutter frequency
    });
  }
}

// ─── Apply marble material to original model ─────────────────────────────────
function applyMarbleMaterial(root) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8ddd0, roughness: 0.35, metalness: 0.05, side: THREE.FrontSide,
  });
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.material = mat.clone();
    node.castShadow = true;
  });
}

// ─── Load GLB ────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load(
  'statue.glb',
  (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 3.5 / Math.max(size.x, size.y, size.z);
    gltf.scene.scale.setScalar(scale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    gltf.scene.position.sub(center.multiplyScalar(scale));
    gltf.scene.updateMatrixWorld(true);

    applyMarbleMaterial(gltf.scene);
    originalModel = gltf.scene;
    displayGroup.add(originalModel);

    // Build feathers from merged surface geometry
    const merged = mergeGLTFGeometries(gltf.scene);
    buildFeathers(merged, 1200);

    loadingEl.classList.add('hidden');
    setTimeout(() => { hintEl.style.opacity = '1'; }, 500);
  },
  (xhr) => {
    const pct = Math.round((xhr.loaded / xhr.total) * 100);
    const fill = loadingEl.querySelector('.loading-fill');
    if (fill) fill.style.width = pct + '%';
  },
  (err) => {
    console.error('GLB load error:', err);
    loadingEl.querySelector('p').textContent = 'Load failed — check console';
  }
);

// ─── Animation Loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  scrollProgress += (targetProgress - scrollProgress) * 0.055;
  progressFill.style.width = (scrollProgress * 100).toFixed(1) + '%';

  displayGroup.rotation.y = elapsed * 0.12;
  displayGroup.rotation.x = Math.sin(elapsed * 0.08) * 0.15;

  // Switch: intact statue → feathers
  const exploding = scrollProgress > 0.015;
  if (originalModel) originalModel.visible = !exploding;
  featherGroup.visible = exploding;

  for (const f of feathers) {
    const localT = Math.max(0, Math.min(1, (scrollProgress - f.delay) / (1.0 - f.delay)));
    const t = easeInOutCubic(localT);

    // Position
    f.mesh.position.x = lerp(f.assembledPos.x, f.shatteredPos.x, t);
    f.mesh.position.y = lerp(f.assembledPos.y, f.shatteredPos.y, t);
    f.mesh.position.z = lerp(f.assembledPos.z, f.shatteredPos.z, t);

    // Rotation + flutter
    // Base rotation lerped between assembled and shattered
    const rx = lerp(f.assembledRot.x, f.shatteredRot.x, t);
    const ry = lerp(f.assembledRot.y, f.shatteredRot.y, t);
    const rz = lerp(f.assembledRot.z, f.shatteredRot.z, t);

    // Flutter: gentle oscillation around the feather's long axis, grows with t
    const flutter = Math.sin(elapsed * f.speed + f.phase) * 0.18 * t;

    f.mesh.rotation.x = rx + flutter * 0.6;
    f.mesh.rotation.y = ry + flutter;
    f.mesh.rotation.z = rz + flutter * 0.4;

    // Scale: start small at assembled position, grow as feather flies out
    const scale = lerp(0.3, 1.8, Math.pow(t, 0.6));
    f.mesh.scale.setScalar(scale);

    // Opacity: fade out as feathers drift away
    if (t > 0.01) {
      f.mesh.material.transparent = true;
      f.mesh.material.opacity = lerp(1.0, 0.0, Math.pow(t, 1.4));
    } else {
      f.mesh.material.opacity = 1.0;
    }
  }

  // Rim light animation
  rimLight.position.x = Math.sin(elapsed * 0.3) * 6;
  rimLight.position.z = Math.cos(elapsed * 0.3) * 4 - 4;

  // Camera drift
  camera.position.x = Math.sin(elapsed * 0.18) * 0.4;
  camera.position.y = Math.cos(elapsed * 0.13) * 0.25;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
