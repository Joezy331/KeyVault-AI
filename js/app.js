/**
 * KeyVault AI — app.js
 * 应用主逻辑：初始化 / 设置 / 解锁 / 手势 / Key 管理 / 导航 / 视图渲染
 *
 * 安全核心（C / S / GL / 常量）位于 js/crypto.js，本文件不重复定义。
 * 所有统计位于 js/analytics.js（A / PROVIDERS / detectProvider）。
 * 真实 API 请求位于 js/playground.js（sendPlaygroundRequest）。
 */

/* ============================================================
   全局状态
   ============================================================ */
let mk = null;            // AES-256-GCM 主密钥（仅内存，锁定后清空）
let keys = [];            // 解密后的 API Key 列表
let visSet = new Set();   // 显示/隐藏状态
let lGL=null, setupGL=null, resetGL1=null, resetGL2=null;
let setupPw='';
let resetVerifiedMk=null;
let isResetting=false;
let currentView='dashboard';
let dashRange='7d';
let charts={};           // ECharts 实例
let idleTimer=null;

/* ============================================================
   UI 工具
   ============================================================ */
function toast(msg,type='success'){
  const t=document.createElement('div');t.className='toast '+type;
  const iconId=type==='success'?'icon-check':type==='error'?'icon-x':'icon-sparkle';
  t.innerHTML=`<svg><use href="#${iconId}"/></svg><span>${esc(msg)}</span>`;
  document.getElementById('toasts').appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500);
}
function confirmDialog(msg){
  return new Promise(resolve=>{
    const el=document.getElementById('confirmDialog');
    document.getElementById('confirmMsg').textContent=msg;
    el.style.display='flex';
    document.getElementById('confirmYes').onclick=()=>{el.style.display='none';resolve(true)};
    document.getElementById('confirmNo').onclick=()=>{el.style.display='none';resolve(false)};
  });
}
const EYE_IMG=`<img class="eye-icon" src="assets/eye-closed.jpg" alt="">`;
function setEye(img,open){if(img)img.src=open?'assets/eye-closed.jpg':'assets/eye-open.jpg';}
function togVis(id){
  const i=document.getElementById(id);
  const img=i.parentElement.querySelector('.eye-icon');
  if(i.type==='password'){i.type='text';setEye(img,false);}
  else{i.type='password';setEye(img,true);}
}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModalEl(id){document.getElementById(id).classList.remove('show')}

/* ============================================================
   主题
   ============================================================ */
function initTheme(){const t=localStorage.getItem('vault_theme')||'dark';applyTheme(t);syncThemeUI(t);}
function setTheme(name){
  localStorage.setItem('vault_theme',name);
  applyTheme(name);
  syncThemeUI(name);
  // 主题切换后重绘图表配色
  if(currentView==='dashboard') renderDashboardCharts();
  if(currentView==='usage') renderUsageCharts();
}
function applyTheme(name){
  let resolved=name;
  if(name==='system') resolved=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  document.documentElement.className = resolved==='dark' ? '' : 'theme-'+resolved;
}
function syncThemeUI(name){
  document.querySelectorAll('.theme-option').forEach(el=>el.classList.toggle('active',el.dataset.theme===name));
}

/* ============================================================
   初始化
   ============================================================ */
initProviderTags();
initTheme();

document.addEventListener('DOMContentLoaded',async()=>{
  const cfg=S.loadCfg();
  if(!cfg){showScreen('setup-screen');return}
  updateNoLockBtn(!!cfg.noLock);
  if(cfg.noLock){await autoUnlock(cfg);}
  else{showScreen('lock-screen');initLockScreen();}
});

let lastCfg=!!S.loadCfg();
let monitoringActive=true;
setInterval(()=>{
  if(!monitoringActive||isResetting)return;
  const c=!!S.loadCfg();
  if(lastCfg&&!c){location.reload();return}
  if(!c)monitoringActive=false;
  lastCfg=c;
},300);

document.getElementById('lpw')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();unlockByPw()}});

/* 空闲自动锁定 */
function resetIdle(){
  clearTimeout(idleTimer);
  const cfg=S.loadCfg()||{};
  if(cfg.noLock||cfg.autoLock===false||!mk) return;
  idleTimer=setTimeout(()=>{ if(mk) lockVault(); }, 5*60*1000);
}
['mousemove','keydown','click','pointerdown'].forEach(ev=>document.addEventListener(ev,resetIdle,true));

/* ============================================================
   设置流程（首次）
   ============================================================ */
function setupNext1(){
  const pw=document.getElementById('spw').value, pw2=document.getElementById('spw2').value;
  if(!pw||pw.length<4||pw.length>30){toast('密码需4-30位','error');return}
  if(pw!==pw2){toast('两次密码不一致','error');return}
  setupPw=pw;
  document.getElementById('s1').classList.remove('active');
  document.getElementById('s2').classList.add('active');
  initSetupGesture();
}
function initSetupGesture(){
  if(setupGL)return;
  setupGL=new GL('sgw','sgc',(p,gl)=>{gl._markSuccess();setTimeout(async()=>{await finishSetup(p)},400);});
}
function setupSkipGesture(){if(setupGL){setupGL.destroy();setupGL=null}finishSetup(null);}
async function finishSetup(gesturePattern){
  try{
    const keySalt=C.genSalt();
    const key=await C.derive(setupPw,keySalt);
    const test=await C.enc(TV,key);
    const pwHash=await C.hash(setupPw);
    let cfg={ pwHash, pwSalt:b64(keySalt), keySalt:b64(keySalt), test, gestureEnabled:false,
              analyticsEnabled:true, activityEnabled:true, dataRetentionDays:30, autoLock:true, pwHint:setupPw };
    if(gesturePattern){
      const gestureSalt=C.genSalt();
      const gestureHash=await C.hash(gesturePattern);
      const gKey=await C.derive(gesturePattern,gestureSalt);
      const raw=await crypto.subtle.exportKey('raw',key);
      const iv=C.genIV();
      const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);
      cfg.gestureEnabled=true;cfg.gestureHash=gestureHash;cfg.gestureSalt=b64(gestureSalt);
      cfg.wrappedKey={c:b64(wrapped),i:b64(iv)};
    }
    S.saveCfg(cfg);S.saveData([]);
    toast('设置成功');showScreen('main-screen');
    mk=key;keys=[];renderKeys();navView('dashboard');resetIdle();
    setupPw='';if(setupGL){setupGL.destroy();setupGL=null}
  }catch(e){toast('设置失败: '+e.message,'error')}
}

/* ============================================================
   免密访问
   ============================================================ */
async function autoUnlock(cfg){
  try{
    const noLockKey=await C.derive('VaultNoLock',NOLOCK_SALT);
    const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(cfg.noLockWrapped.i))},noLockKey,ub64(cfg.noLockWrapped.c));
    mk=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    await loadKeys();showScreen('main-screen');renderKeys();navView('dashboard');resetIdle();
  }catch(e){showScreen('lock-screen');initLockScreen();}
}

/* ============================================================
   锁屏
   ============================================================ */
