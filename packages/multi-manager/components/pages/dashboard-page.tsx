'use client';

import { Badge, Empty, Surface, Text } from '@cloudflare/kumo';
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useManager } from '@/lib/manager-context';
import { maskPathShort } from '@/lib/sensitive';

export function DashboardPage() {
  const { state } = useManager();
  const instances = state?.instances || [];
  const checks = state?.health?.checks || {};
  const runningCount = instances.filter((item) => item.running).length;
  const healthyCount = Object.values(checks).filter((item) => item.ok).length;
  const totalChecks = Object.keys(checks).length;

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          width: '100%'
        }}
      >
        <Stat title="实例总数" value={String(instances.length)} hint={`${runningCount} 个运行中`} />
        <Stat title="健康检查" value={`${healthyCount}/${totalChecks || 0}`} hint="本地路径可用性" />
        <Stat title="配置文件" value={state?.configPath ? '已加载' : '未连接'} hint="~/.touch-wechat-hacker/config.json" mono />
        <Stat title="仓库" value="monorepo" hint="touch-wechat-hacker" mono />
      </div>

      <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
        <Text variant="heading2" as="h2">
          健康检查
        </Text>
        {totalChecks === 0 ? (
          <Empty title="暂无健康检查" description="连接管理端后会显示路径状态" />
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              width: '100%'
            }}
          >
            {Object.entries(checks).map(([name, check]) => (
              <Surface key={name} style={{ padding: 12, display: 'grid', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {check.ok ? (
                    <CheckCircleIcon color="var(--kumo-success, #16a34a)" />
                  ) : (
                    <WarningCircleIcon color="var(--kumo-danger, #dc2626)" />
                  )}
                  <Text as="p" size="sm">
                    {name}
                  </Text>
                  <Badge variant={check.ok ? 'success' : 'error'}>{check.ok ? 'ok' : 'fail'}</Badge>
                </div>
                <Text as="code" variant="mono-secondary">
                  {maskPathShort(check.path, 52)}
                </Text>
                {check.error ? (
                  <Text as="p" size="xs">
                    {check.error}
                  </Text>
                ) : null}
              </Surface>
            ))}
          </div>
        )}
      </Surface>

      <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
        <Text variant="heading2" as="h2">
          最近实例
        </Text>
        {instances.length === 0 ? (
          <Empty title="还没有实例" description="到「实例」页创建第一个微信多开实例" />
        ) : (
          <div style={{ display: 'grid', gap: 8, width: '100%' }}>
            {instances.slice(0, 6).map((item) => (
              <Surface
                key={item.id}
                style={{
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  width: '100%'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Text as="p" size="base">
                    {item.name}
                  </Text>
                  <Text as="p" variant="secondary" size="xs">
                    {item.id}
                  </Text>
                </div>
                <Badge variant={item.running ? 'success' : 'secondary'}>
                  {item.running ? '运行中' : '已停止'}
                </Badge>
              </Surface>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
  mono = false
}: {
  title: string;
  value: string;
  hint: string;
  mono?: boolean;
}) {
  return (
    <Surface style={{ padding: 14, display: 'grid', gap: 6, minWidth: 0, width: '100%' }}>
      <Text as="p" variant="secondary" size="xs">
        {title}
      </Text>
      {mono ? (
        <Text as="p" variant="mono" truncate>
          {value}
        </Text>
      ) : (
        <Text as="p" size="lg">
          {value}
        </Text>
      )}
      <Text as="p" variant="secondary" size="xs">
        {hint}
      </Text>
    </Surface>
  );
}
