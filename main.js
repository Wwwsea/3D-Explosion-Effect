import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);
scene.fog = new THREE.FogExp2(0x080808, 0.04);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0, 6);

// ─── Lights ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const keyLight = new THREE.DirectionalLight(0xfff5e0, 3.5);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xc0d8ff, 1.5);
rimLight.position.set(-5, 2, -4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffe0c0, 2, 30);
fillLight.position.set(0, -3, 4);
scene.add(fillLight);

// ─── Scroll State ────────────────────────────────────────────────────────────
let scrollProgress = 0;
let targetProgress = 0;
let totalScrollDelta = 0;
const MAX_SCROLL = 2500;

const progressFill = document.getElementById('progress-fill');
const loadingEl   = document.getElementById('loading');
const hintEl      = document.getElementById('scroll-hint');

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

// ─── Easing ──────────────────────────────────────────────────────────────────
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Fragment Data ────────────────────────────────────────────────────────────
const fragments = [];
const fragmentGroup = new THREE.Group();
scene.add(fragmentGroup);

// Marble-like material for all fragments
const marbleMat = new THREE.MeshStandardMaterial({
  color: 0xe8ddd0,
  roughness: 0.35,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

// ─── Build Fragments from Geometry ───────────────────────────────────────────
// Takes a merged BufferGeometry, groups every `triPerChunk` triangles into
// one Mesh, records assembled center + random explode target.
function buildFragments(mergedGeo, triPerChunk) {
  const pos = mergedGeo.attributes.position;
  const nor = mergedGeo.attributes.normal;
  const totalTris = Math.floor(pos.count / 3);

  // Compute overall bounding sphere for scaling explode distance
  mergedGeo.computeBoundingSphere();
  const bsRadius = mergedGeo.boundingSphere.radius;
  const bsCenter = mergedGeo.boundingSphere.center.clone();

  for (let start = 0; start < totalTris; start += triPerChunk) {
    const end = Math.min(start + triPerChunk, totalTris);
    const count = (end - start) * 3;

    const chunkPos = new Float32Array(count * 3);
    const chunkNor = new Float32Array(count * 3);

    // centroid of this chunk
    let cx = 0, cy = 0, cz = 0;
    for (let i = start * 3; i < end * 3; i++) {
      cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i);
    }
    cx /= count; cy /= count; cz /= count;
    const centroid = new THREE.Vector3(cx, cy, cz);

    for (let i = 0; i < count; i++) {
      const src = start * 3 + i;
      chunkPos[i * 3]     = pos.getX(src);
      chunkPos[i * 3 + 1] = pos.getY(src);
      chunkPos[i * 3 + 2] = pos.getZ(src);
      if (nor) {
        chunkNor[i * 3]     = nor.getX(src);
        chunkNor[i * 3 + 1] = nor.getY(src);
        chunkNor[i * 3 + 2] = nor.getZ(src);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(chunkPos, 3));
    if (nor) geo.setAttribute('normal', new THREE.BufferAttribute(chunkNor, 3));
    else geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, marbleMat.clone());
    mesh.position.copy(centroid);
    // shift vertices to be relative to centroid
    const pa = mesh.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      pa.setXYZ(i, pa.getX(i) - cx, pa.getY(i) - cy, pa.getZ(i) - cz);
    }
    pa.needsUpdate = true;
    mesh.castShadow = true;

    fragmentGroup.add(mesh);

    // Explode direction: away from bounding sphere center
    const dir = centroid.clone().sub(bsCenter).normalize();
    const explodeDist = bsRadius * (3.5 + Math.random() * 4.0);
    const shatteredPos = centroid.clone().add(
      dir.multiplyScalar(explodeDist).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * bsRadius * 1.5,
          (Math.random() - 0.5) * bsRadius * 1.5,
          (Math.random() - 0.5) * bsRadius * 1.5
        )
      )
    );

    const assembledRot = new THREE.Euler(0, 0, 0);
    const shatteredRot = new THREE.Euler(
      (Math.random() - 0.5) * Math.PI * 3,
      (Math.random() - 0.5) * Math.PI * 3,
      (Math.random() - 0.5) * Math.PI * 3
    );

    fragments.push({
      mesh,
      assembledPos: centroid.clone(),
      shatteredPos,
      assembledRot,
      shatteredRot,
      delay: Math.random() * 0.25,
    });
  }
}

