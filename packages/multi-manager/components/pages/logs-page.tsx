'use client';

import { Badge, Button, Empty, Surface, Text } from '@cloudflare/kumo';
import { TrashIcon } from '@phosphor-icons/react';
import { formatJson } from '@/lib/api';
import { useManager } from '@/lib/manager-context';

export function LogsPage() {
  const { logs, clearLogs } = useManager();

  return (
    <Surface style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Text variant="secondary" size="sm">
          最近 120 条，仅保存在当前浏览器会话。
        </Text>
        <Button variant="secondary" size="sm" icon={<TrashIcon />} onClick={clearLogs}>
          清空
        </Button>
      </div>

      {logs.length === 0 ? (
        <Empty title="暂无日志" description="执行启动、保存配置或补丁操作后会出现在这里" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {logs.map((item, index) => (
            <Surface key={`${item.time}-${index}`} style={{ padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge variant="secondary">{item.time}</Badge>
                <Text as="p" size="sm">
                  {item.message}
                </Text>
              </div>
              {item.data !== undefined ? (
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    overflow: 'auto',
                    maxHeight: 280,
                    fontSize: 12,
                    lineHeight: 1.45,
                    background: 'var(--kumo-recessed, rgba(0,0,0,.04))',
                    borderRadius: 8
                  }}
                >
                  {formatJson(item.data)}
                </pre>
              ) : null}
            </Surface>
          ))}
        </div>
      )}
    </Surface>
  );
}
