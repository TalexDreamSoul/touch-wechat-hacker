'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  Input,
  InputArea,
  Select,
  Surface,
  Tabs,
  Text
} from '@cloudflare/kumo';
import {
  FloppyDiskIcon,
  ArrowCounterClockwiseIcon,
  ShieldCheckIcon,
  MagicWandIcon,
  FolderOpenIcon
} from '@phosphor-icons/react';
import { useManager } from '@/lib/manager-context';
import type { ManagerConfig } from '@/lib/api';
import { maskPath, maskPathShort } from '@/lib/sensitive';

const emptyConfig: ManagerConfig = {
  wechatApp: '',
  instanceRoot: '',
  launcherRoot: '',
  tmpRoot: '',
  antirecallTool: '',
  antirecallConfig: '',
  tweakTool: '',
  defaultTweakDylib: '',
  defaultExtraEnv: ''
};

const tabs = [
  { value: 'paths', label: '目录' },
  { value: 'patch', label: '补丁' },
  { value: 'advanced', label: '高级' },
  { value: 'health', label: '健康' }
] as const;

type TabId = (typeof tabs)[number]['value'];

export function ConfigPage() {
  const { state, busy, runAction } = useManager();
  const [form, setForm] = useState<ManagerConfig>(emptyConfig);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('paths');
  const [revealPaths, setRevealPaths] = useState(false);

  useEffect(() => {
    if (!state?.config || dirty) return;
    setForm({ ...emptyConfig, ...state.config });
  }, [state?.config, dirty]);

  const defaults = state?.meta?.defaults || {};
  const patchConfigs = state?.meta?.patchConfigs || [];
  const migrations = state?.meta?.migrations || [];
  const checks = state?.health?.checks || {};

  const knownPatchPaths = useMemo(() => new Set(patchConfigs.map((item) => item.path)), [patchConfigs]);
  const customPatchSelected = Boolean(form.antirecallConfig && !knownPatchPaths.has(form.antirecallConfig));

  function updateField<K extends keyof ManagerConfig>(key: K, value: ManagerConfig[K]) {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function shown(value?: string) {
    return revealPaths ? value || '' : maskPath(value);
  }

  async function save() {
    setError('');
    setMessage('');
    try {
      await runAction('保存配置', '/api/config', { method: 'PUT', body: form });
      setDirty(false);
      setMessage('配置已保存');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resetPaths() {
    if (!window.confirm('将路径类配置重置为 monorepo 默认值？实例列表不会被清空。')) return;
    setError('');
    setMessage('');
    try {
      await runAction('重置路径默认值', '/api/config', {
        method: 'PUT',
        body: { resetPaths: true, defaultExtraEnv: form.defaultExtraEnv || '' }
      });
      setDirty(false);
      setMessage('已恢复 monorepo 默认路径');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runPatch(dryRun: boolean) {
    if (!dryRun && !window.confirm('正式安装补丁前请确保微信完全退出。继续？')) return;
    setError('');
    setMessage('');
    try {
      await runAction(dryRun ? '补丁 dry-run' : '正式安装补丁', '/api/antirecall', {
        method: 'POST',
        body: { dryRun, noBackup: true }
      });
      setMessage(dryRun ? 'dry-run 完成，详见日志' : '补丁安装命令已执行，详见日志');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openConfigDir() {
    setError('');
    try {
      await runAction('打开配置目录', '/api/open-config-dir', { method: 'POST' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      {error ? <Banner variant="error" title="操作失败" description={error} /> : null}
      {message ? <Banner variant="default" title="完成" description={message} /> : null}

      <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <Text variant="heading2" as="h2">
              全局配置
            </Text>
            <Text variant="secondary" size="sm">
              按分组编辑；默认脱敏显示用户目录，避免截图泄露。
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {dirty ? <Badge variant="warning">未保存</Badge> : <Badge variant="success">已同步</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setRevealPaths((v) => !v)}>
              {revealPaths ? '隐藏完整路径' : '显示完整路径'}
            </Button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <MetaItem label="配置文件" value={shown(state?.configPath)} />
          <MetaItem label="仓库" value={revealPaths ? state?.meta?.repoRoot || '-' : 'monorepo'} />
        </div>

        {migrations.length > 0 ? (
          <Banner
            variant="alert"
            title={`已自动迁移 ${migrations.length} 项配置`}
            description={
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {migrations.map((item, index) => (
                  <div key={`${item.field}-${index}`}>
                    <Text as="p" size="sm">
                      {item.field}: {item.reason}
                    </Text>
                    <Text as="p" size="xs">
                      {maskPathShort(item.from)} → {maskPathShort(item.to)}
                    </Text>
                  </div>
                ))}
              </div>
            }
          />
        ) : null}

        <Tabs
          variant="segmented"
          value={tab}
          onValueChange={(value) => setTab(value as TabId)}
          tabs={tabs.map((item) => ({ value: item.value, label: item.label }))}
        />
      </Surface>

      {tab === 'paths' ? (
        <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
          <Text variant="heading3" as="h3">
            微信与目录
          </Text>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <Input
              label="微信 App 路径"
              value={form.wechatApp}
              onChange={(e) => updateField('wechatApp', e.target.value)}
              placeholder={defaults.wechatApp || ''}
              description={revealPaths ? undefined : `显示: ${maskPath(form.wechatApp)}`}
            />
            <Input
              label="实例数据根目录"
              value={form.instanceRoot}
              onChange={(e) => updateField('instanceRoot', e.target.value)}
              placeholder={defaults.instanceRoot || ''}
              description={revealPaths ? undefined : `显示: ${maskPath(form.instanceRoot)}`}
            />
            <Input
              label="启动器目录"
              value={form.launcherRoot}
              onChange={(e) => updateField('launcherRoot', e.target.value)}
              placeholder={defaults.launcherRoot || ''}
              description={revealPaths ? undefined : `显示: ${maskPath(form.launcherRoot)}`}
            />
            <Input
              label="临时目录根"
              value={form.tmpRoot}
              onChange={(e) => updateField('tmpRoot', e.target.value)}
              placeholder={defaults.tmpRoot || ''}
              description={revealPaths ? undefined : `显示: ${maskPath(form.tmpRoot)}`}
            />
          </div>
        </Surface>
      ) : null}

      {tab === 'patch' ? (
        <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
          <Text variant="heading3" as="h3">
            防撤回补丁
          </Text>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <Input
              label="wechat-antirecall 工具"
              value={form.antirecallTool}
              onChange={(e) => updateField('antirecallTool', e.target.value)}
              placeholder={defaults.antirecallTool || ''}
              description={revealPaths ? undefined : `显示: ${maskPathShort(form.antirecallTool, 64)}`}
            />
            <div style={{ display: 'grid', gap: 8 }}>
              <Select
                label="patches 预设"
                value={customPatchSelected ? '__custom__' : form.antirecallConfig || ''}
                onValueChange={(value) => {
                  const next = String(value || '');
                  if (next === '__custom__') return;
                  updateField('antirecallConfig', next);
                }}
                items={[
                  ...patchConfigs.map((item) => ({
                    label: `${item.name}${item.recommended ? ' (推荐)' : ''}`,
                    value: item.path
                  })),
                  ...(customPatchSelected ? [{ label: '自定义路径', value: '__custom__' }] : [])
                ]}
              />
              <Input
                label="patches 路径"
                value={form.antirecallConfig}
                onChange={(e) => updateField('antirecallConfig', e.target.value)}
                placeholder={defaults.antirecallConfig || ''}
                description={revealPaths ? undefined : `显示: ${maskPathShort(form.antirecallConfig, 64)}`}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="secondary" icon={<ShieldCheckIcon />} disabled={Boolean(busy)} onClick={() => void runPatch(true)}>
              dry-run
            </Button>
            <Button variant="destructive" icon={<MagicWandIcon />} disabled={Boolean(busy)} onClick={() => void runPatch(false)}>
              正式安装补丁
            </Button>
          </div>
        </Surface>
      ) : null}

      {tab === 'advanced' ? (
        <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
          <Text variant="heading3" as="h3">
            高级 / 实验
          </Text>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <Input label="WeChatTweak / 自定义工具" value={form.tweakTool} onChange={(e) => updateField('tweakTool', e.target.value)} />
            <Input
              label="默认 DYLD_INSERT_LIBRARIES"
              value={form.defaultTweakDylib}
              onChange={(e) => updateField('defaultTweakDylib', e.target.value)}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <InputArea
                label="默认额外环境变量"
                description="每行 KEY=value"
                value={form.defaultExtraEnv}
                onChange={(e) => updateField('defaultExtraEnv', e.target.value)}
              />
            </div>
          </div>
        </Surface>
      ) : null}

      {tab === 'health' ? (
        <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
          <Text variant="heading3" as="h3">
            健康检查
          </Text>
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
              width: '100%'
            }}
          >
            {Object.entries(checks).map(([name, check]) => (
              <Surface key={name} style={{ padding: 12, display: 'grid', gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Text as="p" size="sm">
                    {name}
                  </Text>
                  <Badge variant={check.ok ? 'success' : 'error'}>{check.ok ? 'ok' : 'fail'}</Badge>
                </div>
                <Text as="p" variant="mono-secondary">
                  {revealPaths ? check.path || '-' : maskPathShort(check.path, 52)}
                </Text>
              </Surface>
            ))}
          </div>
        </Surface>
      ) : null}

      <Surface style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
        <Button variant="primary" icon={<FloppyDiskIcon />} loading={busy === '保存配置'} onClick={() => void save()}>
          保存配置
        </Button>
        <Button variant="secondary" icon={<ArrowCounterClockwiseIcon />} disabled={Boolean(busy)} onClick={() => void resetPaths()}>
          恢复 monorepo 默认路径
        </Button>
        <Button variant="ghost" icon={<FolderOpenIcon />} disabled={Boolean(busy)} onClick={() => void openConfigDir()}>
          打开配置目录
        </Button>
      </Surface>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text as="p" variant="secondary" size="xs">
        {label}
      </Text>
      <Text as="p" variant="mono-secondary">
        {value}
      </Text>
    </div>
  );
}
