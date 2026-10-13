/* ============================================================
   KeyVault AI — 作品集级产品流程图
   数据驱动渲染：节点 + 连线 → 绝对定位 HTML 节点 + SVG 连线层
   设计语言复用原型：字体栈 / 圆角 / 间距 / 卡片风格
   视觉：浅色编辑风（Minimal / Editorial）· 全中文 + 详细解释
   ============================================================ */

/* ---------- 设计 token（与 prototype/assets/style.css 一致的结构，浅色编辑配色） ---------- */
const T = {
  bg:        '#F6F4EF',
  card:      '#FFFFFF',
  cardSoft:  '#FCFAF6',
  text:      '#1F1F1D',
  muted:     '#6F6C66',
  border:    '#E4E0D8',
  borderMid: '#B8AFA2',
  borderLt:  '#ECE7DE',
  accent:    '#B5764A',   /* 低饱和暖陶土色，仅用于核心闭环强调 */
  accentSoft:'#F0E6DC',
  edge:      '#CFC8BC',   /* 普通连线 */
  edgeLt:    '#E0D9CD',   /* 细分支/扇出 */
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'
};

/* ---------- 节点点击跳转映射（全部指向真实存在的 app.html?view= 页面） ---------- */
const LINK = {
  unlock:    '../app.html?locked=1',
  dashboard: '../app.html?view=dashboard',
  apikeys:   '../app.html?view=apikeys',
  addkey:    '../app.html?view=addkey',
  keydetail: '../app.html?view=keydetail',
  playground:'../app.html?view=playground',
  apirequest:'../app.html?view=requestdetail',
  usagelog:  '../app.html?view=usage',
  analytics: '../app.html?view=usage',
  security:  '../app.html?view=security',
  activity:  '../app.html?view=activity',
  settings:  '../app.html?view=settings'
};

/* ============================================================
   图数据
   node: {id,x,y,w,h,level,label,sub,desc}
   edge: {from,to,kind,bow,accent,light,c1,c2,sa,sea,label}
   ============================================================ */

const D = {};

