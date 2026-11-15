import { requireElement } from "./dom";
import { APP_VIEWS, neighbouringAppView, type AppView } from "./viewState";

export interface ViewSwitch {
  select(appView: AppView): void;
  focusSelectedTab(): void;
}

export function createViewSwitch(onUserSelect: (appView: AppView) => void): ViewSwitch {
  const tabList = requireElement<HTMLElement>("#view-tabs");
  const tabs = new Map<AppView, HTMLButtonElement>();
  const panels = new Map<AppView, HTMLElement>();
  for (const appView of APP_VIEWS) {
    tabs.set(appView, requireElement<HTMLButtonElement>(`#tab-${appView}`));
    panels.set(appView, requireElement<HTMLElement>(`#view-${appView}`));
  }
  let selectedView: AppView = APP_VIEWS[0] ?? "sky";

  function select(appView: AppView): void {
    selectedView = appView;
    document.body.dataset["view"] = appView;
    for (const [tabView, tab] of tabs) {
      const isSelected = tabView === appView;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    }
    for (const [panelView, panel] of panels) {
      panel.hidden = panelView !== appView;
    }
  }

  function selectByUser(appView: AppView): void {
    select(appView);
    onUserSelect(appView);
  }

  for (const [appView, tab] of tabs) {
    tab.addEventListener("click", () => selectByUser(appView));
  }

  tabList.addEventListener("keydown", (event) => {
    const neighbour = neighbouringAppView(selectedView, event.key);
    if (neighbour === null || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    selectByUser(neighbour);
    tabs.get(neighbour)?.focus();
  });

  return {
    select,
    focusSelectedTab(): void {
      tabs.get(selectedView)?.focus();
    },
  };
}
