const ONBOARDING_KEY = 'touch-wechat-hacker-onboarding-v1';

export type OnboardingRecord = {
  acceptedAt: string;
  version: 1;
};

export function hasAcceptedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<OnboardingRecord>;
    return Boolean(parsed.acceptedAt && parsed.version === 1);
  } catch {
    return false;
  }
}

export function acceptOnboarding(): OnboardingRecord {
  const record: OnboardingRecord = {
    acceptedAt: new Date().toISOString(),
    version: 1
  };
  window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(record));
  return record;
}

export function clearOnboarding(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_KEY);
}

export const ONBOARDING_STORAGE_KEY = ONBOARDING_KEY;
