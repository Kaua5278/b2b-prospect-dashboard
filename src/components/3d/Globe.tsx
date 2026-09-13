"use client";

import { cn } from "@/lib/utils";
import { useRef, useEffect, useCallback } from "react";
import { useReducedMotion } from "framer-motion";

interface Marker {
  lat: number;
  lng: number;
  label?: string;
  value?: number;
}

interface GlobeProps {
  className?: string;
  size?: number;
  dotColor?: string;
  arcColor?: string;
  markerColor?: string;
  autoRotateSpeed?: number;
  connections?: { from: [number, number]; to: [number, number] }[];
  markers?: Marker[];
}

const DEFAULT_MARKERS: Marker[] = [
  { lat: -23.55, lng: -46.63, label: "São Paulo" },
  { lat: -22.9, lng: -43.17, label: "Rio de Janeiro" },
  { lat: -19.91, lng: -43.94, label: "Belo Horizonte" },
  { lat: -15.79, lng: -47.88, label: "Brasília" },
  { lat: -12.97, lng: -38.5, label: "Salvador" },
  { lat: -3.73, lng: -38.52, label: "Fortaleza" },
  { lat: -8.05, lng: -34.88, label: "Recife" },
  { lat: -30.03, lng: -51.23, label: "Porto Alegre" },
  { lat: -25.42, lng: -49.27, label: "Curitiba" },
  { lat: -23.95, lng: -47.14, label: "Sorocaba" },
  { lat: -22.32, lng: -49.06, label: "Bauru" },
  { lat: -21.76, lng: -43.35, label: "Juiz de Fora" },
  { lat: -22.38, lng: -47.54, label: "Rio Claro" },
  { lat: -22.13, lng: -51.38, label: "Presidente Prudente" },
  { lat: -21.2, lng: -48.5, label: "Ribeirão Preto" },
  { lat: -22.21, lng: -49.95, label: "Marília" },
  { lat: -20.81, lng: -49.38, label: "São José do Rio Preto" },
  { lat: -23.18, lng: -45.88, label: "São José dos Campos" },
];

const DEFAULT_CONNECTIONS: { from: [number, number]; to: [number, number] }[] = [
  { from: [-23.55, -46.63], to: [-22.9, -43.17] },
  { from: [-23.55, -46.63], to: [-15.79, -47.88] },
  { from: [-23.55, -46.63], to: [-19.91, -43.94] },
  { from: [-23.55, -46.63], to: [-3.73, -38.52] },
  { from: [-23.55, -46.63], to: [-30.03, -51.23] },
  { from: [-23.55, -46.63], to: [-12.97, -38.5] },
  { from: [-15.79, -47.88], to: [-8.05, -34.88] },
  { from: [-3.73, -38.52], to: [-8.05, -34.88] },
  { from: [-19.91, -43.94], to: [-25.42, -49.27] },
  { from: [-12.97, -38.5], to: [-8.05, -34.88] },
];

