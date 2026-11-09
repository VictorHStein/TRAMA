import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Stars } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, Matrix4, SRGBColorSpace, Vector3 } from 'three';
import type { DirectionalLight, Group, PerspectiveCamera, Sprite, SpriteMaterial } from 'three';
import { useArchitectureStore } from '../../state/architectureStore';
import type { MissionReport } from '../../domain/analysis/mission';
import { Atmosphere, EARTH_SCENE_R, EarthTextured, SatelliteModel, modelSatelliteDims } from '../scene3d/physical/PhysicalScene';

/**
 * Backdrop of the project home: an orbital sunrise over the night side of the
 * Earth, seen from behind the satellite of the model. Uses the same Earth and
 * satellite as the orbit scene, purely as a picture; nothing here is simulated.
 */

const DEG = Math.PI / 180;
const CAMERA_DISTANCE = 7.25;
const FOV = 30;
/** How far above the Earth's centre the camera looks, so the limb crosses the frame. */
const ELEVATION = 58.5 * DEG;
const FORWARD = new Vector3(0, Math.sin(ELEVATION), -Math.cos(ELEVATION));
const UP = new Vector3(0, Math.cos(ELEVATION), Math.sin(ELEVATION));
const RIGHT = new Vector3(1, 0, 0);
const BASE_POSITION = new Vector3(0, 0, CAMERA_DISTANCE);

const SUN_START = new Vector3(0.2, 0.26, -0.95).normalize();
const SUN_END = new Vector3(0.4, 0.74, -0.54).normalize();
const INTRO_MS = 3400;

/** South America under the camera, with the ground station's region in the night. */
const EARTH_TILT = -41 * DEG;
const EARTH_START_SPIN = -45 * DEG;
const EARTH_SPIN_RAD_S = 0.004;

/** Where the satellite sits in the frame, in normalized device coordinates. */
const SAT_FRAME = { x: 0.56, y: 0.42, distance: 2.3, yaw: 34 * DEG };
const MIN_ASPECT_FOR_SATELLITE = 1.7;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function Rig({ playIntro, still, sunRef, earthRef }: {
  playIntro: boolean;
  still: boolean;
  sunRef: React.MutableRefObject<DirectionalLight | null>;
  earthRef: React.MutableRefObject<Group | null>;
}) {
  const started = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 });
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
    if (still) return undefined;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [still, invalidate]);

  useFrame((state, delta) => {
    const now = performance.now();
    if (started.current === null) started.current = now;
    const progress = playIntro && !still ? easeOutCubic(Math.min(1, (now - started.current) / INTRO_MS)) : 1;

    sunRef.current?.position.copy(SUN_START).lerp(SUN_END, progress).normalize().multiplyScalar(80);
    if (earthRef.current && !still) earthRef.current.rotation.y += Math.min(delta, 0.1) * EARTH_SPIN_RAD_S;

    // A slow push towards the limb during the sunrise, then a small parallax with the pointer.
    const p = pointer.current;
    const ease = 1 - Math.exp(-Math.min(delta, 0.1) * 2.5);
    p.smoothX += (p.x - p.smoothX) * ease;
    p.smoothY += (p.y - p.smoothY) * ease;
    state.camera.position.copy(BASE_POSITION)
      .addScaledVector(FORWARD, (progress - 1) * 0.28)
      .addScaledVector(RIGHT, p.smoothX * 0.05)
      .addScaledVector(UP, -p.smoothY * 0.03);
    state.camera.up.copy(UP);
    state.camera.lookAt(state.camera.position.clone().addScaledVector(FORWARD, 10));
  });
  return null;
}

/** Soft glare where the sunlight grazes the limb; it grows as the Sun comes up. */
function SunGlare({ sunRef }: { sunRef: React.MutableRefObject<DirectionalLight | null> }) {
  const spriteRef = useRef<Sprite | null>(null);
  const materialRef = useRef<SpriteMaterial | null>(null);
  const map = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    const glow = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    glow.addColorStop(0, 'rgba(255, 244, 224, 1)');
    glow.addColorStop(0.12, 'rgba(255, 226, 180, 0.6)');
    glow.addColorStop(0.4, 'rgba(150, 190, 255, 0.14)');
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => map.dispose(), [map]);

  useFrame(({ camera }) => {
    if (!sunRef.current || !spriteRef.current || !materialRef.current) return;
    const sun = sunRef.current.position.clone().normalize();
    const toCamera = camera.position.clone().normalize();
    const along = sun.clone().addScaledVector(toCamera, -sun.dot(toCamera)).normalize();
    const k = EARTH_SCENE_R / camera.position.length();
    const limb = toCamera.multiplyScalar(k).addScaledVector(along, Math.sqrt(1 - k * k));
    spriteRef.current.position.copy(limb).multiplyScalar(EARTH_SCENE_R * 1.004);
    const rise = Math.max(0, Math.min(1, (sun.dot(limb) + 0.12) / 0.38));
    materialRef.current.opacity = rise * 0.85;
    spriteRef.current.scale.setScalar(1.4 + rise * 2.6);
  });

  return (
    <sprite ref={spriteRef} renderOrder={5}>
      <spriteMaterial ref={materialRef} map={map} blending={AdditiveBlending} depthTest={false} depthWrite={false} transparent toneMapped={false} />
    </sprite>
  );
}

