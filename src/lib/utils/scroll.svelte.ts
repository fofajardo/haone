import { writable } from "svelte/store";

export interface ScrollHeaderState {
  headerHidden: boolean;
  lastScrollY: number;
}

/**
 * Creates a reusable scroll handler context for hide-on-scroll-down sticky headers.
 */
export function createHeaderScrollState() {
  let headerHidden = $state(false);
  let lastScrollY = 0;

  function handleScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    const current = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;

    // If at the very top, always show header
    if (current <= 0) {
      headerHidden = false;
      lastScrollY = current;
      return;
    }

    // If scrolled near the bottom, lock the header state (don't flip it on rebound)
    if (maxScroll - current < 20) {
      lastScrollY = current;
      return;
    }

    const delta = current - lastScrollY;
    if (Math.abs(delta) > 10) {
      headerHidden = delta > 0;
      lastScrollY = current;
    }
  }

  function reset() {
    headerHidden = false;
    lastScrollY = 0;
  }

  return {
    get headerHidden() {
      return headerHidden;
    },
    set headerHidden(value: boolean) {
      headerHidden = value;
    },
    handleScroll,
    reset
  };
}
