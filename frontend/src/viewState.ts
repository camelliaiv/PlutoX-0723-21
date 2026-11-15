export type AppView = "sky" | "time" | "pixel";

export const APP_VIEWS: readonly AppView[] = ["sky", "time", "pixel"];
export const DEFAULT_APP_VIEW: AppView = "sky";

const VIEW_PARAMETER = "view";

export function parseAppView(text: string | null): AppView | null {
  return APP_VIEWS.find((appView) => appView === text) ?? null;
}

export function readAppViewFromUrl(queryString: string): AppView {
  return parseAppView(new URLSearchParams(queryString).get(VIEW_PARAMETER)) ?? DEFAULT_APP_VIEW;
}

export function withAppView(queryString: string, appView: AppView): string {
  const parameters = new URLSearchParams(queryString);
  parameters.set(VIEW_PARAMETER, appView);
  return `?${parameters.toString()}`;
}

export function neighbouringAppView(current: AppView, key: string): AppView | null {
  const currentIndex = APP_VIEWS.indexOf(current);
  const lastIndex = APP_VIEWS.length - 1;
  switch (key) {
    case "ArrowRight":
      return APP_VIEWS[currentIndex === lastIndex ? 0 : currentIndex + 1] ?? null;
    case "ArrowLeft":
      return APP_VIEWS[currentIndex === 0 ? lastIndex : currentIndex - 1] ?? null;
    case "Home":
      return APP_VIEWS[0] ?? null;
    case "End":
      return APP_VIEWS[lastIndex] ?? null;
    default:
      return null;
  }
}
