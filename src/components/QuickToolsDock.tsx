import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Position = { x: number; y: number };

const STORAGE_KEY = "quick-tools-dock-position";

/** Floating, draggable dock: the handle can be moved anywhere on screen and the spot is remembered. */
export default function QuickToolsDock({
  isMobile,
  handle,
  children,
}: {
  isMobile: boolean;
  /** Receives whether a drag just happened, so a click after dragging can be ignored. */
  handle: (args: { dragging: boolean; wasDragged: () => boolean }) => ReactNode;
  children?: ReactNode;
}) {
  const size = isMobile ? 44 : 50;
  const [pos, setPos] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedRef = useRef(false);
  const offsetRef = useRef<Position>({ x: 0, y: 0 });

  const clamp = useCallback((p: Position): Position => ({
    x: Math.min(Math.max(p.x, 8), Math.max(8, window.innerWidth - size - 8)),
    y: Math.min(Math.max(p.y, 8), Math.max(8, window.innerHeight - size - 8)),
  }), [size]);

  // Initial position: saved spot, otherwise the classic bottom-right anchor.
  useEffect(() => {
    let start: Position | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Position;
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) start = parsed;
      }
    } catch { /* ignore corrupted value */ }
    if (!start) {
      start = {
        x: window.innerWidth - (isMobile ? 12 : 72) - size,
        y: window.innerHeight - (isMobile ? 70 : 88) - size,
      };
    }
    setPos(clamp(start));
  }, [clamp, isMobile, size]);

  // Keep the dock on screen after resizes / orientation changes.
  useEffect(() => {
    const onResize = () => setPos(p => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      draggedRef.current = true;
      setPos(clamp({ x: event.clientX - offsetRef.current.x, y: event.clientY - offsetRef.current.y }));
    };
    const up = () => {
      setDragging(false);
      setPos(p => {
        if (p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [clamp, dragging]);

  if (!pos) return null;

  const openLeft = pos.x > window.innerWidth / 2;
  const openUp = pos.y > window.innerHeight / 2;

  return (
    <div
      className="fixed z-[16]"
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      <div
        onPointerDown={event => {
          if (event.button !== 0 && event.pointerType === "mouse") return;
          draggedRef.current = false;
          offsetRef.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
          setDragging(true);
        }}
        style={{ cursor: dragging ? "grabbing" : "grab", width: size, height: size }}
      >
        {handle({ dragging, wasDragged: () => draggedRef.current })}
      </div>

      {children && (
        <div
          className="absolute"
          style={{
            [openLeft ? "right" : "left"]: 0,
            [openUp ? "bottom" : "top"]: size + 10,
            direction: "rtl",
            width: box?.w,
            height: box?.h,
          } as React.CSSProperties}
        >
          <div className="relative h-full w-full overflow-auto">{children}</div>
          {HANDLES.map(dir => (
            <div
              key={dir}
              role="separator"
              aria-label={`שינוי גודל ${dir}`}
              onPointerDown={event => startResize(event, dir)}
              className="absolute z-[2] rounded-full bg-transparent hover:bg-primary/25"
              style={handleStyle(dir)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
