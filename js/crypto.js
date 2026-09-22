/**
 * KeyVault AI — crypto.js
 * 安全核心（从原版 Vault 完整保留，未做任何弱化）
 *
 * 职责：
 *   1. 工具函数（b64 / ub64 / hex / uuid / fmtDate / maskKey）
 *   2. 加密模块 C（PBKDF2 + AES-256-GCM + SHA-256）
 *   3. 存储模块 S（localStorage 封装 + 日志读写）
 *   4. 手势锁类 GL（3×3 九宫格）
 *
 * 安全原则（不可破坏）：
 *   - API Key 一律 AES-256-GCM 加密存储，localStorage 中不存在明文
 *   - 主密钥 mk 仅驻留内存，锁定后清空
 *   - 日志中仅保存 keyId，绝不保存明文 Key / Authorization / Bearer / 完整请求
 */

/* ============================================================
   1. 常量
   ============================================================ */
const SC = 'vault_config';     // 安全配置
const SD = 'vault_data';       // 加密后的 API Key 列表
const UL = 'vault_usage_logs'; // 使用日志（仅 keyId）
const AL = 'vault_activity';    // 活动日志
const TV = 'VAULT_OK';          // AES-GCM 验证值

/** 免密访问固定的派生盐（16字节） */
const NOLOCK_SALT = new Uint8Array([86,97,117,108,116,78,111,76,111,99,107,83,97,108,116,33]);

/* ============================================================
   2. 工具函数
   ============================================================ */
function b64(a){const b=new Uint8Array(a);let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)}
function ub64(s){const d=atob(s),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);return a.buffer}
function hex(a){return Array.from(new Uint8Array(a)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function fmtDate(t){return new Date(t).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function maskKey(k){
  if(!k) return '••••';
  if(k.length<=8) return '•'.repeat(k.length);
  return k.substring(0,4)+'•'.repeat(Math.min(k.length-8,20))+k.substring(k.length-4);
}

/* ============================================================
   3. 加密模块 C
   PBKDF2 + AES-256-GCM + SHA-256
   ============================================================ */
const C = {
  genSalt(){return crypto.getRandomValues(new Uint8Array(16))},
  genIV(){return crypto.getRandomValues(new Uint8Array(12))},

  /** PBKDF2 密码/手势 → AES-256-GCM 密钥 */
  async derive(input,salt){
    const km = await crypto.subtle.importKey('raw',new TextEncoder().encode(input),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},
      km,
      {name:'AES-GCM',length:256},
      true,
      ['encrypt','decrypt','wrapKey','unwrapKey']
    );
  },

  /** AES-256-GCM 加密 */
  async enc(pt,key){
    const iv = this.genIV();
    const ct = await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(pt));
    return {c:b64(ct), i:b64(iv)};
  },

  /** AES-256-GCM 解密 */
  async dec(ci,ii,key){
    const d = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(ii))},key,ub64(ci));
    return new TextDecoder().decode(d);
  },

  /** SHA-256 哈希 */
  async hash(d){
    const h = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d));
    return hex(h);
  }
};

/* ============================================================
   4. 存储模块 S
   ============================================================ */
const S = {
  /* —— 配置 —— */
  saveCfg(c){localStorage.setItem(SC,JSON.stringify(c))},
  loadCfg(){try{return JSON.parse(localStorage.getItem(SC))}catch{return null}},

  /* —— 加密 Key 数据 —— */
  saveData(d){localStorage.setItem(SD,JSON.stringify(d))},
  loadData(){try{return JSON.parse(localStorage.getItem(SD)||'[]')}catch{return[]}},

  /* —— 使用日志（仅 keyId，绝不存明文 Key） —— */
  saveUsageLogs(a){localStorage.setItem(UL,JSON.stringify(a))},
  loadUsageLogs(){try{return JSON.parse(localStorage.getItem(UL)||'[]')}catch{return[]}},

  /* —— 活动日志 —— */
  saveActivity(a){localStorage.setItem(AL,JSON.stringify(a))},
  loadActivity(){try{return JSON.parse(localStorage.getItem(AL)||'[]')}catch{return[]}},

  /* —— 危险操作：清空全部 —— */
  clearAll(){
    localStorage.removeItem(SC);
    localStorage.removeItem(SD);
    localStorage.removeItem(UL);
    localStorage.removeItem(AL);
    localStorage.removeItem('vault_theme');
  }
};

/* ============================================================
   5. 手势锁类 GL（3×3 九宫格）
   安全说明：仅存储 SHA-256 哈希，不可逆推
   ============================================================ */
