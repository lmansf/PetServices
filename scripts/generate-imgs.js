#!/usr/bin/env node
// scripts/generate-imgs.js
// Scans the ./imgs directory (relative to repo root) and writes imgs.json
// Usage: node scripts/generate-imgs.js

const fs = require('fs');
const path = require('path');

const IMG_DIR = path.join(__dirname, '..', 'imgs');
const OUT_FILE = path.join(__dirname, '..', 'imgs.json');

function isImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp'].includes(ext);
}

function main() {
  try {
    if (!fs.existsSync(IMG_DIR)) {
      console.error('imgs directory not found at', IMG_DIR);
      process.exit(1);
    }

    const files = fs.readdirSync(IMG_DIR)
      .filter(f => isImage(f))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    fs.writeFileSync(OUT_FILE, JSON.stringify(files, null, 2) + '\n', 'utf8');
    console.log('Wrote', OUT_FILE, 'with', files.length, 'entries');
  } catch (err) {
    console.error('Error generating imgs.json:', err);
    process.exit(2);
  }
}

if (require.main === module) main();
