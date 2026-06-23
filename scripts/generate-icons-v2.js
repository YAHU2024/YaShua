const fs = require('fs');
const path = require('path');

const staticDir = path.join(__dirname, '../src/static');

if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

// 创建简单的 PNG 图标（使用最小的有效 PNG 格式）
function createSimplePNG(filename, r, g, b) {
  // PNG 文件结构
  const width = 48;
  const height = 48;
  
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);  // width
  ihdrData.writeUInt32BE(height, 4); // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(6, 9);         // color type (RGBA)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // 创建图像数据 - 简单的圆形图标
  const rawData = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = 16;
  
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (dist <= radius) {
        // 圆形内部
        rawData.push(r, g, b, 255);
      } else if (dist <= radius + 1) {
        // 边缘抗锯齿
        const alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - dist) * 255)));
        rawData.push(r, g, b, alpha);
      } else {
        // 外部透明
        rawData.push(0, 0, 0, 0);
      }
    }
  }
  
  // 压缩数据
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  // 组合所有部分
  const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  
  // 写入文件
  fs.writeFileSync(path.join(staticDir, filename), png);
  console.log(`Created: ${filename} (${png.length} bytes)`);
}

// 创建 PNG chunk（包含长度、类型、数据和 CRC）
function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 计算
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 创建图标
const icons = [
  { name: 'tab-home.png', color: [153, 153, 153] },
  { name: 'tab-home-active.png', color: [102, 126, 234] },
  { name: 'tab-library.png', color: [153, 153, 153] },
  { name: 'tab-library-active.png', color: [102, 126, 234] },
  { name: 'tab-wrong.png', color: [153, 153, 153] },
  { name: 'tab-wrong-active.png', color: [102, 126, 234] },
  { name: 'tab-settings.png', color: [153, 153, 153] },
  { name: 'tab-settings-active.png', color: [102, 126, 234] },
];

console.log('开始生成图标...\n');
icons.forEach(icon => {
  createSimplePNG(icon.name, icon.color[0], icon.color[1], icon.color[2]);
});

console.log('\n所有图标生成完成！');
