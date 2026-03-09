const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://github.com/vladmandic/face-api/raw/master/model';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const MODELS_DIR = path.join(__dirname, 'models');

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const dest = path.join(MODELS_DIR, filename);
    const file = fs.createWriteStream(dest);
    
    function get(url) {
      https.get(url, (response) => {
        // Redirect kuzatish
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          get(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          const size = fs.statSync(dest).size;
          console.log(`✅ Yuklandi: ${filename} (${(size/1024/1024).toFixed(2)} MB)`);
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }
    
    console.log(`⬇️  Yuklanmoqda: ${filename}`);
    get(`${BASE_URL}/${filename}`);
  });
}

async function downloadAll() {
  console.log('🚀 Modellar yuklanmoqda...\n');
  for (const file of FILES) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`❌ Xatolik: ${file}`, err.message);
    }
  }
  console.log('\n✅ Barcha modellar yuklandi!');
}

downloadAll();