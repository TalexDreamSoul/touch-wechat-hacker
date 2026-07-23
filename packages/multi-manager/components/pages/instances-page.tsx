'use client';

import { useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  Dialog,
  Empty,
  Input,
  InputArea,
  Select,
  Surface,
  Switch,
  Text
} from '@cloudflare/kumo';
import {
  FolderOpenIcon,
  PlayIcon,
  SquareIcon,
  TrashIcon,
  AppWindowIcon,
  TerminalIcon,
  PlusIcon,
  CopyIcon
} from '@phosphor-icons/react';
import { useManager } from '@/lib/manager-context';
import { stripEmptyStrings } from '@/lib/api';
import { maskPath } from '@/lib/sensitive';

const emptyCreate = {
  name: '',
  id: '',
  icon: '',
  iconPreset: '',
  iconLabel: '',
  homeDir: '',
  notes: '',
  enableTweak: false,
  tweakDylib: '',
  extraEnv: ''
};

const emptyBatch = {
  prefix: '微信小号',
  count: '3',
  start: '1',
  iconPreset: 'cycle',
  notes: ''
};

export function InstancesPage() {
  const { state, busy, runAction } = useManager();
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const instances = state?.instances || [];
  const iconPresets = state?.iconPresets || {};

  async function createOne() {
    if (!createForm.name.trim()) {
      setError('请填写实例名称');
      return;
    }
    setError('');
    try {
      await runAction('创建实例', '/api/instances', {
        method: 'POST',
        body: stripEmptyStrings({
          ...createForm,
          enableTweak: createForm.enableTweak
        })
      });
      setCreateForm(emptyCreate);
      setCreateOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createBatch() {
    const count = Number(batchForm.count || 0);
    if (!Number.isFinite(count) || count < 1) {
      setError('请填写有效数量');
      return;
    }
    setError('');
    try {
      await runAction('批量创建实例', '/api/instances/batch', {
        method: 'POST',
        body: stripEmptyStrings(batchForm)
      });
      setBatchOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function act(name: string, path: string) {
    setError('');
    try {
      await runAction(name, path, { method: 'POST' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(`删除实例 ${id}？不会删除磁盘数据目录。`)) return;
    setError('');
    try {
      await runAction('删除实例', `/api/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      {error ? <Banner variant="error" title="操作失败" description={error} /> : null}

      <Surface
        style={{
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          width: '100%'
        }}
      >
        <div>
          <Text variant="heading2" as="h2">
            实例列表
          </Text>
          <Text variant="secondary" size="sm">
            共 {instances.length} 个 · 列表优先，创建走弹窗
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={<CopyIcon />} onClick={() => setBatchOpen(true)}>
            批量创建
          </Button>
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
            新建实例
          </Button>
        </div>
      </Surface>

      <Surface style={{ padding: 16, display: 'grid', gap: 12, width: '100%' }}>
        {instances.length === 0 ? (
          <Empty
            title="暂无实例"
            description="点击右上角「新建实例」创建独立 HOME 的微信实例"
            contents={
              <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
                新建实例
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 12, width: '100%' }}>
            {instances.map((item) => (
              <Surface key={item.id} style={{ padding: 14, display: 'grid', gap: 10, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <Text as="p" size="base">
                      {item.name}
                    </Text>
                    <Text as="p" variant="secondary" size="xs">
                      {item.id}
                    </Text>
                  </div>
                  <Badge variant={item.running ? 'success' : 'secondary'}>
                    {item.running ? `运行中${item.pid ? ` · ${item.pid}` : ''}` : '已停止'}
                  </Badge>
                </div>
                <Text as="p" variant="secondary" size="xs">
                  HOME: {maskPath(item.homeDir)}
                </Text>
                {item.notes ? (
                  <Text as="p" variant="secondary" size="sm">
                    {item.notes}
                  </Text>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<PlayIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void act('启动实例', `/api/instances/${encodeURIComponent(item.id)}/launch`)}
                  >
                    启动
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<SquareIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void act('停止实例', `/api/instances/${encodeURIComponent(item.id)}/stop`)}
                  >
                    停止
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<AppWindowIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void act('生成启动器', `/api/instances/${encodeURIComponent(item.id)}/launcher`)}
                  >
                    启动器
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<TerminalIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void act('生成脚本', `/api/instances/${encodeURIComponent(item.id)}/script`)}
                  >
                    脚本
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<FolderOpenIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void act('打开 HOME', `/api/instances/${encodeURIComponent(item.id)}/open-home`)}
                  >
                    HOME
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary-destructive"
                    icon={<TrashIcon />}
                    disabled={Boolean(busy)}
                    onClick={() => void remove(item.id)}
                  >
                    删除
                  </Button>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </Surface>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog size="xl" style={{ padding: 24, display: 'grid', gap: 16, maxHeight: '85vh', overflow: 'auto' }}>
          <Dialog.Title>新建实例</Dialog.Title>
          <Dialog.Description>每个实例独立 HOME / 临时目录，可选图标与注入配置。</Dialog.Description>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Input
              label="名称"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="工作号 / 小号"
            />
            <Input
              label="ID（可选）"
              value={createForm.id}
              onChange={(e) => setCreateForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="自动生成"
            />
            <Select
              label="图标预设"
              value={createForm.iconPreset || ''}
              onValueChange={(value) => setCreateForm((f) => ({ ...f, iconPreset: String(value || '') }))}
              placeholder="默认"
              items={[
                { label: '默认', value: '' },
                ...Object.entries(iconPresets).map(([key, item]) => ({ label: item.name, value: key }))
              ]}
            />
            <Input
              label="HOME 目录（可选）"
              value={createForm.homeDir}
              onChange={(e) => setCreateForm((f) => ({ ...f, homeDir: e.target.value }))}
            />
            <Input
              label="Tweak dylib"
              value={createForm.tweakDylib}
              onChange={(e) => setCreateForm((f) => ({ ...f, tweakDylib: e.target.value }))}
            />
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <Switch
                label="启用 DYLD 注入"
                checked={createForm.enableTweak}
                onCheckedChange={(checked) => setCreateForm((f) => ({ ...f, enableTweak: Boolean(checked) }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <InputArea
                label="备注"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <InputArea
                label="额外环境变量"
                description="每行 KEY=value"
                value={createForm.extraEnv}
                onChange={(e) => setCreateForm((f) => ({ ...f, extraEnv: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Dialog.Close render={(props) => <Button variant="secondary" {...props}>取消</Button>} />
            <Button variant="primary" loading={busy === '创建实例'} onClick={() => void createOne()}>
              创建实例
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={batchOpen} onOpenChange={setBatchOpen}>
        <Dialog size="lg" style={{ padding: 24, display: 'grid', gap: 16 }}>
          <Dialog.Title>批量创建</Dialog.Title>
          <Dialog.Description>按前缀与数量快速生成多个实例。</Dialog.Description>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Input
              label="名称前缀"
              value={batchForm.prefix}
              onChange={(e) => setBatchForm((f) => ({ ...f, prefix: e.target.value }))}
            />
            <Input
              label="数量"
              value={batchForm.count}
              onChange={(e) => setBatchForm((f) => ({ ...f, count: e.target.value }))}
            />
            <Input
              label="起始序号"
              value={batchForm.start}
              onChange={(e) => setBatchForm((f) => ({ ...f, start: e.target.value }))}
            />
            <Select
              label="图标策略"
              value={batchForm.iconPreset}
              onValueChange={(value) => setBatchForm((f) => ({ ...f, iconPreset: String(value || 'cycle') }))}
              items={[
                { label: '循环预设色', value: 'cycle' },
                ...Object.entries(iconPresets).map(([key, item]) => ({ label: item.name, value: key }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Dialog.Close render={(props) => <Button variant="secondary" {...props}>取消</Button>} />
            <Button variant="primary" loading={busy === '批量创建实例'} onClick={() => void createBatch()}>
              批量创建
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