/* ---------- 01 完整产品流程图 ---------- */
D.full = {
  w: 1500, h: 1200,
  zones: [
    { no:'01', name:'进入与总览',     x:40,  y:24 },
    { no:'02', name:'密钥管理',       x:40,  y:300 },
    { no:'03', name:'使用与分析',     x:560, y:300 },
    { no:'04', name:'安全防护',       x:1040,y:300 }
  ],
  nodes: [
    { id:'unlock',    x:600, y:60,  w:240, h:56, level:2, label:'解锁保险库',
      desc:'输入主密码解锁本地保险库，数据全程不出本机。' },
    { id:'dashboard', x:570, y:170, w:300, h:80, level:1, label:'总览看板',
      sub:'产品中枢 · 密钥 / 请求 / 安全评分',
      desc:'整个产品的中心节点：一眼可见密钥总量、服务商、请求数、安全评分与近期活动，并分发到四大核心区域。' },

    { id:'apikeys',   x:60,  y:320, w:280, h:74, level:1, label:'API 密钥',
      sub:'掩码列表 · 搜索 / 筛选',
      desc:'管理已存储的 API 密钥。每个密钥默认掩码、本地加密、安全存储——强调“安全保存”而非单纯的增删改查。' },
    { id:'addkey',    x:80,  y:450, w:240, h:54, level:2, label:'添加密钥',
      desc:'选择服务商 → 密钥名称 → API Key → 环境 → 模型 → 标签 → 安全保存。' },
    { id:'keydetail', x:80,  y:540, w:240, h:54, level:2, label:'密钥详情',
      desc:'单密钥视图：元数据、用量概览、近 7 天趋势与活动记录。' },
    { id:'kd_reveal', x:360, y:506, w:150, h:42, level:3, label:'显示 / 复制',
      desc:'临时显示或复制被掩码的密钥明文。' },
    { id:'kd_usage',  x:360, y:552, w:150, h:42, level:3, label:'用量概览',
      desc:'该密钥产生的请求数与 Token 消耗。' },
    { id:'kd_trend',  x:360, y:598, w:150, h:42, level:3, label:'用量趋势',
      desc:'该密钥近 7 天的请求趋势。' },
    { id:'kd_rotate', x:360, y:644, w:150, h:42, level:3, label:'轮换密钥',
      desc:'轮换密钥而不丢失历史记录。' },
    { id:'kd_delete', x:360, y:690, w:150, h:42, level:3, label:'删除密钥',
      desc:'输入名称二次确认的不可逆删除。' },

    { id:'playground',x:580, y:320, w:280, h:74, level:1, label:'API 测试台',
      sub:'配置并发送真实请求',
      desc:'用安全存储的密钥配置并发送 API 请求。' },
    { id:'cf_provider',x:440,y:430, w:104, h:42, level:3, label:'选择服务商',
      desc:'选择本次请求调用的服务商。' },
    { id:'cf_key',    x:554, y:430, w:104, h:42, level:3, label:'选择密钥',
      desc:'选择已存储、掩码的密钥。' },
    { id:'cf_model',  x:668, y:430, w:104, h:42, level:3, label:'选择模型',
      desc:'选择要调用的模型。' },
    { id:'cf_prompt', x:782, y:430, w:104, h:42, level:3, label:'提示词',
      desc:'系统提示词与用户提示词。' },
    { id:'cf_run',    x:896, y:430, w:104, h:42, level:3, label:'发送请求',
      desc:'向服务商发起真实请求。' },
    { id:'apirequest',x:580,y:520, w:280, h:56, level:2, label:'API 请求',
      sub:'状态 · 延迟 · Tokens · 响应',
      desc:'一次 API 调用；响应展示状态码、延迟、Token 用量与返回内容。' },
    { id:'usagelog',  x:580, y:610, w:280, h:56, level:2, label:'用量日志',
      desc:'每一次请求都在本地被记录，用于后续用量分析。' },
    { id:'analytics', x:570, y:710, w:300, h:76, level:1, label:'用量分析',
      sub:'数据反馈 · 趋势 / 服务商 / 模型',
      desc:'将请求行为转化为可执行的用量洞察。' },

    { id:'security',  x:1100,y:320, w:280, h:74, level:1, label:'安全中心',
      sub:'评分 · 检查 · 轮换',
      desc:'保险库的安全评分与加固建议。' },
    { id:'secscore',  x:1120,y:450, w:240, h:54, level:2, label:'安全评分',
      desc:'由加密、锁定与密钥卫生检查综合得出的评分。' },
    { id:'sc_enc',    x:1050,y:520, w:110, h:42, level:3, label:'加密',
      desc:'本地 AES-256-GCM 加密。' },
    { id:'sc_pwd',    x:1180,y:520, w:110, h:42, level:3, label:'主密码',
      desc:'强主密码策略。' },
    { id:'sc_lock',   x:1310,y:520, w:110, h:42, level:3, label:'自动锁定',
      desc:'闲置后自动锁定。' },
    { id:'sc_store',  x:1050,y:572, w:110, h:42, level:3, label:'本地存储',
      desc:'密钥仅存于本机。' },
    { id:'sc_rot',    x:1180,y:572, w:110, h:42, level:3, label:'密钥轮换',
      desc:'定期轮换密钥。' },
    { id:'sc_unused', x:1310,y:572, w:110, h:42, level:3, label:'闲置密钥',
      desc:'标记并清理长期未用的密钥。' },
    { id:'seccrec',   x:1120,y:660, w:240, h:54, level:2, label:'安全建议',
      desc:'可执行建议：轮换、开启自动锁定、更新主密码。' },
    { id:'secstatus', x:1120,y:750, w:240, h:54, level:2, label:'安全状态',
      desc:'用户操作后的安全态势结果。' },

    { id:'activity',  x:560, y:940, w:260, h:56, level:2, label:'活动日志',
      desc:'本地审计日志：密钥增删改、复制、请求、轮换、锁定等事件。' },
    { id:'ac1', x:60,  y:1030, w:130, h:40, level:3, label:'新增密钥', desc:'审计：创建了密钥。' },
    { id:'ac2', x:200, y:1030, w:130, h:40, level:3, label:'编辑密钥', desc:'审计：编辑了密钥。' },
    { id:'ac3', x:340, y:1030, w:130, h:40, level:3, label:'API 请求', desc:'审计：发送了一次请求。' },
    { id:'ac4', x:480, y:1030, w:130, h:40, level:3, label:'轮换密钥', desc:'审计：轮换了密钥。' },
    { id:'ac5', x:620, y:1030, w:130, h:40, level:3, label:'已锁定',   desc:'审计：保险库被锁定。' },
    { id:'settings',  x:860, y:940, w:260, h:56, level:2, label:'设置',
      desc:'安全偏好、外观、数据留存与关于。' },
    { id:'st1', x:880,  y:1030, w:130, h:40, level:3, label:'安全',   desc:'安全相关偏好。' },
    { id:'st2', x:1015, y:1030, w:130, h:40, level:3, label:'外观',   desc:'主题与密度。' },
    { id:'st3', x:1150, y:1030, w:130, h:40, level:3, label:'数据',   desc:'留存周期与导出。' },
    { id:'st4', x:1285, y:1030, w:130, h:40, level:3, label:'关于',   desc:'版本与署名。' }
  ],
  edges: [
    { from:'unlock', to:'dashboard', kind:'down' },
    { from:'dashboard', to:'apikeys',   kind:'curve', accent:true, sa:'left:0.45', sea:'top', c1:[340,206], c2:[200,250] },
    { from:'apikeys',   to:'playground',kind:'right', accent:true },
    { from:'playground',to:'apirequest',kind:'down',  accent:true },
    { from:'apirequest',to:'usagelog',  kind:'down',  accent:true },
    { from:'usagelog',  to:'analytics', kind:'down',  accent:true },
    { from:'analytics', to:'dashboard', kind:'curve', accent:true, sa:'bottom', sea:'right:0.35', c1:[1120,786], c2:[1120,198] },
    { from:'dashboard', to:'security', kind:'curve', sa:'right:0.1', sea:'top', c1:[1020,180], c2:[1240,250] },
    { from:'secstatus',to:'dashboard', kind:'via',   light:true, dashed:true, sa:'right', sea:'right:0.875', via:[[1452,777],[1452,240]] },
    { from:'apikeys',   to:'addkey',    kind:'down' },
    { from:'addkey',    to:'keydetail', kind:'down' },
    { from:'keydetail', to:'kd_reveal', kind:'right', light:true },
    { from:'keydetail', to:'kd_usage',  kind:'right', light:true },
    { from:'keydetail', to:'kd_trend',  kind:'right', light:true },
    { from:'keydetail', to:'kd_rotate', kind:'right', light:true },
    { from:'keydetail', to:'kd_delete', kind:'right', light:true },
    { from:'playground',to:'cf_provider',kind:'down' },
    { from:'cf_provider',to:'cf_key',   kind:'right', light:true },
    { from:'cf_key',    to:'cf_model',  kind:'right', light:true },
    { from:'cf_model',  to:'cf_prompt', kind:'right', light:true },
    { from:'cf_prompt', to:'cf_run',    kind:'right', light:true },
    { from:'cf_run',    to:'apirequest',kind:'down' },
    { from:'security',  to:'secscore',  kind:'down' },
    { from:'secscore',  to:'sc_enc',    kind:'down', light:true },
    { from:'secscore',  to:'sc_pwd',    kind:'down', light:true },
    { from:'secscore',  to:'sc_lock',   kind:'down', light:true },
    { from:'sc_enc',    to:'sc_store',  kind:'down', light:true },
    { from:'sc_pwd',    to:'sc_rot',    kind:'down', light:true },
    { from:'sc_lock',   to:'sc_unused', kind:'down', light:true },
    { from:'secscore',  to:'seccrec',   kind:'down' },
    { from:'seccrec',   to:'secstatus', kind:'down' },
    { from:'activity',  to:'dashboard', kind:'via',   light:true, dashed:true, sa:'left', sea:'left:0.15', via:[[24,968],[24,182]] },
    { from:'settings',  to:'dashboard', kind:'via',   light:true, dashed:true, sa:'right', sea:'right:0.6', via:[[1476,968],[1476,218]] },
    { from:'activity',  to:'ac1', kind:'down', light:true },
    { from:'activity',  to:'ac2', kind:'down', light:true },
    { from:'activity',  to:'ac3', kind:'down', light:true },
    { from:'activity',  to:'ac4', kind:'down', light:true },
    { from:'activity',  to:'ac5', kind:'down', light:true },
    { from:'settings',  to:'st1', kind:'down', light:true },
    { from:'settings',  to:'st2', kind:'down', light:true },
    { from:'settings',  to:'st3', kind:'down', light:true },
    { from:'settings',  to:'st4', kind:'down', light:true }
  ]
};

