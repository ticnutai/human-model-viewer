/**
 * PerformanceMonitor — FPS counter and Three.js renderer stats overlay.
 * Uses drei's <Stats> when available, or a simple custom FPS counter.
 * Place inside <Canvas>.
 */
import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";

interface PerfMonitorProps {
  enabled: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export default function PerformanceMonitor({
  enabled,
  position = "top-left",
}: PerfMonitorProps) {
  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState(0);
  const [triangles, setTriangles] = useState(0);
  const [textures, setTextures] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const { gl } = useThree();

  useFrame(() => {
    if (!enabled) return;
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;
    if (delta >= 500) {
      setFps(Math.round((frameCount.current / delta) * 1000));
      frameCount.current = 0;
      lastTime.current = now;

      const info = gl.info;
      setDrawCalls(info.render?.calls ?? 0);
      setTriangles(info.render?.triangles ?? 0);
      setTextures(info.memory?.textures ?? 0);
    }
  });

  if (!enabled) return null;

  const positionStyle: React.CSSProperties = {
    "top-left": { top: 52, left: 8 },
    "top-right": { top: 52, right: 8 },
    "bottom-left": { bottom: 70, left: 8 },
    "bottom-right": { bottom: 70, right: 8 },
  }[position] as React.CSSProperties;

  const fpsColor = fps >= 55 ? "#22c55e" : fps >= 30 ? "#eab308" : "#ef4444";

  return (
    <Html
      fullscreen
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          position: "fixed",
          ...positionStyle,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontFamily: "'Courier New', monospace",
          fontSize: "11px",
          color: "#ccc",
          zIndex: 100,
          lineHeight: 1.6,
          border: "1px solid rgba(255,255,255,0.1)",
          pointerEvents: "none",
          minWidth: "130px",
        }}
      >
        <div style={{ color: fpsColor, fontWeight: 700, fontSize: "13px" }}>
          {fps} FPS
        </div>
        <div>Draw calls: {drawCalls}</div>
        <div>Triangles: {(triangles / 1000).toFixed(1)}K</div>
        <div>Textures: {textures}</div>
      </div>
    </Html>
  );
}
