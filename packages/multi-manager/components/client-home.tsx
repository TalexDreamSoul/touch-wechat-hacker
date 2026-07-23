'use client';

import { AuthGate } from '@/components/auth-gate';
import { AppShell } from '@/components/app-shell';
import { useManager } from '@/lib/manager-context';

export default function ClientHome() {
  const { auth } = useManager();

  if (auth.checking || !auth.verified) {
    return <AuthGate />;
  }

  return <AppShell />;
}
