# Effet d'Explosion 3D

Une expérience de fragmentation 3D pilotée par le défilement, inspirée de [lukebaffait.fr](https://www.lukebaffait.fr/), construite avec Three.js et du JavaScript natif.

La **Victoire de Samothrace** — l'une des sculptures les plus emblématiques de l'art occidental — est chargée en tant que modèle GLB, décomposée en centaines de fragments de maillage, puis projetée vers l'extérieur au fil du défilement. Remontez pour la reconstituer.

---

## Démo

> Ouvrez `http://localhost:8080` après avoir lancé le serveur local (voir ci-dessous).

- **Défiler vers le bas** → les fragments s'envolent vers l'extérieur en explosion
- **Défiler vers le haut** → les fragments se réassemblent en statue
- La barre de progression en haut reflète l'état de fragmentation actuel

---

## Stack Technique

| Technologie | Rôle |
|---|---|
| [Three.js r160](https://threejs.org/) | Moteur de rendu 3D (WebGL) |
| GLTFLoader | Chargement du modèle `.glb` à l'exécution |
| API Wheel native JS | Contrôle de l'animation par défilement |
| Tone mapping ACESFilmic | Étalonnage colorimétrique cinématographique |

---

## Fonctionnement

### 1. Fragmentation du modèle

Le GLB est chargé, tous les sous-maillages sont fusionnés en un seul `BufferGeometry`, puis découpés en ~400 morceaux indépendants (chaque N triangles = un fragment). Les sommets de chaque fragment sont stockés relativement à son propre centroïde.

### 2. Défilement → Fragmentation

Chaque fragment stocke deux états :

```
assembledPos  — position d'origine sur la statue
shatteredPos  — position explosée (3,5 à 7,5× le rayon de la sphère englobante)
```

La molette de défilement accumule une valeur `scrollProgress` (0 → 1). À chaque frame, la position et la rotation sont interpolées entre les deux états :

```js
mesh.position.x = lerp(assembledPos.x, shatteredPos.x, easedT);
```

### 3. Décalage temporel (Stagger)

Chaque fragment possède un `delay` aléatoire (0–0,25), de sorte qu'ils ne bougent pas tous en même temps — l'explosion se propage naturellement vers l'extérieur.

### 4. Easing

`easeInOutCubic` donne à l'animation un démarrage lent, un milieu rapide et une arrivée douce :

```js
function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}
```

---

## Démarrage

> Un serveur HTTP local est requis car `importmap` (ES Module) est utilisé.

```bash
# Python (intégré)
cd "claude - 3d"
python -m http.server 8080

# Node.js
npx serve .
```

Puis ouvrez `http://localhost:8080` dans votre navigateur.

---

## Structure du Projet

```
3D-Explosion-Effect/
├── index.html      # Structure de la page + importmap (Three.js via CDN)
├── style.css       # Thème sombre, animation du titre, barre de progression
├── main.js         # Scène Three.js, fragmentation, logique de défilement
├── statue.glb      # Victoire de Samothrace (modèle 3D)
├── README.md       # Anglais
├── README.fr.md    # Français (ce fichier)
└── README.zh.md    # Chinois
```

---

## Extensions Possibles

| Idée | Comment |
|---|---|
| Fracture Voronoi réelle | Utiliser `three-mesh-bvh` + décomposition en cellules Voronoi |
| Lueur bloom | Ajouter `UnrealBloomPass` du post-processing Three.js |
| Physique | Intégrer `cannon-es` ou `rapier` pour la gravité et les collisions |
| GSAP ScrollTrigger | Remplacer l'écouteur wheel natif pour une synchronisation plus fluide |
| Autre modèle | Remplacer `statue.glb` par n'importe quel GLB — la fragmentation est générique |

---

## Licence

MIT
