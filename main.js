const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { enrichLibrary } = require('./lib/enrich');
const { applyRenames, artistKey, buildLibrary, planRenames } = require('./lib/library');
const { createStore } = require('./lib/store');
const { createUpdater } = require('./lib/updater');
const { formatVersion } = require('./lib/version');

// Resolução de design da aplicação (igual ao frame do Figma).
const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 900;

let mainWindow = null;
let store = null;
let updater = null;

// A janela inteira é escalada (layout idêntico ao design) conforme a resolução
// escolhida nas configurações, e encolhe mais se não couber na tela.
function getScale() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return Math.min(store.getSettings().app.scale, width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

function applyScale() {
  const scale = getScale();
  // Janelas não redimensionáveis ignoram setContentSize no Windows.
  mainWindow.setResizable(true);
  mainWindow.setContentSize(Math.round(DESIGN_WIDTH * scale), Math.round(DESIGN_HEIGHT * scale));
  mainWindow.setResizable(false);
  mainWindow.webContents.setZoomFactor(scale);
  mainWindow.center();
}

function createWindow() {
  const scale = getScale();

  mainWindow = new BrowserWindow({
    width: Math.round(DESIGN_WIDTH * scale),
    height: Math.round(DESIGN_HEIGHT * scale),
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    title: 'MUSIC-E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(scale);
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    stopWindowDrag();
    mainWindow = null;
  });
}

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:close', () => mainWindow?.close());

// Arrastar a janela: feito à mão porque -webkit-app-region calcula as áreas
// erradas quando a janela está escalada (os botões da janela paravam de clicar).
let dragTimer = null;

function stopWindowDrag() {
  clearInterval(dragTimer);
  dragTimer = null;
}

ipcMain.on('window:drag-start', () => {
  if (!mainWindow || dragTimer) return;
  const startCursor = screen.getCursorScreenPoint();
  const startBounds = mainWindow.getBounds();
  dragTimer = setInterval(() => {
    if (!mainWindow) return stopWindowDrag();
    const cursor = screen.getCursorScreenPoint();
    // setBounds com o tamanho original evita a janela "crescer" em telas com escala.
    mainWindow.setBounds({
      ...startBounds,
      x: startBounds.x + cursor.x - startCursor.x,
      y: startBounds.y + cursor.y - startCursor.y,
    });
  }, 10);
});

ipcMain.on('window:drag-end', stopWindowDrag);

ipcMain.handle('settings:get', () => store.getSettings());

ipcMain.handle('app:get-info', () => ({ version: formatVersion(require('./package.json').version) }));

ipcMain.handle('app:update-settings', (_event, patch) => {
  const settings = store.updateApp(patch);
  if ('scale' in patch) applyScale();
  return settings;
});

ipcMain.handle('app:check-update', () => updater.check());
ipcMain.on('app:install-update', () => updater.install());

ipcMain.handle('settings:update-instrument', (_event, instrument, patch) =>
  store.updateInstrument(instrument, patch)
);

ipcMain.handle('settings:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('library:get', (_event, instrument) => store.getLibrary(instrument));

// Lê a pasta configurada do instrumento, (re)gera o JSON da biblioteca e
// pesquisa as informações extras marcadas nas configurações.
ipcMain.handle('library:scan', async (event, instrument) => {
  const { folder, pattern, info, artistAliases } = store.getSettings().instruments[instrument];
  if (!folder) throw new Error('Escolha o diretório antes de gerar o JSON.');
  if (!isFolder(folder)) throw new Error('O diretório informado não existe.');

  const previous = store.getLibrary(instrument);
  const library = buildLibrary({ instrument, folder, pattern, aliases: artistAliases, previous });
  // Salva antes da pesquisa para não perder a leitura da pasta se a internet falhar.
  store.saveLibrary(library);

  const failures = await enrichLibrary(library, {
    info,
    imagesDir: path.join(app.getPath('userData'), 'images'),
    onProgress: (progress) => event.sender.send('library:scan-progress', progress),
  });
  store.saveLibrary(library);
  return { library, failures };
});

const isFolder = (folder) => Boolean(folder) && fs.existsSync(folder) && fs.statSync(folder).isDirectory();

// Troca o modelo dos nomes renomeando os arquivos da pasta para o novo formato.
// Retorna null se o usuário cancelar (o modelo antigo é mantido).
ipcMain.handle('library:rename-files', async (_event, instrument, toPattern) => {
  const { folder, pattern: fromPattern, artistAliases } = store.getSettings().instruments[instrument];
  const renames = isFolder(folder) ? planRenames({ folder, fromPattern, toPattern }) : [];
  let result = { renamed: 0, skipped: 0 };

  if (renames.length) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Renomear', 'Cancelar'],
      defaultId: 0,
      cancelId: 1,
      title: 'Renomear arquivos',
      message: `Renomear ${renames.length} arquivos da pasta para o novo modelo?`,
      detail: `Exemplo:\n${renames[0].from}\n→ ${renames[0].to}`,
    });
    if (response === 1) return null;
    result = applyRenames(folder, renames);
  }

  store.updateInstrument(instrument, { pattern: toPattern });
  const previous = store.getLibrary(instrument);
  if (previous && isFolder(folder)) {
    store.saveLibrary(buildLibrary({ instrument, folder, pattern: toPattern, aliases: artistAliases, previous }));
  }
  return result;
});

// Abre o arquivo da música no programa padrão do Windows.
ipcMain.handle('library:open-song', async (_event, instrument, file) => {
  const library = store.getLibrary(instrument);
  const known = library?.artists.some((artist) => artist.songs.some((song) => song.file === file));
  if (!known) throw new Error('Música não encontrada na biblioteca.');

  const fullPath = path.join(library.folder, file);
  if (!fs.existsSync(fullPath)) throw new Error('Arquivo não encontrado. Gere o JSON novamente.');
  const error = await shell.openPath(fullPath);
  if (error) throw new Error(error);
});

// Corrige o nome de um artista (ex.: erro de digitação no arquivo). Se o novo nome
// já existir, as músicas são agrupadas nele. Os arquivos não são alterados.
ipcMain.handle('library:rename-artist', (_event, instrument, fromName, toName) => {
  const name = toName.trim();
  const { folder, pattern, artistAliases } = store.getSettings().instruments[instrument];
  if (!name) throw new Error('O nome do artista não pode ficar vazio.');
  if (!isFolder(folder)) throw new Error('O diretório informado não existe.');

  const aliases = { ...artistAliases, [artistKey(fromName)]: name };
  // O nome de destino passa a ser definitivo, mesmo que antes fosse corrigido para outro.
  delete aliases[artistKey(name)];
  store.updateInstrument(instrument, { artistAliases: aliases });

  const previous = store.getLibrary(instrument);
  return store.saveLibrary(buildLibrary({ instrument, folder, pattern, aliases, previous }));
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    store = createStore(app.getPath('userData'));
    updater = createUpdater((progress) => mainWindow?.webContents.send('app:update-progress', progress));
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