/* ---------- 02 作品集流程（简版，一页可放） ---------- */
D.portfolio = {
  w: 1120, h: 720,
  nodes: [
    { id:'unlock',    x:440, y:36,  w:240, h:54, level:2, label:'解锁保险库',
      desc:'主密码解锁本地保险库。' },
    { id:'dashboard', x:410, y:130, w:300, h:74, level:1, label:'总览看板',
      sub:'产品中枢', desc:'产品中心，分发到各核心区域。' },
    { id:'apikeys',   x:60,  y:300, w:240, h:64, level:1, label:'API 密钥',
      desc:'管理掩码、本地加密的密钥。' },
    { id:'playground',x:440, y:300, w:240, h:64, level:1, label:'API 测试台',
      desc:'用已存密钥配置并发送请求。' },
    { id:'security',  x:820, y:300, w:240, h:64, level:1, label:'安全中心',
      desc:'保险库的评分与加固。' },
    { id:'apirequest',x:455, y:430, w:210, h:54, level:2, label:'API 请求',
      desc:'一次调用：状态、延迟、Token。' },
    { id:'usagelog',  x:455, y:520, w:210, h:54, level:2, label:'用量日志',
      desc:'每次请求在本地被记录。' },
    { id:'analytics', x:420, y:614, w:280, h:64, level:1, label:'用量分析',
      sub:'数据反馈', desc:'把活动转化为用量洞察。' }
  ],
  edges: [
    { from:'unlock',    to:'dashboard', kind:'down' },
    { from:'dashboard', to:'apikeys',   kind:'curve', accent:true, sa:'left', sea:'top', c1:[300,167], c2:[180,230] },
    { from:'apikeys',   to:'playground',kind:'right', accent:true },
    { from:'playground',to:'apirequest',kind:'down',  accent:true },
    { from:'apirequest',to:'usagelog',  kind:'down',  accent:true },
    { from:'usagelog',  to:'analytics', kind:'down',  accent:true },
    { from:'analytics', to:'dashboard', kind:'curve', accent:true, sa:'bottom', sea:'right:0.35', c1:[1050,678], c2:[1050,156] },
    { from:'dashboard', to:'security',  kind:'curve', light:true, sa:'right:0.1', sea:'top', c1:[790,138], c2:[940,240] },
    { from:'security',  to:'dashboard', kind:'via',   light:true, dashed:true, sa:'right', sea:'right:0.75', via:[[1096,332],[1096,186]] }
  ]
};

