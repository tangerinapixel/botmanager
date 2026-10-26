// backend/wa-engine/syncVendor.js
// Sincroniza o código-fonte vendorizado e versionado no Git (backend/vendor/wwebjs)
// para a pasta de runtime (backend/node_modules/whatsapp-web.js), garantindo soberania
// total do código sem criar symlinks frágeis no Windows.

const fs = require('fs');
const path = require('path');

const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor', 'wwebjs');
const TARGET_DIR = path.resolve(__dirname, '..', 'node_modules', 'whatsapp-web.js');

const ESSENTIAL_FILES = [
  'package.json',
  'index.js',
  'index.d.ts',
  'LICENSE',
  'README.md'
];

function copyDirRecursive(sourceDir, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    // Ignora node_modules aninhado, pastas de git e caches
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.husky') {
      continue;
    }

    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function calculateDirSize(dirPath) {
  let totalBytes = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalBytes += calculateDirSize(fullPath);
    } else {
      totalBytes += fs.statSync(fullPath).size;
    }
  }
  return totalBytes;
}

function sync() {
  console.log('[syncVendor] Verificando integridade do WhatsApp-Web.js vendorizado...');

  // Se o vendor ainda não existe, inicializa a partir do node_modules existente
  if (!fs.existsSync(VENDOR_DIR) || !fs.existsSync(path.join(VENDOR_DIR, 'src'))) {
    console.log('[syncVendor] Inicializando backend/vendor/wwebjs a partir do node_modules ativo...');
    if (!fs.existsSync(TARGET_DIR)) {
      console.error('[syncVendor] Erro: node_modules/whatsapp-web.js não encontrado para bootstrap.');
      process.exit(1);
    }

    fs.mkdirSync(VENDOR_DIR, { recursive: true });

    // Copia arquivos essenciais
    for (const file of ESSENTIAL_FILES) {
      const srcFile = path.join(TARGET_DIR, file);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(VENDOR_DIR, file));
      }
    }

    // Copia src/
    copyDirRecursive(path.join(TARGET_DIR, 'src'), path.join(VENDOR_DIR, 'src'));

    const sizeKb = (calculateDirSize(VENDOR_DIR) / 1024).toFixed(2);
    console.log(`[syncVendor] Vendor inicializado com sucesso (${sizeKb} KB).`);
    return;
  }

  // Se o vendor já existe, espelha para o node_modules de execução
  console.log('[syncVendor] Espelhando backend/vendor/wwebjs para backend/node_modules/whatsapp-web.js...');
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  for (const file of ESSENTIAL_FILES) {
    const srcFile = path.join(VENDOR_DIR, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(TARGET_DIR, file));
    }
  }

  copyDirRecursive(path.join(VENDOR_DIR, 'src'), path.join(TARGET_DIR, 'src'));

  const sizeKb = (calculateDirSize(VENDOR_DIR) / 1024).toFixed(2);
  console.log(`[syncVendor] Sincronização concluída com sucesso (${sizeKb} KB espelhados).`);
}

sync();
