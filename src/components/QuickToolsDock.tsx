import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Position = { x: number; y: number };
type Box = { w: number; h: number };
type HandleDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const STORAGE_KEY = "quick-tools-dock-position";
const SIZE_KEY = "quick-tools-dock-size";
const HANDLES: HandleDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const THICK = 10;

/** Resize handle geometry + cursor for each edge/corner. */
function handleStyle(dir: HandleDir): React.CSSProperties {
  const corner = dir.length === 2;
  const cursor = corner ? (dir === "ne" || dir === "sw" ? "nesw-resize" : "nwse-resize") : dir === "n" || dir === "s" ? "ns-resize" : "ew-resize";
  const style: React.CSSProperties = { cursor, touchAction: "none" };
  if (corner) {
    style.width = THICK + 6;
    style.height = THICK + 6;
    style[dir.includes("n") ? "top" : "bottom"] = -3;
    style[dir.includes("e") ? "right" : "left"] = -3;
    return style;
  }
  if (dir === "n" || dir === "s") {
    style.left = THICK;
    style.right = THICK;
    style.height = THICK;
    style[dir === "n" ? "top" : "bottom"] = -4;
  } else {
    style.top = THICK;
    style.bottom = THICK;
    style.width = THICK;
    style[dir === "e" ? "right" : "left"] = -4;
  }
  return style;
}


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
  const [box, setBox] = useState<Box | null>(() => {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Box;
        if (Number.isFinite(parsed?.w) && Number.isFinite(parsed?.h)) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  });
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

  const startResize = (event: React.PointerEvent, dir: HandleDir) => {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    const target = (event.currentTarget as HTMLElement).parentElement as HTMLElement;
    const base = { w: box?.w ?? target.offsetWidth, h: box?.h ?? target.offsetHeight };
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      let w = base.w;
      let h = base.h;
      if (dir.includes("e")) w = base.w + dx;
      if (dir.includes("w")) w = base.w - dx;
      if (dir.includes("s")) h = base.h + dy;
      if (dir.includes("n")) h = base.h - dy;
      setBox({
        w: Math.min(Math.max(w, 220), window.innerWidth - 24),
        h: Math.min(Math.max(h, 140), window.innerHeight - 24),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBox(current => {
        if (current) { try { localStorage.setItem(SIZE_KEY, JSON.stringify(current)); } catch { /* ignore */ } }
        return current;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };


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
          <div className="relative h-full w-full overflow-auto [&>*]:h-full [&>*]:w-full [&>*]:max-w-none">{children}</div>
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