// ─── Merge all meshes in a GLTF scene into one BufferGeometry ────────────────
function mergeGLTFGeometries(gltfScene) {
  const posArrays = [];
  const norArrays = [];
  let totalVerts = 0;

  gltfScene.traverse((node) => {
    if (!node.isMesh) return;
    const geo = node.geometry.clone();
    // Apply world transform so fragments are in world space
    node.updateWorldMatrix(true, false);
    geo.applyMatrix4(node.matrixWorld);
    if (!geo.attributes.normal) geo.computeVertexNormals();

    // Convert indexed to non-indexed (each triangle = 3 explicit verts)
    const nonIdx = geo.index ? geo.toNonIndexed() : geo;
    posArrays.push(nonIdx.attributes.position.array);
    norArrays.push(nonIdx.attributes.normal.array);
    totalVerts += nonIdx.attributes.position.count;
  });

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNor = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (let i = 0; i < posArrays.length; i++) {
    mergedPos.set(posArrays[i], offset);
    mergedNor.set(norArrays[i], offset);
    offset += posArrays[i].length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(mergedNor, 3));
  return merged;
}

// ─── Load GLB ────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.load(
  'statue.glb',
  (gltf) => {
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3.5 / maxDim;
    gltf.scene.scale.setScalar(scale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    gltf.scene.position.sub(center.multiplyScalar(scale));

    // Force matrix update before merging
    gltf.scene.updateMatrixWorld(true);

    // Merge all sub-meshes into one geometry
    const merged = mergeGLTFGeometries(gltf.scene);
    merged.computeBoundingSphere();

    // ~40 triangles per chunk → ~several hundred fragments
    const totalTris = merged.attributes.position.count / 3;
    const triPerChunk = Math.max(8, Math.floor(totalTris / 400));
    buildFragments(merged, triPerChunk);

    // Hide loading screen
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

  // Smooth scroll
  scrollProgress += (targetProgress - scrollProgress) * 0.055;
  progressFill.style.width = (scrollProgress * 100).toFixed(1) + '%';

  // Slow auto-rotation of the whole group
  fragmentGroup.rotation.y = elapsed * 0.12;
  fragmentGroup.rotation.x = Math.sin(elapsed * 0.08) * 0.15;

  // Per-fragment animation
  for (const f of fragments) {
    const localT = Math.max(0, Math.min(1, (scrollProgress - f.delay) / (1.0 - f.delay)));
    const t = easeInOutCubic(localT);

    f.mesh.position.x = lerp(f.assembledPos.x, f.shatteredPos.x, t);
    f.mesh.position.y = lerp(f.assembledPos.y, f.shatteredPos.y, t);
    f.mesh.position.z = lerp(f.assembledPos.z, f.shatteredPos.z, t);

    f.mesh.rotation.x = lerp(f.assembledRot.x, f.shatteredRot.x, t);
    f.mesh.rotation.y = lerp(f.assembledRot.y, f.shatteredRot.y, t);
    f.mesh.rotation.z = lerp(f.assembledRot.z, f.shatteredRot.z, t);

    // Fade out as they fly away
    if (t > 0.01) {
      f.mesh.material.transparent = true;
      f.mesh.material.opacity = lerp(1.0, 0.15, t);
    } else {
      f.mesh.material.transparent = false;
      f.mesh.material.opacity = 1.0;
    }
  }

  // Animate rim light for drama
  rimLight.position.x = Math.sin(elapsed * 0.3) * 6;
  rimLight.position.z = Math.cos(elapsed * 0.3) * 4 - 4;

  // Subtle camera drift
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
