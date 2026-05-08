# 3D Explosion Effect

A scroll-driven 3D shatter experience inspired by [lukebaffait.fr](https://www.lukebaffait.fr/), built with Three.js and pure JavaScript.

The **Winged Victory of Samothrace** — one of the most iconic sculptures in Western art — is loaded as a GLB model, decomposed into hundreds of mesh fragments, and exploded outward as you scroll down. Scroll back up to reassemble her.

![preview](https://raw.githubusercontent.com/Wwwsea/3D-Explosion-Effect/main/preview.png)

---

## Demo

> Open `http://localhost:8080` after running the local server (see below).

- **Scroll down** → fragments fly outward in an explosion
- **Scroll up** → fragments reassemble back into the statue
- Top progress bar reflects the current shatter state

---

## Tech Stack

| Technology | Role |
|---|---|
| [Three.js r160](https://threejs.org/) | 3D rendering engine (WebGL) |
| GLTFLoader | Load `.glb` model at runtime |
| Native JS Wheel API | Scroll-driven animation control |
| ACESFilmic tone mapping | Cinematic color grading |

---

## How It Works

### 1. Model Fragmentation

The GLB is loaded, all sub-meshes are merged into a single `BufferGeometry`, then split into ~400 independent chunk meshes (every N triangles = one fragment). Each fragment's vertices are stored relative to its own centroid.

### 2. Scroll → Shatter

Each fragment stores two states:

```
assembledPos  — original position on the statue
shatteredPos  — exploded position (3.5–7.5× bounding radius outward)
```

The scroll wheel accumulates a `scrollProgress` value (0 → 1). Every frame, position and rotation are interpolated between the two states:

```js
mesh.position.x = lerp(assembledPos.x, shatteredPos.x, easedT);
```

### 3. Staggered Timing

Each fragment has a random `delay` (0–0.25), so they don't all move at once — the explosion ripples outward naturally.

### 4. Easing

`easeInOutCubic` gives the animation a slow start, fast middle, and soft landing:

```js
function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}
```

---

## Getting Started

> Requires a local HTTP server because ES Module `importmap` is used.

### 1. Prepare the model

Place your GLB model file in the project root and name it `statue.glb`.  
The original model used is the *Winged Victory of Samothrace* — any GLB will work, the fragmentation is model-agnostic.

### 2. Start a local server

```bash
# Python (built-in)
cd 3D-Explosion-Effect
python -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## Project Structure

```
3D-Explosion-Effect/
├── index.html      # Page structure + importmap (Three.js via CDN)
├── style.css       # Dark theme, title animation, progress bar
├── main.js         # Three.js scene, fragmentation, scroll logic
├── statue.glb      # Winged Victory of Samothrace (3D model)
├── README.md       # English (this file)
├── README.fr.md    # French
└── README.zh.md    # Chinese
```

---

## Extending the Effect

| Idea | How |
|---|---|
| Real Voronoi fracture | Use `three-mesh-bvh` + Voronoi cell decomposition at runtime |
| Bloom glow | Add `UnrealBloomPass` from Three.js post-processing |
| Physics | Integrate `cannon-es` or `rapier` for gravity + collisions |
| GSAP ScrollTrigger | Replace native wheel listener for smoother page-scroll sync |
| Different model | Swap `statue.glb` for any GLB — the fragmentation is model-agnostic |

---

## License

MIT
