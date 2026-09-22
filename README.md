# KeyVault AI

> A local-first secure API key manager with usage analytics and AI developer tools.

KeyVault AI 是一个**本地优先（Local-First）**的 AI API Key 安全管理与使用分析平台。
它在保留原有强加密能力的基础上，将能力从「保存 Key」扩展为：

`安全存储 → Key 管理 → API 调试 → 使用统计 → Dashboard → 安全分析`

的完整闭环。

---

## Product Overview

KeyVault AI 面向 AI 开发者，解决三类核心问题：

1. **安全存储**：所有 API Key 以 AES-256-GCM 加密落盘，主密钥仅驻留内存，锁屏即清空。
2. **使用分析**：每一次通过 Playground 发出的真实请求都会生成用量日志，驱动 Dashboard / Usage 的真实统计。
3. **安全洞察**：基于真实规则计算安全评分，检测弱密码、长期未轮换、长期未使用等风险。

设计原则：**Dashboard 里的每一个数字都必须能追溯到真实本地数据**。无法真实获得的指标，宁可显示空状态，绝不伪造。

---

## Features

- **Setup / Unlock**：主密码（PBKDF2 + AES-256-GCM）+ 可选手势解锁。
- **API Keys**：增删改、搜索、复制、显示/隐藏、Provider 自动识别（带置信度）、环境 / 标签 / 状态 / 备注等元数据。
- **Dashboard**：5 个 Overview 指标卡 + API Usage 折线图 + Provider Analytics + Recent Activity（真实本地事件）。
- **Usage**：Overview、Request Trend、Token Usage、Provider / Model 占比、Request History（搜索 / 筛选 / 排序）。
- **Playground**：选择 Provider / Key / Model，向真实 Provider 发起请求，自动记录用量与 Token，绝不上传明文 Key。
- **Security Center**：真实规则安全评分、风险检测（含详情）、安全轮换流程引导。
- **Settings**：主密码、手势、免密访问、主题、用量 / 活动追踪开关、数据留存、Demo Data、导出（加密优先）。
- **Key Detail**：独立密钥详情页，Provider Logo + 状态 + 元数据网格 + 真实用量趋势图 + Reveal / Copy / Rotate / Edit / Delete。
- **Activity**：统一本地事件流，按 All / Security / API / Keys / System 分类筛选（解锁、增删改、复制、请求、轮换、设置变更等）。
- **Request Detail**：点击用量历史任意一行，查看单条真实请求的 Provider / Model / 状态 / 延迟 / Token 明细。
- **Export**：加密 JSON（默认推荐）、CSV / Excel 明文导出（二次确认 + 明确警告）。
- **Electron**：`npm start` 直接启动；`npm run build:win` 生成 Windows 便携版。
- **主题**：暗夜 / 纯白 / 柔雾紫，含深色与浅色两套配色。
- **响应式**：1440×900 / 1280×800 / 1024×768，小屏侧边栏可折叠。

---

## Architecture

```
          ┌─────────────────────────────────────┐
          │            User (Developer)          │
          └───────────────────┬─────────────────┘
                              │
                              ▼
          ┌─────────────────────────────────────┐
          │            KeyVault AI                │
          │  ┌─────────────────────────────────┐  │
          │  │  Authentication (密码/手势)      │  │
          │  │  Key Management  (增删改/搜索)    │  │
          │  │  Playground       (真实 API 请求) │  │
          │  │  Analytics        (统一数据层)    │  │
          │  │  Security Center  (评分/风险)     │  │
          │  └─────────────────────────────────┘  │
          └───────────────────┬─────────────────┘
                              │
                              ▼
          ┌─────────────────────────────────────┐
          │     Local Encrypted Storage           │
          │  localStorage + AES-256-GCM           │
          │  (无明文 API Key，无第三方服务器)      │
          └─────────────────────────────────────┘
```

### 技术栈

- 前端：原生 HTML / CSS / JavaScript（无需构建步骤，直接打开或 Electron 加载）
- 图表：ECharts 5.5（本地内置 `echarts.min.js`）
- 加密：Web Crypto API（PBKDF2-SHA256 + AES-256-GCM）
- 桌面：Electron 28 + electron-builder

### 目录结构

