// npm run dist: sobe a versão (0.1.001 -> 0.1.002) e gera o instalador.
// npm run release: faz o mesmo e envia os arquivos para um rascunho de release no GitHub (precisa de GH_TOKEN).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { formatVersion } = require('../lib/version');

const root = path.join(__dirname, '..');
const packageFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

const [major, minor, patch] = pkg.version.split('.').map(Number);
pkg.version = `${major}.${minor}.${patch + 1}`;
fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

const displayVersion = formatVersion(pkg.version);
console.log(`Gerando MUSIC-E ${displayVersion}`);

// Sem espaços no nome: o GitHub troca espaços por pontos e a atualização não acharia o arquivo.
const publish = process.argv.includes('--publish') ? 'always' : 'never';
const result = spawnSync(
  `npx electron-builder --win nsis --publish ${publish} "-c.artifactName=MUSIC-E-Setup-${displayVersion}.\${ext}"`,
  { cwd: root, stdio: 'inherit', shell: true }
);
process.exit(result.status ?? 1);
