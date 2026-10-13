const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { formatVersion } = require('./version');

// Atualização pelo GitHub Releases (repositório configurado em "build.publish"
// no package.json). `notify` recebe { status, ... } a cada etapa.
function createUpdater(notify) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => notify({ status: 'downloading', version: formatVersion(info.version), percent: 0 }));
  autoUpdater.on('download-progress', (progress) => notify({ status: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', (info) => notify({ status: 'ready', version: formatVersion(info.version) }));

  async function check() {
    // Rodando com `npm start` não há instalador para atualizar.
    if (!app.isPackaged) return { status: 'dev' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.isUpdateAvailable
        ? { status: 'downloading', version: formatVersion(result.updateInfo.version), percent: 0 }
        : { status: 'up-to-date' };
    } catch (error) {
      return { status: 'error', message: error.message.split('\n')[0] };
    }
  }

  // Fecha o app, instala a versão baixada e abre de novo.
  const install = () => autoUpdater.quitAndInstall(true, true);

  return { check, install };
}

module.exports = { createUpdater };
