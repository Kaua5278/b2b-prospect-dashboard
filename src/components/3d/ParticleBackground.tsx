'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function checkWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const PARTICLE_COUNT = 800;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  color: THREE.Color;
  opacity: number;
}

const ParticleSystem = () => {
  const pointsRef = useRef<any>(null);
  const particlesRef = useRef<Particle[]>([]);
  const { size, viewport } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];
    const colors = [
      new THREE.Color(0x06b6d4), // cyan-500
      new THREE.Color(0x10b981), // emerald-500
      new THREE.Color(0x22d3ee), // cyan-400
      new THREE.Color(0x34d399), // emerald-400
      new THREE.Color(0x67e8f9), // cyan-300
      new THREE.Color(0x6ee7b7), // emerald-300
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 3;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      particles.push({
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.002,
          (Math.random() - 0.5) * 0.002,
          (Math.random() - 0.5) * 0.002
        ),
        size: 0.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.3 + Math.random() * 0.7,
      });
    }
    particlesRef.current = particles;
  }, []);

  // Animation loop
  useFrame((_, delta) => {
    timeRef.current += delta;
    const particles = particlesRef.current;
    const points = pointsRef.current;

    if (!points?.geometry?.attributes?.position?.array) return;

    const positions = points.geometry.attributes.position.array as Float32Array;
    const sizes = points.geometry.attributes.size?.array as Float32Array;
    const colors = points.geometry.attributes.color?.array as Float32Array;
    const alphas = points.geometry.attributes.alpha?.array as Float32Array;

    if (!positions || !sizes || !colors || !alphas) return;

    const mouseInfluence = 0.5;
    const centerPull = 0.0005;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Mouse interaction
      const dx = mouseRef.current.x - p.position.x;
      const dy = mouseRef.current.y - p.position.y;
      const dz = 0 - p.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq) + 0.001;

      if (dist < 3) {
        const force = mouseInfluence / distSq;
        p.velocity.x += dx * force * delta;
        p.velocity.y += dy * force * delta;
        p.velocity.z += dz * force * delta;
      }

      // Gentle pull to center
      p.velocity.x -= p.position.x * centerPull * delta;
      p.velocity.y -= p.position.y * centerPull * delta;
      p.velocity.z -= p.position.z * centerPull * delta;

      // Damping
      p.velocity.multiplyScalar(0.99);

      // Update position
      p.position.add(p.velocity);

      // Boundary check - wrap around
      const bounds = 6;
      if (Math.abs(p.position.x) > bounds) p.position.x = -Math.sign(p.position.x) * bounds;
      if (Math.abs(p.position.y) > bounds) p.position.y = -Math.sign(p.position.y) * bounds;
      if (Math.abs(p.position.z) > bounds) p.position.z = -Math.sign(p.position.z) * bounds;

      // Subtle floating motion
      p.position.y += Math.sin(timeRef.current * 0.5 + i * 0.1) * 0.001;
      p.position.x += Math.cos(timeRef.current * 0.3 + i * 0.15) * 0.001;

      // Update buffer attributes
      const i3 = i * 3;
      positions[i3] = p.position.x;
      positions[i3 + 1] = p.position.y;
      positions[i3 + 2] = p.position.z;

      sizes[i] = p.size * (0.8 + Math.sin(timeRef.current * 2 + i) * 0.2);
      colors[i3] = p.color.r;
      colors[i3 + 1] = p.color.g;
      colors[i3 + 2] = p.color.b;
      alphas[i] = p.opacity * (0.7 + Math.sin(timeRef.current * 1.5 + i) * 0.3);
    }

    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.size.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
    points.geometry.attributes.alpha.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);

    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    return g;
  }, []);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 1,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  return (
    <Points ref={pointsRef} geometry={geometry} material={material}>
      <Html
        center
        position={[0, 0, 0]}
        occlude={false}
        style={{ pointerEvents: 'none' }}
      >
        <div className="pointer-events-none" />
      </Html>
    </Points>
  );
};

const MouseTracker = () => {
  const { camera, size, gl } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const canvas = gl.domElement;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      // Convert to world coordinates
      const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));

      // Update the particle system's mouse reference
      if (window.particleMouseRef) {
        window.particleMouseRef.current = { x: pos.x, y: pos.y };
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [camera, size, gl]);

  return null;
};

// Store mouse ref globally for access from ParticleSystem
declare global {
  interface Window {
    particleMouseRef: { current: { x: number; y: number } } | undefined;
  }
}

if (typeof window !== 'undefined') {
  window.particleMouseRef = { current: { x: 0, y: 0 } };
}

const ParticleBackgroundInner = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      shadows={false}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#0f172a']} /> {/* slate-950 */}
      <fog attach="fog" args={['#0f172a', 2, 10]} />
      <ParticleSystem />
      <MouseTracker />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.2}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </Canvas>
  );
};

export function ParticleBackground() {
  const [hasWebGL, setHasWebGL] = useState(false);

  useEffect(() => {
    setHasWebGL(checkWebGL());
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {hasWebGL && <ParticleBackgroundInner />}
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-slate-950/90" />
    </div>
  );
}