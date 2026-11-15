export const WELCOME_ANIMATED_MILLISECONDS = 3000;
export const WELCOME_REDUCED_MOTION_MILLISECONDS = 1500;
export const WELCOME_FADE_MILLISECONDS = 1000;

const WELCOME_DISMISS_KEYS: readonly string[] = ["Enter", "Escape"];

export function welcomeDisplayMilliseconds(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? WELCOME_REDUCED_MOTION_MILLISECONDS : WELCOME_ANIMATED_MILLISECONDS;
}

export function isWelcomeDismissKey(key: string): boolean {
  return WELCOME_DISMISS_KEYS.includes(key);
}
