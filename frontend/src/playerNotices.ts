import type { DisplayMode } from "./frameModes";

export interface NoticeContext {
  targetNotice: string | undefined;
  responseNotes: string[];
  mode: DisplayMode;
  showMarker: boolean;
  isPredictedPositionOutside: boolean;
}

const MODE_NOTICES: Record<DisplayMode, string | null> = {
  frame: null,
  difference: "Difference shows each frame minus the first epoch. Zero is the neutral colour.",
  stack:
    "Stack combines all epochs, weighted by their noise, to show fainter detail. " +
    "Moving sources appear smeared.",
};

const MARKER_NOTICE =
  "The marker is the predicted position at this epoch, from the catalogue position and " +
  "proper motion. It is not a measurement from the frame.";
const OUTSIDE_FIELD_NOTICE = "Predicted position is outside this field.";

export function buildNotices(context: NoticeContext): string[] {
  const notices = [context.targetNotice, ...context.responseNotes, MODE_NOTICES[context.mode]];
  if (context.showMarker) {
    notices.push(MARKER_NOTICE);
    if (context.isPredictedPositionOutside) {
      notices.push(OUTSIDE_FIELD_NOTICE);
    }
  }
  return notices.filter((notice): notice is string => typeof notice === "string");
}
