import type { GradientName } from "./colorMaps";
import type { PlayerSettings } from "./playerSettings";
import type { PreparedFrames } from "./preparedFrames";

export interface LegendContent {
  gradient: GradientName;
  lowLabel: string;
  highLabel: string;
  caption: string;
}

const MINUS_SIGN = "−";

function formatLimit(limit: number): string {
  return limit >= 10 ? limit.toFixed(0) : limit.toFixed(1);
}

export function describeLegend(
  prepared: PreparedFrames,
  settings: PlayerSettings,
  epochIndex: number,
): LegendContent {
  const { response, modeImages } = prepared;
  const unit = response.unit;
  const epochCount = response.frames.length;
  if (settings.mode === "difference") {
    const limit = formatLimit(modeImages.differenceLimit);
    return {
      gradient: "difference",
      lowLabel: `${MINUS_SIGN}${limit}`,
      highLabel: `+${limit}`,
      caption:
        `${unit} · epoch ${epochIndex + 1} minus epoch 1 · blue: fainter than epoch 1, ` +
        "orange: brighter than epoch 1",
    };
  }
  const range = settings.mode === "stack" ? modeImages.stackRange : response.display_range;
  const sharedCaption = `${unit}, shared across epochs`;
  return {
    gradient: settings.colorMap,
    lowLabel: range ? formatLimit(range.minimum) : "",
    highLabel: range ? formatLimit(range.maximum) : "",
    caption:
      settings.mode === "stack"
        ? `${unit} · stack: inverse-variance weighted mean of ${epochCount} epochs`
        : sharedCaption,
  };
}
