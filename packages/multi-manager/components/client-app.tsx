'use client';

import dynamic from 'next/dynamic';

const ClientHome = dynamic(() => import('@/components/client-home'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>
      Loading…
    </div>
  )
});

export function ClientApp() {
  return <ClientHome />;
}
