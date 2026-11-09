import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Line, OrbitControls, Stars, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { AdditiveBlending, BackSide, DirectionalLight, Group, Matrix4, Quaternion, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import { useArchitectureStore } from '../../../state/architectureStore';
import type { NormalizedArchitecture } from '../../../domain/model/ArchitectureTypes';
import { getMissionReport, type MissionReport } from '../../../domain/analysis/mission';
import {
  buildOperationsModel, lastSunriseBefore, operationsLoadW, operationsMode, reportOrbit, stepStateOfCharge,
  type OperationsModel,
} from '../../../domain/analysis/operations';
import {
  DEG, RAD, R_EARTH_KM, ecfToGeodetic, ecfToLookAngles, eciToEcf, geodeticToEcf, gmstRad, inEclipse,
  propagateKeplerJ2, sunUnitVectorEci, type KeplerOrbit, type Vec3,
} from '../../../domain/mission';
import { useSimStore, SPEEDS, type Telemetry } from './simStore';
import { SceneModeToggle } from './SceneModeToggle';
import { TextBillboard } from '../TextBillboard';
import { mliBumpTexture, mliTexture, solarCellTexture } from './satelliteTextures';
import { fmtNum, fmtPct, fmtQty } from '../../../lib/format';

/* Scale: 1 scene unit = 1 000 km. The satellite is drawn 300× life size. */
const KM = 1 / 1000;
const SAT_SCALE = 300;
const R = R_EARTH_KM * KM;
export const EARTH_SCENE_R = R;
const u = (metres: number) => metres * SAT_SCALE * KM;
const toScene = (p: Vec3) => new Vector3(p.x * KM, p.z * KM, -p.y * KM);
const BASE = import.meta.env.BASE_URL;

/* ── Earth ───────────────────────────────────────────────── */

/**
 * Corrections in the shader, purely visual. The night map adds a violet base to
 * the land, so only the city lights are kept. Seen from orbit the sunlit side
 * carries a blue haze, stronger towards the horizon, and the oceans show a glint.
 */
function tuneEarth(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= smoothstep(0.1, 0.45, max(totalEmissiveRadiance.r, totalEmissiveRadiance.g));`)
    .replace('#include <opaque_fragment>', `
      vec3 sunDir = directionalLights[0].direction;
      vec3 viewDir = normalize(vViewPosition);
      float lit = sqrt(clamp(dot(normal, sunDir), 0.0, 1.0));
      float horizon = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.5);
      float ocean = smoothstep(0.12, 0.05, max(diffuseColor.r, diffuseColor.g));
      float glint = pow(clamp(dot(normal, normalize(sunDir + viewDir)), 0.0, 1.0), 420.0);
      outgoingLight += lit * (vec3(0.006, 0.019, 0.052) + horizon * vec3(0.05, 0.14, 0.32));
      outgoingLight += ocean * glint * vec3(0.16, 0.15, 0.13);
      #include <opaque_fragment>`);
}

/**
 * The cloud map has a grey veil over the whole planet (median 24% of full scale),
 * which turns the oceans grey, and its pixels converge into a starburst at the
 * poles; this keeps only the clouds, fading out at the poles.
 */
function tuneClouds(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <alphamap_fragment>',
    `diffuseColor.a *= smoothstep(0.36, 0.86, texture2D(alphaMap, vAlphaMapUv).g)
      * smoothstep(0.0, 0.07, vAlphaMapUv.y) * smoothstep(1.0, 0.93, vAlphaMapUv.y);`,
  );
}

export function EarthTextured() {
  const [day, night, clouds] = useTexture([
    `${BASE}textures/earth/earth_day_5k.jpg`,
    `${BASE}textures/earth/earth_night_2k.jpg`,
    `${BASE}textures/earth/earth_clouds_2k.jpg`,
  ]);
  useEffect(() => {
    day.colorSpace = SRGBColorSpace;
    night.colorSpace = SRGBColorSpace;
    day.anisotropy = 16;
    night.anisotropy = 8;
    clouds.anisotropy = 16;
  }, [day, night, clouds]);
  // envMapIntensity 0: the environment below is there for the satellite's metal, not for the planet.
  // toneMapped false: the film curve desaturates the blue of the oceans.
  return (
    <>
      <mesh>
        <sphereGeometry args={[R, 128, 96]} />
        <meshStandardMaterial map={day} emissiveMap={night} emissive="#ffe2b0" emissiveIntensity={1.1} roughness={1} metalness={0} envMapIntensity={0} toneMapped={false} onBeforeCompile={tuneEarth} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.004, 96, 64]} />
        <meshStandardMaterial alphaMap={clouds} color="#ffffff" transparent opacity={0.9} depthWrite={false} roughness={1} envMapIntensity={0} toneMapped={false} onBeforeCompile={tuneClouds} />
      </mesh>
    </>
  );
}

