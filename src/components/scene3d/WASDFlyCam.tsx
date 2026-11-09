import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../../lib/dom';
import { useFrame, useThree } from '@react-three/fiber';
import { Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/**
 * FPS-style fly camera + keyboard orbit for the 3D scene.
 *
 *   W / S       → move forward / backward along the camera's look
 *                  direction (XZ plane only — Y is locked).
 *   A / D       → strafe left / right
 *   Q / E       → drop / lift (world Y)
 *   ← / →       → orbit yaw (rotate horizontally around target)
 *   ↑ / ↓       → orbit pitch (rotate vertically around target)
 *   Shift       → 3× sprint
 *
 * Movement translates both the camera AND the orbit target by the same
 * vector. Orbit rotates the camera around the current target without
 * moving it. Mouse-driven pan/zoom/rotate continues to work in parallel.
 */
const BASE_SPEED = 14;  // world units / second
const ORBIT_SPEED = 1.4; // radians / second
const SPRINT = 3;
const MIN_PITCH = 0.15;
const MAX_PITCH = Math.PI * 0.85;

export function WASDFlyCam({
  controlsRef,
  active = true,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  active?: boolean;
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!active) return;

    const onDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
        keys.current[k] = true;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        keys.current.yawL = true;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        keys.current.yawR = true;
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        keys.current.pitchU = true;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        keys.current.pitchD = true;
        e.preventDefault();
      }
      if (e.key === 'Shift') keys.current.shift = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k] = false;
      if (e.key === 'ArrowLeft') keys.current.yawL = false;
      if (e.key === 'ArrowRight') keys.current.yawR = false;
      if (e.key === 'ArrowUp') keys.current.pitchU = false;
      if (e.key === 'ArrowDown') keys.current.pitchD = false;
      if (e.key === 'Shift') keys.current.shift = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      keys.current = {};
    };
  }, [active]);

  useFrame((_, dt) => {
    if (!active) return;
    const k = keys.current;
    const moving = k.w || k.a || k.s || k.d || k.q || k.e;
    const orbiting = k.yawL || k.yawR || k.pitchU || k.pitchD;
    if (!moving && !orbiting) return;

    const sprint = k.shift ? SPRINT : 1;
    const speed = BASE_SPEED * sprint * dt;
    const orbitSpeed = ORBIT_SPEED * sprint * dt;

    // ── Translation (WASD/QE) ─────────────────────────────────
    if (moving) {
      const forward = new Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();
      const right = new Vector3().crossVectors(forward, camera.up).normalize();
      const move = new Vector3();
      if (k.w) move.add(forward);
      if (k.s) move.sub(forward);
      if (k.d) move.add(right);
      if (k.a) move.sub(right);
      if (k.e) move.y += 1;
      if (k.q) move.y -= 1;
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        camera.position.add(move);
        if (controlsRef.current) {
          controlsRef.current.target.add(move);
        }
      }
    }

    // ── Orbit (arrow keys) ────────────────────────────────────
    if (orbiting && controlsRef.current) {
      const target = controlsRef.current.target;
      // Offset = camera - target, in spherical coords
      const offset = camera.position.clone().sub(target);
      const sph = new Spherical().setFromVector3(offset);
      if (k.yawL) sph.theta += orbitSpeed;
      if (k.yawR) sph.theta -= orbitSpeed;
      if (k.pitchU) sph.phi -= orbitSpeed;
      if (k.pitchD) sph.phi += orbitSpeed;
      sph.phi = Math.max(MIN_PITCH, Math.min(MAX_PITCH, sph.phi));
      const newOffset = new Vector3().setFromSpherical(sph);
      camera.position.copy(target).add(newOffset);
    }

    if (controlsRef.current) controlsRef.current.update();
  });

  return null;
}
