const fs = require('fs');
const path = require('path');

const staticDir = path.join(__dirname, '../src/static');

if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

const createPNG = (width, height, r, g, b) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  ihdr[18] = 0;
  ihdr[19] = 0;
  ihdr[20] = 0;
  
  const crc32 = (buf) => {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdr.slice(4, 21)), 0);
  
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      if (dist < width / 3) {
        rawData.push(r, g, b, 255);
      } else {
        rawData.push(0, 0, 0, 0);
      }
    }
  }
  
  const { deflateSync } = require('zlib');
  const compressed = deflateSync(Buffer.from(rawData));
  
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idat.slice(4, 8 + compressed.length)), 0);
  
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  
  return Buffer.concat([signature, ihdr, ihdrCrc, idat, idatCrc, iend]);
};

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

icons.forEach(icon => {
  const png = createPNG(48, 48, icon.color[0], icon.color[1], icon.color[2]);
  fs.writeFileSync(path.join(staticDir, icon.name), png);
  console.log(`Created: ${icon.name}`);
});

console.log('All icons created successfully!');