function initLockScreen(){
  const cfg=S.loadCfg();
  if(!cfg){showScreen('setup-screen');return}
  if(cfg.gestureEnabled)showGestureLock();else showPasswordLock();
}
function showGestureLock(){
  document.getElementById('lock-gesture').classList.remove('hidden');
  document.getElementById('lock-pw').classList.add('hidden');
  if(lGL)return;
  lGL=new GL('lgw','lgc',async(p,gl)=>{
    try{
      const cfg=S.loadCfg();
      const gh=await C.hash(p);
      if(gh!==cfg.gestureHash){gl._markError();document.getElementById('lgh').textContent='手势错误';setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800);return;}
      const gKey=await C.derive(p,ub64(cfg.gestureSalt));
      const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(cfg.wrappedKey.i))},gKey,ub64(cfg.wrappedKey.c));
      mk=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
      await loadKeys();gl._markSuccess();setTimeout(()=>{showScreen('main-screen');renderKeys();navView(currentView||'dashboard');gl.reset();resetIdle()},400);
    }catch(e){gl._markError();document.getElementById('lgh').textContent='解锁失败';setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800);}
  });
}
function showPasswordLock(){
  document.getElementById('lock-gesture').classList.add('hidden');
  document.getElementById('lock-pw').classList.remove('hidden');
  const cfg=S.loadCfg();
  if(cfg&&cfg.gestureEnabled)document.getElementById('backToGesture').classList.remove('hidden');
  else document.getElementById('backToGesture').classList.add('hidden');
}
function switchToPw(){if(lGL)lGL.reset();showPasswordLock();document.getElementById('lpw').focus();}
function switchToGesture(){document.getElementById('lpw').value='';document.getElementById('lpwh').textContent='';showGestureLock();}
async function unlockByPw(){
  const pw=document.getElementById('lpw').value;
  if(!pw){toast('请输入密码','error');return}
  try{
    const cfg=S.loadCfg();
    const hash=await C.hash(pw);
    if(hash!==cfg.pwHash){document.getElementById('lpwh').textContent='密码错误';toast('密码错误','error');return;}
    const key=await C.derive(pw,ub64(cfg.keySalt));
    const ok=await C.dec(cfg.test.c,cfg.test.i,key);
    if(ok!==TV)throw new Error('wrong');
    mk=key;await loadKeys();showScreen('main-screen');renderKeys();navView(currentView||'dashboard');resetIdle();
    addActivity('login',null,{method:'password'});
    document.getElementById('lpw').value='';document.getElementById('lpwh').textContent='';
  }catch(e){document.getElementById('lpwh').textContent='密码错误';toast('密码错误','error');}
}
function lockVault(){
  mk=null;keys=[];visSet.clear();
  document.getElementById('kg').innerHTML='';
  document.getElementById('search').value='';
  if(lGL)lGL.reset();
  addActivity('vault_locked',null,{});
  const cfg=S.loadCfg();
  if(cfg&&cfg.noLock){autoUnlock(cfg);return;}
  showScreen('lock-screen');initLockScreen();
}

/* ============================================================
   设置弹窗
   ============================================================ */
function openSettings(){
  const cfg=S.loadCfg()||{};
  if(cfg){
    document.getElementById('gestureToggle').checked=cfg.gestureEnabled;
    document.getElementById('resetGestureBtn').style.display=cfg.gestureEnabled?'flex':'none';
    document.getElementById('analyticsToggle').checked=cfg.analyticsEnabled!==false;
    document.getElementById('activityToggle').checked=cfg.activityEnabled!==false;
    document.getElementById('retentionSel').value=String(cfg.dataRetentionDays||30);
  }
  const t=localStorage.getItem('vault_theme')||'dark';
  document.querySelectorAll('.theme-option').forEach(el=>el.classList.toggle('active',el.dataset.theme===t));
  openModal('settings-modal');
}
function closeSettings(){closeModalEl('settings-modal')}
function toggleAnalytics(on){const c=S.loadCfg()||{};c.analyticsEnabled=on;S.saveCfg(c);toast('用量追踪已'+(on?'开启':'关闭'));}
function toggleActivity(on){const c=S.loadCfg()||{};c.activityEnabled=on;S.saveCfg(c);toast('活动记录已'+(on?'开启':'关闭'));}
function setRetention(v){const c=S.loadCfg()||{};c.dataRetentionDays=parseInt(v,10);S.saveCfg(c);toast('数据留存：'+v+' 天');}
function resetDemoData(){
  if(!confirmDialogSync('生成演示数据？将写入明确标记为 Demo 的用量与活动日志。'))return;
  seedDemoData();toast('已生成 Demo Data','info');if(currentView==='dashboard')renderDashboard();if(currentView==='usage')renderUsage();if(currentView==='security')renderSecurity();
}
function confirmDialogSync(msg){return window.confirm?window.confirm(msg):true;}

async function toggleGesture(enabled){
  const cfg=S.loadCfg();if(!cfg)return;
  if(enabled){closeSettings();initGestureSetup();}
  else{cfg.gestureEnabled=false;delete cfg.gestureHash;delete cfg.gestureSalt;delete cfg.wrappedKey;S.saveCfg(cfg);document.getElementById('resetGestureBtn').style.display='none';if(lGL){lGL.destroy();lGL=null}toast('手势已关闭');}
}
async function toggleNoLockBtn(){
  const cfg=S.loadCfg();if(!cfg)return;
  if(cfg.noLock){cfg.noLock=false;delete cfg.noLockWrapped;S.saveCfg(cfg);updateNoLockBtn(false);toast('免密访问已关闭');}
  else{try{
    const noLockKey=await C.derive('VaultNoLock',NOLOCK_SALT);
    const raw=await crypto.subtle.exportKey('raw',mk);
    const iv=C.genIV();
    const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},noLockKey,raw);
    cfg.noLock=true;cfg.noLockWrapped={c:b64(wrapped),i:b64(iv)};S.saveCfg(cfg);updateNoLockBtn(true);toast('免密访问已开启');
  }catch(e){toast('开启失败: '+e.message,'error')}}
}
function updateNoLockBtn(active){const btn=document.getElementById('noLockBtn');if(btn)btn.classList.toggle('active',active);}
function initGestureSetup(){
  const gSetupModal=document.getElementById('reset-gesture-modal');
  document.getElementById('rgs1').classList.add('hidden');
  document.getElementById('rgs2').classList.remove('hidden');
  document.getElementById('rgs3').classList.add('hidden');
  document.getElementById('rgpw').value='';
  openModal('reset-gesture-modal');
  if(resetGL1){resetGL1.destroy();resetGL1=null}if(resetGL2){resetGL2.destroy();resetGL2=null}
  resetGL1=new GL('rggw','rggc',(p,gl)=>{gl._markSuccess();setTimeout(()=>{
    document.getElementById('rgs2').classList.add('hidden');document.getElementById('rgs3').classList.remove('hidden');
    resetGL2=new GL('rggw2','rggc2',async(p2,gl2)=>{
      if(p2===p){gl2._markSuccess();setTimeout(async()=>{try{await saveGestureConfig(p,mk);closeResetGesture();if(lGL){lGL.destroy();lGL=null}toast('手势已开启');}catch(e){toast('设置失败: '+e.message,'error')}},400);}
      else{gl2._markError();document.getElementById('rggh2').textContent='不一致，请重试';setTimeout(()=>{gl2.reset();resetGL1.reset();document.getElementById('rgs3').classList.add('hidden');document.getElementById('rgs2').classList.remove('hidden');document.getElementById('rggh').textContent='';document.getElementById('rggh2').textContent='';},800);}
    });
  },400);});
}
async function saveGestureConfig(pattern,key){
  const gestureSalt=C.genSalt();const gestureHash=await C.hash(pattern);
  const gKey=await C.derive(pattern,gestureSalt);
  const raw=await crypto.subtle.exportKey('raw',key);
  const iv=C.genIV();
  const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);
  const cfg=S.loadCfg();cfg.gestureEnabled=true;cfg.gestureHash=gestureHash;cfg.gestureSalt=b64(gestureSalt);cfg.wrappedKey={c:b64(wrapped),i:b64(iv)};S.saveCfg(cfg);
}
function openResetGesture(){
  document.getElementById('rgs1').classList.remove('hidden');document.getElementById('rgs2').classList.add('hidden');document.getElementById('rgs3').classList.add('hidden');
  document.getElementById('rgpw').value='';resetVerifiedMk=null;
  if(resetGL1){resetGL1.destroy();resetGL1=null}if(resetGL2){resetGL2.destroy();resetGL2=null}
  openModal('reset-gesture-modal');
}
function closeResetGesture(){closeModalEl('reset-gesture-modal');if(resetGL1){resetGL1.destroy();resetGL1=null}if(resetGL2){resetGL2.destroy();resetGL2=null}}
async function verifyResetGesture(){
  const pw=document.getElementById('rgpw').value;
  if(!pw){toast('请输入密码','error');return}
  try{
    const cfg=S.loadCfg();
    const hash=await C.hash(pw);
    if(hash!==cfg.pwHash){toast('密码错误','error');return;}
    const key=await C.derive(pw,ub64(cfg.keySalt));
    const ok=await C.dec(cfg.test.c,cfg.test.i,key);
    if(ok!==TV)throw new Error('wrong');
    resetVerifiedMk=key;
    document.getElementById('rgs1').classList.add('hidden');document.getElementById('rgs2').classList.remove('hidden');
    resetGL1=new GL('rggw','rggc',(p,gl)=>{gl._markSuccess();setTimeout(()=>{
      document.getElementById('rgs2').classList.add('hidden');document.getElementById('rgs3').classList.remove('hidden');
      resetGL2=new GL('rggw2','rggc2',async(p2,gl2)=>{
        if(p2===p){gl2._markSuccess();setTimeout(async()=>{try{await saveGestureConfig(p,resetVerifiedMk);resetVerifiedMk=null;closeResetGesture();if(lGL){lGL.destroy();lGL=null}toast('手势已重置');}catch(e){toast('重置失败: '+e.message,'error')}},400);}
        else{gl2._markError();document.getElementById('rggh2').textContent='不一致，请重试';setTimeout(()=>{gl2.reset();resetGL1.reset();document.getElementById('rgs3').classList.add('hidden');document.getElementById('rgs2').classList.remove('hidden');document.getElementById('rggh').textContent='';document.getElementById('rggh2').textContent='';},800);}
      });
    },400);});
  }catch(e){toast('验证失败','error')}
}
function openChangePw(){document.getElementById('cpwOld').value='';document.getElementById('cpwNew').value='';document.getElementById('cpwNew2').value='';closeSettings();openModal('change-pw-modal');}
function closeChangePw(){closeModalEl('change-pw-modal')}
async function saveChangePw(){
  const oldPw=document.getElementById('cpwOld').value,newPw=document.getElementById('cpwNew').value,newPw2=document.getElementById('cpwNew2').value;
  if(!oldPw||!newPw){toast('请填写所有字段','error');return;}
  if(newPw.length<4||newPw.length>30){toast('新密码需4-30位','error');return;}
  if(newPw!==newPw2){toast('两次新密码不一致','error');return;}
  if(oldPw===newPw){toast('新旧密码不能相同','error');return;}
  try{
    const cfg=S.loadCfg();
    const oldHash=await C.hash(oldPw);
    if(oldHash!==cfg.pwHash){toast('当前密码错误','error');return;}
    const oldKey=await C.derive(oldPw,ub64(cfg.keySalt));
    const ok=await C.dec(cfg.test.c,cfg.test.i,oldKey);
    if(ok!==TV){toast('当前密码错误','error');return;}
    const newKeySalt=C.genSalt();const newKey=await C.derive(newPw,newKeySalt);const newTest=await C.enc(TV,newKey);const newPwHash=await C.hash(newPw);
    const storedData=S.loadData();
    for(let i=0;i<keys.length;i++){storedData[i].ek=await C.enc(keys[i].apiKey,newKey);}
    S.saveData(storedData);
    cfg.pwHash=newPwHash;cfg.pwSalt=b64(newKeySalt);cfg.keySalt=b64(newKeySalt);cfg.test=newTest;cfg.pwHint=newPw;
    if(cfg.gestureEnabled||cfg.noLock){
      delete cfg.gestureEnabled;delete cfg.gestureHash;delete cfg.gestureSalt;delete cfg.wrappedKey;delete cfg.noLock;delete cfg.noLockWrapped;
      if(lGL){lGL.destroy();lGL=null}
      toast('主密码已修改，手势和免密已关闭，请在设置中重新开启');
    }else{toast('主密码已修改');}
    S.saveCfg(cfg);mk=newKey;closeChangePw();
  }catch(e){toast('修改失败: '+e.message,'error')}
}

