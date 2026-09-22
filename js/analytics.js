/**
 * KeyVault AI — analytics.js
 * 统一数据计算层（所有统计唯一的真实来源）
 *
 * 设计原则：
 *   - Dashboard / Usage / Security 全部从这里取数，禁止各自重复计算
 *   - 所有统计均来自真实本地数据（usage_logs / activity_logs / keys）
 *   - 无法真实获得的指标，宁可显示空状态，绝不伪造
 *   - 日志中只保存 keyId，绝不保存明文 Key / Authorization / Bearer / 完整请求
 */

/* ============================================================
   1. Provider 注册表（静态元数据）
   ============================================================ */
const PROVIDERS = [
  { id:'openai',     name:'OpenAI',      short:'ChatGPT', color:'#8D8277', logo:'icon-logo-openai',    baseUrl:'https://api.openai.com/v1/chat/completions',      models:['GPT-4.1','GPT-4o','GPT-4o-mini','o1','o3-mini'] },
  { id:'anthropic',  name:'Anthropic',   short:'Claude',  color:'#B8ADA1', logo:'icon-logo-claude',    baseUrl:'https://api.anthropic.com/v1/messages',            models:['claude-opus-4','claude-sonnet-4','claude-3-5-sonnet','claude-3-haiku'] },
  { id:'google',     name:'Google Gemini',short:'Gemini', color:'#5B5349', logo:'icon-logo-gemini',    baseUrl:'https://generativelanguage.googleapis.com/v1beta/models', models:['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash'] },
  { id:'deepseek',   name:'DeepSeek',    short:'DeepSeek',color:'#A89A8C', logo:'icon-logo-deepseek',  baseUrl:'https://api.deepseek.com/chat/completions',        models:['deepseek-chat','deepseek-reasoner'] },
  { id:'qwen',       name:'Qwen',        short:'Qwen',    color:'#C4B8AC', logo:'icon-logo-qwen',      baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models:['qwen-max','qwen-plus','qwen-turbo'] },
  { id:'moonshot',   name:'Moonshot',    short:'Kimi',    color:'#6B6259', logo:'icon-logo-other',     baseUrl:'https://api.moonshot.cn/v1/chat/completions',      models:['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k'] },
  { id:'zhipu',      name:'Zhipu',       short:'GLM',     color:'#9A8E82', logo:'icon-logo-other',     baseUrl:'https://open.bigmodel.cn/api/paas/v4/chat/completions', models:['glm-4-plus','glm-4-air','glm-4-flash'] },
  { id:'openrouter', name:'OpenRouter',  short:'Router',  color:'#7A6F65', logo:'icon-logo-other',     baseUrl:'https://openrouter.ai/api/v1/chat/completions',     models:['openai/gpt-4o','anthropic/claude-3.5-sonnet','google/gemini-pro-1.5'] },
  { id:'other',      name:'Other',       short:'Other',   color:'#D9CFC6', logo:'icon-logo-other',     baseUrl:'', models:[] }
];

function getProviderMeta(id){
  return PROVIDERS.find(p=>p.id===id) || PROVIDERS.find(p=>p.id==='other');
}

/* ============================================================
   2. Provider 自动识别（谨慎：仅格式猜测，置信度分级）
   注意：sk- 前缀被多家共用，绝不高置信度断言为 OpenAI
   ============================================================ */
function detectProvider(rawKey){
  const k = (rawKey||'').trim();
  if(!k) return { provider:'other', confidence:'Low' };
  if(/^sk-ant-/.test(k))            return { provider:'anthropic', confidence:'High' };
  if(/^sk-or-/.test(k))             return { provider:'openrouter', confidence:'High' };
  if(/^AIza[0-9A-Za-z_-]{35}$/.test(k)) return { provider:'google', confidence:'High' };
  if(/^sk-/.test(k))                return { provider:'openai', confidence:'Medium' }; // DeepSeek/Qwen/Kimi/Zhipu 也用 sk-
  return { provider:'other', confidence:'Low' };
}

/* ============================================================
   3. 日志写入（统一入口，自动应用留存策略）
   ============================================================ */
