'use client';

import { AuthGate } from '@/components/auth-gate';
import { AppShell } from '@/components/app-shell';
import { OnboardingGate } from '@/components/onboarding-gate';
import { useManager } from '@/lib/manager-context';

export default function ClientHome() {
  const { auth } = useManager();

  return (
    <OnboardingGate>
      {auth.checking || !auth.verified ? <AuthGate /> : <AppShell />}
    </OnboardingGate>
  );
}