```
KeyVault AI/
├── index.html          # SPA 外壳：Setup / Lock / Main(Sidebar + 六视图 + 弹窗)
├── style.css           # KeyVault AI 设计系统（Design Tokens / 主题 / 基础组件）
├── app2.css            # KeyVault AI 扩展样式（侧边栏 / 多视图 / 卡片 / 图表 / 弹窗）
├── main.js             # Electron 主进程
├── gen-icon.js         # 应用图标生成（sharp，矢量深棕 V 字标）
├── echarts.min.js      # 本地图表库
├── icon-vault-md-*.png # 应用图标（由 gen-icon.js 生成，全尺寸）
├── js/
│   ├── crypto.js       # 安全核心：工具函数 / C(PBKDF2+AES-GCM) / S(存储) / GL(手势)
│   ├── analytics.js    # 统一数据层：Provider 识别 / 日志 / 统计 / 安全评分 / Demo
│   ├── playground.js   # 真实 API 请求（fetch + Bearer，记录用量）
│   └── app.js          # 应用主逻辑：导航 / 视图渲染 / 事件
└── uml/                # 原项目 UML（class / state / sequence / component / data-flow）
```

> 采用渐进式重构：未移动原文件结构，新增模块以 `js/` 子文件挂载，原有安全逻辑保持原位并完整复用。

---

## Security Architecture

```
Master Password
   └─ PBKDF2 (SHA-256, 100k iterations)
         └─ Derived Key (AES-256-GCM)
               ├─ 加密 Vault 配置中的验证值 (TV)
               └─ 加密每个 API Key (ek = {c, i})

Gesture Pattern
   └─ SHA-256 哈希存储（仅哈希，不可逆推）
   └─ PBKDF2 → 派生密钥 → 加密「Derived Key 的包装密钥」（wrappedKey）

No-Lock Access（免密访问，可选关闭）
   └─ 固定派生盐 → 派生密钥 → 加密主密钥包装（noLockWrapped）
```

**永不存储**：明文 API Key、Authorization 头、Bearer Token、完整请求体 / Prompt 内容。

---

## Encryption

| 环节 | 算法 | 说明 |
|------|------|------|
| 密钥派生 | PBKDF2-SHA256 | 100,000 迭代，每 Vault 独立随机盐 |
| 对称加密 | AES-256-GCM | 12 字节随机 IV，认证加密（防篡改） |
| 密码哈希 | SHA-256 | 仅用于快速校验，不存明文 |
| 手势 | SHA-256 + PBKDF2 | 存哈希与包装密钥，不存图案本身 |

加密后的数据以 `{c: base64(ciphertext), i: base64(iv)}` 形式写入 `localStorage`，**明文 Key 不会出现在任何存储中**。

---

## Data Model

```js
// 配置（vault_config）
{
  pwHash,            // SHA-256(主密码)
  pwSalt, keySalt,   // base64 派生盐
  test,              // AES-GCM 加密的验证值 {c,i}
  gestureEnabled, gestureHash, gestureSalt, wrappedKey,  // 手势（可选）
  noLock, noLockWrapped,                    // 免密访问（可选）
  analyticsEnabled, activityEnabled, dataRetentionDays, autoLock,
  pwHint,             // 仅用于强度提示，不存明文密码
  demoData           // 是否处于 Demo 模式
}

// 加密 Key 数据（vault_data）每项
{ id, name, ek:{c,i}, url, notes, provider, env, tags[], status,
  createdAt, updatedAt, lastUsed, requestCount }

// 使用日志（vault_usage_logs）— 仅保存 keyId，绝不保存明文 Key
{ id, timestamp, provider, keyId, model, endpoint,
  status, latency, promptTokens, completionTokens, totalTokens, demo? }

// 活动日志（vault_activity）
{ id, timestamp, type, keyId, metadata }
```

**活动类型**：`key_added` / `key_updated` / `key_deleted` / `key_copied` / `key_rotated` /
`api_request` / `api_success` / `api_failed` / `key_tested` / `login` /
`logout` / `vault_locked` / `vault_unlocked` / `gesture_set` / `gesture_reset` /
`pw_changed` / `settings_changed` / `export` / `import` / `reset` / `demo`。

---

## Dashboard

默认进入页。5 秒内能看清：Key 数量、使用状态、使用情况、潜在风险。

- **Overview Cards**：Total API Keys / Providers / Active Keys / API Requests(本月) / Security Score（真实规则计算）。
- **API Usage**：折线图（Requests / Successful / Failed），支持 Today / 7 Days / 30 Days。
- **Provider Analytics**：按请求量排序的 Provider 占比，点击查看详情（请求 / Token / 成功率 / 最近使用）。
- **Recent Activity**：来自真实本地事件日志，非伪造。

无数据时显示空状态，引导用户去 Playground 发起第一次请求。

---

## Usage Tracking

独立 Usage 页，数据全部来自真实请求日志：

- Overview：Total Requests / Success Rate / Failed / Total Tokens / Avg Latency
- Request Trend：折线图（按天）
- Token Usage：柱状图（Prompt / Completion / Total）
- Provider / Model Usage：饼图 / 列表
- Request History：表格，支持搜索、状态筛选、时间倒序

