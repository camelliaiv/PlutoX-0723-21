import { requireElement } from "./dom";

const OPEN_CLASS = "sheet-open";
const SWIPE_CLOSE_PIXELS = 90;

interface SheetPair {
  sheet: HTMLElement;
  opener: HTMLButtonElement;
}

export interface SheetsOptions {
  onGuideOpen(): void;
}

export interface Sheets {
  closeAll(): void;
}

export function createSheets(options: SheetsOptions): Sheets {
  const backdrop = requireElement<HTMLElement>("#sheet-backdrop");
  const pairs: SheetPair[] = [
    {
      sheet: requireElement<HTMLElement>("#sheet-guide"),
      opener: requireElement<HTMLButtonElement>("#guide-button"),
    },
    {
      sheet: requireElement<HTMLElement>("#sheet-challenge"),
      opener: requireElement<HTMLButtonElement>("#challenge-button"),
    },
  ];
  let historyEntryPushed = false;

  function setOpen(pair: SheetPair, open: boolean): void {
    pair.sheet.classList.toggle(OPEN_CLASS, open);
    pair.opener.setAttribute("aria-expanded", String(open));
  }

  function anyOpen(): boolean {
    return pairs.some((pair) => pair.sheet.classList.contains(OPEN_CLASS));
  }

  function closeVisually(): void {
    for (const pair of pairs) {
      pair.sheet.style.transform = "";
      setOpen(pair, false);
    }
    backdrop.hidden = true;
  }

  function closeAll(): void {
    closeVisually();
    if (historyEntryPushed) {
      historyEntryPushed = false;
      history.back();
    }
  }

  function enableSwipeToClose(pair: SheetPair): void {
    let startY: number | null = null;
    let offset = 0;
    pair.sheet.addEventListener(
      "touchstart",
      (event) => {
        startY = pair.sheet.scrollTop <= 0 ? event.touches[0].clientY : null;
        offset = 0;
      },
      { passive: true },
    );
    pair.sheet.addEventListener(
      "touchmove",
      (event) => {
        if (startY === null) {
          return;
        }
        offset = Math.max(0, event.touches[0].clientY - startY);
        pair.sheet.style.transition = "none";
        pair.sheet.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
      },
      { passive: true },
    );
    pair.sheet.addEventListener("touchend", () => {
      pair.sheet.style.transition = "";
      const shouldClose = startY !== null && offset > SWIPE_CLOSE_PIXELS;
      startY = null;
      if (shouldClose) {
        const opener = pair.opener;
        closeAll();
        opener.focus();
      } else {
        pair.sheet.style.transform = "";
      }
    });
  }

  for (const pair of pairs) {
    pair.opener.addEventListener("click", () => {
      const willOpen = !pair.sheet.classList.contains(OPEN_CLASS);
      if (!willOpen) {
        closeAll();
        return;
      }
      for (const other of pairs) {
        setOpen(other, other === pair);
      }
      backdrop.hidden = false;
      if (!historyEntryPushed) {
        history.pushState({ sheet: pair.sheet.id }, "");
        historyEntryPushed = true;
      }
      if (pair.sheet.id === "sheet-guide") {
        options.onGuideOpen();
      }
      pair.sheet.querySelector<HTMLButtonElement>("button")?.focus();
    });
    for (const closeButton of pair.sheet.querySelectorAll("[data-close-sheet]")) {
      closeButton.addEventListener("click", () => {
        closeAll();
        pair.opener.focus();
      });
    }
    enableSwipeToClose(pair);
  }

  backdrop.addEventListener("click", closeAll);
  window.addEventListener("popstate", () => {
    if (anyOpen()) {
      historyEntryPushed = false;
      closeVisually();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && anyOpen()) {
      closeAll();
    }
  });

  return { closeAll };
}
