// A versão do package.json precisa ser semver (0.1.4); na tela e no nome do
// instalador ela aparece com o último número em 3 dígitos (0.1.004).
function formatVersion(version) {
  const [major, minor, patch] = version.split('.');
  return `${major}.${minor}.${String(patch).padStart(3, '0')}`;
}

module.exports = { formatVersion };
