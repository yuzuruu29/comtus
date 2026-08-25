import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export type PaneSide = "left" | "right";

type PaneResizeOptions = {
  side: PaneSide;
  storageKey: string;
  cssVariable: `--${string}`;
  controlsId: string;
  label: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  collapseThreshold: number;
  onCollapse: () => void;
  keyboardStep?: number;
};

type SeparatorProps = {
  role: "separator";
  tabIndex: 0;
  "aria-label": string;
  "aria-controls": string;
  "aria-orientation": "vertical";
  "aria-valuemin": number;
  "aria-valuemax": number;
  "aria-valuenow": number;
  "aria-valuetext": string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
};

type DragSession = {
  startX: number;
  startWidth: number;
  pointerId: number;
  handle: HTMLElement;
  pane: HTMLElement;
  previousCursor: string;
  previousUserSelect: string;
  pendingClientX: number;
  frameId: number | null;
};

export function clampPaneWidth(value: number, minWidth: number, maxWidth: number): number {
  if (!Number.isFinite(value)) return minWidth;
  return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
}

export function loadPaneWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): number {
  if (typeof localStorage === "undefined") return defaultWidth;
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return localStorage.getItem(storageKey) !== null && Number.isFinite(stored)
      ? clampPaneWidth(stored, minWidth, maxWidth)
      : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

function widthFromPointer(side: PaneSide, startWidth: number, startX: number, clientX: number) {
  const pointerDelta = clientX - startX;
  return startWidth + (side === "left" ? pointerDelta : -pointerDelta);
}

function setSeparatorValue(handle: HTMLElement, width: number) {
  const rounded = Math.round(width);
  handle.setAttribute("aria-valuenow", String(rounded));
  handle.setAttribute("aria-valuetext", `${rounded} pixels wide`);
}

export function usePaneResize({
  side,
  storageKey,
  cssVariable,
  controlsId,
  label,
  minWidth,
  maxWidth,
  defaultWidth,
  collapseThreshold,
  onCollapse,
  keyboardStep = 12,
}: PaneResizeOptions): {
  width: number;
  isDragging: boolean;
  paneRef: RefObject<HTMLElement | null>;
  separatorProps: SeparatorProps;
} {
  const [width, setWidth] = useState(() =>
    loadPaneWidth(storageKey, defaultWidth, minWidth, maxWidth),
  );
  const [isDragging, setIsDragging] = useState(false);
  const paneRef = useRef<HTMLElement | null>(null);
  const widthRef = useRef(width);
  const dragRef = useRef<DragSession | null>(null);
  const cancelDragRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelDragRef.current?.();
    };
  }, []);

  const persistWidth = useCallback(
    (nextWidth: number) => {
      try {
        localStorage.setItem(storageKey, String(nextWidth));
      } catch {
        // Width persistence is a convenience; resizing still works without storage.
      }
    },
    [storageKey],
  );

  const commitWidth = useCallback(
    (requestedWidth: number, handle?: HTMLElement) => {
      const nextWidth = clampPaneWidth(requestedWidth, minWidth, maxWidth);
      widthRef.current = nextWidth;
      paneRef.current?.style.setProperty(cssVariable, `${nextWidth}px`);
      if (handle) setSeparatorValue(handle, nextWidth);
      setWidth(nextWidth);
      persistWidth(nextWidth);
    },
    [cssVariable, maxWidth, minWidth, persistWidth],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const pane = paneRef.current;
      if (!pane) return;

      event.preventDefault();
      cancelDragRef.current?.();

      const handle = event.currentTarget;
      const session: DragSession = {
        startX: event.clientX,
        startWidth: widthRef.current,
        pointerId: event.pointerId,
        handle,
        pane,
        previousCursor: document.body.style.cursor,
        previousUserSelect: document.body.style.userSelect,
        pendingClientX: event.clientX,
        frameId: null,
      };
      dragRef.current = session;

      const renderWidth = (clientX: number) => {
        if (dragRef.current !== session) return;
        const rawWidth = widthFromPointer(side, session.startWidth, session.startX, clientX);
        const nextWidth = clampPaneWidth(rawWidth, minWidth, maxWidth);
        session.pane.style.setProperty(cssVariable, `${nextWidth}px`);
        setSeparatorValue(session.handle, nextWidth);
        session.handle.dataset.collapseReady = rawWidth < collapseThreshold ? "true" : "false";
      };

      const flushPendingFrame = () => {
        if (session.frameId !== null) {
          cancelAnimationFrame(session.frameId);
          session.frameId = null;
        }
        renderWidth(session.pendingClientX);
      };

      const cleanup = () => {
        if (dragRef.current !== session) return;
        if (session.frameId !== null) cancelAnimationFrame(session.frameId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("blur", onWindowBlur);
        document.body.style.cursor = session.previousCursor;
        document.body.style.userSelect = session.previousUserSelect;
        delete session.handle.dataset.collapseReady;
        delete session.handle.dataset.resizing;
        delete session.pane.dataset.resizing;
        dragRef.current = null;
        cancelDragRef.current = null;
        if (mountedRef.current) setIsDragging(false);
      };

      const cancel = () => {
        cleanup();
        session.pane.style.setProperty(cssVariable, `${session.startWidth}px`);
        setSeparatorValue(session.handle, session.startWidth);
      };

      function onPointerMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== session.pointerId) return;
        session.pendingClientX = moveEvent.clientX;
        if (session.frameId !== null) return;
        session.frameId = requestAnimationFrame(() => {
          session.frameId = null;
          renderWidth(session.pendingClientX);
        });
      }

      function onPointerUp(upEvent: PointerEvent) {
        if (upEvent.pointerId !== session.pointerId) return;
        session.pendingClientX = upEvent.clientX;
        flushPendingFrame();
        const rawWidth = widthFromPointer(side, session.startWidth, session.startX, upEvent.clientX);
        const shouldCollapse = rawWidth < collapseThreshold;
        cleanup();
        if (shouldCollapse) {
          onCollapse();
        } else {
          commitWidth(rawWidth, session.handle);
        }
      }

      function onPointerCancel(cancelEvent: PointerEvent) {
        if (cancelEvent.pointerId === session.pointerId) cancel();
      }

      function onWindowBlur() {
        cancel();
      }

      cancelDragRef.current = cancel;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.dataset.resizing = "true";
      pane.dataset.resizing = "true";
      setIsDragging(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("blur", onWindowBlur);
    },
    [collapseThreshold, commitWidth, cssVariable, maxWidth, minWidth, onCollapse, side],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      let nextWidth: number | null = null;
      const physicalDirection = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

      if (physicalDirection !== 0) {
        const paneDirection = side === "left" ? physicalDirection : -physicalDirection;
        nextWidth = widthRef.current + paneDirection * (event.shiftKey ? keyboardStep * 3 : keyboardStep);
      } else if (event.key === "Home") {
        nextWidth = minWidth;
      } else if (event.key === "End") {
        nextWidth = maxWidth;
      }

      if (nextWidth === null) return;
      event.preventDefault();
      commitWidth(nextWidth, event.currentTarget);
    },
    [commitWidth, keyboardStep, maxWidth, minWidth, side],
  );

  const resetWidth = useCallback(() => {
    commitWidth(defaultWidth);
  }, [commitWidth, defaultWidth]);

  const separatorProps = useMemo<SeparatorProps>(
    () => ({
      role: "separator",
      tabIndex: 0,
      "aria-label": label,
      "aria-controls": controlsId,
      "aria-orientation": "vertical",
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      "aria-valuenow": width,
      "aria-valuetext": `${width} pixels wide`,
      onPointerDown: startResize,
      onKeyDown: handleKeyDown,
      onDoubleClick: resetWidth,
    }),
    [controlsId, handleKeyDown, label, maxWidth, minWidth, resetWidth, startResize, width],
  );

  return { width, isDragging, paneRef, separatorProps };
}
