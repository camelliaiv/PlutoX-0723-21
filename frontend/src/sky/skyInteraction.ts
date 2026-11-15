export interface InteractionCallbacks {
  onInteraction(): void;
  onDragStart(): void;
  onDrag(deltaX: number, deltaY: number): void;
  onDragEnd(): void;
  onPinch(distanceRatio: number): void;
  onTap(x: number, y: number): void;
  onHover(x: number, y: number): void;
  onHoverEnd(): void;
  onZoom(factor: number, x: number, y: number): void;
  onKeyRotate(yawDelta: number, pitchDelta: number): void;
  onKeyZoom(factor: number): void;
  onPointerLook(horizontal: number, vertical: number): void;
}

const TAP_MOVEMENT_PIXELS = 4;
const KEY_ROTATION_RADIANS = 0.08;
const KEY_ZOOM_FACTOR = 1.3;
const WHEEL_LINE_HEIGHT_PIXELS = 33;
const WHEEL_DELTA_LIMIT = 300;
const WHEEL_ZOOM_PER_PIXEL = 0.0016;
const DRAGGING_CLASS = "sky-canvas-dragging";

interface PointerPosition {
  x: number;
  y: number;
}

export function attachSkyInteraction(
  canvas: HTMLCanvasElement,
  callbacks: InteractionCallbacks,
): void {
  const pointers = new Map<number, PointerPosition>();
  let movedPixels = 0;
  let pinchDistance = 0;

  function pointerSeparation(): number {
    const [first, second] = [...pointers.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    movedPixels = 0;
    callbacks.onDragStart();
    canvas.classList.add(DRAGGING_CLASS);
    if (pointers.size === 2) {
      pinchDistance = pointerSeparation();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      callbacks.onHover(event.clientX, event.clientY);
      return;
    }
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointers.size === 2) {
      const separation = pointerSeparation();
      if (pinchDistance > 0 && separation > 0) {
        callbacks.onInteraction();
        callbacks.onPinch(pinchDistance / separation);
      }
      pinchDistance = separation;
      movedPixels += 5;
      return;
    }
    movedPixels += Math.abs(deltaX) + Math.abs(deltaY);
    if (movedPixels > TAP_MOVEMENT_PIXELS) {
      callbacks.onInteraction();
      callbacks.onDrag(deltaX, deltaY);
    }
  });

  function endPointer(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.delete(event.pointerId);
    canvas.classList.remove(DRAGGING_CLASS);
    callbacks.onDragEnd();
    if (event.type === "pointerup" && movedPixels <= TAP_MOVEMENT_PIXELS && pointers.size === 0) {
      callbacks.onTap(event.clientX, event.clientY);
    }
    if (pointers.size < 2) {
      pinchDistance = 0;
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener("pointerleave", () => callbacks.onHoverEnd());

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const pixels = event.deltaMode === 1 ? event.deltaY * WHEEL_LINE_HEIGHT_PIXELS : event.deltaY;
      const limited = Math.min(WHEEL_DELTA_LIMIT, Math.max(-WHEEL_DELTA_LIMIT, pixels));
      callbacks.onInteraction();
      callbacks.onZoom(Math.exp(limited * WHEEL_ZOOM_PER_PIXEL), event.clientX, event.clientY);
    },
    { passive: false },
  );

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
      callbacks.onPointerLook(
        (event.clientX / window.innerWidth - 0.5) * 2,
        (event.clientY / window.innerHeight - 0.5) * 2,
      );
    }
  });
  document.documentElement.addEventListener("mouseleave", () => callbacks.onPointerLook(0, 0));

  canvas.addEventListener("keydown", (event) => {
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        callbacks.onKeyRotate(KEY_ROTATION_RADIANS, 0);
        break;
      case "ArrowRight":
        callbacks.onKeyRotate(-KEY_ROTATION_RADIANS, 0);
        break;
      case "ArrowUp":
        callbacks.onKeyRotate(0, KEY_ROTATION_RADIANS);
        break;
      case "ArrowDown":
        callbacks.onKeyRotate(0, -KEY_ROTATION_RADIANS);
        break;
      case "+":
      case "=":
        callbacks.onKeyZoom(1 / KEY_ZOOM_FACTOR);
        break;
      case "-":
        callbacks.onKeyZoom(KEY_ZOOM_FACTOR);
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      callbacks.onInteraction();
    }
  });
}