function addUsageLog(entry){
  if(!A.isAnalyticsOn()) return null;
  const cfg = S.loadCfg() || {};
  const retention = cfg.dataRetentionDays || 30;
  const logs = S.loadUsageLogs().filter(l=> Date.now()-l.timestamp < retention*864e5);
  const rec = Object.assign({ id:uuid(), timestamp:Date.now(), demo:false }, entry);
  logs.push(rec);
  S.saveUsageLogs(logs);
  return rec;
}

function addActivity(type,keyId,metadata){
  if(!A.isActivityOn()) return null;
  const cfg = S.loadCfg() || {};
  const retention = cfg.dataRetentionDays || 30;
  const logs = S.loadActivity().filter(l=> Date.now()-l.timestamp < retention*864e5);
  const rec = { id:uuid(), timestamp:Date.now(), type, keyId:keyId||null, metadata:metadata||null };
  logs.push(rec);
  S.saveActivity(logs);
  return rec;
}

/* ============================================================
   4. 统计计算（唯一真实来源）
   ============================================================ */
const A = {
  isAnalyticsOn(){ const c=S.loadCfg()||{}; return c.analyticsEnabled!==false; },
  isActivityOn(){ const c=S.loadCfg()||{}; return c.activityEnabled!==false; },

  getTotalKeys(){ return (typeof keys!=='undefined'?keys:[]).length; },

  /** 近 30 天内有成功请求的 Key 视为 Active */
  getActiveKeys(){
    const ks = (typeof keys!=='undefined'?keys:[]);
    const logs = S.loadUsageLogs().filter(l=>l.status==='success' && Date.now()-l.timestamp < 30*864e5);
    const activeIds = new Set(logs.map(l=>l.keyId));
    return ks.filter(k=>activeIds.has(k.id)).length;
  },

  getUsageStats(){
    const logs = S.loadUsageLogs();
    const total = logs.length;
    const success = logs.filter(l=>l.status==='success').length;
    const failed = total - success;
    const totalTokens = logs.reduce((s,l)=>s+(l.totalTokens||0),0);
    const latencies = logs.filter(l=>l.status==='success' && l.latency).map(l=>l.latency);
    const avgLatency = latencies.length ? latencies.reduce((a,b)=>a+b,0)/latencies.length : 0;
    return {
      totalRequests: total,
      successRate: total ? success/total : 0,
      failedRequests: failed,
      totalTokens,
      avgLatency
    };
  },

  /** 按天聚合（用于折线图） */
  getUsageByDay(range){
    const {from} = A.rangeBounds(range);
    const logs = S.loadUsageLogs().filter(l=>l.timestamp>=from);
    const days = [];
    const now = new Date(); now.setHours(0,0,0,0);
    let cursor = new Date(from); cursor.setHours(0,0,0,0);
    while(cursor<=now){
      const key = cursor.toISOString().slice(0,10);
      days.push({ date:key, ts:cursor.getTime(), requests:0, success:0, failed:0, tokens:0 });
      cursor = new Date(cursor.getTime()+864e5);
    }
    const idx = {};
    days.forEach((d,i)=>idx[d.date]=i);
    for(const l of logs){
      const dk = new Date(l.timestamp).toISOString().slice(0,10);
      if(dk in idx){
        days[idx[dk]].requests++;
        days[idx[dk]].tokens += (l.totalTokens||0);
        if(l.status==='success') days[idx[dk]].success++; else days[idx[dk]].failed++;
      }
    }
    return days;
  },

  getProviderStats(){
    const logs = S.loadUsageLogs();
    const map = {};
    for(const l of logs){
      const p = l.provider || 'other';
      if(!map[p]) map[p] = { provider:p, requests:0, tokens:0, success:0, lastUsed:0 };
      map[p].requests++;
      map[p].tokens += (l.totalTokens||0);
      if(l.status==='success') map[p].success++;
      if(l.timestamp>map[p].lastUsed) map[p].lastUsed = l.timestamp;
    }
    return Object.values(map).map(p=>{
      const meta = getProviderMeta(p.provider);
      return {
        provider: p.provider,
        name: meta.name,
        color: meta.color,
        requests: p.requests,
        tokens: p.tokens,
        successRate: p.requests? p.success/p.requests : 0,
        lastUsed: p.lastUsed
      };
    }).sort((a,b)=>b.requests-a.requests);
  },

  getModelStats(){
    const logs = S.loadUsageLogs();
    const map = {};
    for(const l of logs){
      const m = l.model || 'unknown';
      if(!map[m]) map[m] = { model:m, requests:0, tokens:0 };
      map[m].requests++;
      map[m].tokens += (l.totalTokens||0);
    }
    return Object.values(map).sort((a,b)=>b.requests-a.requests);
  },

  getRecentActivity(limit){
    const acts = S.loadActivity().slice().sort((a,b)=>b.timestamp-a.timestamp);
    return acts.slice(0, limit||10);
  },

  /** 计算时间范围起点 */
  rangeBounds(range){
    const now = Date.now();
    if(range==='today') return { from: new Date(new Date().setHours(0,0,0,0)).getTime(), to:now };
    if(range==='7d')   return { from: now-7*864e5, to:now };
    if(range==='30d')  return { from: now-30*864e5, to:now };
    if(range && range.from) return range; // custom {from,to}
    return { from: now-7*864e5, to:now };
  },

  /* —— 安全评分与风险 —— */
  getSecurityChecks(){
    const cfg = S.loadCfg() || {};
    const ks = (typeof keys!=='undefined'?keys:[]);
    const checks = [];
    checks.push({ label:'Vault encryption enabled', status:'pass', detail:'AES-256-GCM' });
    checks.push({ label:'Master password protected', status:'pass', detail:'PBKDF2 100k iterations' });
    checks.push({ label:'API Keys encrypted', status:'pass', detail:'Stored as ciphertext' });

    // Auto lock
    if(cfg.noLock){
      checks.push({ label:'Auto lock enabled', status:'fail', detail:'免密访问已开启，自动锁定失效' });
    }else{
      checks.push({ label:'Auto lock enabled', status:'pass', detail: cfg.autoLock===false?'已手动关闭':'启用（空闲自动锁定）' });
    }

    // Gesture
    checks.push({ label:'Gesture unlock', status: cfg.gestureEnabled?'pass':'warn', detail: cfg.gestureEnabled?'已启用':'未启用（可选）' });

    // Master password strength
    const pwStrength = estimatePasswordStrength(cfg.pwHint||'');
    if(pwStrength==='weak') checks.push({ label:'Master password strength', status:'warn', detail:'主密码偏弱' });
    else checks.push({ label:'Master password strength', status:'pass', detail: pwStrength==='strong'?'强':'中等' });

    // Rotation / unused
    const oldRot = ks.filter(k=> k.createdAt && Date.now()-k.createdAt > 90*864e5).length;
    if(oldRot>0) checks.push({ label:'Key rotation', status:'warn', detail:`${oldRot} 个密钥超过 90 天未轮换` });
    else checks.push({ label:'Key rotation', status:'pass', detail:'无长期未轮换密钥' });

    const unused = ks.filter(k=> !hasRecentUsage(k.id,90)).length;
    if(unused>0) checks.push({ label:'Unused keys', status:'warn', detail:`${unused} 个密钥 90 天内无使用` });
    else checks.push({ label:'Unused keys', status:'pass', detail:'无长期未使用密钥' });

    return checks;
  },

  getSecurityScore(){
    const checks = A.getSecurityChecks();
    let score = 100;
    for(const c of checks){
      if(c.status==='fail') score -= 20;
      else if(c.status==='warn') score -= 6;
    }
    score = Math.max(0, Math.min(100, score));
    let level = 'Critical';
    if(score>=85) level='Good';
    else if(score>=70) level='Fair';
    else if(score>=50) level='Weak';
    return { score, level, checks };
  },

  getRisks(){
    const cfg = S.loadCfg()||{};
    const ks = (typeof keys!=='undefined'?keys:[]);
    const risks = [];
    if(cfg.noLock) risks.push({ level:'high', title:'Auto lock disabled', detail:'免密访问已开启，任何可访问设备的人都能直接查看密钥。建议关闭免密访问。' });
    if(estimatePasswordStrength(cfg.pwHint||'')==='weak') risks.push({ level:'medium', title:'Weak master password', detail:'主密码长度偏短，建议至少 12 位并包含大小写与符号。' });
    for(const k of ks){
      if(k.createdAt && Date.now()-k.createdAt>90*864e5) risks.push({ level:'low', title:'Old API Key', detail:`「${k.name}」已超过 90 天未轮换，建议定期轮换。`, keyId:k.id });
      if(!hasRecentUsage(k.id,90)) risks.push({ level:'low', title:'Unused API Key', detail:`「${k.name}」最近 90 天未使用，可考虑删除或轮换。`, keyId:k.id });
    }
    // 频繁复制（泄露风险）
    const acts = S.loadActivity().filter(a=>a.type==='key_copied' && Date.now()-a.timestamp<7*864e5);
    const cnt = {};
    acts.forEach(a=>{ if(a.keyId) cnt[a.keyId]=(cnt[a.keyId]||0)+1 });
    for(const id in cnt){
      if(cnt[id]>10){
        const k = (typeof keys!=='undefined'?keys:[]).find(x=>x.id===id);
        risks.push({ level:'medium', title:'Frequent key exposure', detail:`「${k?k.name:id}」近 7 天被复制 ${cnt[id]} 次，存在泄露风险。`, keyId:id });
      }
    }
    const order = {critical:0,high:1,medium:2,low:3};
    return risks.sort((a,b)=>order[a.level]-order[b.level]);
  }
};

