// PWA アイコン生成スクリプト（依存ゼロ・純 Node）。
// ブランドカラー（coral #D9624A）背景に白い花弁モチーフを描き、zlib で PNG を出力する。
// 正式ロゴ確定後は本スクリプトの差し替え、または public/icons の画像直接差し替えで更新する。
//
//   node scripts/generate-pwa-icons.mjs
//
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');

// ブランドカラー（design-system tokens より）。
const CORAL = [0xd9, 0x62, 0x4a];
const WHITE = [0xff, 0xff, 0xff];

// --- PNG エンコード（RGBA, 8bit）-----------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10-12: compression / filter / interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- 花弁モチーフの描画 ---------------------------------------------------
// 5 枚の花弁（放射状に配置した楕円）＋中心円を白で描く。
function isFlower(nx, ny, scale) {
  // nx, ny: 中心を原点とする -1..1 正規化座標。scale: コンテンツ半径（0..1）。
  const r = Math.hypot(nx, ny);
  if (r > scale) return false;
  // 中心円
  if (r <= 0.18 * scale) return true;
  // 5 枚の花弁
  const petalDist = 0.5 * scale; // 花弁中心までの距離
  const aMajor = 0.42 * scale; // 半径方向の半軸
  const aMinor = 0.24 * scale; // 周方向の半軸
  for (let i = 0; i < 5; i++) {
    const theta = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const cx = Math.cos(theta) * petalDist;
    const cy = Math.sin(theta) * petalDist;
    const dx = nx - cx;
    const dy = ny - cy;
    // 花弁の長軸が放射方向を向くよう回転して楕円判定。
    const rx = dx * Math.cos(theta) + dy * Math.sin(theta);
    const ry = -dx * Math.sin(theta) + dy * Math.cos(theta);
    if ((rx * rx) / (aMajor * aMajor) + (ry * ry) / (aMinor * aMinor) <= 1) {
      return true;
    }
  }
  return false;
}

function renderIcon({ size, maskable, rounded }) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = size / 2;
  // maskable はセーフゾーン確保のため content を小さめに。
  const contentScale = maskable ? 0.55 : 0.72;
  // 角丸（透過）の半径。maskable と apple は full-bleed 矩形。
  const cornerR = rounded ? size * 0.22 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // 角丸の外側は透過。
      if (rounded && isOutsideRoundedRect(x, y, size, cornerR)) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }
      const nx = (x + 0.5 - half) / half;
      const ny = (y + 0.5 - half) / half;
      const fg = isFlower(nx, ny, contentScale);
      const [r, g, b] = fg ? WHITE : CORAL;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

function isOutsideRoundedRect(x, y, size, r) {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const minX = r;
  const maxX = size - r;
  const minY = r;
  const maxY = size - r;
  let dx = 0;
  let dy = 0;
  if (cx < minX) dx = minX - cx;
  else if (cx > maxX) dx = cx - maxX;
  if (cy < minY) dy = minY - cy;
  else if (cy > maxY) dy = cy - maxY;
  return dx * dx + dy * dy > r * r;
}

const ICONS = [
  { name: 'icon-192.png', size: 192, maskable: false, rounded: true },
  { name: 'icon-512.png', size: 512, maskable: false, rounded: true },
  { name: 'icon-maskable-192.png', size: 192, maskable: true, rounded: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true, rounded: false },
  // apple-touch-icon は iOS 側で角丸が付くため full-bleed 正方形・不透過。
  { name: 'apple-touch-icon.png', size: 180, maskable: false, rounded: false },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const spec of ICONS) {
  const png = renderIcon(spec);
  writeFileSync(join(OUT_DIR, spec.name), png);
  console.log(`wrote public/icons/${spec.name} (${png.length} bytes)`);
}
