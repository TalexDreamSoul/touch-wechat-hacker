'use client';

import { useState } from 'react';
import { Banner, Button, Input, Loader, Surface, Text } from '@cloudflare/kumo';
import { KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useManager } from '@/lib/manager-context';

export function AuthGate() {
  const { auth, setupToken, verifyToken } = useManager();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (auth.checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loader />
      </div>
    );
  }

  const isSetup = !auth.configured;

  async function submit() {
    const value = token.trim();
    if (value.length < 6) {
      setError('token 至少 6 位');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (isSetup) await setupToken(value);
      else await verifyToken(value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Surface style={{ width: 'min(440px, 100%)', padding: 24, display: 'grid', gap: 16 }}>
        <div>
          <Text as="p" variant="secondary" size="xs">
            Touch WeChat Hacker
          </Text>
          <Text variant="heading1" as="h1">
            {isSetup ? '设置本地访问 Token' : '验证访问 Token'}
          </Text>
          <Text as="p" size="sm">
            管理端只绑定 127.0.0.1。Token 以 scrypt 哈希保存在本地配置文件中。
          </Text>
        </div>

        {error ? <Banner variant="error" title="认证失败" description={error} /> : null}

        <Input
          label="访问 Token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="至少 6 位"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />

        <Button
          variant="primary"
          icon={isSetup ? <KeyIcon /> : <ShieldCheckIcon />}
          loading={submitting}
          onClick={() => void submit()}
        >
          {isSetup ? '设置并进入' : '验证并进入'}
        </Button>
      </Surface>
    </div>
  );
}