class GL{
  constructor(wid,cid,cb){
    this.w = document.getElementById(wid);
    this.cv = document.getElementById(cid);
    this.ctx = this.cv.getContext('2d');
    this.cb = cb;
    this.dots = [];
    this.sel = [];
    this.drawing = false;
    this._init();
  }
  _init(){
    this.grid = document.createElement('div');
    this.grid.className = 'gesture-grid';
    for(let i=0;i<9;i++){
      const d = document.createElement('div');
      d.className = 'g-dot';
      d.dataset.i = i;
      this.grid.appendChild(d);
      this.dots.push(d);
    }
    this.w.appendChild(this.grid);
    this._resize();
    this._onResize = ()=>this._resize();
    this._onPd = this._pd.bind(this);
    this._onPm = this._pm.bind(this);
    this._onPu = this._pu.bind(this);
    this.w.addEventListener('pointerdown',this._onPd);
    this.w.addEventListener('pointermove',this._onPm);
    this.w.addEventListener('pointerup',this._onPu);
    window.addEventListener('resize',this._onResize);
  }
  _resize(){const r=this.w.getBoundingClientRect();this.cv.width=r.width;this.cv.height=r.height}
  _center(i){const wr=this.w.getBoundingClientRect(),dr=this.dots[i].getBoundingClientRect();return{x:dr.left-wr.left+dr.width/2,y:dr.top-wr.top+dr.height/2}}
  _hit(x,y){for(let i=0;i<9;i++){const c=this._center(i);if(Math.hypot(x-c.x,y-c.y)<28)return i}return -1}
  _sel(i){this.sel.push(i);this.dots[i].classList.add('active');this._draw()}
  _draw(){
    this.ctx.clearRect(0,0,this.cv.width,this.cv.height);
    if(this.sel.length<2)return;
    this.ctx.beginPath();
    this.ctx.strokeStyle='#6366f1';
    this.ctx.lineWidth=3;
    this.ctx.lineCap='round';
    this.ctx.lineJoin='round';
    const f=this._center(this.sel[0]);
    this.ctx.moveTo(f.x,f.y);
    for(let j=1;j<this.sel.length;j++){const p=this._center(this.sel[j]);this.ctx.lineTo(p.x,p.y)}
    this.ctx.stroke();
  }
  _drawTo(x,y){
    this._draw();
    if(this.sel.length>0){
      const l=this._center(this.sel[this.sel.length-1]);
      this.ctx.beginPath();
      this.ctx.strokeStyle='rgba(99,102,241,.5)';
      this.ctx.lineWidth=2;
      this.ctx.lineCap='round';
      this.ctx.moveTo(l.x,l.y);
      this.ctx.lineTo(x,y);
      this.ctx.stroke();
    }
  }
  _pd(e){
    e.preventDefault();
    this.w.setPointerCapture(e.pointerId);
    this.drawing=true;
    this.sel=[];
    this.dots.forEach(d=>{d.classList.remove('active','error','success')});
    this._resize();
    const r=this.w.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=this._hit(x,y);
    if(h>=0)this._sel(h);
  }
  _pm(e){
    if(!this.drawing)return;
    const r=this.w.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=this._hit(x,y);
    if(h>=0&&!this.sel.includes(h))this._sel(h);
    this._drawTo(x,y);
  }
  _pu(e){
    this.drawing=false;
    this.ctx.clearRect(0,0,this.cv.width,this.cv.height);
    this._draw();
    if(this.sel.length>=4){this.cb(this.sel.join(''),this)}
    else if(this.sel.length>0){this._markError();setTimeout(()=>this.reset(),600)}
  }
  _markError(){this.dots.forEach(d=>{if(d.classList.contains('active')){d.classList.remove('active');d.classList.add('error')}})}
  _markSuccess(){this.dots.forEach(d=>{if(d.classList.contains('active')){d.classList.remove('active');d.classList.add('success')}})}
  reset(){this.sel=[];this.dots.forEach(d=>d.classList.remove('active','error','success'));this.ctx.clearRect(0,0,this.cv.width,this.cv.height)}
  destroy(){
    this.reset();
    window.removeEventListener('resize',this._onResize);
    this.w.removeEventListener('pointerdown',this._onPd);
    this.w.removeEventListener('pointermove',this._onPm);
    this.w.removeEventListener('pointerup',this._onPu);
    if(this.grid&&this.grid.parentNode)this.grid.remove();
  }
}
