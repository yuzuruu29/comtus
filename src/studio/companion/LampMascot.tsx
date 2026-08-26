import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampLampPos,
  LAMP_DRAG_PX,
  loadLampPos,
  saveLampPos,
  viewportSize,
  type LampPos,
} from "./lampPos";

export type LampMood = "idle" | "cheer" | "sleepy" | "celebrate" | "poke";

const SPEECH: Record<LampMood, string[]> = {
  idle: ["The light holds.", "One more page.", "Back to the margin."],
  cheer: ["Well kept.", "The page is warmer.", "Still with you."],
  sleepy: ["The lamp is still lit.", "Your notes are waiting.", "A quiet desk, still."],
  celebrate: ["A mark on the shelf.", "The work shows.", "Kept, and polished."],
  poke: ["Here.", "Still burning.", "Ask when you are ready."],
};

function pickLine(mood: LampMood, tick: number): string {
  const lines = SPEECH[mood];
  return lines[tick % lines.length];
}

function boxFrom(el: HTMLElement): { w: number; h: number } {
  const r = el.getBoundingClientRect();
  return {
    w: Math.max(48, r.width || 96),
    h: Math.max(48, r.height || 112),
  };
}

export default function LampMascot({
  mood,
  speech,
  onPoke,
  lineTick = 0,
}: {
  mood: LampMood;
  speech: string | null;
  onPoke: () => void;
  lineTick?: number;
}) {
  const labelId = useId();
  const caption =
    speech ??
    (mood === "sleepy" || mood === "poke" || mood === "cheer"
      ? pickLine(mood, lineTick)
      : null);
  const [blink, setBlink] = useState(false);
  const [placed, setPlaced] = useState<LampPos | null>(() => loadLampPos());
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    grabX: number;
    grabY: number;
    originX: number;
    originY: number;
    moved: boolean;
    last: LampPos | null;
  } | null>(null);

  const applyClamp = useCallback((pos: LampPos): LampPos => {
    const el = rootRef.current;
    const box = el ? boxFrom(el) : { w: 96, h: 112 };
    return clampLampPos(pos.left, pos.top, box, viewportSize());
  }, []);

  useEffect(() => {
    if (mood === "sleepy") {
      setBlink(true);
      return;
    }
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 4200);
    return () => window.clearInterval(id);
  }, [mood]);

  useEffect(() => {
    if (!placed) return;
    const onResize = () => setPlaced((cur) => (cur ? applyClamp(cur) : cur));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [placed, applyClamp]);

  const suppressClick = useRef(false);

  const resetCorner = useCallback(() => {
    saveLampPos(null);
    setPlaced(null);
    setDragging(false);
    drag.current = null;
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      last: null,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const sess = drag.current;
    if (!sess || sess.pointerId !== e.pointerId) return;
    const el = rootRef.current;
    if (!el) return;
    const dist = Math.hypot(e.clientX - sess.originX, e.clientY - sess.originY);
    if (!sess.moved && dist < LAMP_DRAG_PX) return;
    sess.moved = true;
    const next = applyClamp({
      left: e.clientX - sess.grabX,
      top: e.clientY - sess.grabY,
    });
    sess.last = next;
    setDragging(true);
    setPlaced(next);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const sess = drag.current;
    if (!sess || sess.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
    if (sess.moved) {
      const saved = sess.last ?? applyClamp({ left: e.clientX - sess.grabX, top: e.clientY - sess.grabY });
      saveLampPos(saved);
      setPlaced(saved);
      suppressClick.current = true;
      return;
    }
    if (e.detail >= 2) {
      resetCorner();
      suppressClick.current = true;
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={rootRef}
      className="lamp-mascot"
      data-mood={mood}
      data-placed={placed ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={
        placed
          ? { left: placed.left, top: placed.top, right: "auto", bottom: "auto" }
          : undefined
      }
    >
      {caption && (
        <p id={labelId} className="lamp-speech" role="status">
          {caption}
        </p>
      )}
      <div className="lamp-stage">
        <button
          type="button"
          className="lamp-btn"
          aria-label="Study lamp"
          aria-describedby={caption ? labelId : undefined}
          aria-grabbed={dragging}
          title="Drag to move. Double-click to return to the corner."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDoubleClick={resetCorner}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onPoke();
          }}
        >
          <span className="lamp-glow" aria-hidden />
          <span className="lamp-sparks" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <LampSprite sleepy={mood === "sleepy" || blink} />
        </button>
      </div>
    </div>
  );
}

function LampSprite({ sleepy }: { sleepy: boolean }) {
  return (
    <svg className="lamp-svg" viewBox="0 0 36 42" width={96} height={112} aria-hidden="true">
      <g className="lamp-flame">
        <rect x="16" y="2" width="4" height="5" fill="#E64A19" />
        <rect x="15" y="4" width="6" height="5" fill="#FF8F00" />
        <rect x="16" y="5" width="4" height="4" fill="#FFC107" />
        <rect x="17" y="6" width="2" height="3" fill="#FFF59D" />
        <rect x="17" y="7" width="2" height="1" fill="#FFFFFF" />
      </g>
      {/* Shade */}
      <rect x="10" y="11" width="16" height="3" fill="#C99236" />
      <rect x="8" y="14" width="20" height="8" fill="#E3B04B" />
      <rect x="9" y="15" width="18" height="6" fill="#F0CE8C" />
      <rect x="10" y="16" width="16" height="4" fill="#E3B04B" />
      <rect x="11" y="16" width="3" height="2" fill="#F8E3B0" />
      {/* Eyes on the shade */}
      {sleepy ? (
        <>
          <rect x="13" y="18" width="4" height="1" fill="#1B2334" />
          <rect x="19" y="18" width="4" height="1" fill="#1B2334" />
        </>
      ) : (
        <>
          <rect x="14" y="17" width="2" height="3" fill="#1B2334" />
          <rect x="20" y="17" width="2" height="3" fill="#1B2334" />
          <rect x="14" y="17" width="1" height="1" fill="#F2EDE3" />
          <rect x="20" y="17" width="1" height="1" fill="#F2EDE3" />
        </>
      )}
      {/* Stem */}
      <rect x="17" y="22" width="2" height="10" fill="#C99236" />
      <rect x="16" y="31" width="4" height="2" fill="#A5731C" />
      {/* Base */}
      <rect x="12" y="33" width="12" height="3" fill="#E3B04B" />
      <rect x="10" y="36" width="16" height="3" fill="#C99236" />
      <rect x="11" y="37" width="14" height="1" fill="#F0CE8C" />
    </svg>
  );
}
