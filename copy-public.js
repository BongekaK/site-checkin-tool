const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source directory ${src} does not exist. Skipping copy.`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  copyDir(path.join(__dirname, 'src', 'public'), path.join(__dirname, 'dist', 'public'));
  console.log('Public assets copied successfully.');
} catch (err) {
  console.error('Error copying public assets:', err);
  process.exit(1);
}
