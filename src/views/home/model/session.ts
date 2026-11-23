import type { OnboardingStep } from '@/entities/save';

/**
 * Home's memory for this page load only — never persisted (the save schema fixes every stored key, and
 * a reload must show these again). Survives client-side navigation, unlike component state.
 */
export type Dismissible = 'v1Welcome' | 'persistDenied';

const dismissed = new Set<Dismissible>();
let sawOnboarding = false;
let finishShown = false;

export function isDismissed(key: Dismissible): boolean {
  return dismissed.has(key);
}

export function dismiss(key: Dismissible): void {
  dismissed.add(key);
}

/** Home rendered an onboarding step (anything but `done`) in this page load. */
export function noteOnboardingStep(step: OnboardingStep): void {
  if (step !== 'done') sawOnboarding = true;
}

/**
 * Onboarding finished in this page load and the hub hasn't celebrated it yet: the next-stage card's
 * Fight pulses once and takes focus. False after a reload (the step was already `done`).
 */
export function onboardingJustFinished(): boolean {
  return sawOnboarding && !finishShown;
}

export function markFinishShown(): void {
  finishShown = true;
}

/** Test helper: forget this page load. */
export function __resetHomeSessionForTests(): void {
  dismissed.clear();
  sawOnboarding = false;
  finishShown = false;
}
