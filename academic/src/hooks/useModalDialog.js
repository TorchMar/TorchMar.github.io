import { useEffect } from "react";

let scrollLocks = 0;
let previousStyles;
let scrollPosition;

// Share lifecycle behavior, not the visual design of different preview windows.
export function useModalDialog(dialogRef) {
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (scrollLocks++ === 0) {
      const body = document.body.style;
      scrollPosition = { x: window.scrollX, y: window.scrollY };
      previousStyles = Object.fromEntries(["overflow", "position", "top", "left", "width", "paddingRight"].map(key => [key, body[key]]));
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbar > 0) body.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
      Object.assign(body, { overflow: "hidden", position: "fixed", top: `-${scrollPosition.y}px`, left: `-${scrollPosition.x}px`, width: "100%" });
    }
    dialog.setAttribute("tabindex", "-1");
    if (!dialog.open) dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (--scrollLocks === 0) {
        Object.assign(document.body.style, previousStyles);
        window.scrollTo({ left: scrollPosition.x, top: scrollPosition.y, behavior: "instant" });
      }
      requestAnimationFrame(() => {
        // StrictMode may already have opened the dialog again.
        if (!dialog.open && !scrollLocks && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      });
    };
  }, [dialogRef]);
}