/* ---------- 03 核心数据闭环 ---------- */
D.core = {
  w: 1040, h: 660,
  nodes: [
    { id:'dashboard',  x:370, y:40,  w:300, h:80, level:1, label:'总览看板',
      sub:'产品中枢', desc:'指标与闭环的入口/出口。' },
    { id:'apikeys',    x:40,  y:240, w:260, h:74, level:1, label:'API 密钥',
      desc:'密钥被安全管理之处。' },
    { id:'playground', x:740, y:240, w:260, h:74, level:1, label:'API 测试台',
      desc:'请求被发出之处。' },
    { id:'apirequest', x:740, y:450, w:260, h:74, level:1, label:'API 请求',
      desc:'一次真实 API 调用。' },
    { id:'usagelog',   x:40,  y:450, w:260, h:74, level:1, label:'用量日志',
      desc:'每次请求在本地被记录。' },
    { id:'analytics',  x:370, y:560, w:300, h:80, level:1, label:'用量分析',
      sub:'数据反馈', desc:'洞察回流到总览看板。' }
  ],
  edges: [
    { from:'dashboard',  to:'apikeys',    kind:'curve', accent:true, sa:'left:0.4', sea:'top', c1:[280,72], c2:[170,170] },
    { from:'apikeys',    to:'playground', kind:'right', accent:true },
    { from:'playground', to:'apirequest', kind:'down',  accent:true },
    { from:'apirequest', to:'usagelog',   kind:'left',  accent:true },
    { from:'usagelog',   to:'analytics',  kind:'curve', accent:true, sa:'bottom', sea:'left:0.3', c1:[170,560], c2:[300,584] },
    { from:'analytics',  to:'dashboard',   kind:'via',   accent:true, sa:'left:0.75', sea:'left:0.1', via:[[16,620],[16,48]] }
  ]
};

/* ---------- 04 安全分支 ---------- */
D.security = {
  w: 1040, h: 600,
  nodes: [
    { id:'security',  x:370, y:40,  w:300, h:80, level:1, label:'安全中心',
      sub:'评分 · 检查 · 轮换', desc:'产品的安全枢纽。' },
    { id:'dashboard', x:720, y:40,  w:260, h:72, level:1, label:'总览看板',
      desc:'安全态势回流到中枢。' },
    { id:'secscore',  x:390, y:170, w:260, h:56, level:2, label:'安全评分',
      desc:'由全部检查综合得出。' },
    { id:'sc_enc',    x:45,  y:260, w:150, h:42, level:3, label:'加密',     desc:'本地 AES-256-GCM。' },
    { id:'sc_pwd',    x:205, y:260, w:150, h:42, level:3, label:'主密码',   desc:'强密码策略。' },
    { id:'sc_lock',   x:365, y:260, w:150, h:42, level:3, label:'自动锁定', desc:'闲置自动锁定。' },
    { id:'sc_store',  x:525, y:260, w:150, h:42, level:3, label:'本地存储', desc:'仅设备端存储。' },
    { id:'sc_rot',    x:685, y:260, w:150, h:42, level:3, label:'密钥轮换', desc:'定期轮换。' },
    { id:'sc_unused', x:845, y:260, w:150, h:42, level:3, label:'闲置密钥', desc:'清理陈旧密钥。' },
    { id:'seccrec',   x:390, y:360, w:260, h:56, level:2, label:'安全建议',
      desc:'轮换、开启自动锁定、更新密码。' },
    { id:'secstatus', x:390, y:450, w:260, h:56, level:2, label:'安全状态',
      desc:'操作后的态势结果。' }
  ],
  edges: [
    { from:'security',  to:'dashboard', kind:'right', light:true },
    { from:'security',  to:'secscore',  kind:'down' },
    { from:'secscore',  to:'sc_enc',    kind:'down', light:true },
    { from:'secscore',  to:'sc_pwd',    kind:'down', light:true },
    { from:'secscore',  to:'sc_lock',   kind:'down', light:true },
    { from:'secscore',  to:'sc_store',  kind:'down', light:true },
    { from:'secscore',  to:'sc_rot',    kind:'down', light:true },
    { from:'secscore',  to:'sc_unused', kind:'down', light:true },
    { from:'secscore',  to:'seccrec',   kind:'down' },
    { from:'seccrec',   to:'secstatus', kind:'down' },
    { from:'secstatus', to:'dashboard', kind:'curve', accent:true, sa:'right', sea:'bottom', c1:[700,478], c2:[850,240] }
  ]
};