**诚实原则**：若用户尚未发起请求，页面显示「No usage data」，并提示去 Playground。
Demo Data 会在 UI 顶部明确标记 `Demo Data`，与真实数据严格区分。

---

## Playground

真实 API 调试器：

1. 选择 Provider / API Key / Model
2. 填写 Endpoint（默认填充 Provider 官方地址）
3. 输入 System / User Prompt
4. 点击 Send

请求通过 `fetch` 直达 Provider，**不经过任何中间服务器**。成功后自动：
- 解析 Token 用量（Prompt / Completion / Total）与延迟、状态码
- 写入 `usage_logs`（仅 `keyId`）
- 写入 `activity_logs`
- 更新该 Key 的 `lastUsed` 与 `requestCount`

错误给出具体信息（如 `401 / 网络错误 / 无法连接 Provider`），而非笼统提示。

---

## Security Center

基于真实规则的安全评分（100 分制，逐项扣分）：

- Vault 加密已启用（AES-256-GCM）
- 主密码保护（PBKDF2 100k）
- API Key 已加密存储
- 自动锁定（Auto Lock）状态
- 手势解锁状态
- 主密码强度
- Key 轮换（>90 天未轮换告警）
- 长期未使用 Key（>90 天无成功请求）

**Risk Detection**：弱密码、陈旧 Key、未使用 Key、频繁复制（泄露风险）、免密访问开启等，按 Critical/High/Medium/Low 分级，点击查看建议。

**Key Rotation**：引导用户在 Provider 后台创建新 Key → 加入 Vault → Playground 验证 → 旧 Key 标记 Deprecated → 删除旧 Key。KeyVault AI 不会替用户修改第三方平台。

---

## Electron

主进程 `main.js`（`nodeIntegration: true` 以便导出 Excel 时 `require('xlsx')`）：

- `npm start`：加载 `index.html`，窗口 1200×800。
- `npm run build:win` / `npm run build:portable`：electron-builder 生成 Windows 便携版（`KeyVaultAI.exe`）。

> 数据全部留在本地 `localStorage`，不上传任何服务器。

---

## Installation

```bash
# 1. 安装依赖
npm install

# 2.（构建图标，可选，build 前需要）
node gen-icon.js

# 3. 启动开发版
npm start
```

---

## Development

直接编辑 `index.html` / `app2.css` / `js/*.js` 即可，无需构建步骤。
改完刷新窗口（或重启 `npm start`）即可生效。

测试逻辑层（不依赖浏览器 DOM）：

```bash
node test_logic.js   # 加密往返 / Provider 识别 / 统计 / 安全评分
```

---

## Build

```bash
# Windows 便携版
npm run build:win
# 产物：dist/KeyVaultAI.exe
```

构建前确保已生成图标文件 `icon-vault-md-256.png`（`node gen-icon.js`）。

---

## Screenshots

截图统一放置于 `screenshots/` 目录，命名规范：

```
screenshots/
├── 01-cover.png          # 封面（Dashboard 总览）
├── 02-dashboard.png
├── 03-api-keys.png
├── 04-add-key.png
├── 05-key-detail.png
├── 06-playground.png
├── 07-usage-analytics.png
├── 08-security-center.png
├── 09-activity.png
└── 10-settings.png
```

> ⚠️ **截图安全准则**：所有截图必须先在「设置 → Demo Data」模式下生成，并确保画面中**不出现任何真实 API Key、主密码或 Token**。README 首页优先展示 Dashboard，其次 API Keys / Playground / Analytics / Security Center。

---

## Credits

This project is a redesign and feature extension inspired by the original **Vault** project by **jzt-Tesla**.

- Original project: [github.com/jzt-Tesla/vault](https://github.com/jzt-Tesla/vault)
- The original project is licensed under **MIT**.

KeyVault AI 在保留原项目 AES-256-GCM / PBKDF2 安全核心的基础上，进行了产品重构与功能扩展（Usage Analytics、API Playground、Security Center、Activity、Key Detail 等）。**请勿将原项目的实现据为己有**——本项目的二次设计与扩展部分在 MIT 许可下复用并发展自原项目。

---

## Roadmap

- [ ] 导入 / 导出加密备份的「导入」流程补全
- [ ] 多 Vault / 多用户配置
- [ ] 用量异常告警（阈值 / 突增检测）
- [ ] 自定义 Provider 与自定义 Endpoint 预设
- [ ] 用量数据 CSV/JSON 导出
- [ ] 浏览器扩展版本（同源加密核心复用）
- [ ] 跨设备端到端加密同步（可选，默认关闭）

---

## License

MIT
