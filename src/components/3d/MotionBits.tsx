"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * HyperText — texto que troca as letras rapidamente (efeito cyber/hack).
 * Baseado no conceito do componente "Hyper Text" (dillionverma/21st).
 */
export function HyperText({
  text,
  duration = 0.01,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(text.split(""));

  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()[]{}";

  const randomise = useCallback(() => {
    setDisplayText((prev) => {
      const chars = remainingRef.current;
      if (!chars.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return text;
      }
      const next = chars.map((c, idx) => c === " " ? " " : prev[idx] === c ? c : characters[Math.floor(Math.random() * characters.length)]);
      return next.join("");
    });
    // resolve mais letras progressivamente
    const remaining = remainingRef.current;
    for (let i = 0; i < Math.ceil(remaining.length / 8) + 1; i++) {
      const idx = Math.floor(Math.random() * remaining.length);
      remaining[idx] = text[idx];
    }
    remainingRef.current = remaining;
  }, [text, characters]);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayText(text);
      return;
    }
    remainingRef.current = text.split("");
    setDisplayText(text.split("").map(() => characters[Math.floor(Math.random() * characters.length)]).join(""));
    intervalRef.current = setInterval(randomise, duration);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, duration, randomise, reduceMotion, characters]);

  return <span className={className}>{displayText}</span>;
}

/**
 * Shimmer — brilho que atravessa texto/elemento periodicamente.
 */
export function Shimmer({
  className,
  children,
  delay = 0,
}: {
  className?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent"
        style={{ animationDelay: `${delay}s` }}
      />
    </span>
  );
}

/**
 * AnimatedNumber — contador animado de 0 a value com easing.
 */
export function AnimatedNumber({
  value,
  duration = 1.2,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const from = prevRef.current;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4); // easeOutQuart
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduceMotion]);

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}

/**
 * TiltCard — cartão com efeito 3D tilt no hover (perspectiva).
 */
export function TiltCard({
  children,
  className,
  maxTilt = 8,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-y * maxTilt).toFixed(2)}deg) rotateY(${(x * maxTilt).toFixed(2)}deg) translateZ(0)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("transition-transform duration-200 will-change-transform", className)}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}