/* ---------- 05 活动 / 设置 辅助分支 ---------- */
D.activity = {
  w: 1040, h: 500,
  nodes: [
    { id:'activity',  x:60,  y:60,  w:260, h:56, level:2, label:'活动日志',
      desc:'每个保险库事件的本地审计日志。' },
    { id:'ac1', x:45,  y:150, w:150, h:40, level:3, label:'新增密钥', desc:'密钥已创建。' },
    { id:'ac2', x:205, y:150, w:150, h:40, level:3, label:'删除密钥', desc:'密钥已删除。' },
    { id:'ac3', x:365, y:150, w:150, h:40, level:3, label:'API 请求', desc:'请求已发送。' },
    { id:'ac4', x:525, y:150, w:150, h:40, level:3, label:'轮换密钥', desc:'密钥已轮换。' },
    { id:'ac5', x:685, y:150, w:150, h:40, level:3, label:'已锁定',   desc:'保险库已锁定。' },
    { id:'ac6', x:845, y:150, w:150, h:40, level:3, label:'设置变更', desc:'偏好已更改。' },
    { id:'settings',  x:60,  y:300, w:260, h:56, level:2, label:'设置',
      desc:'安全 · 外观 · 数据 · 关于。' },
    { id:'st1', x:102, y:390, w:200, h:40, level:3, label:'安全',   desc:'安全偏好。' },
    { id:'st2', x:314, y:390, w:200, h:40, level:3, label:'外观',   desc:'主题与密度。' },
    { id:'st3', x:526, y:390, w:200, h:40, level:3, label:'数据',   desc:'留存与导出。' },
    { id:'st4', x:738, y:390, w:200, h:40, level:3, label:'关于',   desc:'版本与署名。' },
    { id:'dashboard', x:720, y:200, w:260, h:72, level:1, label:'总览看板',
      desc:'所有活动与设置回流到中枢。' }
  ],
  edges: [
    { from:'activity',  to:'ac1', kind:'down', light:true },
    { from:'activity',  to:'ac2', kind:'down', light:true },
    { from:'activity',  to:'ac3', kind:'down', light:true },
    { from:'activity',  to:'ac4', kind:'down', light:true },
    { from:'activity',  to:'ac5', kind:'down', light:true },
    { from:'activity',  to:'ac6', kind:'down', light:true },
    { from:'settings',  to:'st1', kind:'down', light:true },
    { from:'settings',  to:'st2', kind:'down', light:true },
    { from:'settings',  to:'st3', kind:'down', light:true },
    { from:'settings',  to:'st4', kind:'down', light:true },
    { from:'activity',  to:'dashboard', kind:'via',   light:true, dashed:true, sa:'bottom', sea:'left:0.28', via:[[190,220]] },
    { from:'settings',  to:'dashboard', kind:'via',   light:true, dashed:true, sa:'right',  sea:'bottom:0.2', via:[[560,328],[772,328]] }
  ]
};

