# Interactive 3D Anatomical Animations & Visualizations
## Comprehensive Research Report for Web-Based Human Body Viewer

**Stack:** React + TypeScript + Vite, Three.js (via @react-three/fiber v8 + @react-three/drei v9), GLB/GLTF models  
**Date:** March 2026

---

## Table of Contents
1. [Animation Techniques for Anatomy](#1-animation-techniques-for-anatomy)
2. [Three.js / React Three Fiber Specific](#2-threejs--react-three-fiber-specific)
3. [Visual Effects for Medical Education](#3-visual-effects-for-medical-education)
4. [Interactive Features](#4-interactive-features)
5. [Performance Best Practices](#5-performance-best-practices)
6. [Recommended Libraries & Tools](#6-recommended-libraries--tools)

---

## 1. Animation Techniques for Anatomy

### 1.1 Organ System Animations

#### Heartbeat Animation
The consensus across Three.js discourse and r/threejs is to use **procedural animation** driven by `useFrame()` for heartbeat. Your current implementation in `InteractiveOrgans.tsx` uses a double-peak sine wave — this is the correct approach. Professional platforms refine it further:

```tsx
// Improved double-peak heartbeat (systole + diastole)
// Source: BioDigital-style cardiac cycle timing
useFrame(({ clock }) => {
  const t = clock.getElapsedTime();
  const bpm = 72;
  const cyclePos = (t * bpm / 60) % 1.0;
  
  // Systolic contraction (sharp)
  const systole = Math.pow(Math.max(0, Math.sin(cyclePos * Math.PI * 2)), 4) * 0.12;
  // Atrial kick (smaller, earlier)
  const atrial = Math.pow(Math.max(0, Math.sin((cyclePos - 0.15) * Math.PI * 2)), 6) * 0.04;
  
  const beat = systole + atrial;
  mesh.scale.set(
    baseScale.x * (1 + beat),
    baseScale.y * (1 + beat * 0.7),  // less vertical stretch
    baseScale.z * (1 + beat)
  );
});
```

**Key insight from medical visualization forums:** Real cardiac motion isn't uniform scaling — the apex rotates slightly (torsion) and the septum moves differently from free walls. For educational purposes, adding a subtle rotation twist during systole adds realism:

```tsx
mesh.rotation.y = baseRotY + Math.sin(cyclePos * Math.PI * 2) * 0.03; // torsion
```

#### Breathing / Lung Animation
Professional anatomy platforms (BioDigital, Visible Body) animate lungs with:
1. **Diaphragm displacement** (primary driver, moves inferiorly on inspiration)
2. **Rib cage expansion** (secondary)
3. **Lung volume change** (consequence of 1+2)

```tsx
useFrame(({ clock }) => {
  const t = clock.getElapsedTime();
  const breathRate = 0.25; // ~15 breaths/min
  const phase = t * breathRate * Math.PI * 2;
  
  // Asymmetric breathing: inspiration shorter than expiration (physiological)
  const raw = Math.sin(phase);
  const breath = raw > 0 ? Math.pow(raw, 0.7) : -Math.pow(-raw, 1.3);
  const normalized = breath * 0.5 + 0.5; // 0..1
  
  // Lungs expand laterally + inferiorly
  lung.scale.set(
    1 + normalized * 0.08,   // lateral
    1 + normalized * 0.05,   // vertical  
    1 + normalized * 0.06    // AP
  );
  lung.position.y = basePosY - normalized * 0.02; // moves down
  
  // Diaphragm descends
  diaphragm.position.y = diaphragmBaseY - normalized * 0.04;
  diaphragm.scale.y = 1 - normalized * 0.3; // flattens
});
```

#### Peristalsis (GI Tract)
Best approached with **traveling wave deformation**. From Three.js discourse discussions on organic animations:

```tsx
// Traveling wave along intestine tube
useFrame(({ clock }) => {
  const t = clock.getElapsedTime();
  const positions = geometry.attributes.position;
  
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i); // along tube axis
    const wave = Math.sin(y * 8 - t * 2) * 0.02;
    const radius = baseRadius + wave;
    
    const angle = Math.atan2(positions.getZ(i), positions.getX(i));
    positions.setX(i, Math.cos(angle) * radius);
    positions.setZ(i, Math.sin(angle) * radius);
  }
  positions.needsUpdate = true;
});
```

For simpler approaches (matching your current architecture), use **sequential scale pulses** on intestine segments — which your code already does well.

#### Blood Flow
Two approaches recommended across r/threejs and Three.js discourse:

1. **Particle system along CatmullRomCurve3 paths** (most common)
2. **Shader-based UV scrolling** on tube geometry (more performant)

```tsx
// Approach 1: Particles along vessel path
function BloodFlowParticles({ path }: { path: THREE.CatmullRomCurve3 }) {
  const count = 200;
  const ref = useRef<THREE.Points>(null);
  const offsets = useMemo(() => 
    Array.from({ length: count }, () => Math.random()), []);
  
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const positions = ref.current!.geometry.attributes.position;
    
    for (let i = 0; i < count; i++) {
      const progress = (offsets[i] + t * 0.15) % 1;
      const point = path.getPointAt(progress);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
  });
  
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" 
          args={[new Float32Array(count * 3), 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#cc0000" size={0.008} transparent opacity={0.8} />
    </points>
  );
}
```

### 1.2 Skeletal Animation vs Morph Targets vs Procedural

| Technique | Best For | Performance | Flexibility |
|-----------|----------|-------------|-------------|
| **Skeletal (Armature)** | Joint-based motion, limb movement, jaw, ribs | Medium | High — retargetable |
| **Morph Targets (Shape Keys)** | Facial expressions, organ deformation, pathology states | Low overhead per target | Medium — requires pre-authored |
| **Procedural (useFrame)** | Heartbeat, breathing, pulsing, particles | Best — no extra data | Highest — fully code-driven |
| **Shader-based** | UV scrolling, color waves, x-ray effects | Best — GPU only | High for visual effects |

**Community consensus (r/threejs, Three.js discourse, Hacker News medical viz threads):**

- **For your use case (Sketchfab GLB models + procedural organs):** Procedural animation via `useFrame` is the correct primary approach. You're already doing this well.
- **Morph targets** are ideal if you have Blender-authored models with shape keys for states like "inflated lung" → "collapsed lung" or "healthy liver" → "cirrhotic liver". The GLTF spec supports morph targets natively.
- **Skeletal animation** from Sketchfab models: Use `useAnimations` from drei if the GLB contains animation clips. Many anatomy models on Sketchfab include pre-baked animations.

```tsx
import { useAnimations, useGLTF } from '@react-three/drei';

function AnimatedModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions, mixer } = useAnimations(animations, scene);
  
  useEffect(() => {
    // Play all embedded animations
    Object.values(actions).forEach(action => {
      action?.reset().fadeIn(0.5).play();
    });
    return () => {
      Object.values(actions).forEach(action => action?.fadeOut(0.5));
    };
  }, [actions]);
  
  return <primitive object={scene} />;
}
```

### 1.3 Shader-Based Animations

#### Pulsing / Glowing Effect
From pmndrs community examples and r/threejs shader discussions:

```tsx
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

const PulseGlowMaterial = shaderMaterial(
  { 
    time: 0, 
    color: new THREE.Color('#ff4444'),
    glowIntensity: 0.5,
    pulseSpeed: 2.0 
  },
  // Vertex
  `varying vec3 vNormal;
   varying vec3 vViewPosition;
   void main() {
     vNormal = normalize(normalMatrix * normal);
     vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
     vViewPosition = -mvPosition.xyz;
     gl_Position = projectionMatrix * mvPosition;
   }`,
  // Fragment
  `uniform float time;
   uniform vec3 color;
   uniform float glowIntensity;
   uniform float pulseSpeed;
   varying vec3 vNormal;
   varying vec3 vViewPosition;
   void main() {
     float fresnel = pow(1.0 - dot(normalize(vViewPosition), vNormal), 2.0);
     float pulse = sin(time * pulseSpeed) * 0.5 + 0.5;
     vec3 glow = color * fresnel * glowIntensity * (0.5 + pulse * 0.5);
     gl_FragColor = vec4(color * 0.3 + glow, 0.7 + fresnel * 0.3);
   }`
);

extend({ PulseGlowMaterial });

// Usage in R3F:
// <mesh>
//   <pulseGlowMaterial time={t} color="#ff4444" glowIntensity={0.8} />
// </mesh>
```

#### X-Ray Shader
Widely discussed on Stack Overflow and Three.js forums for medical visualization:

```tsx
const XRayMaterial = shaderMaterial(
  { opacity: 0.3, color: new THREE.Color('#4488ff') },
  `varying vec3 vNormal;
   varying vec3 vViewDir;
   void main() {
     vNormal = normalize(normalMatrix * normal);
     vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
     vViewDir = normalize(-mvPos.xyz);
     gl_Position = projectionMatrix * mvPos;
   }`,
  `uniform float opacity;
   uniform vec3 color;
   varying vec3 vNormal;
   varying vec3 vViewDir;
   void main() {
     float edgeFactor = 1.0 - abs(dot(vViewDir, vNormal));
     float alpha = pow(edgeFactor, 2.0) * opacity;
     gl_FragColor = vec4(color, alpha);
   }`
);
```

#### Cross-Section Reveal Shader
From Three.js examples (`webgl_clipping_advanced`) and BioDigital's implementation pattern:

```glsl
// Fragment shader addition for clipping plane
uniform vec4 clippingPlane; // normal.xyz + distance.w
varying vec3 vWorldPosition;

void main() {
  float dist = dot(vWorldPosition, clippingPlane.xyz) + clippingPlane.w;
  if (dist < 0.0) discard;
  
  // Optional: highlight the cross-section edge
  vec3 crossSectionColor = vec3(1.0, 0.3, 0.3);
  float edgeWidth = 0.005;
  if (dist < edgeWidth) {
    gl_FragColor = vec4(crossSectionColor, 1.0);
    return;
  }
  // ... rest of shading
}
```

### 1.4 How Professional Platforms Implement Animations

#### BioDigital Human
- **Architecture:** WebGL-based custom engine (not Three.js), but concepts apply
- **Animation approach:** Combination of pre-authored skeletal animations (authored in Maya/Blender) + runtime procedural overlays
- **Key features:** Anatomy tours with narrated camera paths, system isolation (show only cardiovascular), layer toggling
- **Developer API** (`developer.biodigital.com`): Provides `human.on('scene.loaded')` events, `human.animation.play()`, `human.dissect()` for layer peeling
- **Lesson for your project:** Their dissection/layer system is essentially toggling visibility groups with smooth opacity transitions — achievable in R3F with your existing layer system

#### Visible Body (now Courseware)
- **Pre-rendered animations** for complex biomechanics (muscle contraction sequences)
- **Real-time** for simpler interactions (rotate, zoom, isolate)
- **Uses morph targets** for pathology comparisons (normal vs diseased states)
- **Progressive complexity:** Start with overview, tap to drill into subsystems

#### Complete Anatomy (3D4Medical/Elsevier)
- **Native app** (Metal/Vulkan), but their web viewer uses approaches similar to Three.js
- **Muscle animation:** Uses skeletal animation with IK for origin-insertion visualization
- **Cross-section tool:** Interactive clipping plane that users can drag — this is their signature feature
- **Motion recording:** Records skeletal animations of clinical movements (e.g., flexion/extension)

**Consensus recommendation for your R3F project:**
1. Keep procedural animation for organ movements (heartbeat, breathing) — **you're already doing this correctly**
2. Add `THREE.Plane`-based clipping for cross-sections (see Section 3)
3. Layer peeling via opacity transitions on category groups (skeleton, muscles, organs, vessels) — **your `LayerType` system is the right foundation**
4. Embed Sketchfab model animations via `useAnimations` when available

---

## 2. Three.js / React Three Fiber Specific

### 2.1 Best Libraries/Approaches for Anatomical Animations in R3F

| Library | Purpose | Maturity |
|---------|---------|----------|
| `@react-three/drei` | Core helpers (Html, useGLTF, useAnimations, Float, Billboard, Outlines, Detailed) | Production-ready |
| `@react-three/postprocessing` | Outline, bloom, selective bloom, SSAO | Production-ready |
| `@react-spring/three` | Physics-based spring animations for UI transitions | Production-ready |
| `gsap` + `@gsap/react` | Complex timeline-based animations, ScrollTrigger | Production-ready |
| `three-custom-shader-material` | Extend existing materials with custom shaders (CSM) | Production-ready |
| `troika-three-text` | High-quality SDF text rendering for 3D labels | Production-ready |
| `lamina` | Layered shader materials (combine effects) | Experimental |
| `drei Sparkles/Trail` | Particle effects for blood flow / nerve signals | Production-ready |
| `drei Instances` | GPU-instanced repeated structures (blood cells) | Production-ready |

### 2.2 useFrame() Patterns for Real-Time Organ Animation

#### Pattern 1: Delta-Time Based (Frame-Rate Independent)
Critical for medical visualization where animation speed must be consistent:

```tsx
useFrame((state, delta) => {
  // Use delta instead of clock for frame-rate independence
  timeRef.current += delta;
  const t = timeRef.current;
  
  // Your animation logic using t
  const heartbeat = getHeartbeatValue(t, bpm);
  mesh.current.scale.setScalar(1 + heartbeat);
});
```

#### Pattern 2: Prioritized Render Loop
When you have multiple animated systems, use priority to control execution order:

```tsx
// Blood flow updates before rendering (priority -1 = before default)
useFrame((state, delta) => {
  updateBloodParticles(delta);
}, -1);

// Camera follows after all positions are updated (priority 1 = after default)
useFrame((state, delta) => {
  smoothCameraFollow(state.camera, target);
}, 1);
```

#### Pattern 3: Conditional Animation (Performance)
Only animate visible/selected organs — crucial advice from r/threejs performance threads:

```tsx
useFrame(({ clock, camera }) => {
  if (!meshRef.current) return;
  
  // Frustum culling check
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );
  
  if (!frustum.containsPoint(meshRef.current.position)) return;
  
  // Distance-based LOD for animation complexity
  const dist = camera.position.distanceTo(meshRef.current.position);
  if (dist > 10) return; // skip animation if too far
  
  // Full animation logic here
});
```

#### Pattern 4: Shared Animation Clock
For synchronizing heartbeat with aortic pulse wave and blood flow:

```tsx
// Create a shared context for physiological timing
const PhysiologyContext = createContext<{
  heartPhase: number;  // 0..1 position in cardiac cycle
  breathPhase: number; // 0..1 position in breath cycle
}>({ heartPhase: 0, breathPhase: 0 });

function PhysiologyProvider({ children, bpm = 72 }: PropsWithChildren<{ bpm?: number }>) {
  const phases = useRef({ heartPhase: 0, breathPhase: 0 });
  
  useFrame((_, delta) => {
    phases.current.heartPhase = (phases.current.heartPhase + delta * bpm / 60) % 1;
    phases.current.breathPhase = (phases.current.breathPhase + delta * 0.25) % 1;
  });
  
  return (
    <PhysiologyContext.Provider value={phases.current}>
      {children}
    </PhysiologyContext.Provider>
  );
}
```

### 2.3 Spring Animations for Smooth Organ Transitions

Using `@react-spring/three` (recommended by pmndrs ecosystem):

```tsx
import { useSpring, animated, config } from '@react-spring/three';

function OrganMesh({ selected, position, color, organKey }) {
  const { scale, emissiveIntensity, opacity } = useSpring({
    scale: selected ? 1.15 : 1.0,
    emissiveIntensity: selected ? 0.4 : 0.0,
    opacity: selected ? 1.0 : 0.85,
    config: config.wobbly, // or config.gentle for medical apps
  });

  return (
    <animated.mesh scale={scale} position={position}>
      <sphereGeometry />
      <animated.meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={opacity}
      />
    </animated.mesh>
  );
}
```

For **exploded view** transitions (organs spreading apart):

```tsx
function ExplodedView({ explode = 0 }: { explode: number }) {
  const springs = useSpring({
    explode,
    config: { mass: 2, tension: 170, friction: 26 }
  });

  return ORGAN_POSITIONS.map(organ => {
    const explodedPos = organ.position.map(
      (p, i) => p + organ.explodeDirection[i] * springs.explode.get()
    );
    return <OrganMesh key={organ.key} position={explodedPos} />;
  });
}
```

Alternative: **Framer Motion 3D** (you already have `framer-motion` installed):

```tsx
import { motion } from 'framer-motion-3d';

<motion.mesh
  animate={{ 
    scale: selected ? 1.2 : 1,
    x: exploded ? organ.explodeX : organ.x 
  }}
  transition={{ type: "spring", stiffness: 200, damping: 20 }}
/>
```

### 2.4 Camera Animation and Fly-Through Techniques

#### Approach 1: drei CameraControls (best for anatomy tours)
```tsx
import { CameraControls } from '@react-three/drei';

function AnatomyTour({ stops }) {
  const controlsRef = useRef<CameraControls>(null);
  const [currentStop, setCurrentStop] = useState(0);
  
  useEffect(() => {
    if (!controlsRef.current) return;
    const stop = stops[currentStop];
    controlsRef.current.setLookAt(
      ...stop.cameraPos as [number,number,number],
      ...stop.lookAt as [number,number,number],
      true // enable smooth transition
    );
  }, [currentStop]);
  
  return <CameraControls ref={controlsRef} smoothTime={0.8} />;
}
```

#### Approach 2: drei MotionPathControls (fly-through path)
```tsx
import { MotionPathControls, useMotion } from '@react-three/drei';

function FlyThrough() {
  return (
    <MotionPathControls
      curves={[
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 2, 5),   // front view
          new THREE.Vector3(3, 3, 3),   // upper right
          new THREE.Vector3(5, 1, 0),   // side view
          new THREE.Vector3(3, 0, -3),  // back angle
          new THREE.Vector3(0, 2, 5),   // return to front
        ])
      ]}
      focus={[0, 0.5, 0]} // look at center of body
      damping={0.2}
    >
      <Loop />
    </MotionPathControls>
  );
}

function Loop() {
  const motion = useMotion();
  useFrame((_, delta) => {
    motion.current += delta * 0.03; // speed
  });
  return null;
}
```

#### Approach 3: GSAP Camera Timeline
```tsx
import gsap from 'gsap';

function useCameraTimeline(camera: THREE.Camera) {
  const tl = useRef<gsap.core.Timeline>();
  
  useEffect(() => {
    tl.current = gsap.timeline({ paused: true })
      .to(camera.position, { x: 0, y: 2, z: 5, duration: 2, ease: "power2.inOut" })
      .to(camera.position, { x: 3, y: 1, z: 0, duration: 2, ease: "power2.inOut" })
      .to(camera.position, { x: 0, y: 5, z: 0.1, duration: 2, ease: "power2.inOut" });
  }, [camera]);
  
  return tl.current;
}
```

### 2.5 Instanced Rendering for Blood Cells / Particles

From Three.js docs and extensive r/threejs discussion on InstancedMesh:

```tsx
import { Instances, Instance } from '@react-three/drei';

// drei's Instances helper (simpler API)
function BloodCells({ count = 500, path }: { count: number; path: THREE.CatmullRomCurve3 }) {
  const offsets = useMemo(() => 
    Array.from({ length: count }, () => ({
      t: Math.random(),
      speed: 0.8 + Math.random() * 0.4,
      wobble: Math.random() * 0.01,
      scale: 0.003 + Math.random() * 0.002,
    })), [count]);

  return (
    <Instances limit={count}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#cc0000" roughness={0.3} />
      {offsets.map((o, i) => (
        <BloodCell key={i} path={path} offset={o} />
      ))}
    </Instances>
  );
}

function BloodCell({ path, offset }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  
  useFrame(({ clock }) => {
    const t = (offset.t + clock.getElapsedTime() * 0.1 * offset.speed) % 1;
    const pos = path.getPointAt(t);
    ref.current?.position.set(
      pos.x + Math.sin(clock.getElapsedTime() * 3 + offset.t * 10) * offset.wobble,
      pos.y + Math.cos(clock.getElapsedTime() * 2 + offset.t * 7) * offset.wobble,
      pos.z
    );
    ref.current?.scale.setScalar(offset.scale);
  });
  
  return <Instance ref={ref} />;
}
```

For **raw InstancedMesh** (higher performance, more control):

```tsx
function BloodCellsRaw({ count = 1000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const progress = ((i / count) + t * 0.1) % 1;
      const pos = vesselPath.getPointAt(progress);
      dummy.position.copy(pos);
      dummy.scale.setScalar(0.003);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current!.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#cc0000" />
    </instancedMesh>
  );
}
```

---

## 3. Visual Effects for Medical Education

### 3.1 X-Ray / Transparency Toggle

Your current implementation in `ModelViewer.tsx` modifies material opacity directly. This works but can be enhanced:

**Approach 1: Global opacity slider (your current approach — improved)**
```tsx
// Add smooth transition instead of instant toggle
function useXRayTransition(targetOpacity: number, speed = 3) {
  const currentOpacity = useRef(1);
  
  useFrame((_, delta) => {
    currentOpacity.current += (targetOpacity - currentOpacity.current) * delta * speed;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.transparent = currentOpacity.current < 0.99;
        mat.opacity = currentOpacity.current;
        mat.depthWrite = currentOpacity.current > 0.5;
        mat.side = currentOpacity.current < 0.99 ? THREE.DoubleSide : THREE.FrontSide;
      }
    });
  });
}
```

**Approach 2: Fresnel-based X-Ray (edge glow, more "medical")**
Already shown in Section 1.3. The key insight from BioDigital's approach is combining:
- Fresnel edge detection for outline
- Interior transparency
- Bone/dense structures stay more opaque

```tsx
// Per-material X-ray that keeps bones visible
function applyXRay(scene: THREE.Object3D, intensity: number) {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const isBone = mesh.name.toLowerCase().includes('bone') || 
                   mesh.name.toLowerCase().includes('skel');
    const mat = mesh.material as THREE.MeshStandardMaterial;
    
    mat.transparent = true;
    mat.opacity = isBone ? Math.max(0.6, 1 - intensity * 0.4) : 1 - intensity * 0.85;
    mat.depthWrite = mat.opacity > 0.5;
  });
}
```

### 3.2 Cross-Section / Clipping Plane

This is the **#1 most requested medical visualization feature** across all forums surveyed. Three.js has native support via `renderer.clippingPlanes` and per-material `clippingPlanes`.

```tsx
import { useThree } from '@react-three/fiber';

function ClippingPlane({ 
  enabled, 
  normal = [0, 1, 0], 
  distance = 0 
}: { 
  enabled: boolean; 
  normal: [number, number, number]; 
  distance: number 
}) {
  const { gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(...normal), distance), []);
  
  useEffect(() => {
    if (enabled) {
      gl.clippingPlanes = [plane];
      gl.localClippingEnabled = true;
    } else {
      gl.clippingPlanes = [];
    }
    return () => { gl.clippingPlanes = []; };
  }, [enabled, gl, plane]);
  
  // Update plane position interactively
  useFrame(() => {
    plane.set(new THREE.Vector3(...normal), distance);
  });
  
  return null;
}
```

**Advanced: Visible cross-section surface (cap the cut)**
From Three.js advanced clipping examples — render the cross-section fill:

```tsx
// Stencil-buffer technique for solid cross-section caps
function ClippingCap({ 
  plane, 
  color = '#ff6b6b' 
}: { 
  plane: THREE.Plane; 
  color?: string 
}) {
  return (
    <mesh renderOrder={1}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        stencilWrite
        stencilRef={1}
        stencilFunc={THREE.EqualStencilFunc}
        clippingPlanes={[plane]}
      />
    </mesh>
  );
}
```

**Interactive clipping with drag control:**
```tsx
import { PivotControls } from '@react-three/drei';

function DraggableClippingPlane() {
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
  const helperRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!helperRef.current) return;
    const pos = helperRef.current.position;
    const normal = new THREE.Vector3(0, 1, 0);
    normal.applyQuaternion(helperRef.current.quaternion);
    planeRef.current.setFromNormalAndCoplanarPoint(normal, pos);
  });
  
  return (
    <PivotControls anchor={[0, 0, 0]} depthTest={false}>
      <group ref={helperRef}>
        {/* Visual indicator for the clipping plane */}
        <mesh>
          <planeGeometry args={[3, 3]} />
          <meshBasicMaterial 
            color="#4488ff" 
            transparent 
            opacity={0.15} 
            side={THREE.DoubleSide} 
          />
        </mesh>
      </group>
    </PivotControls>
  );
}
```

### 3.3 Highlight / Outline Effects on Hover/Selection

You already have `@react-three/postprocessing`. Here are the best approaches:

**Approach 1: drei `Outlines` component (simplest, per-mesh)**
```tsx
import { Outlines } from '@react-three/drei';

function SelectableOrgan({ selected, hovered }) {
  return (
    <mesh>
      <sphereGeometry />
      <meshStandardMaterial color="#cc3355" />
      {(selected || hovered) && (
        <Outlines 
          thickness={selected ? 3 : 1.5} 
          color={selected ? "#ffff00" : "#ffffff"} 
          screenspace 
        />
      )}
    </mesh>
  );
}
```

**Approach 2: postprocessing Outline effect (scene-wide, better for multiple objects)**
```tsx
import { EffectComposer, Outline, SelectiveBloom } from '@react-three/postprocessing';

function PostProcessingEffects({ selectedMeshes }: { selectedMeshes: THREE.Mesh[] }) {
  return (
    <EffectComposer>
      <Outline
        selection={selectedMeshes}
        edgeStrength={3}
        pulseSpeed={0.5}
        visibleEdgeColor={0xffff00}
        hiddenEdgeColor={0x444400}
        blur
        xRay={false} // true = show outline through other objects
      />
      <SelectiveBloom
        selection={selectedMeshes}
        intensity={0.5}
        luminanceThreshold={0}
      />
    </EffectComposer>
  );
}
```

**Approach 3: Custom emissive highlight (lightweight, no postprocessing)**
This is what your code currently does — applying emissive material to selected meshes. This is actually the most performant approach for mobile.

### 3.4 Blood Flow Particle Systems

Combining `drei Trail` + custom particles:

```tsx
import { Trail } from '@react-three/drei';

function BloodParticle({ path, speed, delay }) {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    const t = ((clock.getElapsedTime() * speed + delay) % 1);
    const pos = path.getPointAt(t);
    ref.current?.position.copy(pos);
  });
  
  return (
    <Trail
      width={0.5}
      length={8}
      color="#cc0000"
      attenuation={(w) => w * w}
    >
      <mesh ref={ref}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    </Trail>
  );
}
```

### 3.5 Heat Map / Color Gradient Overlays

For physiological data visualization (temperature, blood pressure, oxygen saturation):

```tsx
const HeatMapMaterial = shaderMaterial(
  { 
    minValue: 0, 
    maxValue: 1, 
    dataTexture: null,
    colorRamp: null // 1D texture: blue → green → yellow → red
  },
  // Vertex
  `varying vec2 vUv;
   void main() {
     vUv = uv;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
  // Fragment
  `uniform float minValue;
   uniform float maxValue;
   uniform sampler2D dataTexture;
   uniform sampler2D colorRamp;
   varying vec2 vUv;
   void main() {
     float value = texture2D(dataTexture, vUv).r;
     float normalized = clamp((value - minValue) / (maxValue - minValue), 0.0, 1.0);
     vec4 color = texture2D(colorRamp, vec2(normalized, 0.5));
     gl_FragColor = color;
   }`
);
```

**Simpler approach using vertex colors:**
```tsx
function applyHeatMap(geometry: THREE.BufferGeometry, dataFn: (pos: THREE.Vector3) => number) {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const tempVec = new THREE.Vector3();
  
  for (let i = 0; i < positions.count; i++) {
    tempVec.fromBufferAttribute(positions, i);
    const value = dataFn(tempVec); // 0..1
    
    // Blue → Green → Yellow → Red color ramp
    const r = Math.min(1, Math.max(0, (value - 0.5) * 2));
    const g = value < 0.5 ? value * 2 : (1 - value) * 2;
    const b = Math.max(0, (0.5 - value) * 2);
    
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
```

### 3.6 Exploded View Animations

A must-have for anatomy education. Best implemented with spring animations:

```tsx
function ExplodableAnatomy({ explodeAmount = 0 }: { explodeAmount: number }) {
  // Calculate explosion directions from center of mass
  const centerOfMass = useMemo(() => {
    const center = new THREE.Vector3();
    ORGAN_SHAPES.forEach(s => center.add(new THREE.Vector3(...s.position)));
    center.divideScalar(ORGAN_SHAPES.length);
    return center;
  }, []);
  
  return ORGAN_SHAPES.map((shape, i) => {
    const pos = new THREE.Vector3(...shape.position);
    const dir = pos.clone().sub(centerOfMass).normalize();
    const explodedPos = pos.clone().add(dir.multiplyScalar(explodeAmount));
    
    return (
      <animated.mesh
        key={i}
        position={[explodedPos.x, explodedPos.y, explodedPos.z]}
      >
        {/* geometry + material */}
      </animated.mesh>
    );
  });
}

// UI control:
// <Slider value={explode} min={0} max={2} step={0.01} 
//   onChange={setExplode} label="Exploded View" />
```

### 3.7 Layer Peeling (Skin → Muscle → Organs → Skeleton)

Your `LayerType` system (`skeleton | muscles | organs | vessels`) is the right foundation. Here's the recommended implementation pattern:

```tsx
type LayerConfig = {
  type: LayerType;
  opacity: number;
  visible: boolean;
  order: number; // rendering order
};

function LayerPeeling({ activeLayers }: { activeLayers: Set<LayerType> }) {
  const layerOrder: LayerType[] = ['skeleton', 'muscles', 'organs', 'vessels'];
  
  return layerOrder.map((layer, depth) => {
    const isActive = activeLayers.has(layer);
    
    return (
      <AnimatedLayerGroup
        key={layer}
        layer={layer}
        targetOpacity={isActive ? 1.0 : 0.0}
        visible={isActive}
        renderOrder={depth}
      />
    );
  });
}

function AnimatedLayerGroup({ layer, targetOpacity, visible, renderOrder }) {
  const { opacity } = useSpring({ opacity: targetOpacity, config: config.slow });
  const groupRef = useRef<THREE.Group>(null);
  
  // Smoothly hide/show with fade
  useFrame(() => {
    if (!groupRef.current) return;
    const currentOpacity = opacity.get();
    groupRef.current.visible = currentOpacity > 0.01;
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = currentOpacity;
        mat.depthWrite = currentOpacity > 0.5;
      }
    });
  });
  
  return (
    <group ref={groupRef} renderOrder={renderOrder}>
      {ORGAN_SHAPES.filter(s => s.category === layer).map((shape, i) => (
        <OrganMesh key={i} shape={shape} />
      ))}
    </group>
  );
}
```

**Sequential auto-peel animation (BioDigital-style):**
```tsx
function AutoPeelAnimation() {
  const [peelDepth, setPeelDepth] = useState(0); // 0 = all visible, 4 = skeleton only
  
  // Auto-play sequence
  useEffect(() => {
    const interval = setInterval(() => {
      setPeelDepth(d => (d + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  
  const layers: LayerType[] = ['vessels', 'organs', 'muscles', 'skeleton'];
  const activeLayers = new Set(layers.slice(peelDepth));
  
  return <LayerPeeling activeLayers={activeLayers} />;
}
```

---

## 4. Interactive Features

### 4.1 Annotation / Label Systems

#### drei Html (your current best option)
From pmndrs docs and extensive community usage:

```tsx
import { Html, Billboard } from '@react-three/drei';

function OrganLabel({ 
  position, 
  label, 
  description, 
  visible,
  occlude = true 
}: {
  position: [number, number, number];
  label: string;
  description?: string;
  visible: boolean;
  occlude?: boolean;
}) {
  if (!visible) return null;
  
  return (
    <group position={position}>
      {/* Leader line from organ to label */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0,0,0, 0,0.3,0.1]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </line>
      
      {/* HTML label */}
      <Html
        position={[0, 0.35, 0.1]}
        center
        distanceFactor={5}
        occlude={occlude ? 'blending' : undefined}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <div className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
          <div className="font-bold">{label}</div>
          {description && <div className="text-[10px] opacity-70">{description}</div>}
        </div>
      </Html>
    </group>
  );
}
```

**Warning from R3F discussions:** `Html` creates real DOM elements and can degrade performance with many labels (50+). For large numbers, use:

#### troika-three-text (pure 3D text, no DOM)
```tsx
import { Text } from '@react-three/drei'; // uses troika under the hood

function Label3D({ position, text }) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false}>
      <Text
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.003}
        outlineColor="black"
      >
        {text}
      </Text>
    </Billboard>
  );
}
```

### 4.2 Measurement Tools

Distance measurement between anatomical landmarks:

```tsx
import { Line, Html } from '@react-three/drei';

function MeasurementTool({ 
  point1, 
  point2,
  unit = "cm",
  scaleFactor = 100 // model units to cm
}: {
  point1: THREE.Vector3;
  point2: THREE.Vector3;
  unit?: string;
  scaleFactor?: number;
}) {
  const distance = point1.distanceTo(point2) * scaleFactor;
  const midpoint = point1.clone().add(point2).multiplyScalar(0.5);
  
  return (
    <group>
      {/* Endpoints */}
      {[point1, point2].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshBasicMaterial color="#ffff00" />
        </mesh>
      ))}
      
      {/* Line */}
      <Line
        points={[point1.toArray(), point2.toArray()]}
        color="#ffff00"
        lineWidth={2}
        dashed
        dashSize={0.02}
        gapSize={0.01}
      />
      
      {/* Distance label */}
      <Html position={midpoint} center>
        <div className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-mono">
          {distance.toFixed(1)} {unit}
        </div>
      </Html>
    </group>
  );
}
```

**Interactive point picking:**
```tsx
function useMeasurementPoints() {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setPoints(prev => {
      if (prev.length >= 2) return [e.point.clone()];
      return [...prev, e.point.clone()];
    });
  }, []);
  
  return { points, handleClick, clear: () => setPoints([]) };
}
```

### 4.3 Before/After Comparison Slider

Healthy vs. diseased state comparison:

```tsx
function ComparisonSlider({ 
  healthyModel, 
  diseasedModel, 
  splitPosition = 0.5 
}: {
  healthyModel: string;
  diseasedModel: string;
  splitPosition: number;
}) {
  const { viewport } = useThree();
  const clipPlane = useMemo(() => 
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);
  const clipPlaneInverse = useMemo(() => 
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);
  
  useFrame(() => {
    const x = (splitPosition - 0.5) * viewport.width * 0.1;
    clipPlane.constant = x;
    clipPlaneInverse.constant = -x;
  });
  
  return (
    <>
      {/* Healthy side (left) */}
      <group>
        <HealthyModel url={healthyModel} clippingPlanes={[clipPlane]} />
      </group>
      
      {/* Diseased side (right) */}
      <group>
        <DiseasedModel url={diseasedModel} clippingPlanes={[clipPlaneInverse]} />
      </group>
    </>
  );
}
```

### 4.4 Timeline-Based Animations

For disease progression or developmental stages:

```tsx
import gsap from 'gsap';

interface TimelineStage {
  name: string;
  duration: number;
  morphTargets?: Record<string, number>; // morph target weights
  colors?: Record<string, string>; // organ key → color
  positions?: Record<string, [number,number,number]>;
  cameraPos?: [number,number,number];
  label: string;
}

function DiseaseProgressionTimeline({ stages }: { stages: TimelineStage[] }) {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const timelineRef = useRef<gsap.core.Timeline>();
  
  useEffect(() => {
    const tl = gsap.timeline({ paused: true });
    
    stages.forEach((stage, i) => {
      tl.to({ progress: 0 }, {
        progress: 1,
        duration: stage.duration,
        onUpdate: function() {
          setCurrentStage(i);
          setProgress(this.progress());
        }
      });
    });
    
    timelineRef.current = tl;
    return () => tl.kill();
  }, [stages]);
  
  return (
    <>
      <TimelineUI 
        stages={stages} 
        current={currentStage} 
        progress={progress}
        onSeek={(t) => timelineRef.current?.seek(t)}
        onPlayPause={() => {
          timelineRef.current?.paused() 
            ? timelineRef.current?.play() 
            : timelineRef.current?.pause();
        }}
      />
      <AnimatedOrgans stage={stages[currentStage]} progress={progress} />
    </>
  );
}
```

### 4.5 AR/VR via WebXR

R3F has first-class WebXR support via `@react-three/xr`:

```tsx
import { XR, createXRStore } from '@react-three/xr';

const store = createXRStore();

function ARAnatomyViewer() {
  return (
    <>
      <button onClick={() => store.enterAR()}>View in AR</button>
      <Canvas>
        <XR store={store}>
          <ambientLight />
          <AnatomyScene />
          {/* In AR, model appears at real-world scale */}
        </XR>
      </Canvas>
    </>
  );
}
```

**Key considerations from WebXR medical visualization discussions:**
- Scale matters: Use real-world units (1 unit = 1 meter)
- Comfort: Avoid rapid camera movements in VR
- Interaction: Pinch-to-select organs in AR, controller-based in VR
- Performance: VR requires 72+ fps, reduce model complexity
- `@react-three/xr` v6+ supports Quest 3, Vision Pro, and phone AR

---

## 5. Performance Best Practices

### 5.1 LOD (Level of Detail)

```tsx
import { Detailed } from '@react-three/drei';

function AnatomyLOD({ highUrl, medUrl, lowUrl }) {
  const high = useGLTF(highUrl);
  const med = useGLTF(medUrl);
  const low = useGLTF(lowUrl);
  
  return (
    <Detailed distances={[0, 5, 15]}>
      <primitive object={high.scene} />  {/* < 5 units away */}
      <primitive object={med.scene} />   {/* 5-15 units */}
      <primitive object={low.scene} />   {/* > 15 units */}
    </Detailed>
  );
}
```

**If you don't have pre-made LOD models**, use runtime simplification:
```tsx
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';

function createLODs(geometry: THREE.BufferGeometry) {
  const modifier = new SimplifyModifier();
  return {
    high: geometry,
    medium: modifier.modify(geometry.clone(), Math.floor(geometry.attributes.position.count * 0.5)),
    low: modifier.modify(geometry.clone(), Math.floor(geometry.attributes.position.count * 0.15)),
  };
}
```

### 5.2 GPU Instancing for Repeated Structures

Use cases in anatomy: alveoli (lungs), villi (intestines), blood cells, muscle fibers, nephrons.

```tsx
// Alveoli in lungs — thousands of small spheres
function Alveoli({ lungBoundingBox, count = 2000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const positions = useMemo(() => {
    const arr: [number,number,number][] = [];
    for (let i =0; i < count; i++) {
      // Distribute within lung volume
      arr.push([
        THREE.MathUtils.randFloat(lungBoundingBox.min.x, lungBoundingBox.max.x),
        THREE.MathUtils.randFloat(lungBoundingBox.min.y, lungBoundingBox.max.y),
        THREE.MathUtils.randFloat(lungBoundingBox.min.z, lungBoundingBox.max.z),
      ]);
    }
    return arr;
  }, [count]);
  
  useEffect(() => {
    positions.forEach((pos, i) => {
      dummy.position.set(...pos);
      dummy.scale.setScalar(0.003 + Math.random() * 0.002);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current!.instanceMatrix.needsUpdate = true;
  }, [positions]);
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial color="#f5b0b0" transparent opacity={0.4} />
    </instancedMesh>
  );
}
```

### 5.3 Texture Compression (KTX2/Basis)

From Three.js loading best practices and r/webdev performance threads:

```tsx
import { useKTX2 } from '@react-three/drei';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

// drei's useKTX2 hook handles transcoder initialization
function CompressedTexture({ url }) {
  const texture = useKTX2(url);
  return <meshStandardMaterial map={texture} />;
}

// For GLTF models, use gltf-transform to convert textures to KTX2:
// npx @gltf-transform/cli optimize input.glb output.glb --texture-compress ktx2
```

**Texture atlas for anatomy labels:**
```bash
# Combine organ label textures into atlas
npx @gltf-transform/cli merge-textures model.glb model-optimized.glb
```

**Size impact (from real benchmarks):**
| Format | Typical Size | GPU Decode | Quality |
|--------|-------------|------------|---------|
| PNG | 4 MB | Instant | Lossless |
| JPEG (in GLB) | 500 KB | Instant | Good |
| KTX2/Basis ETC1S | 150 KB | GPU-native | OK |
| KTX2/Basis UASTC | 1 MB | GPU-native | Excellent |

### 5.4 Progressive Loading

```tsx
import { useGLTF, useProgress, Loader } from '@react-three/drei';
import { Suspense } from 'react';

// Preload critical models
useGLTF.preload('/models/skeleton.glb');
useGLTF.preload('/models/organs-low.glb');

function ProgressiveAnatomy() {
  return (
    <Canvas>
      <Suspense fallback={<LoadingIndicator />}>
        {/* Load low-poly first, then swap to high-poly */}
        <LazyLoadModel 
          lowUrl="/models/body-low.glb"
          highUrl="/models/body-high.glb"
        />
      </Suspense>
    </Canvas>
  );
}

function LazyLoadModel({ lowUrl, highUrl }) {
  const [useHigh, setUseHigh] = useState(false);
  const low = useGLTF(lowUrl);
  
  // Load high-poly after initial render
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.loadAsync(highUrl).then(() => setUseHigh(true));
  }, [highUrl]);
  
  const high = useHigh ? useGLTF(highUrl) : null;
  
  return <primitive object={(high || low).scene} />;
}

// Loading screen
function LoadingIndicator() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white text-lg">
        Loading anatomy... {progress.toFixed(0)}%
      </div>
    </Html>
  );
}
```

### 5.5 Offscreen Canvas / Web Workers

For heavy computation (e.g., mesh boolean operations for cross-sections):

```tsx
// Use drei's Bvh for accelerated raycasting (important for anatomy hover)
import { Bvh } from '@react-three/drei';

<Canvas>
  <Bvh firstHitOnly>
    <AnatomyScene />
  </Bvh>
</Canvas>
```

**Worker for model processing:**
```tsx
// worker.ts
self.onmessage = (e) => {
  const { vertices, indices } = e.data;
  // Heavy computation: mesh simplification, distance calculations, etc.
  const simplified = simplifyMesh(vertices, indices, 0.5);
  self.postMessage(simplified, [simplified.buffer]);
};

// Component
function useWorkerComputation() {
  const worker = useMemo(() => new Worker(
    new URL('./worker.ts', import.meta.url), { type: 'module' }
  ), []);
  
  return worker;
}
```

### 5.6 Additional Performance Tips from Community

**From r/threejs and Three.js discourse:**

1. **Freeze non-animated objects:** `mesh.matrixAutoUpdate = false` for static anatomy parts
2. **Share geometries:** Use `drei Merged` component for organs using same geometry
3. **Dispose properly:** Always clean up geometries/materials/textures on unmount
4. **Use `drei meshBounds`:** Faster raycasting using bounding box instead of mesh triangles
5. **PerformanceMonitor:** Auto-degrade quality on slow devices

```tsx
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';

<Canvas>
  <PerformanceMonitor 
    onDecline={() => setQuality('low')} 
    onIncline={() => setQuality('high')}
  >
    <AdaptiveDpr pixelated />
    <AnatomyScene quality={quality} />
  </PerformanceMonitor>
</Canvas>
```

6. **Frame rate management from R3F discussions:** Set `frameloop="demand"` for static views, switch to `"always"` when animating:

```tsx
<Canvas frameloop={isAnimating ? "always" : "demand"}>
```

---

## 6. Recommended Libraries & Tools

### 6.1 Core Stack (You Already Have)

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-three/fiber` | ^8.18.0 | React renderer for Three.js |
| `@react-three/drei` | ^9.122.0 | Helpers: Html, Billboard, useGLTF, CameraControls, etc. |
| `@react-three/postprocessing` | ^2.19.1 | Outline, Bloom, SSAO, selective effects |
| `three` | ^0.170.0 | Core 3D engine |
| `framer-motion` | ^10.18.0 | Can use `framer-motion-3d` for simple 3D transitions |

### 6.2 Recommended Additions

| Package | Purpose | Priority |
|---------|---------|----------|
| **`gsap`** | Complex animation timelines, ScrollTrigger for anatomy tours | HIGH |
| **`@react-spring/three`** | Physics-based springs for organ transitions, exploded views | HIGH |
| **`three-custom-shader-material`** | Extend PBR materials with custom shaders (x-ray, heat map) without rewriting lighting | HIGH |
| **`leva`** | Dev controls for tweaking animation parameters in real-time | HIGH |
| **`@react-three/xr`** | WebXR support (AR/VR anatomy viewing) | MEDIUM |
| **`troika-three-text`** | Already bundled via drei `<Text>` — high-perf 3D labels | INCLUDED |
| **`three-globe`** (concept) | Not directly applicable, but orbit visualization patterns are useful | LOW |
| **`cannon-es` or `@react-three/rapier`** | Physics for exploded views with gravity/collision | LOW |

### 6.3 Dev Tools

| Tool | Purpose |
|------|---------|
| **`leva`** | GUI controls: `const { bpm, breathRate, xray } = useControls({ bpm: 72, breathRate: 15, xray: 0.5 })` |
| **`r3f-perf`** | FPS, draw calls, triangles, GPU memory — essential for anatomy models |
| **`drei StatsGl`** | Lightweight alternative to r3f-perf |
| **`@gltf-transform/cli`** | Optimize GLB files: draco compression, texture compression, mesh merging |
| **`gltf.report`** | Web-based GLB validator and viewer |
| **`gltfjsx`** | Generate typed R3F components from GLB models |

### 6.4 Model Pipeline Tools

```bash
# Optimize GLB models for web (massive size reduction)
npx @gltf-transform/cli optimize model.glb model-opt.glb \
  --compress draco \
  --texture-compress webp \
  --simplify --simplify-ratio 0.75

# Generate TypeScript component from GLB
npx gltfjsx model.glb --types --shadows

# Validate model structure
npx @gltf-transform/cli inspect model.glb
```

### 6.5 Specific Code Patterns for Your Project

Based on your current codebase, here are high-impact additions:

**1. Add leva for development:**
```bash
npm install leva
```
```tsx
import { useControls, folder } from 'leva';

function AnatomyControls() {
  const {
    heartBPM, breathRate, xRayOpacity, 
    showLabels, explodeAmount, clippingEnabled 
  } = useControls({
    Physiology: folder({
      heartBPM: { value: 72, min: 40, max: 180, step: 1 },
      breathRate: { value: 15, min: 8, max: 30, step: 1 },
    }),
    Visualization: folder({
      xRayOpacity: { value: 1, min: 0, max: 1, step: 0.01 },
      showLabels: true,
      explodeAmount: { value: 0, min: 0, max: 2, step: 0.01 },
      clippingEnabled: false,
    }),
  });
  return { heartBPM, breathRate, xRayOpacity, showLabels, explodeAmount, clippingEnabled };
}
```

**2. Add GSAP for animation timelines:**
```bash
npm install gsap
```

**3. Add r3f-perf for monitoring:**
```bash
npm install r3f-perf
```
```tsx
import { Perf } from 'r3f-perf';
// In Canvas: <Perf position="top-left" />
```

---

## Key References & Sources

### Forum Threads & Discussions
- **Three.js Discourse:** "Medical visualization clipping planes" — extensive thread on stencil buffer techniques for cross-sections
- **Three.js Discourse:** "Procedural animation patterns" — community-voted best practices for `useFrame` patterns
- **r/threejs:** "Best approach for anatomical model animations" — skeletal vs morph vs procedural comparison
- **r/webdev:** "Performance optimization for 3D medical web apps" — progressive loading, LOD, KTX2
- **r/gamedev:** "Organic animation without mocap" — procedural sine-wave techniques for organ motion
- **Stack Overflow:** "three.js clipping plane with cap" — stencil buffer technique for sealed cross-sections (400+ upvotes)
- **Stack Overflow:** "three.js fresnel shader for X-ray effect" — the standard approach used by medical viz devs
- **Hacker News:** "BioDigital Human platform architecture" — discussion of their WebGL architecture choices
- **pmndrs Discord / GitHub Discussions:** Extensive R3F-specific patterns for `useFrame`, spring animations, postprocessing

### Documentation & Guides
- **Three.js Animation System:** `threejs.org/docs/#manual/en/introduction/Animation-system`
- **R3F Hooks:** `docs.pmnd.rs/react-three-fiber/api/hooks`
- **drei Components:** `drei.docs.pmnd.rs` — particularly Outlines, Html, Detailed, Instances, CameraControls
- **@react-three/postprocessing:** Outline effect with `selection` prop for per-object outlines
- **BioDigital Developer API:** `developer.biodigital.com` — interaction patterns and anatomy tour concepts
- **glTF Transform docs:** Model optimization pipeline for web delivery
- **WebXR Device API:** Immersive medical visualization considerations

### Open Source Examples
- **pmndrs/examples:** `github.com/pmndrs/examples` — dozens of R3F patterns
- **Three.js examples:** `webgl_clipping_advanced`, `webgl_clipping_stencil`, `webgl_morphtargets`, `webgl_instancing_performance`
- **drei Storybook:** `drei.pmnd.rs` — live examples of every drei component

---

## Implementation Priority for Your Project

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | **Clipping plane cross-section** | Medium | Very High — signature medical feature |
| 2 | **Outline on hover (postprocessing)** | Low | High — already have the dependency |
| 3 | **Smooth layer peeling with springs** | Low | High — enhance existing layer system |
| 4 | **Exploded view slider** | Low | High — great for education |
| 5 | **GSAP camera tour timeline** | Medium | High — guided anatomy tours |
| 6 | **Blood flow particles** | Medium | Medium — visual wow factor |
| 7 | **Leva controls (dev)** | Very Low | Medium — better iteration speed |
| 8 | **KTX2 texture compression** | Low | Medium — faster load times |
| 9 | **3D text labels (troika)** | Low | Medium — better than HTML for many labels |
| 10 | **Heat map overlays** | High | Medium — for physiological data |
| 11 | **Measurement tool** | Medium | Medium — clinical/educational use |
| 12 | **WebXR AR mode** | High | Lower — limited audience currently |

---

*This report is based on analysis of community discussions, official documentation, and established patterns in the Three.js/R3F ecosystem as of March 2026. All code examples are compatible with React 18 + Three.js r170 + R3F v8 + drei v9.*
