/* KeyVault AI —— 流程图截图脚本
   从 prototype/flow/index.html?diagram=X 导出各流程图 PNG
   产物：prototype/flow/screenshots/flow-*.png
   用法（需先移除 NODE_OPTIONS）：
     env -u NODE_OPTIONS -u ELECTRON_RUN_AS_NODE "node_modules/electron/dist/electron.exe" flow-shot.js
*/
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const baseDir = path.join(__dirname, 'prototype', 'flow');
const outDir = path.join(baseDir, 'screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS_ALL = [
  { key: 'full',       name: 'flow-full' },
  { key: 'portfolio',  name: 'flow-portfolio' },
  { key: 'core',       name: 'flow-core-loop' },
  { key: 'security',   name: 'flow-security' },
  { key: 'activity',   name: 'flow-activity' },
  { key: 'logic',      name: 'flow-logic' }
];
/* 本环境 Electron 连续多窗口易崩（display surface not available），
   支持单目标模式：electron.exe flow-shot.js <key>，由外层脚本逐个进程调用 */
const onlyKey = process.argv[2];
const TARGETS = onlyKey ? TARGETS_ALL.filter(t => t.key === onlyKey) : TARGETS_ALL;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

async function shoot(t) {
  const win = new BrowserWindow({
    useContentSize: true,
    width: 1700,
    height: 1700,
    show: false,
    paintWhenOffscreen: true,
    backgroundColor: '#F6F4EF',
  });
  win.webContents.on('console-message', () => {});
  try {
    const fileUrl = require('url').pathToFileURL(path.join(baseDir, 'index.html')).href;
    const url = fileUrl + '?diagram=' + t.key;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await win.loadURL(url);
        await sleep(900); // 等布局 + 渲染稳定
        const rect = await win.webContents.executeJavaScript(`(function(){
          var el = document.getElementById('d-${t.key}');
          if(!el) return null;
          var r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()`);
        if (!rect) throw new Error('canvas not found');
        // 解除横向滚动裁切，保证 1440 全宽入图（窗口 1700 足够容纳）
        await win.webContents.executeJavaScript(
          `document.querySelectorAll('.flow-scroll').forEach(function(e){ e.style.overflow='visible'; }); 1;`
        );
        await sleep(250);
        const img = await win.webContents.capturePage({
          x: Math.round(rect.x), y: Math.round(rect.y),
          width: Math.round(rect.width), height: Math.round(rect.height)
        });
        fs.writeFileSync(path.join(outDir, t.name + '.png'), img.toPNG());
        console.log('shot', t.name, Math.round(rect.width) + 'x' + Math.round(rect.height));
        return true;
      } catch (e) {
        if (attempt === 3) throw e;
        await sleep(500);
      }
    }
  } finally {
    try { win.destroy(); } catch (e) {}
  }
  return false;
}

(async function main() {
  await app.whenReady();
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  for (const t of TARGETS) {
    try { await shoot(t); }
    catch (e) { console.log('FAIL', t.name, e && e.message); }
    await sleep(200);
  }
  app.quit();
})();