/* ---------- 06 核心使用逻辑流程图（经典判定式：蓝处理框 + 橙判断菱形 + 是/否分支） ---------- */
D.logic = {
  w: 1000, h: 1620,
  nodes: [
    { id:'title', x:90,  y:24,   w:680, h:54, cls:'lg-title', label:'KeyVault AI · 核心使用逻辑流程图', desc:'' },
    { id:'start', x:360, y:110,  w:140, h:44, cls:'lg-pill', label:'开始', desc:'' },
    { id:'launch', x:325, y:186, w:210, h:44, cls:'lg-proc', label:'启动 KeyVault',
      desc:'本地启动应用，数据全程不出本机。' },
    { id:'load', x:325, y:262, w:210, h:44, cls:'lg-proc', label:'加载本地加密数据',
      desc:'读取本机 AES-256-GCM 加密的保险库文件。' },
    { id:'unlock', x:325, y:338, w:210, h:44, cls:'lg-proc', label:'输入主密码',
      desc:'输入主密码以派生解密密钥。' },
    { id:'dPwd', x:325, y:414, w:210, h:84, cls:'shape-diamond', shape:'diamond', label:'密码是否正确？',
      desc:'PBKDF2 派生密钥解密失败则判定密码错误。' },
    { id:'err', x:650, y:434, w:180, h:44, cls:'lg-side', label:'显示错误提示',
      desc:'提示密码错误并显示剩余尝试次数。' },
    { id:'vault', x:325, y:530, w:210, h:44, cls:'lg-proc', label:'解密并解锁保险库',
      desc:'解密成功，进入已解锁状态。' },
    { id:'dashboard', x:325, y:606, w:210, h:44, cls:'lg-proc', label:'进入总览看板',
      desc:'查看密钥总量、请求数与安全评分。' },
    { id:'dKey', x:325, y:682, w:210, h:84, cls:'shape-diamond', shape:'diamond', label:'是否已有密钥？',
      desc:'检查保险库中是否存在已保存的 API 密钥。' },
    { id:'addkey', x:60, y:702, w:190, h:44, cls:'lg-proc', label:'添加并保存密钥',
      desc:'选择服务商，填写密钥后加密保存。' },
    { id:'playground', x:325, y:798, w:210, h:44, cls:'lg-proc', label:'进入 API 测试台',
      desc:'用安全存储的密钥配置并发送请求。' },
    { id:'config', x:325, y:874, w:210, h:44, cls:'lg-proc', label:'选择服务商 · 密钥 · 模型',
      desc:'从已存密钥中选择，填写提示词。' },
    { id:'send', x:325, y:950, w:210, h:44, cls:'lg-proc', label:'发送 API 请求',
      desc:'向服务商发起真实调用。' },
    { id:'dOk', x:325, y:1026, w:210, h:84, cls:'shape-diamond', shape:'diamond', label:'请求是否成功？',
      desc:'检查返回状态码与响应内容。' },
    { id:'apirequest', x:650, y:1046, w:180, h:44, cls:'lg-side', label:'查看错误详情',
      desc:'查看状态码、延迟与返回内容，调整后重试。' },
    { id:'usagelog', x:325, y:1142, w:210, h:44, cls:'lg-proc', label:'记录用量日志',
      desc:'请求的 Token 用量与耗时在本地留痕。' },
    { id:'analytics', x:310, y:1218, w:240, h:44, cls:'lg-proc', label:'更新用量分析与安全评分',
      desc:'数据回流，形成趋势洞察与安全评分。' },
    { id:'dSec', x:325, y:1294, w:210, h:84, cls:'shape-diamond', shape:'diamond', label:'是否存在安全风险？',
      desc:'如弱主密码、长期未轮换、闲置密钥等。' },
    { id:'security', x:650, y:1314, w:180, h:44, cls:'lg-side', label:'生成安全建议',
      desc:'给出可执行建议：轮换、自动锁定、更新密码。' },
    { id:'dIdle', x:325, y:1410, w:210, h:84, cls:'shape-diamond', shape:'diamond', label:'是否闲置超时？',
      desc:'达到设置页配置的自动锁定时长。' },
    { id:'settings', x:650, y:1430, w:180, h:44, cls:'lg-proc', label:'自动锁定保险库',
      desc:'重新上锁，需主密码再次解锁。' },
    { id:'end', x:360, y:1540, w:140, h:44, cls:'lg-pill', label:'结束 · 已锁定', desc:'' }
  ],
  edges: [
    { from:'start',    to:'launch',    kind:'down', cl:'#8FA9C9' },
    { from:'launch',   to:'load',      kind:'down', cl:'#8FA9C9' },
    { from:'load',     to:'unlock',    kind:'down', cl:'#8FA9C9' },
    { from:'unlock',   to:'dPwd',      kind:'down', cl:'#8FA9C9' },
    { from:'dPwd',     to:'err',       kind:'right', cl:'#8FA9C9', label:'否', lx:592, ly:447 },
    { from:'err',      to:'unlock',    kind:'via', cl:'#8FA9C9', dashed:true, sa:'top', sea:'right', via:[[710,360]] },
    { from:'dPwd',     to:'vault',     kind:'down', cl:'#8FA9C9', label:'是', lx:446, ly:521 },
    { from:'vault',    to:'dashboard', kind:'down', cl:'#8FA9C9' },
    { from:'dashboard',to:'dKey',      kind:'down', cl:'#8FA9C9' },
    { from:'dKey',     to:'addkey',    kind:'left', cl:'#8FA9C9', label:'否', lx:287, ly:715 },
    { from:'addkey',   to:'playground',kind:'via', cl:'#8FA9C9', sa:'bottom', sea:'left', via:[[155,820]] },
    { from:'dKey',     to:'playground',kind:'down', cl:'#8FA9C9', label:'是', lx:446, ly:789 },
    { from:'playground',to:'config',   kind:'down', cl:'#8FA9C9' },
    { from:'config',   to:'send',      kind:'down', cl:'#8FA9C9' },
    { from:'send',     to:'dOk',       kind:'down', cl:'#8FA9C9' },
    { from:'dOk',      to:'apirequest',kind:'right', cl:'#8FA9C9', label:'否', lx:592, ly:1059 },
    { from:'apirequest',to:'send',     kind:'via', cl:'#8FA9C9', dashed:true, sa:'top', sea:'right', via:[[710,972]] },
    { from:'dOk',      to:'usagelog',  kind:'down', cl:'#8FA9C9', label:'是', lx:446, ly:1133 },
    { from:'usagelog', to:'analytics', kind:'down', cl:'#8FA9C9' },
    { from:'analytics',to:'dSec',      kind:'down', cl:'#8FA9C9' },
    { from:'dSec',     to:'security',  kind:'right', cl:'#8FA9C9', label:'是', lx:592, ly:1327 },
    { from:'security', to:'dashboard', kind:'via', cl:'#8FA9C9', dashed:true, sa:'right', sea:'right', via:[[900,1336],[900,628]] },
    { from:'dSec',     to:'dIdle',     kind:'down', cl:'#8FA9C9', label:'否', lx:446, ly:1401 },
    { from:'dIdle',    to:'settings',  kind:'right', cl:'#8FA9C9', label:'是', lx:592, ly:1443 },
    { from:'settings', to:'end',       kind:'via', cl:'#8FA9C9', sa:'bottom', sea:'right', via:[[740,1562]] },
    { from:'dIdle',    to:'dashboard', kind:'via', cl:'#8FA9C9', dashed:true, sa:'left', sea:'left', via:[[30,1452],[30,628]], label:'否 · 继续使用', lx:150, ly:1440 }
  ]
};

/* ============================================================
   渲染器
   ============================================================ */
const SVGNS = 'http://www.w3.org/2000/svg';