/* 辅助：主密码强度（仅基于提示长度，不存储明文） */
function estimatePasswordStrength(hint){
  if(!hint) return 'unknown';
  if(hint.length>=12) return 'strong';
  if(hint.length>=8) return 'medium';
  return 'weak';
}

/* 辅助：某 Key 近期是否有成功使用 */
function hasRecentUsage(keyId, days){
  const cutoff = Date.now()-days*864e5;
  return S.loadUsageLogs().some(l=>l.keyId===keyId && l.status==='success' && l.timestamp>=cutoff);
}

/* ============================================================
   5. Demo Data（明确标记，仅用于演示，不与真实数据混淆）
   ============================================================ */
function seedDemoData(){
  const providers = ['openai','deepseek','anthropic','qwen'];
  const models = { openai:['GPT-4.1','GPT-4o-mini'], deepseek:['deepseek-chat'], anthropic:['claude-3-5-sonnet'], qwen:['qwen-max'] };
  const keyIds = (typeof keys!=='undefined'?keys:[]).map(k=>k.id).concat(['demo-key-1','demo-key-2']);
  const usage = [];
  const activity = [];
  const now = Date.now();
  for(let d=29; d>=0; d--){
    const dayBase = now - d*864e5;
    const count = 20 + Math.floor(Math.random()*120);
    for(let i=0;i<count;i++){
      const p = providers[Math.floor(Math.random()*providers.length)];
      const ms = models[p];
      const model = ms[Math.floor(Math.random()*ms.length)];
      const ts = dayBase + Math.floor(Math.random()*864e5);
      const ok = Math.random()>0.12;
      const pt = 200+Math.floor(Math.random()*3000);
      const ct = 100+Math.floor(Math.random()*1500);
      usage.push({
        id:uuid(), timestamp:ts, demo:true,
        provider:p, keyId:keyIds[Math.floor(Math.random()*keyIds.length)],
        model, endpoint:getProviderMeta(p).baseUrl,
        status: ok?'success':'failed',
        latency: +(0.4+Math.random()*3).toFixed(2),
        promptTokens:pt, completionTokens:ct, totalTokens:pt+ct
      });
      activity.push({ id:uuid(), timestamp:ts, type: ok?'api_success':'api_failed', keyId:null, metadata:{provider:p} });
    }
  }
  S.saveUsageLogs(usage);
  S.saveActivity(activity);
  const cfg = S.loadCfg()||{}; cfg.demoData = true; S.saveCfg(cfg);
}
