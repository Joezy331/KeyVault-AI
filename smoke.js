/**
 * KeyVault AI — DOM 冒烟测试（jsdom）
 * 验证：setup → 加 Key → Dashboard → Demo → Playground 真实请求 → Usage → Security
 * 关键断言：localStorage 中绝不出现明文 API Key。
 */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const RES = p => path.join(__dirname, p);

(async () => {
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n); } };

  const vc = new VirtualConsole();
  let domErrors = [];
  vc.on('jsdomError', e => domErrors.push(e.message));

  const html = fs.readFileSync(RES('index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
  const { window } = dom;

  // —— 注入浏览器环境桩 ——
  Object.defineProperty(window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.performance = require('perf_hooks').performance;
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
  window.confirm = () => true;
  window.navigator.clipboard = { writeText: () => Promise.resolve() };
  window.URL.createObjectURL = () => 'blob:mock';
  window.URL.revokeObjectURL = () => {};
  // jsdom 无 canvas 2d 上下文，桩一个 no-op 以避免 GL 崩溃（非测试手势逻辑）
  window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
    set strokeStyle(v){}, set lineWidth(v){}, set lineCap(v){}, set lineJoin(v){}
  });

  // 在 window 全局作用域里求值（可见顶层 const 词法全局 C/S/A/keys 等）
  const ev = expr => window.eval(expr);

  // fetch 桩：模拟成功响应
  window.fetch = () => Promise.resolve({
    status: 200,
    text: () => Promise.resolve(JSON.stringify({
      choices: [{ message: { content: 'Hello from mock provider' } }],
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 }
    }))
  });

  // —— 顺序注入脚本（模拟浏览器多 <script> 标签的全局作用域）——
  for (const f of ['js/crypto.js', 'js/analytics.js', 'js/playground.js', 'js/app.js']) {
    const code = fs.readFileSync(RES(f), 'utf8');
    const s = window.document.createElement('script');
    s.textContent = code;
    window.document.body.appendChild(s);
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  ok('无脚本加载错误', domErrors.length === 0);
  ok('全局 C / S / A 词法全局存在', ev('typeof C') === 'object' && ev('typeof S') === 'object' && ev('typeof A') === 'object');
  ok('detectProvider 已定义', typeof window.detectProvider === 'function');

  ok('初始进入 Setup 屏', window.document.getElementById('setup-screen').classList.contains('active'));

  // —— 1. Setup（直接完成，跳过手势 canvas）——
  ev("setupPw='Password123!'");
  await window.finishSetup(null);
  ok('Setup 后进入主界面', window.document.getElementById('main-screen').classList.contains('active'));
  ok('配置已写入 (pwHash)', !!(ev('S.loadCfg()') && ev('S.loadCfg()').pwHash));

  // —— 2. 添加 API Key ——
  const PLAIN = 'sk-secret-plaintext-NEVER-IN-STORAGE';
  window.openAdd();
  window.document.getElementById('mn').value = 'OpenAI Prod';
  window.document.getElementById('mk').value = PLAIN;
  window.document.getElementById('mp').value = 'openai';
  window.document.getElementById('menv').value = 'Production';
  window.document.getElementById('mst').value = 'Active';
  window.document.getElementById('mtg').value = 'prod, core';
  const form = window.document.getElementById('kform');
  await window.saveKey({ preventDefault() {}, target: form });
  ok('Key 已添加 (keys.length=1)', ev('keys.length') === 1);

  const storedData = ev("JSON.stringify(S.loadData())");
  ok('vault_data 不含明文 API Key', !storedData.includes(PLAIN));
  ok('vault_data 为密文结构 {c,i}', /"ek":\{"c":"[^"]+","i":"[^"]+"\}/.test(storedData));

  // —— 3. Dashboard ——
  window.navView('dashboard');
  const dashCards = window.document.getElementById('dashCards').innerHTML;
  ok('Dashboard 渲染 密钥总数', dashCards.includes('密钥总数'));
  ok('Dashboard 渲染 安全评分', dashCards.includes('安全评分'));
  ok('Key 卡片网格渲染', window.document.getElementById('kg').innerHTML.includes('OpenAI Prod'));

  // —— 4. Provider 自动识别 ——
  ok('识别 Anthropic (High)', ev("detectProvider('sk-ant-abc123').provider") === 'anthropic' && ev("detectProvider('sk-ant-abc123').confidence") === 'High');
  ok('识别 OpenRouter (High)', ev("detectProvider('sk-or-xyz').provider") === 'openrouter');
  ok('Generic sk- 仅 Medium', ev("detectProvider('sk-generic').confidence") === 'Medium');

  // —— 5. Demo Data + Provider Analytics ——
  window.seedDemoData();
  ok('Demo 数据已生成', ev('S.loadUsageLogs().length') > 0);
  ok('Demo 数据已标记 demo:true', ev('S.loadUsageLogs().every(l=>l.demo===true)'));
  window.navView('dashboard');
  ok('Provider Analytics 渲染', window.document.getElementById('provList').innerHTML.includes('prov-row'));
  ok('Demo 横幅显示', window.document.getElementById('demoBannerDash').innerHTML.includes('Demo Data'));

  // —— 6. Playground 真实请求（走 fetch 桩）——
  window.navView('playground');   // 先初始化下拉框（注入 options）
  const before = ev('S.loadUsageLogs().length');
  window.document.getElementById('pgProvider').value = 'openai';
  window.onPgProviderChange();
  window.document.getElementById('pgKey').value = ev('keys[0].id');
  window.document.getElementById('pgEndpoint').value = 'https://api.openai.com/v1/chat/completions';
  window.document.getElementById('pgModel').value = 'GPT-4.1';
  window.document.getElementById('pgUser').value = 'hello';
  await window.runPlayground();
  const after = ev('S.loadUsageLogs().length');
  ok('Playground 产生 1 条 usage_log', after === before + 1);
  ok('usage_log 状态 success', ev('S.loadUsageLogs().slice(-1)[0].status') === 'success');
  ok('usage_log 仅含 keyId（无明文 Key）', ev('!(function(){var l=S.loadUsageLogs().slice(-1)[0];return ("apiKey" in l)||JSON.stringify(l).includes("' + PLAIN + '")})()'));
  ok('usage_log 含 token 统计', ev('S.loadUsageLogs().slice(-1)[0].totalTokens') === 18);
  ok('Key 使用计数 +1', ev('keys[0].requestCount') >= 1);
  ok('活动日志记录 api_success', ev('S.loadActivity().some(a=>a.type==="api_success")'));

  // —— 7. Usage 页 ——
  window.navView('usage');
  ok('Usage 渲染 总请求数', window.document.getElementById('usageContent').innerHTML.includes('总请求数'));

  // —— 7.5 新视图：Key Detail / Activity / Request Detail ——
  window.openKeyDetail(ev('keys[0].id'));
  ok('Key Detail 视图渲染', window.document.getElementById('kdContent').innerHTML.length > 0);
  window.navView('activity');
  ok('Activity 视图渲染', window.document.getElementById('actListFull').innerHTML.length > 0);
  window.renderActivityView('keys');
  ok('Activity 分类(keys)不报错', typeof window.document.getElementById('actListFull').innerHTML === 'string');
  const firstLogId = ev('S.loadUsageLogs()[0].id');
  window.openRequestDetail(firstLogId);
  ok('Request Detail 弹窗渲染', window.document.getElementById('reqBody').innerHTML.includes('Total Tokens'));

  // —— 8. Security Center ——
  window.navView('security');
  ok('Security 渲染 安全评分', window.document.getElementById('secCards').innerHTML.includes('安全评分'));
  const secScore = ev('A.getSecurityScore()');
  ok('安全评分在 0-100', secScore.score >= 0 && secScore.score <= 100);

  // —— 9. 安全：全局断言 localStorage 无明文 ——
  const ALL = ['vault_config', 'vault_data', 'vault_usage_logs', 'vault_activity']
    .map(k => window.localStorage.getItem(k)).join('|');
  ok('localStorage 任何键均不含明文 API Key', !ALL.includes(PLAIN));

  // —— 10. 加解密往返 ——
  const dec = await window.eval('(async()=>{const s=C.genSalt();const kk=await C.derive("Password123!",s);const e=await C.enc("roundtrip-check",kk);return await C.dec(e.c,e.i,kk);})()');
  ok('AES-256-GCM 加解密往返', dec === 'roundtrip-check');

  console.log(`\n=== 冒烟测试结果: ${pass} passed, ${fail} failed ===`);
  if (domErrors.length) console.log('DOM errors:', domErrors);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