function anchor(n, sideSpec){
  /* 支持 'side:frac' 分数锚点，如 'left:0.25' / 'bottom:0.8'，
     让多条连线在同一节点同一边错开进出，避免端点重叠 */
  const parts = String(sideSpec).split(':');
  const side = parts[0];
  const f = parts[1] !== undefined ? parseFloat(parts[1]) : 0.5;
  switch(side){
    case 'top':    return { x: n.x + n.w*f, y: n.y };
    case 'bottom': return { x: n.x + n.w*f, y: n.y + n.h };
    case 'left':   return { x: n.x, y: n.y + n.h*f };
    case 'right':  return { x: n.x + n.w, y: n.y + n.h*f };
  }
  return { x: n.x + n.w/2, y: n.y + n.h/2 };
}

/* 直角圆角折线路径：pts 为 [x,y] waypoints，拐角用二次贝塞尔圆角 */
function roundedPath(pts, r){
  r = r || 22;
  let d = 'M ' + pts[0][0] + ' ' + pts[0][1];
  for(let i = 1; i < pts.length - 1; i++){
    const x0 = pts[i-1][0], y0 = pts[i-1][1];
    const x1 = pts[i][0],   y1 = pts[i][1];
    const x2 = pts[i+1][0], y2 = pts[i+1][1];
    const l1 = Math.hypot(x1-x0, y1-y0), l2 = Math.hypot(x2-x1, y2-y1);
    const rr = Math.min(r, l1/2, l2/2);
    const ax = x1 - (x1-x0)/l1*rr, ay = y1 - (y1-y0)/l1*rr;
    const bx = x1 + (x2-x1)/l2*rr, by = y1 + (y2-y1)/l2*rr;
    d += ' L ' + ax + ' ' + ay + ' Q ' + x1 + ' ' + y1 + ' ' + bx + ' ' + by;
  }
  const last = pts[pts.length-1];
  d += ' L ' + last[0] + ' ' + last[1];
  return d;
}

function edgePath(e, from, to){
  let a, b, d;
  /* via：显式 waypoint 折线（圆角），用于沿画布边缘的回流/反馈线 */
  if(e.via){
    a = anchor(from, startSide(e));
    b = anchor(to,   endSide(e));
    const pts = [[a.x, a.y]].concat(e.via).concat([[b.x, b.y]]);
    return { d: roundedPath(pts), end: b };
  }
  if(e.c1 && e.c2){
    a = anchor(from, startSide(e));
    b = anchor(to,   endSide(e));
    d = `M ${a.x} ${a.y} C ${e.c1[0]} ${e.c1[1]} ${e.c2[0]} ${e.c2[1]} ${b.x} ${b.y}`;
    return { d, end: b };
  }
  switch(e.kind){
    case 'down':  a = anchor(from,'bottom'); b = anchor(to,'top');    d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`; break;
    case 'up':    a = anchor(from,'top');    b = anchor(to,'bottom'); d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`; break;
    case 'left':  a = anchor(from,'left');   b = anchor(to,'right');  d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`; break;
    case 'right': a = anchor(from,'right');  b = anchor(to,'left');   d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`; break;
    case 'curve': {
      a = anchor(from,'bottom'); b = anchor(to,'top');
      const dx = 70;
      d = `M ${a.x} ${a.y} C ${a.x} ${a.y+dx} ${b.x} ${b.y-dx} ${b.x} ${b.y}`;
      break;
    }
  }
  return { d, end: b };
}

function startSide(e){
  if(e.sa) return e.sa;
  if(e.c1 && e.c2) return 'bottom';
  if(e.kind==='down')  return 'bottom';
  if(e.kind==='up')    return 'top';
  if(e.kind==='left')  return 'left';
  if(e.kind==='right') return 'right';
  return 'bottom';
}
function endSide(e){
  if(e.sea) return e.sea;
  if(e.c1 && e.c2) return 'top';
  if(e.kind==='down')  return 'top';
  if(e.kind==='up')    return 'bottom';
  if(e.kind==='left')  return 'right';
  if(e.kind==='right') return 'left';
  return 'top';
}