/** The model's satellite, near the camera and pointing its nadir face at the Earth. */
function HeroSatellite({ report, still }: { report: MissionReport; still: boolean }) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const dims = useMemo(() => modelSatelliteDims(architecture, report), [architecture, report]);
  const groupRef = useRef<Group | null>(null);
  const wingsRef = useRef<Group | null>(null);
  const radiatorRef = useRef<Group | null>(null);
  const time = useRef(0);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const fov = useThree((s) => (s.camera as PerspectiveCamera).fov);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (!still) time.current += Math.min(delta, 0.1);
    const halfH = Math.tan((fov * DEG) / 2) * SAT_FRAME.distance;
    const drift = Math.sin(time.current * 0.22) * 0.012;
    group.position.copy(BASE_POSITION)
      .addScaledVector(FORWARD, SAT_FRAME.distance)
      .addScaledVector(RIGHT, SAT_FRAME.x * halfH * aspect)
      .addScaledVector(UP, SAT_FRAME.y * halfH + drift);

    const nadir = group.position.clone().negate().normalize();
    const sway = Math.sin(time.current * 0.16) * 5 * DEG;
    const wingAxis = RIGHT.clone().applyAxisAngle(nadir, SAT_FRAME.yaw + sway);
    wingAxis.addScaledVector(nadir, -wingAxis.dot(nadir)).normalize();
    const flight = new Vector3().crossVectors(wingAxis, nadir);
    group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(flight, wingAxis, nadir));
    if (wingsRef.current) wingsRef.current.rotation.y = 0.7;
  });

  if (aspect < MIN_ASPECT_FOR_SATELLITE) return null;
  return (
    <group ref={groupRef}>
      <SatelliteModel dims={dims} wingsRef={wingsRef} radiatorRef={radiatorRef} foilRelief={0.3} />
    </group>
  );
}

function OnReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export function HomeOrbitScene({ report, playIntro, active, still }: {
  report: MissionReport | null;
  /** First view of this page load: the Sun comes up. Otherwise it is already up. */
  playIntro: boolean;
  /** False while the hero is scrolled out of view, so nothing is drawn for nothing. */
  active: boolean;
  /** Reduced motion: one still frame. */
  still: boolean;
}) {
  const sunRef = useRef<DirectionalLight | null>(null);
  const earthRef = useRef<Group | null>(null);
  const [ready, setReady] = useState(false);
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });
  const markReady = useMemo(() => () => setReady(true), []);

  // Without WebGL the hero keeps its plain dark background.
  if (!supported) return null;

  return (
    <div className={`home__orbit${ready ? ' is-ready' : ''}`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={still ? 'demand' : active ? 'always' : 'never'}
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: FOV, near: 0.05, far: 500 }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#05080E']} />
        <ambientLight intensity={0.06} />
        <directionalLight ref={sunRef} position={[80, 0, 0]} intensity={3.2} color="#fff4e0" />
        <Stars radius={150} depth={60} count={3000} factor={2.5} saturation={0} fade />
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={5} color="#fff4e0" position={[6, 4, 6]} scale={[8, 8, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#8fb6ff" position={[0, -7, 0]} scale={[14, 14, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#ffffff" position={[-6, 2, -6]} scale={[6, 6, 1]} />
          {/* All around the camera: the foil is pure metal, so this is what shows the gold on the faces we see. */}
          <Lightformer form="rect" intensity={1.5} color="#ffeccc" position={[0, 0, 16]} scale={[60, 60, 1]} />
        </Environment>
        <Rig playIntro={playIntro} still={still} sunRef={sunRef} earthRef={earthRef} />
        <group rotation={[EARTH_TILT, 0, 0]}>
          <group ref={earthRef} rotation={[0, EARTH_START_SPIN, 0]}>
            <Suspense fallback={null}>
              <EarthTextured />
              <OnReady onReady={markReady} />
            </Suspense>
          </group>
        </group>
        <Atmosphere sunRef={sunRef} />
        <SunGlare sunRef={sunRef} />
        {report && <Suspense fallback={null}><HeroSatellite report={report} still={still} /></Suspense>}
      </Canvas>
    </div>
  );
}
