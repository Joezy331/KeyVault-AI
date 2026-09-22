const sharp = require('sharp');
const path = require('path');

const SIZE = 1024;
const CORNER_R = 220;
const SRC = path.join(__dirname, 'assets', 'app-icon.jpg');

async function main() {
  const outDir = __dirname;

  // 读取用户提供的封面图，缩放并裁切成带圆角的方形图标
  const base = await sharp(SRC)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .composite([{
      input: Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${SIZE}" height="${SIZE}" rx="${CORNER_R}" ry="${CORNER_R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
      </svg>`),
      blend: 'over'
    }])
    .png()
    .toBuffer();

  const sizes = [1024, 512, 256, 128, 64, 48, 32, 16];
  for (const s of sizes) {
    const out = s === 1024
      ? path.join(outDir, 'icon-vault-md.png')
      : path.join(outDir, `icon-vault-md-${s}.png`);
    await sharp(base).resize(s, s).png().toFile(out);
    console.log(`  -> ${out} (${s}x${s})`);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