function EarthPlain() {
  return (
    <mesh>
      <sphereGeometry args={[R, 64, 48]} />
      <meshStandardMaterial color="#2b4f7a" roughness={1} envMapIntensity={0} />
    </mesh>
  );
}

/* ── Atmosphere ──────────────────────────────────────────── */

const ATMOSPHERE_R = R * 1.03;
/** |N·V| on the inside of the shell where a line of sight just grazes the surface. */
const LIMB_DOT = Math.sqrt(1 - (R / ATMOSPHERE_R) ** 2);

/**
 * Thin limb seen against space, drawn on the inside of a shell around the Earth:
 * brightest at the surface, fading to nothing at the top of the shell, and only
 * on the side the Sun lights. Purely visual; the analyses have no atmosphere optics.
 */
export function Atmosphere({ sunRef }: { sunRef: React.MutableRefObject<DirectionalLight | null> }) {
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { sunDir: { value: new Vector3(1, 0, 0) }, limb: { value: LIMB_DOT } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vView = -mv.xyz;
        vWorld = normalize(position);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      uniform float limb;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        float d = -dot(normalize(vNormal), normalize(vView));
        float rim = pow(clamp(d / limb, 0.0, 1.0), 2.2);
        float day = smoothstep(-0.25, 0.35, dot(vWorld, sunDir));
        gl_FragColor = vec4(mix(vec3(0.16, 0.42, 1.0), vec3(0.55, 0.78, 1.0), rim), rim * day * 0.95);
      }`,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    if (sunRef.current) (material.uniforms.sunDir.value as Vector3).copy(sunRef.current.position).normalize();
  });
  return (
    <mesh material={material}>
      <sphereGeometry args={[ATMOSPHERE_R, 96, 64]} />
    </mesh>
  );
}

/* ── Ground station (inside the rotating Earth group) ──────── */

function StationMarker({ report }: { report: MissionReport }) {
  const s = report.station;
  const data = useMemo(() => {
    if (!s) return null;
    const g = { latRad: s.station.latDeg * DEG, lonRad: s.station.lonDeg * DEG, heightKm: s.station.altKm };
    const p = toScene(geodeticToEcf(g));
    const n = p.clone().normalize();
    const lambda = s.coverage.earthCentralAngleDeg * DEG;
    const e1 = new Vector3(0, 1, 0).cross(n).normalize();
    if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
    const e2 = n.clone().cross(e1).normalize();
    const ring: [number, number, number][] = [];
    for (let k = 0; k <= 72; k++) {
      const phi = (k / 72) * 2 * Math.PI;
      const d = n.clone().multiplyScalar(Math.cos(lambda))
        .add(e1.clone().multiplyScalar(Math.sin(lambda) * Math.cos(phi)))
        .add(e2.clone().multiplyScalar(Math.sin(lambda) * Math.sin(phi)))
        .multiplyScalar(R * 1.003);
      ring.push([d.x, d.y, d.z]);
    }
    return { p, ring, name: s.station.name };
  }, [s]);
  if (!data) return null;
  const tip = data.p.clone().multiplyScalar(1.01);
  return (
    <group>
      <mesh position={data.p}>
        <sphereGeometry args={[0.035, 16, 12]} />
        <meshBasicMaterial color="#E8A33D" />
      </mesh>
      <Line points={data.ring} color="#E8A33D" lineWidth={1} transparent opacity={0.7} />
      <TextBillboard position={[tip.x, tip.y + 0.12, tip.z]} text={data.name.split('(')[0].trim()} size={0.11} color="#E8A33D" />
    </group>
  );
}

/* ── Satellite ───────────────────────────────────────────── */

interface AntennaShape { kind: 'patch' | 'dish'; sizeM: number }
interface SatDims {
  /** Bus edges along velocity (x), orbit normal (y, wing axis) and nadir (z). */
  bx: number; by: number; bz: number;
  /** True when the bus size comes from the model; false when estimated from the mass. */
  declared: boolean;
  wingLengthM: number; wingWidthM: number;
  /** Radiator plate on a ±Y face, sized from the declared radiator area. */
  radW: number; radH: number;
  antenna: AntennaShape | null;
}

/**
 * Antenna drawn from the link budget: the effective aperture A_e = G·λ²/(4π)
 * sets a patch side for low gain; above 12 dBi a dish of diameter
 * D = (λ/π)·√(G/η), with η = 0.55.
 */
function antennaShape(report: MissionReport): AntennaShape | null {
  const gainDbi = report.link?.inputs.find((i) => i.label === 'Ganho da antena TX')?.value ?? null;
  const frequencyGHz = report.link?.inputs.find((i) => i.label === 'Frequência')?.value ?? null;
  if (gainDbi === null || frequencyGHz === null || frequencyGHz <= 0) return null;
  const lambdaM = 0.299792458 / frequencyGHz;
  const g = Math.pow(10, gainDbi / 10);
  if (gainDbi < 12) return { kind: 'patch', sizeM: Math.sqrt((g * lambdaM * lambdaM) / (4 * Math.PI)) };
  return { kind: 'dish', sizeM: (lambdaM / Math.PI) * Math.sqrt(g / 0.55) };
}

/** Bus size declared in the model (bus_x_m, bus_y_m, bus_z_m on one entity, usually the space segment). */
function declaredBus(params: Record<string, { value: number | null }>): { bx: number; by: number; bz: number } | null {
  for (const key of Object.keys(params)) {
    if (!key.endsWith('.bus_x_m')) continue;
    const owner = key.slice(0, -'.bus_x_m'.length);
    const bx = params[key]?.value;
    const by = params[`${owner}.bus_y_m`]?.value;
    const bz = params[`${owner}.bus_z_m`]?.value;
    if (bx && by && bz) return { bx, by, bz };
  }
  return null;
}

function satelliteDims(report: MissionReport, bus: { bx: number; by: number; bz: number } | null, massKg: number | null, panelAreaM2: number | null, radiatorAreaM2: number | null): SatDims {
  // Without declared dimensions, a cube from the mass (~400 kg/m³ for small spacecraft).
  const cube = Math.cbrt((massKg && massKg > 0 ? massKg : 30) / 400);
  const { bx, by, bz } = bus ?? { bx: cube, by: cube, bz: cube };
  const area = panelAreaM2 && panelAreaM2 > 0 ? panelAreaM2 : report.power?.array?.areaM2 ?? 0.3;
  const wingWidthM = bx;
  const wingLengthM = Math.max(0.15, (area / 2) / wingWidthM);
  // Declared radiator area on a ±Y face (x by z), capped at the face.
  const radArea = radiatorAreaM2 && radiatorAreaM2 > 0 ? radiatorAreaM2 : 0.2;
  const radW = bx * 0.96;
  const radH = Math.min(bz * 0.96, radArea / radW);
  const antenna = antennaShape(report);
  if (antenna) antenna.sizeM = Math.min(antenna.sizeM, Math.min(bx, by) * 0.6);
  return { bx, by, bz, declared: !!bus, wingLengthM, wingWidthM, radW, radH, antenna };
}

/** The satellite's dimensions from the model: declared bus, mass, panel and radiator areas. */
export function modelSatelliteDims(architecture: NormalizedArchitecture | null, report: MissionReport): SatDims {
  const ev = architecture?.evaluation;
  const mass = ev?.derived['engine.budget_mass_total'] ?? ev?.params['mission.dry_mass']?.value ?? null;
  const panel = report.power?.declaredArrayAreaM2 ?? null;
  const radiator = report.thermal?.inputs.find((i) => i.label === 'Área radiante')?.value ?? null;
  return satelliteDims(report, ev ? declaredBus(ev.params) : null, mass, panel, radiator);
}

export function SatelliteModel({ dims, wingsRef, radiatorRef, foilRelief = 1.4 }: { dims: SatDims; foilRelief?: number; wingsRef: React.MutableRefObject<Group | null>; radiatorRef: React.MutableRefObject<Group | null> }) {
  const hx = u(dims.bx) / 2;
  const hy = u(dims.by) / 2;
  const hz = u(dims.bz) / 2;
  const wl = u(dims.wingLengthM);
  const ww = u(dims.wingWidthM);
  const gap = u(0.06);
  const ant = dims.antenna;
  const rail = u(0.012);
  const { foil, foilBump, cells } = useMemo(() => {
    const cellTile = solarCellTexture();
    // One tile holds 4 × 4 cells of about 4 cm, real proportions on any wing size.
    cellTile.repeat.set(Math.max(1, Math.round(dims.wingWidthM / 0.16)), Math.max(1, Math.round(dims.wingLengthM / 0.16)));
    return { foil: mliTexture(), foilBump: mliBumpTexture(), cells: cellTile };
  }, [dims.wingWidthM, dims.wingLengthM]);
  useEffect(() => () => { foil.dispose(); foilBump.dispose(); cells.dispose(); }, [foil, foilBump, cells]);
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[u(dims.bx), u(dims.by), u(dims.bz)]} />
        {/* A faint self-glow keeps faces the Sun does not reach readable; it touches only the satellite. */}
        <meshStandardMaterial map={foil} bumpMap={foilBump} bumpScale={foilRelief} roughness={0.3} metalness={1} envMapIntensity={1.1} emissive="#6e4a18" emissiveIntensity={0.12} />
      </mesh>
      {/* Structure rails on the twelve edges of the bus */}
      {([[u(dims.bx), rail, rail, 0], [rail, u(dims.by), rail, 1], [rail, rail, u(dims.bz), 2]] as const).flatMap(([x, y, z, axis]) =>
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => (
          <mesh
            key={`${axis}${a}${b}`}
            position={axis === 0 ? [0, a * hy, b * hz] : axis === 1 ? [a * hx, 0, b * hz] : [a * hx, b * hy, 0]}
          >
            <boxGeometry args={[x + rail * 0.5, y + rail * 0.5, z + rail * 0.5]} />
            <meshStandardMaterial color="#6f7884" roughness={0.55} metalness={0.5} envMapIntensity={0.5} />
          </mesh>
        )),
      )}
      {/* Solar wings along ±Y (orbit normal), rotating about Y to face the Sun */}
      <group ref={wingsRef}>
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh position={[0, s * (hy + gap + wl / 2), 0]}>
              <boxGeometry args={[ww, wl, u(0.02)]} />
              {/* Rough and not metallic: on a flat panel a tight highlight would wash out every cell at once. */}
              <meshStandardMaterial map={cells} roughness={0.8} metalness={0} envMapIntensity={0.25} emissive="#ffffff" emissiveMap={cells} emissiveIntensity={0.22} />
            </mesh>
            {/* Panel frame */}
            {[1, -1].map((side) => (
              <mesh key={side} position={[side * (ww / 2 + rail / 2), s * (hy + gap + wl / 2), 0]}>
                <boxGeometry args={[rail, wl + rail * 2, u(0.024)]} />
                <meshStandardMaterial color="#5f6875" roughness={0.6} metalness={0.5} />
              </mesh>
            ))}
            {[0, wl].map((along) => (
              <mesh key={along} position={[0, s * (hy + gap + along), 0]}>
                <boxGeometry args={[ww, rail, u(0.024)]} />
                <meshStandardMaterial color="#5f6875" roughness={0.6} metalness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, s * (hy + gap / 2), 0]}>
              <boxGeometry args={[u(0.03), gap, u(0.03)]} />
              <meshStandardMaterial color="#8c97a6" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Nadir face (+Z): payload aperture and the TT&C antenna from the link budget */}
      <mesh position={[hx * 0.35, 0, hz + u(0.05)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[u(0.09), u(0.09), u(0.1), 24]} />
        <meshStandardMaterial color="#2a3140" roughness={0.4} metalness={0.6} />
      </mesh>
      {ant?.kind === 'patch' && (
        <mesh position={[-hx * 0.45, 0, hz + u(0.004)]}>
          <boxGeometry args={[u(ant.sizeM), u(ant.sizeM), u(0.008)]} />
          <meshStandardMaterial color="#dde2e8" roughness={0.6} metalness={0.1} />
        </mesh>
      )}
      {ant?.kind === 'dish' && (
        <mesh position={[-hx * 0.4, 0, hz + u(0.03)]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[u(ant.sizeM / 2), u(ant.sizeM * 0.15), u(0.06), 28, 1, true]} />
          <meshStandardMaterial color="#d9dee5" roughness={0.5} metalness={0.3} side={2} />
        </mesh>
      )}
      {/* Radiator on the ±Y face that never sees the Sun (side set each frame from β) */}
      <group ref={radiatorRef} position={[0, -(hy + u(0.006)), 0]}>
        <mesh>
          <boxGeometry args={[u(dims.radW), u(0.012), u(dims.radH)]} />
          <meshStandardMaterial color="#e8edf3" roughness={0.2} metalness={0.1} emissive="#e8edf3" emissiveIntensity={0.12} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Simulation driver (runs inside the Canvas) ──────────── */

interface DriverProps {
  report: MissionReport;
  orbit: KeplerOrbit;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  earthRef: React.MutableRefObject<Group | null>;
  satRef: React.MutableRefObject<Group | null>;
  wingsRef: React.MutableRefObject<Group | null>;
  radiatorRef: React.MutableRefObject<Group | null>;
  radiatorOffset: number;
  sunRef: React.MutableRefObject<DirectionalLight | null>;
  linkRef: React.MutableRefObject<Group | null>;
  modeNames: Record<string, string>;
  ops: OperationsModel | null;
}

function SimDriver({ report, orbit, controlsRef, earthRef, satRef, wingsRef, radiatorRef, radiatorOffset, sunRef, linkRef, modeNames, ops }: DriverProps) {
  const { camera } = useThree();
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const follow = useSimStore((s) => s.follow);
  const resetTick = useSimStore((s) => s.resetTick);
  const overviewTick = useSimStore((s) => s.overviewTick);
  const setTelemetry = useSimStore((s) => s.setTelemetry);

  const t = useRef(0);
  const sun = useRef<Vec3>(sunUnitVectorEci(report.orbit.epoch));
  const sunT = useRef(-1e9);
  const lastSunrise = useRef<number | null>(null);
  const wasSunlit = useRef<boolean | null>(null);
  // Battery integrated from the simulated events, starting full at the epoch.
  const soc = useRef(1);
  const prevT = useRef(0);
  const telemetryAcc = useRef(1);
  const lastTarget = useRef(new Vector3());
  const lastAttitude = useRef(new Quaternion());
  const framed = useRef(false);
  const epochMs = report.orbit.epoch.getTime();
  const periodS = report.orbit.basics.periodMin * 60;
  const station = report.station;
  const observer = station ? { latRad: station.station.latDeg * DEG, lonRad: station.station.lonDeg * DEG, heightKm: station.station.altKm } : null;
  const minEl = station ? station.station.minElevationDeg * DEG : 0;

  useEffect(() => {
    t.current = 0;
    sunT.current = -1e9;
    lastSunrise.current = null;
    wasSunlit.current = null;
    soc.current = 1;
    prevT.current = 0;
    framed.current = false;
  }, [resetTick, report]);

  useEffect(() => {
    if (overviewTick === 0) return;
    const c = controlsRef.current;
    // Frame the whole orbit from the side the satellite is on, slightly above it,
    // so the satellite and the ground under it stay in view.
    const dir = toScene(propagateKeplerJ2(orbit, t.current)).normalize();
    camera.position.copy(dir.multiplyScalar(24)).add(new Vector3(0, 6, 0));
    camera.up.set(0, 1, 0);
    if (c) { c.target.set(0, 0, 0); c.update(); }
  }, [overviewTick, camera, controlsRef, orbit]);

  useFrame((_, dt) => {
    if (playing) t.current += Math.min(dt, 0.1) * speed;
    const tSec = t.current;
    const date = new Date(epochMs + tSec * 1000);
    if (tSec - sunT.current > 600 || tSec < sunT.current) { sun.current = sunUnitVectorEci(date); sunT.current = tSec; }
    const sunDir = sun.current;

    const pos = propagateKeplerJ2(orbit, tSec);
    const pos2 = propagateKeplerJ2(orbit, tSec + 1);
    const satPos = toScene(pos);
    const vel = toScene(pos2).sub(satPos).normalize();
    const zAxis = satPos.clone().normalize().multiplyScalar(-1); // nadir
    const xAxis = vel.clone().sub(zAxis.clone().multiplyScalar(vel.dot(zAxis))).normalize();
    const yAxis = zAxis.clone().cross(xAxis).normalize();
    const sat = satRef.current;
    if (sat) {
      sat.position.copy(satPos);
      sat.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
      const sunScene = toScene(sunDir);
      const sunBody = sunScene.clone().applyQuaternion(sat.quaternion.clone().invert());
      if (wingsRef.current) wingsRef.current.rotation.y = Math.atan2(-sunBody.x, -sunBody.z);
      // In a nadir-pointing orbit the Sun's out-of-plane component (sin β) keeps its sign,
      // so the ±Y face opposite to it never sees the Sun: that is where the radiator goes.
      if (radiatorRef.current) radiatorRef.current.position.y = sunBody.y > 0 ? -radiatorOffset : radiatorOffset;
    }
    const gmst = gmstRad(date);
    if (earthRef.current) earthRef.current.rotation.y = gmst;
    if (sunRef.current) { const s = toScene(sunDir).multiplyScalar(80); sunRef.current.position.copy(s); }

    const sunlit = !inEclipse(pos, sunDir);
    if (wasSunlit.current === false && sunlit) lastSunrise.current = tSec;
    if (lastSunrise.current === null) lastSunrise.current = lastSunriseBefore(orbit, tSec, sunDir, periodS);
    wasSunlit.current = sunlit;

    // Camera follow: the camera rides in the satellite's orbital frame, so the
    // Earth stays below, the horizon stays level, and the camera never goes
    // through the planet as the satellite goes around it.
    const c = controlsRef.current;
    if (c) {
      const up = satPos.clone().normalize();
      if (!framed.current && sat) {
        framed.current = true;
        // Behind and above: the satellite against the Earth, with the limb and space at the top.
        camera.position.copy(satPos).addScaledVector(xAxis, -1.05).addScaledVector(yAxis, 0.55).addScaledVector(up, 0.82);
        camera.up.copy(up);
        c.target.copy(satPos);
        lastTarget.current.copy(satPos);
        lastAttitude.current.copy(sat.quaternion);
        c.update();
      } else if (follow && sat) {
        const turn = sat.quaternion.clone().multiply(lastAttitude.current.clone().invert());
        const offset = camera.position.clone().sub(lastTarget.current).applyQuaternion(turn);
        camera.position.copy(satPos).add(offset);
        camera.up.copy(up);
        c.target.copy(satPos);
        lastTarget.current.copy(satPos);
        lastAttitude.current.copy(sat.quaternion);
        c.update();
      } else {
        camera.up.set(0, 1, 0);
        lastTarget.current.copy(c.target);
      }
    }

    // Station geometry and link line
    let contact = false;
    let elevationDeg = -90;
    let rangeKm = 0;
    const ecf = eciToEcf(pos, gmst);
    if (observer && station) {
      const look = ecfToLookAngles(observer, ecf);
      elevationDeg = look.elevationRad * RAD;
      rangeKm = look.rangeKm;
      contact = look.elevationRad >= minEl;
      const link = linkRef.current;
      if (link) {
        link.visible = contact;
        if (contact) {
          const st = geodeticToEcf(observer);
          const stEci = { x: Math.cos(gmst) * st.x - Math.sin(gmst) * st.y, y: Math.sin(gmst) * st.x + Math.cos(gmst) * st.y, z: st.z };
          const a = toScene(stEci);
          link.position.copy(a);
          link.lookAt(satPos);
          link.scale.set(1, 1, a.distanceTo(satPos));
        }
      }
    }

    // Operations decided by the simulated events; battery integrated over the simulated step.
    const minutesSinceSunrise = lastSunrise.current === null ? null : (tSec - lastSunrise.current) / 60;
    const modeId = ops ? operationsMode(ops, { sunlit, contact, minutesSinceSunrise }) : null;
    const dtSim = tSec - prevT.current;
    prevT.current = tSec;
    if (ops && dtSim > 0) soc.current = stepStateOfCharge(ops, soc.current, modeId, sunlit, dtSim);

    telemetryAcc.current += dt;
    if (telemetryAcc.current >= 0.25) {
      telemetryAcc.current = 0;
      const gd = ecfToGeodetic(ecf);
      const telemetry: Telemetry = {
        tSeconds: tSec,
        utc: date.toISOString().slice(0, 19).replace('T', ' '),
        altitudeKm: gd.heightKm,
        latDeg: gd.latRad * RAD,
        lonDeg: gd.lonRad * RAD,
        sunlit,
        contact,
        elevationDeg,
        rangeKm,
        orbitNumber: Math.floor(tSec / periodS) + 1,
        modeId,
        modeName: modeId ? (modeNames[modeId] ?? (modeId === '__eclipse' ? 'Eclipse' : modeId)) : null,
        loadW: ops ? operationsLoadW(ops, modeId) : null,
        genW: ops ? (sunlit ? ops.generationW : 0) : null,
        soc: ops ? soc.current : null,
        betaDeg: report.eclipse.betaDeg,
      };
      setTelemetry(telemetry);
      useArchitectureStore.getState().setLiveModeId(modeId);
    }
  });
  return null;
}

/* ── Orbit path ──────────────────────────────────────────── */

function OrbitPath({ orbit, report }: { orbit: KeplerOrbit; report: MissionReport }) {
  const { full, shadow } = useMemo(() => {
    const periodS = report.orbit.basics.periodMin * 60;
    const sunDir = sunUnitVectorEci(report.orbit.epoch);
    const n = 240;
    const full: [number, number, number][] = [];
    const shadowSegs: [number, number, number][][] = [];
    let cur: [number, number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const p = propagateKeplerJ2(orbit, (k / n) * periodS);
      const v = toScene(p);
      const pt: [number, number, number] = [v.x, v.y, v.z];
      full.push(pt);
      if (inEclipse(p, sunDir)) cur.push(pt);
      else if (cur.length) { shadowSegs.push(cur); cur = []; }
    }
    if (cur.length) shadowSegs.push(cur);
    return { full, shadow: shadowSegs.filter((s) => s.length > 1) };
  }, [orbit, report]);
  return (
    <group>
      <Line points={full} color="#A3AFBF" lineWidth={1} transparent opacity={0.55} />
      {shadow.map((seg, i) => <Line key={i} points={seg} color="#5CB8D6" lineWidth={2.5} />)}
    </group>
  );
}

/* ── Scene ───────────────────────────────────────────────── */

function PhysicalContent({ report, controlsRef }: { report: MissionReport; controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const earthRef = useRef<Group | null>(null);
  const satRef = useRef<Group | null>(null);
  const wingsRef = useRef<Group | null>(null);
  const radiatorRef = useRef<Group | null>(null);
  const sunRef = useRef<DirectionalLight | null>(null);
  const linkRef = useRef<Group | null>(null);

  const orbit = useMemo<KeplerOrbit>(() => reportOrbit(report), [report]);
  const ops = useMemo(() => (architecture ? buildOperationsModel(architecture, report) : null), [architecture, report]);

  const dims = useMemo(() => modelSatelliteDims(architecture, report), [architecture, report]);

  const modeNames = useMemo(() => Object.fromEntries((architecture?.evaluation.modes ?? []).map((m) => [m.id, m.name])), [architecture]);

  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight ref={sunRef} position={[80, 0, 0]} intensity={3.2} color="#fff4e0" />
      {/* Earth albedo: light from the planet reaches only the faces turned to it (nadir side). */}
      <pointLight position={[0, 0, 0]} intensity={0.9} decay={0} color="#a9c8ff" />
      <Stars radius={150} depth={60} count={3000} factor={2.5} saturation={0} fade />
      {/* Reflections for the metal of the satellite; built locally, so it works offline. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={5} color="#fff4e0" position={[6, 4, 6]} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#8fb6ff" position={[0, -7, 0]} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#ffffff" position={[-6, 2, -6]} scale={[6, 6, 1]} />
      </Environment>

      <group ref={earthRef}>
        <Suspense fallback={<EarthPlain />}>
          <EarthTextured />
        </Suspense>
        <StationMarker report={report} />
      </group>
      <Atmosphere sunRef={sunRef} />

      <OrbitPath orbit={orbit} report={report} />

      <group ref={satRef}>
        <SatelliteModel dims={dims} wingsRef={wingsRef} radiatorRef={radiatorRef} />
      </group>

      {/* Contact line: unit segment along +Z, scaled each frame */}
      <group ref={linkRef} visible={false}>
        <Line points={[[0, 0, 0], [0, 0, 1]]} color="#7FB0FF" lineWidth={1.5} dashed dashSize={0.08} gapSize={0.05} />
      </group>

      <SimDriver
        report={report} orbit={orbit} controlsRef={controlsRef} earthRef={earthRef} satRef={satRef} wingsRef={wingsRef}
        radiatorRef={radiatorRef} radiatorOffset={u(dims.by) / 2 + u(0.006)} sunRef={sunRef} linkRef={linkRef}
        modeNames={modeNames} ops={ops}
      />
    </>
  );
}

/* ── HUD ─────────────────────────────────────────────────── */

function TelemetryPanel({ report }: { report: MissionReport }) {
  const tm = useSimStore((s) => s.telemetry);
  const playing = useSimStore((s) => s.playing);
  if (!tm) return null;
  const socTone = tm.soc === null ? '' : tm.soc < 0.3 ? ' is-fail' : tm.soc < 0.5 ? ' is-warn' : '';
  return (
    <div className="phys-telemetry" aria-live="off">
      <div className="phys-telemetry__clock">
        <span>{tm.utc} UTC</span>
        <span className="support-label">{playing ? `órbita ${tm.orbitNumber}` : `pausado, órbita ${tm.orbitNumber}`}</span>
      </div>
      <div className="phys-telemetry__chips">
        <span className={`chip chip--${tm.sunlit ? 'warn' : 'info'}`}><span className="chip__dot" />{tm.sunlit ? 'ao Sol' : 'eclipse'}</span>
        {report.station && (
          <span className={`chip chip--${tm.contact ? 'ok' : 'neutral'}`}><span className="chip__dot" />{tm.contact ? `em contato, elevação ${fmtNum(tm.elevationDeg, 0)}°` : 'fora do alcance da estação'}</span>
        )}
        {tm.modeName && <span className="chip chip--neutral">modo {tm.modeName}</span>}
      </div>
      <div className="phys-telemetry__row"><span>Altitude</span><span className="mono">{fmtQty(tm.altitudeKm, 'km', 1)}</span></div>
      <div className="phys-telemetry__row"><span>Posição</span><span className="mono">{fmtNum(tm.latDeg, 2)}°, {fmtNum(tm.lonDeg, 2)}°</span></div>
      {tm.betaDeg !== null && <div className="phys-telemetry__row"><span>β na época</span><span className="mono">{fmtQty(tm.betaDeg, '°', 1)}</span></div>}
      {tm.genW !== null && <div className="phys-telemetry__row"><span>Geração</span><span className="mono">{fmtQty(tm.genW, 'W', 1)}</span></div>}
      {tm.loadW !== null && <div className="phys-telemetry__row"><span>Consumo</span><span className="mono">{fmtQty(tm.loadW, 'W', 1)}</span></div>}
      {tm.soc !== null && (
        <div className="phys-telemetry__row phys-telemetry__row--gauge">
          <span>Bateria</span>
          <span className="phys-gauge" role="img" aria-label={`estado de carga ${fmtPct(tm.soc)}`}><span className={`phys-gauge__fill${socTone}`} style={{ width: `${Math.round(tm.soc * 100)}%` }} /></span>
          <span className="mono">{fmtPct(tm.soc)}</span>
        </div>
      )}
      {tm.contact && <div className="phys-telemetry__row"><span>Distância à estação</span><span className="mono">{fmtQty(tm.rangeKm, 'km', 0)}</span></div>}
    </div>
  );
}

export function PhysicalScene() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const report = useMemo(() => (architecture ? getMissionReport(architecture) : null), [architecture]);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const follow = useSimStore((s) => s.follow);
  const setPlaying = useSimStore((s) => s.setPlaying);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const setFollow = useSimStore((s) => s.setFollow);
  const reset = useSimStore((s) => s.reset);
  const overview = useSimStore((s) => s.overview);
  useEffect(() => () => useArchitectureStore.getState().setLiveModeId(null), []);
  // The pause lives in a store that outlives the view; opening the scene always shows it running.
  useEffect(() => { useSimStore.getState().setPlaying(true); }, []);

  if (!report) {
    return (
      <div className="scene3d-shell">
        <div className="scene3d-hud"><SceneModeToggle /></div>
        <div className="empty-state">Declare <span className="mono">mission.orbit</span> no JSON para ver o satélite em órbita.</div>
      </div>
    );
  }

  return (
    <div className="scene3d-shell">
      <Canvas camera={{ position: [8, 5, 8], fov: 45, near: 0.01, far: 500 }} style={{ width: '100%', height: '100%' }}>
        <color attach="background" args={['#0F141B']} />
        <PhysicalContent report={report} controlsRef={controlsRef} />
        <OrbitControls
          ref={(instance) => { if (instance) controlsRef.current = instance; }}
          enablePan={false}
          enableZoom
          enableRotate
          minDistance={0.25}
          maxDistance={80}
          onStart={() => { /* user takes over the camera; follow keeps the target on the satellite */ }}
        />
      </Canvas>

      <div className="scene3d-hud">
        <SceneModeToggle />
        <div className="hud-divider" />
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPlaying(!playing)} aria-pressed={playing} title={playing ? 'Pausar a simulação' : 'Continuar a simulação'}>
          {playing ? 'Pausar' : 'Continuar'}
        </button>
        <div className="segmented" role="group" aria-label="Velocidade da simulação">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`segmented__item${speed === s ? ' is-on' : ''}`} aria-pressed={speed === s} onClick={() => setSpeed(s)} title={`${s} segundos simulados por segundo`}>
              ×{s}
            </button>
          ))}
        </div>
        <button type="button" className={`btn btn--secondary btn--sm${follow ? ' is-on' : ''}`} aria-pressed={follow} onClick={() => setFollow(!follow)} title="Manter a câmera no satélite">
          Seguir satélite
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={overview} title="Afastar a câmera para ver a Terra e a órbita inteira">
          Ver a órbita
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { reset(); setFollow(true); }} title="Voltar à época da órbita">
          Reiniciar
        </button>
      </div>

      <TelemetryPanel report={report} />
      <div className="phys-note support-label">
        Satélite ampliado {SAT_SCALE}×; 1 unidade = 1 000 km. Trecho azul da órbita: eclipse na época.
        Modos e bateria seguem a simulação.
      </div>
    </div>
  );
}
