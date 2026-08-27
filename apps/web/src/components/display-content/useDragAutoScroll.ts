'use client';

import { useEffect, useRef, type RefObject } from 'react';

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/** Scrolls the nearest overflow ancestor when a drag is held near (or past) its edges. */
export function useDragAutoScroll(
  active: boolean,
  originRef: RefObject<HTMLElement | null>,
) {
  const pointerYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      pointerYRef.current = null;
      return;
    }

    const scrollParent = getScrollParent(originRef.current);
    if (!scrollParent) {
      return;
    }

    const edgePx = 96;
    const maxSpeed = 28;

    function onDragOver(event: DragEvent) {
      event.preventDefault();
      pointerYRef.current = event.clientY;
    }

    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      const y = pointerYRef.current;
      if (y == null || !scrollParent) {
        return;
      }

      const rect = scrollParent.getBoundingClientRect();
      let delta = 0;
      if (y < rect.top + edgePx) {
        const intensity = (rect.top + edgePx - y) / edgePx;
        delta = -maxSpeed * Math.min(2.5, Math.max(0, intensity));
      } else if (y > rect.bottom - edgePx) {
        const intensity = (y - (rect.bottom - edgePx)) / edgePx;
        delta = maxSpeed * Math.min(2.5, Math.max(0, intensity));
      }

      if (delta !== 0) {
        scrollParent.scrollTop += delta;
      }
    }

    document.addEventListener('dragover', onDragOver);
    frame = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      cancelAnimationFrame(frame);
      pointerYRef.current = null;
    };
  }, [active, originRef]);
}
