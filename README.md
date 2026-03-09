# chief-of-staff

「タレントのマネージャー」のように動くAIタスク管理エージェント。
Slackで会話するだけでタスクを管理してくれるツール。

## 構成

```
packages/
├── gateway/   # Cloudflare Workers（Slack受信・Cron Trigger）
└── agent/     # Mastra（AIエージェント・Notion連携）
```

## セットアップ

```bash
pnpm install
```

## 開発

```bash
# Agent (Mastra dev server)
pnpm dev:agent

# Gateway (Cloudflare Workers)
pnpm dev:gateway
```