function latLngToXYZ(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function project(x: number, y: number, z: number, cx: number, cy: number, fov: number): [number, number, number] {
  const scale = fov / (fov + z);
  return [x * scale + cx, y * scale + cy, z];
}

export function Globe({
  className,
  size = 460,
  dotColor = "rgba(103, 232, 249, ALPHA)",
  arcColor = "rgba(34, 211, 238, 0.35)",
  markerColor = "rgba(52, 211, 153, 1)",
  autoRotateSpeed = 0.002,
  connections = DEFAULT_CONNECTIONS,
  markers = DEFAULT_MARKERS,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotYRef = useRef(0.6);
  const rotXRef = useRef(0.5);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startRotY: number; startRotX: number }>({
    active: false, startX: 0, startY: 0, startRotY: 0, startRotX: 0,
  });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const dotsRef = useRef<[number, number, number][]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const dots: [number, number, number][] = [];
    const numDots = 1200;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < numDots; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numDots);
      dots.push([
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
      ]);
    }
    dotsRef.current = dots;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;
    const fov = 600;

    if (!dragRef.current.active && !reduceMotion) {
      rotYRef.current += autoRotateSpeed;
    }

    timeRef.current += 0.015;
    const time = timeRef.current;

    ctx.clearRect(0, 0, w, h);

    // Outer glow (cyan-tinted for the app)
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.5);
    glowGrad.addColorStop(0, "rgba(34, 211, 238, 0.05)");
    glowGrad.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(103, 232, 249, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const ry = rotYRef.current;
    const rx = rotXRef.current;

    const dots = dotsRef.current;
    for (let i = 0; i < dots.length; i++) {
      let [x, y, z] = dots[i];
      x *= radius; y *= radius; z *= radius;
      [x, y, z] = rotateX(x, y, z, rx);
      [x, y, z] = rotateY(x, y, z, ry);
      if (z > 0) continue;
      const [sx, sy] = project(x, y, z, cx, cy, fov);
      const depthAlpha = Math.max(0.08, 1 - (z + radius) / (2 * radius));
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + depthAlpha * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = dotColor.replace("ALPHA", depthAlpha.toFixed(2));
      ctx.fill();
    }

    for (const conn of connections) {
      let [x1, y1, z1] = latLngToXYZ(conn.from[0], conn.from[1], radius);
      let [x2, y2, z2] = latLngToXYZ(conn.to[0], conn.to[1], radius);
      [x1, y1, z1] = rotateX(x1, y1, z1, rx);
      [x1, y1, z1] = rotateY(x1, y1, z1, ry);
      [x2, y2, z2] = rotateX(x2, y2, z2, rx);
      [x2, y2, z2] = rotateY(x2, y2, z2, ry);
      if (z1 > radius * 0.3 && z2 > radius * 0.3) continue;
      const [sx1, sy1] = project(x1, y1, z1, cx, cy, fov);
      const [sx2, sy2] = project(x2, y2, z2, cx, cy, fov);
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const midZ = (z1 + z2) / 2;
      const midLen = Math.sqrt(midX * midX + midY * midY + midZ * midZ) || 1;
      const arcHeight = radius * 1.25;
      const elevX = (midX / midLen) * arcHeight;
      const elevY = (midY / midLen) * arcHeight;
      const elevZ = (midZ / midLen) * arcHeight;
      const [scx, scy] = project(elevX, elevY, elevZ, cx, cy, fov);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(scx, scy, sx2, sy2);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      const t = (Math.sin(time * 1.2 + conn.from[0] * 0.1) + 1) / 2;
      const tx = (1 - t) * (1 - t) * sx1 + 2 * (1 - t) * t * scx + t * t * sx2;
      const ty = (1 - t) * (1 - t) * sy1 + 2 * (1 - t) * t * scy + t * t * sy2;
      ctx.beginPath();
      ctx.arc(tx, ty, 2, 0, Math.PI * 2);
      ctx.fillStyle = markerColor;
      ctx.fill();
    }

    for (const marker of markers) {
      let [x, y, z] = latLngToXYZ(marker.lat, marker.lng, radius);
      [x, y, z] = rotateX(x, y, z, rx);
      [x, y, z] = rotateY(x, y, z, ry);
      if (z > radius * 0.1) continue;
      const [sx, sy] = project(x, y, z, cx, cy, fov);
      const pulse = Math.sin(time * 2 + marker.lat) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = markerColor.replace("1)", `${0.15 + pulse * 0.15})`);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = markerColor;
      ctx.fill();
      if (marker.label) {
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = markerColor.replace("1)", "0.55)");
        ctx.fillText(marker.label, sx + 8, sy + 3);
      }
    }

    if (!reduceMotion) {
      animRef.current = requestAnimationFrame(draw);
    }
  }, [dotColor, arcColor, markerColor, autoRotateSpeed, connections, markers, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      // prefers-reduced-motion: desenha um frame estático (globo visível, sem rotação)
      draw();
      return;
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, reduceMotion]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      active: !!(e.pointerType === 'mouse' ? e.isPrimary : true),
      startX: e.clientX,
      startY: e.clientY,
      startRotY: rotYRef.current,
      startRotX: rotXRef.current,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    rotYRef.current = dragRef.current.startRotY + dx * 0.005;
    rotXRef.current = Math.max(-1, Math.min(1, dragRef.current.startRotX + dy * 0.005));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full cursor-grab active:cursor-grabbing", className)}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}