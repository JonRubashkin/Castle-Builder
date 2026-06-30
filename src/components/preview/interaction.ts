// Distinguishing a clean click from an orbit drag.
//
// OrbitControls rotates on drag; we must not place or select when the user was
// orbiting. We record the pointer-down screen position and treat the following
// pointer-up as a "clean click" only if the pointer barely moved.

const DRAG_THRESHOLD_PX = 5;

const dragState = { downX: 0, downY: 0 };

export function recordPointerDown(clientX: number, clientY: number): void {
  dragState.downX = clientX;
  dragState.downY = clientY;
}

export function isCleanClick(clientX: number, clientY: number): boolean {
  const dx = clientX - dragState.downX;
  const dy = clientY - dragState.downY;
  return Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX;
}
