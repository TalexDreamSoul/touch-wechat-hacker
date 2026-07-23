'use client';

import { useEffect, useState } from 'react';
import { Banner, Button, Checkbox, Dialog, Surface, Text } from '@cloudflare/kumo';
import { WarningCircleIcon, ShieldWarningIcon, GithubLogoIcon } from '@phosphor-icons/react';
import { acceptOnboarding, hasAcceptedOnboarding } from '@/lib/onboarding';

const REPO_URL = 'https://github.com/TalexDreamSoul/touch-wechat-hacker';

type OnboardingGateProps = {
  children: React.ReactNode;
};

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [legalOk, setLegalOk] = useState(false);
  const [riskOk, setRiskOk] = useState(false);
  const [localOk, setLocalOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const accepted = hasAcceptedOnboarding();
    setOpen(!accepted);
    setReady(true);
  }, []);

  function confirm() {
    if (!legalOk || !riskOk || !localOk) {
      setError('请完整勾选全部确认项后才能继续。');
      return;
    }
    acceptOnboarding();
    setError('');
    setOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {children}

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          // 未同意前不允许关闭
          if (!hasAcceptedOnboarding()) {
            setOpen(true);
            return;
          }
          setOpen(next);
        }}
        role="alertdialog"
      >
        <Dialog
          size="xl"
          style={{
            padding: 24,
            display: 'grid',
            gap: 16,
            maxHeight: '88vh',
            overflow: 'auto'
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <Dialog.Title>首次使用前请认真阅读</Dialog.Title>
            <Dialog.Description>
              检测到本机 localStorage 尚未保存使用确认记录。请完整阅读下列说明；未勾选确认前无法使用管理端。
            </Dialog.Description>
          </div>

          <Banner
            variant="error"
            icon={<WarningCircleIcon weight="fill" />}
            title="重要：学习研究用途 / 风险自负"
            description="本项目涉及修改微信客户端、多开实例与本地补丁。继续使用即表示你已理解并接受下列全部条款。"
          />

          <Surface style={{ padding: 14, display: 'grid', gap: 10 }}>
            <Text variant="heading3" as="h3">
              1. 法律与责任声明（非常重要）
            </Text>
            <Text as="p" size="sm">
              本仓库 / 本管理端仅供个人学习、安全研究、技术验证与本地实验。作者、贡献者与任何相关维护者不承担因你使用、传播、改装、部署本工具而产生的任何直接或间接法律责任、民事赔偿、行政处罚、账号处罚、数据损失或业务中断后果。
            </Text>
            <Text as="p" size="sm">
              你应自行确认：使用本工具不违反你所在地区的法律法规、平台服务协议、用人单位规定与设备使用政策。若你无法确认合法性，请立即停止使用并关闭本页面。
            </Text>
            <Text as="p" size="sm">
              本工具不是官方产品，与腾讯 / 微信 / WeChat 无任何隶属、授权、合作或背书关系。对微信客户端的任何修改、注入、重签名、多开与逆向行为，均由你本人独立决策并承担后果。
            </Text>
            <Text as="p" size="sm">
              禁止将本工具用于：骚扰、诈骗、批量营销、绕过安全策略、侵犯他人隐私、破坏服务可用性，或其他违法 / 违规用途。因上述用途导致的全部责任与你个人相关，与作者无关。
            </Text>
          </Surface>

          <Surface style={{ padding: 14, display: 'grid', gap: 10 }}>
            <Text variant="heading3" as="h3">
              2. 账号、稳定性与封禁风险
            </Text>
            <Text as="p" size="sm">
              多开、补丁、注入、屏蔽更新、防撤回等能力可能触发微信风控、登录异常、功能失效、闪退、无法收发消息、无法更新，甚至有概率导致临时限制或永久封号。没有任何保证说“一定安全 / 一定不会封”。
            </Text>
            <Text as="p" size="sm">
              不同微信版本、构建号、系统版本、SIP / 签名 / 权限环境差异很大。补丁可能在升级后失效，也可能在某些环境下不可用。工具会尽量按已知构建号匹配，但仍存在未知风险。
            </Text>
            <Text as="p" size="sm">
              正式写入补丁会修改 `/Applications/WeChat.app` 内文件并重新签名。若操作不当、权限不足、微信未退出、版本不匹配，可能导致微信无法启动，需要你自行恢复备份或重装微信。
            </Text>
            <Text as="p" size="sm">
              本工具默认仅本机 loopback 使用。请勿把管理端暴露到公网。配置、实例路径、补丁日志中可能包含本机路径与操作痕迹，截图分享前请注意脱敏。
            </Text>
          </Surface>

          <Surface style={{ padding: 14, display: 'grid', gap: 10 }}>
            <Text variant="heading3" as="h3">
              3. 数据、备份与本地安全
            </Text>
            <Text as="p" size="sm">
              多开实例会创建独立数据目录。请勿多个实例共享同一 HOME。删除管理端实例记录不一定删除磁盘数据；迁移 / 删除前请自行确认。
            </Text>
            <Text as="p" size="sm">
              建议任何正式 install 前先 dry-run，并确保微信完全退出。作者不承诺备份一定可用、恢复一定成功，也不承诺兼容所有未来微信版本。
            </Text>
            <Text as="p" size="sm">
              本地访问 token、配置文件、实例信息保存在你的机器上。请妥善保管，不要把 token 或完整配置贴到公开场合。
            </Text>
          </Surface>

          <Surface style={{ padding: 14, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldWarningIcon size={18} />
              <Text variant="heading3" as="h3">
                继续前必须确认
              </Text>
            </div>

            <Checkbox
              checked={legalOk}
              onCheckedChange={(checked) => setLegalOk(Boolean(checked))}
              label="我已阅读并理解：作者不承担法律责任；本工具仅供学习研究；违规使用后果自负。"
            />
            <Checkbox
              checked={riskOk}
              onCheckedChange={(checked) => setRiskOk(Boolean(checked))}
              label="我已知晓：可能出现封号、不稳定、功能异常、微信损坏、补丁失效等风险，并自行承担全部后果。"
            />
            <Checkbox
              checked={localOk}
              onCheckedChange={(checked) => setLocalOk(Boolean(checked))}
              label="我确认仅在本机受控环境使用，不会把管理端暴露到公网，也不会用于违法违规用途。"
            />

            {error ? <Banner variant="error" title="还不能继续" description={error} /> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                icon={<GithubLogoIcon />}
                onClick={() => window.open(REPO_URL, '_blank', 'noopener,noreferrer')}
              >
                打开 GitHub 仓库
              </Button>
              <Button variant="primary" onClick={confirm}>
                我已充分理解，同意并继续
              </Button>
            </div>

            <Text variant="secondary" size="xs">
              确认后会写入 localStorage 键：`touch-wechat-hacker-onboarding-v1`。清除该键可再次触发本引导。
            </Text>
          </Surface>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
