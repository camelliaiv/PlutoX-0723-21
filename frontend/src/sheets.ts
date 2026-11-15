import { requireElement } from "./dom";

const OPEN_CLASS = "sheet-open";

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

  function setOpen(pair: SheetPair, open: boolean): void {
    pair.sheet.classList.toggle(OPEN_CLASS, open);
    pair.opener.setAttribute("aria-expanded", String(open));
  }

  for (const pair of pairs) {
    pair.opener.addEventListener("click", () => {
      const willOpen = !pair.sheet.classList.contains(OPEN_CLASS);
      for (const other of pairs) {
        setOpen(other, other === pair && willOpen);
      }
      if (willOpen && pair.sheet.id === "sheet-guide") {
        options.onGuideOpen();
      }
      if (willOpen) {
        pair.sheet.querySelector<HTMLButtonElement>("button")?.focus();
      }
    });
    pair.sheet.querySelector("button")?.addEventListener("click", () => {
      setOpen(pair, false);
      pair.opener.focus();
    });
  }

  return {
    closeAll(): void {
      for (const pair of pairs) {
        setOpen(pair, false);
      }
    },
  };
}
