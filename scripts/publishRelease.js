// scripts/publishRelease.js
// Script turbo para criar a release e fazer upload direto dos arquivos da pasta dist/ para o GitHub Releases

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Obtém versão do package.json
const rootPkg = require('../package.json');
const version = rootPkg.version;
const tagName = `v${version}`;
const distDir = path.join(__dirname, '..', 'dist');

console.log(`\n🚀 INICIANDO PUBLICAÇÃO TURBO PARA A RELEASE ${tagName}...`);

// 2. Obtém token do Git Credential Manager
function getGitToken() {
  try {
    const input = 'protocol=https\nhost=github.com\nusername=tangerinapixel\n\n';
    const out = execSync('git credential fill', { input, encoding: 'utf-8' });
    const pass = out.split('\n').find(l => l.startsWith('password='));
    if (!pass) throw new Error('Token não encontrado');
    return pass.replace('password=', '').trim();
  } catch (err) {
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    throw new Error('Não foi possível obter o token de acesso do GitHub.');
  }
}

const token = getGitToken();

// 3. Localiza os arquivos a enviar na pasta dist/
if (!fs.existsSync(distDir)) {
  console.error('❌ Pasta dist/ não encontrada! Execute "npm run dist" primeiro.');
  process.exit(1);
}

const allDistFiles = fs.readdirSync(distDir);
const filesToUpload = allDistFiles.filter(f => {
  if (f.endsWith('.exe') && (f.includes(version) || f.includes('Bot Manager X') || f.includes('Bot-Manager-X'))) return true;
  if (f.endsWith('.blockmap') && (f.includes(version) || f.includes('Bot Manager X') || f.includes('Bot-Manager-X'))) return true;
  if (f === 'latest.yml') return true;
  return false;
});

if (filesToUpload.length === 0) {
  console.error(`❌ Nenhum instalador da versão ${version} encontrado na pasta dist/.`);
  console.error('Arquivos presentes em dist/:', allDistFiles.filter(f => f.endsWith('.exe') || f.endsWith('.yml')));
  process.exit(1);
}

console.log(`📦 Arquivos identificados para upload da versão ${version}:`);
filesToUpload.forEach(f => console.log(`   - ${f}`));

// 4. Cria ou localiza a Release no GitHub
async function getOrCreateRelease() {
  return new Promise((resolve, reject) => {
    // Primeiro tenta buscar se já existe
    https.get({
      hostname: 'api.github.com',
      path: `/repos/tangerinapixel/botmanager/releases/tags/${tagName}`,
      headers: {
        'User-Agent': 'BotManager-Release-CLI',
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          console.log(`ℹ️ Release ${tagName} já existe no GitHub (ID: ${json.id}).`);
          return resolve(json);
        }

        // Se não existe, cria a Release oficial
        console.log(`✨ Criando nova Release ${tagName} no GitHub...`);
        const postData = JSON.stringify({
          tag_name: tagName,
          name: `Bot Manager X - Versão ${version}`,
          body: `## 🚀 Bot Manager X v${version}\n\n- Atualização com Auto-Update e melhorias gerais.\n- Instalador e arquivos de atualização anexados.`,
          draft: false,
          prerelease: false
        });

        const postReq = https.request({
          hostname: 'api.github.com',
          path: '/repos/tangerinapixel/botmanager/releases',
          method: 'POST',
          headers: {
            'User-Agent': 'BotManager-Release-CLI',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, postRes => {
          let pb = '';
          postRes.on('data', c => pb += c);
          postRes.on('end', () => {
            if (postRes.statusCode === 201) {
              const newRel = JSON.parse(pb);
              console.log(`✅ Release ${tagName} criada com sucesso (ID: ${newRel.id}).`);
              resolve(newRel);
            } else {
              reject(new Error(`Falha ao criar release (${postRes.statusCode}): ${pb}`));
            }
          });
        });

        postReq.on('error', reject);
        postReq.write(postData);
        postReq.end();
      });
    }).on('error', reject);
  });
}

// 5. Upload de cada arquivo
async function uploadAsset(releaseId, fileName) {
  const filePath = path.join(distDir, fileName);
  const fileSize = fs.statSync(filePath).size;
  const isExe = fileName.endsWith('.exe');
  const contentType = isExe ? 'application/vnd.microsoft.portable-executable' : 'application/octet-stream';

  console.log(`\n⬆️ Enviando ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'uploads.github.com',
      path: `/repos/tangerinapixel/botmanager/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: {
        'User-Agent': 'BotManager-Release-CLI',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': contentType,
        'Content-Length': fileSize
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          const json = JSON.parse(body);
          console.log(`   ✅ Concluído: ${json.name}`);
          resolve(json);
        } else if (res.statusCode === 422) {
          console.log(`   ℹ️ Arquivo ${fileName} já existia nesta release (ignorado).`);
          resolve(null);
        } else {
          reject(new Error(`Falha no upload ${fileName} (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);

    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    let sent = 0;
    stream.on('data', chunk => {
      sent += chunk.length;
      const pct = ((sent / fileSize) * 100).toFixed(0);
      process.stdout.write(`   [Progresso: ${pct}%]\r`);
    });
    stream.pipe(req);
  });
}

async function run() {
  try {
    const release = await getOrCreateRelease();
    for (const file of filesToUpload) {
      await uploadAsset(release.id, file);
    }
    console.log(`\n🎉 RELEASE ${tagName} PUBLICADA COM SUCESSO NO GITHUB!`);
    console.log(`👉 Link oficial: ${release.html_url}\n`);
  } catch (err) {
    console.error('\n❌ Erro durante a publicação:', err.message);
    process.exit(1);
  }
}

run();
