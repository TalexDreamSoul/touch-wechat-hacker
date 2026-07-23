'use client';

import type { ReactNode } from 'react';
import '@cloudflare/kumo/styles/standalone';
import { ManagerProvider } from '@/lib/manager-context';

export function Providers({ children }: { children: ReactNode }) {
  return <ManagerProvider>{children}</ManagerProvider>;
}