function renderDiagram(mountId, key){
  const cfg = D[key];
  const mount = document.getElementById(mountId);
  mount.style.width = cfg.w + 'px';
  mount.style.height = cfg.h + 'px';
  mount.classList.add('flow-canvas');

  const map = {};
  cfg.nodes.forEach(n => map[n.id] = n);

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', cfg.w);
  svg.setAttribute('height', cfg.h);
  svg.setAttribute('viewBox', `0 0 ${cfg.w} ${cfg.h}`);
  svg.classList.add('flow-svg');

  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML = `
    <marker id="arw" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L7,3 L0,6 Z" fill="${T.edge}"></path>
    </marker>
    <marker id="arwL" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L6.5,3 L0,6 Z" fill="${T.edgeLt}"></path>
    </marker>
    <marker id="arwA" markerWidth="11" markerHeight="11" refX="8" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L8,3.5 L0,7 Z" fill="${T.accent}"></path>
    </marker>
    <marker id="arwB" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L7,3 L0,6 Z" fill="#8FA9C9"></path>
    </marker>`;
  svg.appendChild(defs);

  cfg.edges.forEach(e => {
    const from = map[e.from], to = map[e.to];
    if(!from || !to) return;
    const r = edgePath(e, from, to);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', r.d);
    let col, wdt, mk;
    if(e.accent){ col = T.accent; wdt = '2.6'; mk = 'url(#arwA)'; }
    else if(e.cl){ col = e.cl; wdt = e.dashed ? '1.5' : '1.6'; mk = 'url(#arwB)'; }
    else if(e.light){ col = e.dashed ? T.edge : T.edgeLt; wdt = e.dashed ? '1.5' : '1.4'; mk = 'url(#arwL)'; }
    else { col = T.edge; wdt = '1.6'; mk = 'url(#arw)'; }
    p.setAttribute('stroke', col);
    p.setAttribute('stroke-width', wdt);
    p.setAttribute('marker-end', mk);
    if(e.dashed) p.setAttribute('stroke-dasharray','7 6');
    p.setAttribute('fill','none');
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    svg.appendChild(p);
  });

  /* 连线标签（是/否 等分支标注，e.lx/e.ly 为画布绝对坐标） */
  cfg.edges.forEach(e => {
    if(!e.label) return;
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', e.lx);
    t.setAttribute('y', e.ly);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('class', 'flow-edge-label');
    t.setAttribute('style', 'paint-order:stroke;stroke:#F6F4EF;stroke-width:3px');
    t.textContent = e.label;
    svg.appendChild(t);
  });
  mount.appendChild(svg);

  if(cfg.zones){
    cfg.zones.forEach(z => {
      const d = document.createElement('div');
      d.className = 'flow-zone';
      d.style.left = z.x + 'px';
      d.style.top  = z.y + 'px';
      d.innerHTML = `<span class="zn">${z.no}</span><span class="zt">${z.name}</span>`;
      mount.appendChild(d);
    });
  }

  /* 菱形判断节点：SVG 多边形 + 透明 HTML 命中/文字层 */
  cfg.nodes.forEach(n => {
    if(n.shape !== 'diamond') return;
    const poly = document.createElementNS(SVGNS, 'polygon');
    poly.setAttribute('points',
      `${n.x + n.w/2},${n.y} ${n.x + n.w},${n.y + n.h/2} ${n.x + n.w/2},${n.y + n.h} ${n.x},${n.y + n.h/2}`);
    poly.setAttribute('fill', T.accentSoft);
    poly.setAttribute('stroke', T.accent);
    poly.setAttribute('stroke-width', '1.4');
    svg.appendChild(poly);
  });

  cfg.nodes.forEach(n => {
    const el = document.createElement('a');
    el.className = 'flow-node ' + (n.cls || ('lv' + n.level));
    el.style.left = n.x + 'px';
    el.style.top  = n.y + 'px';
    el.style.width  = n.w + 'px';
    el.style.height = n.h + 'px';
    const href = LINK[n.id] || '#';
    el.setAttribute('href', href);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
    el.dataset.desc = n.desc || '';
    el.innerHTML = `<span class="nl">${n.label}</span>` +
                   (n.sub ? `<span class="ns">${n.sub}</span>` : '');
    el.addEventListener('mouseenter', ev => showTip(ev, n));
    el.addEventListener('mousemove',  ev => moveTip(ev));
    el.addEventListener('mouseleave', hideTip);
    mount.appendChild(el);
  });
}

/* ---------- Tooltip ---------- */
let tip;
function ensureTip(){
  if(!tip){ tip = document.createElement('div'); tip.className = 'flow-tip'; document.body.appendChild(tip); }
  return tip;
}
function showTip(ev, n){
  const t = ensureTip();
  t.innerHTML = `<strong>${n.label}</strong><span>${n.desc || ''}</span>`;
  t.style.opacity = '1';
  moveTip(ev);
}
function moveTip(ev){
  if(!tip) return;
  let x = ev.clientX + 16, y = ev.clientY + 16;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  if(x + w > window.innerWidth)  x = ev.clientX - w - 16;
  if(y + h > window.innerHeight) y = ev.clientY - h - 16;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
function hideTip(){ if(tip) tip.style.opacity = '0'; }

/* ---------- 初始化 ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const only = params.get('diagram');
  const all = [
    ['d-full','full','sec-full'],
    ['d-portfolio','portfolio','sec-portfolio'],
    ['d-core','core','sec-core'],
    ['d-security','security','sec-security'],
    ['d-activity','activity','sec-activity'],
    ['d-logic','logic','sec-logic']
  ];
  if(only){
    const want = all.find(a => a[1] === only);
    all.forEach(a => { const s = document.getElementById(a[2]); if(s) s.style.display = (a[1]===only ? '' : 'none'); });
    const hero = document.querySelector('.hero'); if(hero) hero.style.display = 'none';
    const foot = document.querySelector('.foot'); if(foot) foot.style.display = 'none';
    if(want) renderDiagram(want[0], want[1]);
  } else {
    all.forEach(([m,k]) => renderDiagram(m,k));
  }
});
