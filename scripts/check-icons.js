const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const staticDir = path.join(__dirname, '../src/static');
const pngFiles = fs.readdirSync(staticDir).filter(f => f.endsWith('.png'));

console.log('检查 PNG 图标文件:\n');

pngFiles.forEach(file => {
  const filePath = path.join(staticDir, file);
  const stats = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  
  console.log(`文件: ${file}`);
  console.log(`  大小: ${stats.size} bytes`);
  
  // 检查 PNG 签名
  const signature = buffer.slice(0, 8);
  const isPngSignature = signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71;
  console.log(`  PNG 签名: ${isPngSignature ? '✓ 正确' : '✗ 错误'}`);
  
  if (buffer.length >= 24) {
    // 读取 IHDR chunk
    const ihdrLength = buffer.readUInt32BE(8);
    const ihdrType = buffer.slice(12, 16).toString();
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    
    console.log(`  IHDR 类型: ${ihdrType}`);
    console.log(`  尺寸: ${width}x${height}`);
    console.log(`  IHDR 长度: ${ihdrLength}`);
  }
  
  console.log('');
});
