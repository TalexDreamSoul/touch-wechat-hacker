'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  Badge,
  Button,
  Loader,
  Sidebar,
  Surface,
  Text
} from '@cloudflare/kumo';
import {
  ArrowsClockwiseIcon,
  GearSixIcon,
  HouseIcon,
  ScrollIcon,
  SignOutIcon,
  SquaresFourIcon
} from '@phosphor-icons/react';
import { useManager } from '@/lib/manager-context';
import { DashboardPage } from '@/components/pages/dashboard-page';
import { InstancesPage } from '@/components/pages/instances-page';
import { ConfigPage } from '@/components/pages/config-page';
import { LogsPage } from '@/components/pages/logs-page';

const navItems = [
  { value: 'dashboard', label: '仪表盘', description: '运行状态与健康检查', icon: HouseIcon },
  { value: 'instances', label: '实例', description: '创建与管理多开实例', icon: SquaresFourIcon },
  { value: 'config', label: '全局配置', description: '路径、补丁与环境变量', icon: GearSixIcon },
  { value: 'logs', label: '日志', description: '操作记录与 API 结果', icon: ScrollIcon }
] as const;

type PageId = (typeof navItems)[number]['value'];

const fullHeightShellStyle: CSSProperties = {
  minHeight: '100svh',
  height: '100svh',
  maxHeight: '100svh',
  overflow: 'hidden'
};

export function AppShell() {
  const { state, loading, busy, refresh, logout } = useManager();
  const [page, setPage] = useState<PageId>('dashboard');

  const runningCount = useMemo(
    () => (state?.instances || []).filter((item) => item.running).length,
    [state?.instances]
  );
  const instanceCount = state?.instances?.length || 0;
  const active = navItems.find((item) => item.value === page) || navItems[0];

  if (loading && !state) {
    return (
      <div style={{ minHeight: '100svh', height: '100svh', display: 'grid', placeItems: 'center' }}>
        <Loader />
      </div>
    );
  }

  return (
    <Sidebar.Provider
      defaultOpen
      collapsible="icon"
      variant="sidebar"
      className="min-h-svh h-svh"
      style={fullHeightShellStyle}
    >
      <Sidebar style={{ height: '100%', minHeight: '100%' }}>
        <Sidebar.Header>
          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <Text variant="heading3" as="h1">
              Touch WeChat
            </Text>
            <Text variant="secondary" size="xs">
              Hacker Manager
            </Text>
          </div>
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>导航</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {navItems.map((item) => (
                <Sidebar.MenuButton
                  key={item.value}
                  icon={item.icon}
                  active={page === item.value}
                  onClick={() => setPage(item.value)}
                >
                  {item.label}
                </Sidebar.MenuButton>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>

        <Sidebar.Footer>
          <Button
            variant="ghost"
            size="sm"
            icon={<SignOutIcon />}
            onClick={logout}
            style={{ width: '100%' }}
          >
            退出
          </Button>
        </Sidebar.Footer>
      </Sidebar>

      <div
        style={{
          minWidth: 0,
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          overflow: 'hidden'
        }}
      >
        <Surface
          style={{
            borderBottom: '1px solid var(--kumo-line, rgba(0,0,0,.08))',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            <Text variant="heading2" as="h2">
              {active.label}
            </Text>
            <Text variant="secondary" size="sm">
              {active.description}
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge variant="secondary">{runningCount} 运行中</Badge>
            <Badge variant="outline">{instanceCount} 实例</Badge>
            {busy ? <Badge variant="info">{busy}</Badge> : null}
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowsClockwiseIcon />}
              loading={loading}
              onClick={() => void refresh()}
            >
              刷新
            </Button>
          </div>
        </Surface>

        <main
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            width: '100%'
          }}
        >
          <div
            style={{
              width: '100%',
              margin: '0 auto',
              padding: '20px 28px 32px',
              boxSizing: 'border-box',
              display: 'grid',
              gap: 16,
              justifyItems: 'stretch'
            }}
          >
            {page === 'dashboard' ? <DashboardPage /> : null}
            {page === 'instances' ? <InstancesPage /> : null}
            {page === 'config' ? <ConfigPage /> : null}
            {page === 'logs' ? <LogsPage /> : null}
          </div>
        </main>
      </div>
    </Sidebar.Provider>
  );
}