/* ============================================================
   API Key 管理
   ============================================================ */
async function loadKeys(){
  const raw=S.loadData();keys=[];
  for(const e of raw){
    try{
      const ak=await C.dec(e.ek.c,e.ek.i,mk);
      keys.push({id:e.id,name:e.name,apiKey:ak,url:e.url||'',notes:e.notes||'',provider:e.provider||'',env:e.env||'Production',tags:e.tags||[],status:e.status||'Active',createdAt:e.createdAt,updatedAt:e.updatedAt,lastUsed:e.lastUsed||0,requestCount:e.requestCount||0});
    }catch{keys.push({id:e.id,name:e.name,apiKey:'[解密失败]',url:e.url||'',notes:e.notes||'',provider:e.provider||'',env:e.env||'Production',tags:e.tags||[],status:e.status||'Active',createdAt:e.createdAt,updatedAt:e.updatedAt,lastUsed:e.lastUsed||0,requestCount:e.requestCount||0});}
  }
}
async function saveAll(){
  const out=[];
  for(const k of keys){const ek=await C.enc(k.apiKey,mk);out.push({id:k.id,name:k.name,ek,url:k.url,notes:k.notes,provider:k.provider,env:k.env,tags:k.tags,status:k.status,createdAt:k.createdAt,updatedAt:k.updatedAt,lastUsed:k.lastUsed,requestCount:k.requestCount});}
  S.saveData(out);
}
function keySecurityScore(k){
  let s=100;
  if(k.status==='Deprecated')s-=15;
  if(k.status==='Expired'||k.status==='Revoked')s-=35;
  const age=k.createdAt?Date.now()-k.createdAt:0;
  if(age>90*864e5)s-=10;
  if(k.requestCount===0&&age>30*864e5)s-=5;
  return Math.max(0,Math.min(100,s));
}
function statusMap(status){
  switch(status){
    case 'Active': return {icon:'icon-status-active',cls:'green'};
    case 'Deprecated': return {icon:'icon-status-warn',cls:'amber'};
    case 'Expired': return {icon:'icon-status-error',cls:'red'};
    case 'Revoked': return {icon:'icon-status-error',cls:'red'};
    default: return {icon:'icon-status-offline',cls:'gray'};
  }
}
function renderKeys(){
  const q=(document.getElementById('search').value||'').toLowerCase();
  const filtered=keys.filter(k=>{
    const meta=getProviderMeta(k.provider);
    const pstr=(meta.name+' '+meta.short).toLowerCase();
    const tags=(k.tags||[]).join(' ').toLowerCase();
    return k.name.toLowerCase().includes(q)||pstr.includes(q)||(k.env||'').toLowerCase().includes(q)||tags.includes(q)||(k.url||'').toLowerCase().includes(q)||(k.notes||'').toLowerCase().includes(q);
  });
  const grid=document.getElementById('kg'),empty=document.getElementById('empty');
  if(filtered.length===0){grid.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  grid.innerHTML=filtered.map(k=>{
    const meta=getProviderMeta(k.provider);
    const logo=meta.logo||'icon-logo-other';
    const sc=keySecurityScore(k);
    const scClass=sc>=80?'green':sc>=60?'amber':'red';
    const st=statusMap(k.status);
    const lastUsed=k.lastUsed?fmtDate(k.lastUsed):'从未';
    const tagsHtml=(k.tags||[]).map(t=>`<span class="kc-tag">${esc(t)}</span>`).join('');
    return `<div class="key-card" data-id="${k.id}">
      <div class="kc-top">
        <div class="kc-brand">
          <div class="kc-logo" style="background:${meta.color};--logo-bg:${meta.color}"><svg><use href="#${logo}"/></svg></div>
          <div class="kc-meta">
            <div class="kc-name">${esc(k.name)}</div>
            <div class="kc-prov"><span class="kc-prov-name">${esc(meta.name)}</span><span class="kc-env">${esc(k.env)}</span></div>
          </div>
        </div>
        <span class="status-pill ${st.cls}"><svg><use href="#${st.icon}"/></svg>${esc(k.status)}</span>
      </div>
      ${tagsHtml?`<div class="kc-tags">${tagsHtml}</div>`:''}
      <div class="card-key-row"><span class="card-key-val" id="kv-${k.id}">${maskKey(k.apiKey)}</span>
      <div class="card-key-btns"><button id="eye-${k.id}" onclick="togKeyVis('${k.id}')" title="显示/隐藏">${EYE_IMG}</button>
      <button onclick="copyKey('${k.id}')" title="复制" class="copy-btn"><svg><use href="#icon-copy"/></svg></button></div></div>
      <div class="kc-grid">
        <div><div class="k">创建于</div><div class="v">${k.createdAt?fmtDate(k.createdAt):'-'}</div></div>
        <div><div class="k">最近使用</div><div class="v">${lastUsed}</div></div>
        <div><div class="k">请求数</div><div class="v">${k.requestCount||0}</div></div>
        <div><div class="k">安全分</div><div class="v"><span class="badge ${scClass}">${sc}/100</span></div></div>
      </div>
      <div class="kc-foot"><span class="card-name">${esc(meta.short||meta.name)} · ${esc(k.env)}</span><span class="spacer"></span><button onclick="openKeyDetail('${k.id}')" title="详情"><svg><use href="#icon-search"/></svg></button><button onclick="openEdit('${k.id}')" title="编辑"><svg><use href="#icon-edit"/></svg></button><button onclick="delKey('${k.id}')" title="删除"><svg><use href="#icon-trash"/></svg></button></div>
    </div>`;
  }).join('');
}
function togKeyVis(id){
  const el=document.getElementById('kv-'+id);if(!el)return;const icon=document.getElementById('eye-'+id);
  const k=keys.find(x=>x.id===id);if(!k)return;
  const img=icon?icon.querySelector('.eye-icon'):null;
  if(visSet.has(id)){el.textContent=maskKey(k.apiKey);visSet.delete(id);if(img)setEye(img,true);}
  else{el.textContent=k.apiKey;visSet.add(id);if(img)setEye(img,false);}
}
function copyKey(id){
  const k=keys.find(x=>x.id===id);if(!k)return;
  navigator.clipboard.writeText(k.apiKey).then(()=>{toast('已复制');addActivity('key_copied',id,{});}).catch(()=>toast('复制失败','error'));
}
function initProviderTags(){
  const box=document.getElementById('providerTags');if(!box)return;
  box.innerHTML=PROVIDERS.filter(p=>p.id!=='other').map(p=>`<button type="button" class="provider-tag" onclick="pickProviderById('${p.id}')"><span class="pt-logo" style="background:${p.color}"><svg><use href="#${p.logo||'icon-logo-other'}"/></svg></span>${p.name}</button>`).join('');
  const sel=document.getElementById('mp');if(sel)sel.innerHTML=PROVIDERS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
}
function pickProviderById(id){
  const p=getProviderMeta(id);
  document.getElementById('mp').value=id;
  document.getElementById('mu').value=p.baseUrl;
  document.getElementById('menv').value='Production';
  onProviderPick();
}
function onProviderPick(){
  const id=document.getElementById('mp').value;const p=getProviderMeta(id);
  const ep=document.getElementById('mu');if(ep&&!ep.value)ep.value=p.baseUrl;
  updateDetectHint();
}
function updateDetectHint(){
  const el=document.getElementById('detectHint');if(!el)return;
  const v=document.getElementById('mk')?.value||'';
  if(!v){el.textContent='';return;}
  const d=detectProvider(v);
  const confClass=d.confidence==='High'?'green':d.confidence==='Medium'?'amber':'gray';
  el.innerHTML=`识别结果：<b>${esc(getProviderMeta(d.provider).name)}</b> · 置信度 <span class="badge ${confClass}">${d.confidence}</span> <span style="color:var(--text3)">（可手动修改）</span>`;
  const mp=document.getElementById('mp');if(mp&&!mp.dataset.touched)mp.value=d.provider;
}
function openAdd(){
  document.getElementById('mtitle').textContent='添加 API Key';
  document.getElementById('kform').reset();
  document.getElementById('meid').value='';
  document.getElementById('mp').dataset.touched='';
  document.getElementById('menv').value='Production';
  document.getElementById('mst').value='Active';
  document.getElementById('detectHint').textContent='';
  openModal('kmodal');
  setTimeout(()=>document.getElementById('mn').focus(),50);
}
function openEdit(id){
  const k=keys.find(x=>x.id===id);if(!k)return;
  document.getElementById('mtitle').textContent='编辑 API Key';
  document.getElementById('mn').value=k.name;
  document.getElementById('mk').value=k.apiKey;document.getElementById('mk').type='password';
  document.getElementById('mp').value=k.provider;document.getElementById('mp').dataset.touched='1';
  document.getElementById('menv').value=k.env||'Production';
  document.getElementById('mst').value=k.status||'Active';
  document.getElementById('mtg').value=(k.tags||[]).join(', ');
  document.getElementById('mu').value=k.url;
  document.getElementById('mno').value=k.notes;
  document.getElementById('meid').value=id;
  // 重置 eye 状态
  const eyeSvg=document.querySelector('#kmodal .eye-icon');
  if(eyeSvg){setEye(eyeSvg,true);document.getElementById('mk').type='password';}
  openModal('kmodal');
}
function closeModal(){closeModalEl('kmodal')}
async function saveKey(e){
  e.preventDefault();
  const btn=e.target.querySelector('[type="submit"]');if(btn.disabled)return;btn.disabled=true;
  const name=document.getElementById('mn').value.trim();
  const ak=document.getElementById('mk').value;
  const provider=document.getElementById('mp').value;
  const env=document.getElementById('menv').value;
  const status=document.getElementById('mst').value;
  const tags=document.getElementById('mtg').value.split(',').map(s=>s.trim()).filter(Boolean);
  const url=document.getElementById('mu').value.trim();
  const notes=document.getElementById('mno').value.trim();
  const eid=document.getElementById('meid').value;
  if(!name||!ak){toast('名称和 Key 不能为空','error');btn.disabled=false;return;}
  const now=Date.now();
  if(eid){
    const k=keys.find(x=>x.id===eid);
    if(k){k.name=name;k.apiKey=ak;k.provider=provider;k.env=env;k.status=status;k.tags=tags;k.url=url;k.notes=notes;k.updatedAt=now;addActivity('key_updated',eid,{});}
  }else{
    keys.push({id:uuid(),name,apiKey:ak,provider,env,status,tags,url,notes,createdAt:now,updatedAt:now,lastUsed:0,requestCount:0});
    addActivity('key_added',keys[keys.length-1].id,{});
  }
  await saveAll();renderKeys();closeModal();toast(eid?'已更新':'已添加');btn.disabled=false;
}
async function delKey(id){
  if(!await confirmDialog('确定删除此 API Key？此操作不可撤销。'))return;
  keys=keys.filter(k=>k.id!==id);
  await saveAll();renderKeys();addActivity('key_deleted',id,{});toast('已删除');
}

/* ============================================================
   密钥详情（独立视图）
   ============================================================ */
function openKeyDetail(id){currentKeyDetailId=id;navView('detail');}
function renderKeyDetail(id){
  const k=keys.find(x=>x.id===id);
  const box=document.getElementById('kdContent');
  if(!k){box.innerHTML=emptyHtml('未找到密钥','可能已被删除。');return;}
  const meta=getProviderMeta(k.provider);
  const logo=meta.logo||'icon-logo-other';
  const sc=keySecurityScore(k);
  const st=statusMap(k.status);
  const lastUsed=k.lastUsed?fmtDate(k.lastUsed):'从未';
  const lastRotated=k.lastRotated?fmtDate(k.lastRotated):'未轮换';
  const reqLogs=S.loadUsageLogs().filter(l=>l.keyId===id);
  const reqCount=reqLogs.length;
  const succ=reqLogs.filter(l=>l.status==='success').length;
  document.getElementById('kdTitle').textContent=k.name;
  document.getElementById('kdSub').textContent=meta.name+' · '+k.env;
  box.innerHTML=`
    <div class="detail-head">
      <div class="kc-logo" style="background:${meta.color}"><svg><use href="#${logo}"/></svg></div>
      <div class="detail-head-meta">
        <div class="kc-name" style="font-size:18px">${esc(k.name)}</div>
        <div class="kc-prov"><span class="kc-prov-name">${esc(meta.name)}</span><span class="kc-env">${esc(k.env)}</span><span class="status-pill ${st.cls}"><svg><use href="#${st.icon}"/></svg>${esc(k.status)}</span></div>
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn-sm" onclick="togKeyVisFromDetail('${k.id}')" id="kdReveal">显示 Key</button>
      <button class="btn-sm" onclick="copyKey('${k.id}')">复制</button>
      <button class="btn-sm" onclick="rotateKey('${k.id}')"><svg class="i i-sm" style="margin-right:4px;vertical-align:-3px"><use href="#icon-rotate"/></svg>轮换</button>
      <button class="btn-sm" onclick="openEdit('${k.id}')">编辑</button>
      <button class="btn-sm danger" onclick="delKey('${k.id}')">删除</button>
    </div>
    <div class="detail-key-row"><span class="card-key-val" id="kv-detail-${k.id}" data-revealed="0">${maskKey(k.apiKey)}</span></div>
    <div class="cards-row">
      ${card('Provider',meta.name,'','')}
      ${card('环境',k.env,'','')}
      ${card('创建于',k.createdAt?fmtDate(k.createdAt):'-','','')}
      ${card('最近使用',lastUsed,'','')}
      ${card('请求数',String(reqCount),'成功 '+succ,'')}
      ${card('安全分',String(sc),'/100','')}
      ${card('上次轮换',lastRotated,'','')}
      ${card('标签',(k.tags||[]).join('、')||'—','','')}
    </div>
    <div class="panel"><div class="panel-head"><div class="panel-title">该密钥用量趋势</div><div class="panel-sub">仅统计真实请求</div></div><div class="chart-box sm" id="kdChart"></div></div>
    ${k.notes?`<div class="panel"><div class="panel-head"><div class="panel-title">备注</div></div><div style="font-size:13px;color:var(--text2);line-height:1.7">${esc(k.notes)}</div></div>`:''}
  `;
  const days=A.getUsageByDay('30d').map(d=>({date:d.date,req:reqLogs.filter(l=>new Date(l.timestamp).toISOString().slice(0,10)===d.date).length}));
  const has=days.some(d=>d.req>0);
  const el=document.getElementById('kdChart');
  if(!has){el.innerHTML=`<div class="empty-state"><h3>暂无用量</h3><p>该密钥还没有通过测试台发起的请求。</p></div>`;return;}
  drawChart('kdChart',lineOption(days.map(d=>d.date.slice(5)),days.map(d=>d.req),days.map(d=>d.req),days.map(()=>0)));
}
function togKeyVisFromDetail(id){
  const el=document.getElementById('kv-detail-'+id);if(!el)return;
  const btn=document.getElementById('kdReveal');
  const k=keys.find(x=>x.id===id);if(!k)return;
  if(el.dataset.revealed==='1'){el.textContent=maskKey(k.apiKey);el.dataset.revealed='0';btn.textContent='显示 Key';}
  else{el.textContent=k.apiKey;el.dataset.revealed='1';btn.textContent='隐藏 Key';}
}
async function rotateKey(id){
  if(!await confirmDialog('轮换此 API Key？\n\nKeyVault 不会替你修改第三方平台。请先在 Provider 后台创建新 Key，再「添加新 Key」到 Vault。此处仅记录本次轮换时间与活动。'))return;
  const k=keys.find(x=>x.id===id);if(!k)return;
  k.lastRotated=Date.now();k.updatedAt=Date.now();
  addActivity('key_rotated',id,{});
  await saveAll();renderKeyDetail(id);toast('已记录密钥轮换');
}

/* ============================================================
   活动视图（独立，分类筛选）
   ============================================================ */
const ACT_CATEGORY={
  security:['login','logout','vault_locked','vault_unlocked','gesture_set','gesture_reset','pw_changed','settings_changed'],
  api:['api_request','api_success','api_failed','key_tested'],
  keys:['key_added','key_updated','key_deleted','key_copied','key_rotated'],
  system:['reset','export','import','demo']
};
function actCategory(type){
  for(const c in ACT_CATEGORY){if(ACT_CATEGORY[c].includes(type))return c;}
  return 'system';
}
function renderActivityView(filter){
  if(filter)document.querySelectorAll('#actTabs .range-tab').forEach(t=>t.classList.toggle('active',t.dataset.f===filter));
  const acts=A.getRecentActivity(500);
  const list=filter&&filter!=='all'?acts.filter(a=>actCategory(a.type)===filter):acts;
  const box=document.getElementById('actListFull');
  if(!list.length){box.innerHTML=emptyHtml('暂无活动','密钥增删改、复制、API 请求与解锁事件都会记录在这里。');return;}
  box.innerHTML=list.map(a=>{
    const k=keys.find(x=>x.id===a.keyId);
    const label=activityLabel(a,k);
    const cat=actCategory(a.type);
    return `<div class="activity-item"><div class="act-icon">${label.icon}</div>
      <div class="act-main"><div class="act-title">${esc(label.title)}</div><div class="act-sub">${esc(label.sub)}</div></div>
      <span class="act-cat act-cat-${cat}">${cat}</span>
      <div class="act-time">${timeAgo(a.timestamp)}</div></div>`;
  }).join('');
}

/* ============================================================
   请求详情
   ============================================================ */
function openRequestDetail(id){
  const logs=S.loadUsageLogs();
  const l=logs.find(x=>x.id===id);
  if(!l){toast('未找到该记录','error');return;}
  const meta=getProviderMeta(l.provider);
  const k=keys.find(x=>x.id===l.keyId);
  document.getElementById('reqTitle').textContent='请求详情 · '+meta.name;
  document.getElementById('reqBody').innerHTML=`
    <div class="req-grid">
      <div><div class="k">时间</div><div class="v">${fmtDate(l.timestamp)}</div></div>
      <div><div class="k">Provider</div><div class="v">${esc(meta.name)}</div></div>
      <div><div class="k">Model</div><div class="v">${esc(l.model||'-')}</div></div>
      <div><div class="k">状态</div><div class="v"><span class="badge ${l.status==='success'?'green':'red'}">${l.status==='success'?'成功':'失败'}</span></div></div>
      <div><div class="k">延迟</div><div class="v">${l.latency?l.latency+'s':'-'}</div></div>
      <div><div class="k">关联密钥</div><div class="v">${esc(k?k.name:'已删除 / 未知')}</div></div>
      <div><div class="k">Prompt Tokens</div><div class="v">${l.promptTokens||0}</div></div>
      <div><div class="k">Completion Tokens</div><div class="v">${l.completionTokens||0}</div></div>
      <div><div class="k">Total Tokens</div><div class="v">${l.totalTokens||0}</div></div>
    </div>
    ${l.error?`<div style="margin-top:12px;color:var(--error);font-size:13px">错误：${esc(l.error)}</div>`:''}
  `;
  openModal('request-modal');
}

/* ============================================================
   导航 / 视图路由
   ============================================================ */
const VIEW_TITLES={dashboard:'总览',keys:'密钥',usage:'用量',playground:'测试台',security:'安全',activity:'活动',detail:'密钥详情'};
let currentKeyDetailId=null;
function navView(v){
  currentView=v;
  document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  document.getElementById('viewTitle').textContent=VIEW_TITLES[v]||v;
  document.getElementById('sidebar').classList.remove('open');
  if(v==='dashboard')renderDashboard();
  else if(v==='usage')renderUsage();
  else if(v==='security')renderSecurity();
  else if(v==='playground')initPlayground();
  else if(v==='keys'){renderKeys();}
  else if(v==='activity')renderActivityView();
  else if(v==='detail')renderKeyDetail(currentKeyDetailId);
  requestAnimationFrame(()=>{Object.values(charts).forEach(c=>c&&c.resize());});
}
function onGlobalSearch(){
  if(currentView==='keys')renderKeys();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}

/* ============================================================
   Dashboard
   ============================================================ */
function isDemoMode(){const logs=S.loadUsageLogs();return logs.length>0 && logs.every(l=>l.demo) && S.loadCfg()?.demoData;}
function renderDashboard(){
  document.getElementById('demoBannerDash').innerHTML = isDemoMode()
    ? `<div class="demo-banner"><svg><use href="#icon-sparkle"/></svg><b>Demo Data</b> — 当前展示的是明确标记的演示数据，并非真实用量。在设置 → Demo Data 可重置。</div>` : '';
  const total=A.getTotalKeys();
  const active=A.getActiveKeys();
  const provSet=new Set(keys.map(k=>k.provider).filter(Boolean));
  const us=A.getUsageStats();
  const monthly=monthlyCount();
  const sec=A.getSecurityScore();
  const secClass=sec.level==='Good'?'good':sec.level==='Fair'?'warn':'bad';
  document.getElementById('dashCards').innerHTML=`
    ${card('密钥总数',total,'全部收藏','keys')}
    ${card('Providers',provSet.size,'接入供应商','provs')}
    ${card('活跃密钥',active,'30 天内有成功请求','active')}
    ${card('API 请求',monthly,'本月','reqs')}
    <div class="stat-block"><div class="sb-label">安全评分</div><div class="sb-value sb-${secClass}">${sec.score}<span style="font-size:14px;color:var(--text3);margin-left:4px">/100</span></div><div class="sb-note sb-${secClass}">${sec.level==='Good'?'良好':sec.level==='Fair'?'一般':'较弱'}</div></div>`;
  renderProviders();
  renderActivity();
  renderDashboardCharts();
}
function card(label,val,sub,key){
  return `<div class="stat-block" data-key="${key||''}"><div class="sb-label">${label}</div><div class="sb-value">${val}</div><div class="sb-note">${sub}</div></div>`;
}
function monthlyCount(){const now=new Date();const y=now.getFullYear(),m=now.getMonth();return S.loadUsageLogs().filter(l=>{const d=new Date(l.timestamp);return d.getFullYear()===y&&d.getMonth()===m;}).length;}
function renderProviders(){
  const stats=A.getProviderStats();
  const box=document.getElementById('provList');
  if(!stats.length){box.innerHTML=emptyHtml('暂无用量数据','在测试台发起请求后将自动统计。');return;}
  const max=Math.max(...stats.map(s=>s.requests));
  box.innerHTML=stats.map(s=>{
    const meta=getProviderMeta(s.provider);
    return `<div class="prov-row">
    <div class="prov-name" onclick="openProviderDetail('${s.provider}')"><span class="prov-logo" style="background:${s.color}"><svg><use href="#${meta.logo||'icon-logo-other'}"/></svg></span><span>${esc(s.name)}</span></div>
    <div class="prov-bar"><i style="width:${max?Math.round(s.requests/max*100):0}%;background:${s.color}"></i></div>
    <div class="prov-meta"><span>请求 <b>${s.requests}</b></span><span>Token <b>${s.tokens}</b></span><span>成功率 <b>${Math.round(s.successRate*100)}%</b></span></div>
  </div>`;
  }).join('');
}
function renderActivity(){
  const acts=A.getRecentActivity(10);
  const box=document.getElementById('actList');
  if(!acts.length){box.innerHTML=emptyHtml('暂无活动','密钥增删改、复制、API 请求都会记录在这里。');return;}
  box.innerHTML=acts.map(a=>{
    const k=keys.find(x=>x.id===a.keyId);
    const label=activityLabel(a,k);
    return `<div class="activity-item"><div class="act-icon">${label.icon}</div>
      <div class="act-main"><div class="act-title">${esc(label.title)}</div><div class="act-sub">${esc(label.sub)}</div></div>
      <div class="act-time">${timeAgo(a.timestamp)}</div></div>`;
  }).join('');
}
function activityLabel(a,k){
  const name=k?k.name:(a.metadata?.provider?getProviderMeta(a.metadata.provider).name:'Vault');
  const svg=(id)=>`<svg><use href="#${id}"/></svg>`;
  const map={
    key_added:{icon:svg('icon-plus'),title:'添加密钥',sub:name},
    key_updated:{icon:svg('icon-edit'),title:'更新密钥',sub:name},
    key_deleted:{icon:svg('icon-trash'),title:'删除密钥',sub:name},
    key_copied:{icon:svg('icon-copy'),title:'复制密钥',sub:name},
    key_rotated:{icon:svg('icon-rotate'),title:'轮换密钥',sub:name},
    api_request:{icon:svg('icon-gamepad'),title:'API 请求',sub:name},
    api_success:{icon:svg('icon-check'),title:'API 请求成功',sub:name},
    api_failed:{icon:svg('icon-x'),title:'API 请求失败',sub:name},
    key_tested:{icon:svg('icon-gamepad'),title:'测试密钥',sub:name},
    login:{icon:svg('icon-arrow-right'),title:'已解锁',sub:'主密码'},
    logout:{icon:svg('icon-arrow-right'),title:'已登出',sub:''},
    vault_locked:{icon:svg('icon-lock'),title:'已锁定',sub:''}
  };
  return map[a.type]||{icon:'•',title:a.type,sub:name};
}
function timeAgo(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return s+'秒前';if(s<3600)return Math.floor(s/60)+'分钟前';if(s<86400)return Math.floor(s/3600)+'小时前';return Math.floor(s/86400)+'天前';}
function emptyHtml(title,sub){return `<div class="empty-state"><div class="es-icon"><svg><use href="#icon-folder"/></svg></div><h3>${title}</h3><p>${sub}</p></div>`;}

/* 仪表盘图表 */
function renderDashboardCharts(){
  const days=A.getUsageByDay(dashRange);
  const hasData=days.some(d=>d.requests>0);
  const el=document.getElementById('dashChart');
  if(!hasData){el.innerHTML=`<div class="empty-state"><h3>暂无用量</h3><p>在测试台发起第一次请求后，分析图表将自动出现。</p><button class="btn-primary-line" onclick="navView('playground')">打开测试台</button></div>`;return;}
  const opt=lineOption(days.map(d=>d.date.slice(5)),days.map(d=>d.requests),days.map(d=>d.success),days.map(d=>d.failed));
  drawChart('dashChart',opt);
  document.querySelectorAll('#dashRange .range-tab').forEach(t=>{
    t.onclick=()=>{document.querySelectorAll('#dashRange .range-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');dashRange=t.dataset.r;renderDashboardCharts();};
  });
}
function lineOption(x,req,succ,fail){
  const c=cssColors();
  return {
    backgroundColor:'transparent',
    tooltip:{trigger:'axis'},
    legend:{data:['请求','成功','失败'],textStyle:{color:c.text},top:0},
    grid:{left:40,right:16,top:36,bottom:30},
    xAxis:{type:'category',data:x,axisLine:{lineStyle:{color:c.border}},axisLabel:{color:c.text}},
    yAxis:{type:'value',splitLine:{lineStyle:{color:c.border}},axisLabel:{color:c.text}},
    series:[
      {name:'请求',type:'line',smooth:true,data:req,areaStyle:{opacity:.12},itemStyle:{color:c.accent},lineStyle:{width:2}},
      {name:'成功',type:'line',smooth:true,data:succ,itemStyle:{color:c.green},lineStyle:{width:2}},
      {name:'失败',type:'line',smooth:true,data:fail,itemStyle:{color:c.red},lineStyle:{width:2}}
    ]
  };
}
function cssColors(){
  const cs=getComputedStyle(document.documentElement);
  return {text:(cs.getPropertyValue('--text2')||'#D5D8D8').trim(),border:(cs.getPropertyValue('--border')||'rgba(113,136,155,0.20)').trim(),accent:(cs.getPropertyValue('--accent')||'#71889B').trim(),green:cs.getPropertyValue('--success').trim(),red:cs.getPropertyValue('--error').trim()};
}
function drawChart(id,option){
  if(typeof echarts==='undefined')return;
  if(charts[id])charts[id].dispose();
  const el=document.getElementById(id);
  if(!el)return;
  charts[id]=echarts.init(el);
  charts[id].setOption(option);
}

/* ============================================================
   Usage
   ============================================================ */
function renderUsage(){
  const us=A.getUsageStats();
  const hasData=us.totalRequests>0;
  const box=document.getElementById('usageContent');
  if(!hasData){
    box.innerHTML=isDemoMode()?demoNote()+usageInner(true):`<div class="empty-state"><h3>暂无用量数据</h3><p>在测试台发起第一次真实请求后，用量档案将自动出现。</p><button class="btn-primary-line" onclick="navView('playground')">打开测试台</button></div>`;
    if(isDemoMode())bindUsageAfter();
    return;
  }
  box.innerHTML=usageInner(false);
  bindUsageAfter();
  renderUsageCharts();
}
function demoNote(){return `<div class="demo-banner"><svg><use href="#icon-sparkle"/></svg><b>Demo Data</b> — 以下为明确标记的演示数据，并非真实用量。</div>`;}
function usageInner(demo){
  const us=A.getUsageStats();
  const sr=Math.round(us.successRate*100);
  const ov=`<div class="cards-row">
    ${card('总请求数',us.totalRequests,'全部请求','ureq')}
    ${card('成功率',sr+'%','成功请求占比','usr')}
    ${card('失败请求',us.failedRequests,'失败请求','ufail')}
    ${card('总 Token',us.totalTokens,'累计 Token','utok')}
    ${card('平均延迟',us.avgLatency.toFixed(2)+'s','成功请求平均','ulat')}
  </div>`;
  return ov+`
    <div class="panel"><div class="panel-head"><div class="panel-title">请求趋势</div></div><div class="chart-box" id="trendChart"></div></div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Token 用量</div></div><div class="chart-box sm" id="tokenChart"></div></div>
    <div class="pg-row">
      <div class="panel"><div class="panel-head"><div class="panel-title">Provider 占比</div></div><div class="chart-box sm" id="provPie"></div></div>
      <div class="panel"><div class="panel-head"><div class="panel-title">Model 用量</div></div><div id="modelList"></div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-title">请求历史</div>
        <div style="display:flex;gap:8px">
          <input id="histSearch" placeholder="搜索..." style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:7px 12px;color:var(--text);font-size:12px" oninput="renderHistory()">
          <select id="histStatus" onchange="renderHistory()" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:7px 12px;color:var(--text);font-size:12px"><option value="">全部</option><option value="success">成功</option><option value="failed">失败</option></select>
        </div>
      </div>
      <div class="table-wrap"><table class="kv-table" id="histTable"></table></div>
    </div>`;
}
function bindUsageAfter(){
  renderHistory();
  const ml=document.getElementById('modelList');
  if(ml){
    const ms=A.getModelStats();
    if(!ms.length){ml.innerHTML=emptyHtml('暂无数据','');}
    else{const max=Math.max(...ms.map(m=>m.requests));ml.innerHTML=ms.slice(0,8).map(m=>`<div class="prov-row"><div class="prov-name" style="cursor:default">${esc(m.model)}</div><div class="prov-bar"><i style="width:${Math.round(m.requests/max*100)}%;background:var(--accent)"></i></div><div class="prov-meta"><span>请求 <b>${m.requests}</b></span><span>Token <b>${m.tokens}</b></span></div></div>`).join('');}
  }
}
function renderUsageCharts(){
  const days=A.getUsageByDay('30d');
  drawChart('trendChart',lineOption(days.map(d=>d.date.slice(5)),days.map(d=>d.requests),days.map(d=>d.success),days.map(d=>d.failed)));
  const logs=S.loadUsageLogs();
  const pt=logs.reduce((s,l)=>s+(l.promptTokens||0),0),ct=logs.reduce((s,l)=>s+(l.completionTokens||0),0),tt=logs.reduce((s,l)=>s+(l.totalTokens||0),0);
  const c=cssColors();
  drawChart('tokenChart',{backgroundColor:'transparent',tooltip:{trigger:'axis'},legend:{data:['Prompt','Completion','Total'],textStyle:{color:c.text}},
    grid:{left:50,right:16,top:36,bottom:30},xAxis:{type:'category',data:['Token'],axisLine:{lineStyle:{color:c.border}},axisLabel:{color:c.text}},
    yAxis:{type:'value',splitLine:{lineStyle:{color:c.border}},axisLabel:{color:c.text}},
    series:[{name:'Prompt',type:'bar',data:[pt],itemStyle:{color:c.accent}},{name:'Completion',type:'bar',data:[ct],itemStyle:{color:c.green}},{name:'Total',type:'bar',data:[tt],itemStyle:{color:c.red}}]});
  const ps=A.getProviderStats();
  if(ps.length)drawChart('provPie',{backgroundColor:'transparent',tooltip:{trigger:'item'},legend:{textStyle:{color:c.text},bottom:0},
    series:[{type:'pie',radius:['40%','68%'],data:ps.map(p=>({name:p.name,value:p.requests,itemStyle:{color:p.color}})),label:{color:c.text}}]});
}
function renderHistory(){
  const tbl=document.getElementById('histTable');if(!tbl)return;
  let logs=S.loadUsageLogs().slice().sort((a,b)=>b.timestamp-a.timestamp);
  const q=(document.getElementById('histSearch')?.value||'').toLowerCase();
  const st=document.getElementById('histStatus')?.value||'';
  if(q)logs=logs.filter(l=>(l.model||'').toLowerCase().includes(q)||getProviderMeta(l.provider).name.toLowerCase().includes(q));
  if(st)logs=logs.filter(l=>l.status===st);
  if(!logs.length){tbl.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:28px">无匹配记录</td></tr>`;return;}
  let rows=logs.slice(0,200).map(l=>{
    const meta=getProviderMeta(l.provider);const stBadge=l.status==='success'?'green':'red';
    return `<tr style="cursor:pointer" onclick="openRequestDetail('${l.id}')" title="点击查看请求详情"><td class="mono">${fmtDate(l.timestamp)}</td><td><span class="prov-logo-sm" style="background:${meta.color}"><svg><use href="#${meta.logo||'icon-logo-other'}"/></svg></span> ${esc(meta.name)}</td><td>${esc(l.model||'-')}</td><td><span class="badge ${stBadge}">${l.status==='success'?'成功':'失败'}</span></td><td>${l.totalTokens||0}</td><td>${l.latency?l.latency+'s':'-'}</td></tr>`;
  }).join('');
  tbl.innerHTML=`<thead><tr><th>时间</th><th>Provider</th><th>Model</th><th>状态</th><th onclick="sortHist('tokens')">Token</th><th>延迟</th></tr></thead><tbody>${rows}</tbody>`;
}
function sortHist(){} // 占位（按默认时间倒序已满足）

/* ============================================================
   Security Center
   ============================================================ */
function renderSecurity(){
  const sec=A.getSecurityScore();
  const secClass=sec.level==='Good'?'good':sec.level==='Fair'?'warn':'bad';
  const secLabel=sec.level==='Good'?'良好':sec.level==='Fair'?'一般':'较弱';
  document.getElementById('secCards').innerHTML=`
    <div class="stat-block" style="grid-column:span 2"><div class="sb-label">安全评分</div>
      <div class="score-ring"><div class="score-num ${secClass}">${sec.score}</div><div><div class="score-label">/ 100</div><div class="badge ${sec.level==='Good'?'green':sec.level==='Fair'?'amber':'red'}">${secLabel}</div></div></div></div>
    ${card('密钥总数',A.getTotalKeys(),'已保存','skeys')}
    ${card('风险数',A.getRisks().length,'检测到的风险','srisks')}`;
  document.getElementById('secChecks').innerHTML=sec.checks.map(c=>{
    const ic=c.status==='pass'?'<svg><use href="#icon-check"/></svg>':c.status==='warn'?'<svg><use href="#icon-alert"/></svg>':'<svg><use href="#icon-x"/></svg>';
    return `<div class="check-item"><span class="check-ic ${c.status}">${ic}</span><div style="flex:1"><b>${esc(c.label)}</b><div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(c.detail)}</div></div></div>`;
  }).join('');
  const risks=A.getRisks();
  const box=document.getElementById('riskList');
  if(!risks.length){box.innerHTML=emptyHtml('暂无风险','继续保持良好安全习惯。');}
  else box.innerHTML=risks.map((r,i)=>`<div class="risk-item" onclick="openRisk(${i})"><div class="risk-lvl ${r.level}"></div><div class="risk-main"><div class="risk-title">${esc(r.title)}</div><div class="risk-detail">${esc(r.detail)}</div></div><span class="badge ${r.level==='high'||r.level==='critical'?'red':r.level==='medium'?'amber':'gray'}">${r.level}</span></div>`).join('');
  window.__risks=risks;
  document.getElementById('rotationGuide').innerHTML=`
    <b>安全轮换流程（Vault 不会替你修改第三方平台）：</b><br>
    1. 在 Provider 后台创建新 Key<br>
    2. 在 Vault 中「添加新 Key」并保存<br>
    3. 在测试台用新 Key 验证可用<br>
    4. 将旧 Key 标记为 <b>Deprecated</b><br>
    5. 确认新 Key 稳定后删除旧 Key`;
}
function openRisk(i){
  const r=window.__risks?.[i];if(!r)return;
  document.getElementById('riskTitle').textContent=r.title;
  document.getElementById('riskBody').innerHTML=`<div style="font-size:14px;line-height:1.7">${esc(r.detail)}</div><div style="margin-top:14px;color:var(--text3);font-size:12px">风险等级：<b>${r.level}</b></div>`;
  openModal('risk-modal');
}
function openProviderDetail(id){
  const stats=A.getProviderStats().find(p=>p.provider===id);const meta=getProviderMeta(id);
  document.getElementById('provTitle').textContent=meta.name;
  document.getElementById('provBody').innerHTML=stats?`<div><b>请求数：</b> ${stats.requests}</div><div><b>总 Token：</b> ${stats.tokens}</div><div><b>成功率：</b> ${Math.round(stats.successRate*100)}%</div><div><b>最近使用：</b> ${stats.lastUsed?fmtDate(stats.lastUsed):'从未'}</div><div style="margin-top:12px;color:var(--text3);font-size:12px">Endpoint：${meta.baseUrl||'自定义'}</div>`:'暂无该 Provider 的用量数据。';
  openModal('prov-modal');
}

/* ============================================================
   Playground
   ============================================================ */
function initPlayground(){
  const psel=document.getElementById('pgProvider');
  if(psel)psel.innerHTML=PROVIDERS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  refreshKeySelect();
  onPgProviderChange();
}
function refreshKeySelect(){
  const ksel=document.getElementById('pgKey');if(!ksel)return;
  const cur=ksel.value;
  ksel.innerHTML=keys.map(k=>`<option value="${k.id}">${esc(k.name)} · ${esc(getProviderMeta(k.provider).name)}</option>`).join('');
  if(cur)ksel.value=cur;
}
function onPgProviderChange(){
  const id=document.getElementById('pgProvider')?.value;if(!id)return;
  const p=getProviderMeta(id);
  const ep=document.getElementById('pgEndpoint');if(ep&&!ep.value)ep.value=p.baseUrl;
  const ms=document.getElementById('pgModel');if(ms)ms.innerHTML=p.models.map(m=>`<option>${m}</option>`).join('');
}
async function runPlayground(){
  const btn=document.getElementById('pgSend');btn.disabled=true;btn.textContent='发送中…';
  const providerId=document.getElementById('pgProvider').value;
  const keyId=document.getElementById('pgKey').value;
  const model=document.getElementById('pgModel').value;
  const endpoint=document.getElementById('pgEndpoint').value.trim();
  const systemPrompt=document.getElementById('pgSystem').value;
  const userPrompt=document.getElementById('pgUser').value;
  const resp=document.getElementById('pgResponse');const meta=document.getElementById('pgMeta');
  resp.textContent='请求中…';meta.style.display='none';
  const r=await sendPlaygroundRequest({providerId,keyId,model,endpoint,systemPrompt,userPrompt});
  if(r.ok){
    resp.textContent=r.text||'(空响应)';
    meta.style.display='flex';
    meta.innerHTML=`<div class="m">状态<b><span class="pg-status-pill pg-status-200">${r.status} OK</span></b></div>
      <div class="m">延迟<b>${r.latency}s</b></div>
      <div class="m">Prompt<b>${r.promptTokens}</b></div>
      <div class="m">Completion<b>${r.completionTokens}</b></div>
      <div class="m">Total<b>${r.totalTokens}</b></div>`;
    addActivity('api_success',keyId,{provider:providerId,model});
    toast('请求成功');
  }else{
    resp.textContent='请求失败\n\n'+(r.message||'未知错误');
    meta.style.display='flex';
    meta.innerHTML=`<div class="m">状态<b><span class="pg-status-pill pg-status-err">${r.status?r.status+' ':'Error'}</span></b></div><div class="m">延迟<b>${r.latency||'-'}s</b></div>`;
    addActivity('api_failed',keyId,{provider:providerId,error:r.error});
    if(r.error==='network')toast('网络错误：无法连接 Provider','error');else toast('请求失败：'+(r.status||''),'error');
  }
  btn.disabled=false;btn.textContent='发送请求';
  refreshKeySelect();
}
function onKeyUsed(keyId,success){
  const k=keys.find(x=>x.id===keyId);if(!k)return;
  k.lastUsed=Date.now();k.requestCount=(k.requestCount||0)+1;
  saveAll().then(()=>{if(currentView==='keys')renderKeys();});
}

/* ============================================================
   导出（含明文二次确认）
   ============================================================ */
function exportMenu(){openExportModal();}
function openExportModal(){
  let m=document.getElementById('export-modal');
  if(!m){
    m=document.createElement('div');m.id='export-modal';m.className='modal-overlay';
    const arrow=`<svg class="i i-sm"><use href="#icon-arrow-right"/></svg>`;
    m.innerHTML=`<div class="modal"><h2>导出 Vault</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:18px;line-height:1.6">默认推荐加密导出。导出明文 Key 需二次确认。</p>
      <button class="settings-item" onclick="exportEncrypted()"><span class="settings-item-left"><span class="settings-item-icon"><svg class="i"><use href="#icon-lock"/></svg></span><span>加密导出（JSON，安全）</span></span><span class="settings-item-arrow">${arrow}</span></button>
      <button class="settings-item" onclick="exportCSV()"><span class="settings-item-left"><span class="settings-item-icon"><svg class="i"><use href="#icon-doc"/></svg></span><span>导出 CSV（明文 Key）</span></span><span class="settings-item-arrow">${arrow}</span></button>
      <button class="settings-item" onclick="exportExcel()"><span class="settings-item-left"><span class="settings-item-icon"><svg class="i"><use href="#icon-pie"/></svg></span><span>导出 Excel（明文 Key）</span></span><span class="settings-item-arrow">${arrow}</span></button>
      <div class="form-actions"><button class="btn btn-secondary" onclick="closeModalEl('export-modal')">取消</button></div></div>`;
    document.body.appendChild(m);
  }
  openModal('export-modal');
}
function downloadBlob(name,blob){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportEncrypted(){
  if(!keys.length){toast('没有可导出的数据','error');return;}
  const payload={exportedAt:Date.now(),config:S.loadCfg(),data:S.loadData(),usageLogs:S.loadUsageLogs(),activity:S.loadActivity()};
  downloadBlob('vault_encrypted_'+Date.now()+'.json',new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  closeModalEl('export-modal');toast('已导出加密备份');
}
async function exportCSV(){
  if(!await confirmDialog('警告：CSV 将包含明文 API Key。\n任何获得该文件的人都能直接使用你的密钥。\n确定继续导出明文？'))return;
  if(!await confirmDialog('再次确认：导出明文 API Key 到 CSV 文件？'))return;
  const rows=[['名称','Provider','环境','状态','API Key','标签','创建时间','最近使用','请求数']];
  keys.forEach(k=>rows.push([k.name,getProviderMeta(k.provider).name,k.env,k.status,k.apiKey,(k.tags||[]).join('|'),k.createdAt?fmtDate(k.createdAt):'',k.lastUsed?fmtDate(k.lastUsed):'',k.requestCount||0]));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob('vault_keys_'+Date.now()+'.csv',new Blob(['\ufeff'+csv],{type:'text/csv'}));
  closeModalEl('export-modal');toast('已导出 CSV（明文）','info');
}
async function exportExcel(){
  if(typeof require!=='function'){toast('Excel 导出仅桌面版支持，浏览器请用 CSV','info');return;}
  try{
    if(!await confirmDialog('Excel 将包含明文 API Key。确定继续？'))return;
    const XLSX=require('xlsx');const {ipcRenderer}=require('electron');
    const data=keys.map(k=>({'名称':k.name,'Provider':getProviderMeta(k.provider).name,'环境':k.env,'状态':k.status,'API Key':k.apiKey,'标签':(k.tags||[]).join(','),'创建时间':k.createdAt?fmtDate(k.createdAt):''}));
    const ws=XLSX.utils.json_to_sheet(data);ws['!cols']=[{wch:20},{wch:16},{wch:14},{wch:12},{wch:50},{wch:20},{wch:20}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'API Keys');
    const buf=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});
    const saved=await ipcRenderer.invoke('save-file-dialog',{defaultName:'vault_'+Date.now()+'.xlsx',data:buf.toString('base64')});
    if(saved)toast('导出成功');
    closeModalEl('export-modal');
  }catch(e){toast('导出失败: '+e.message,'error');}
}

/* ============================================================
   重置所有数据
   ============================================================ */
async function resetAll(){
  if(!await confirmDialog('确定要重置所有数据？\n\n这将清除所有 API Key、设置与日志，此操作不可撤销！'))return;
  if(!await confirmDialog('再次确认：删除所有数据并恢复初始状态？'))return;
  isResetting=true;monitoringActive=false;
  mk=null;keys=[];visSet.clear();setupPw='';resetVerifiedMk=null;
  if(lGL){lGL.destroy();lGL=null}if(setupGL){setupGL.destroy();setupGL=null}if(resetGL1){resetGL1.destroy();resetGL1=null}if(resetGL2){resetGL2.destroy();resetGL2=null}
  document.getElementById('kg').innerHTML='';
  document.getElementById('spw').value='';document.getElementById('spw2').value='';document.getElementById('lpw').value='';
  document.querySelectorAll('.modal-overlay.show').forEach(m=>m.style.display='none');
  S.clearAll();setTheme('dark');updateNoLockBtn(false);lastCfg=false;
  document.getElementById('s1').classList.add('active');document.getElementById('s2').classList.remove('active');
  showScreen('setup-screen');
  setTimeout(()=>{isResetting=false;document.getElementById('spw')?.focus()},100);
  toast('已重置，所有数据已清除');
}
