const fs = require('fs');
const path = require('path');
const { DEFAULT_PATTERN } = require('./library');

const INSTRUMENTS = ['violao', 'piano'];

const defaultInstrument = () => ({
  folder: null,
  pattern: DEFAULT_PATTERN,
  // Ainda não renomeia nada: a opção fica salva até a regra de renomeação ser definida.
  renameFiles: false,
  // Preferências da tela de cifras/partituras (menu "..."): lista ou cards, e ordenação.
  view: { list: false, sort: 'alpha' },
  // Correções de nome de artista feitas na tela: { chave do nome original: nome corrigido }.
  artistAliases: {},
  // Informações extras pesquisadas ao gerar o JSON.
  info: {
    artistImage: true,
    album: false,
    year: false,
    videoLesson: false,
    spotify: false,
    youtube: false,
  },
});

const mergeInstrument = (base, patch = {}) => ({
  ...base,
  ...patch,
  info: { ...base.info, ...patch.info },
});

const defaultSettings = () => ({
  version: 1,
  // scale: tamanho da janela em relação ao design de 1600 x 900. theme: 'dark' ou 'light'.
  app: { scale: 0.8, theme: 'dark' },
  instruments: Object.fromEntries(INSTRUMENTS.map((id) => [id, defaultInstrument()])),
});

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Guarda configurações e bibliotecas (uma por instrumento) na pasta de dados do app.
function createStore(dataDir) {
  const settingsFile = path.join(dataDir, 'settings.json');
  const libraryFile = (instrument) => path.join(dataDir, `library-${instrument}.json`);

  const assertInstrument = (instrument) => {
    if (!INSTRUMENTS.includes(instrument)) throw new Error(`Instrumento inválido: ${instrument}`);
  };

  function getSettings() {
    const defaults = defaultSettings();
    const saved = readJson(settingsFile);
    Object.assign(defaults.app, saved?.app);
    INSTRUMENTS.forEach((id) => {
      defaults.instruments[id] = mergeInstrument(defaults.instruments[id], saved?.instruments?.[id]);
    });
    return defaults;
  }

  function updateInstrument(instrument, patch) {
    assertInstrument(instrument);
    const settings = getSettings();
    settings.instruments[instrument] = mergeInstrument(settings.instruments[instrument], patch);
    writeJson(settingsFile, settings);
    return settings;
  }

  function updateApp(patch) {
    const settings = getSettings();
    Object.assign(settings.app, patch);
    writeJson(settingsFile, settings);
    return settings;
  }

  function getLibrary(instrument) {
    assertInstrument(instrument);
    return readJson(libraryFile(instrument));
  }

  function saveLibrary(library) {
    assertInstrument(library.instrument);
    writeJson(libraryFile(library.instrument), library);
    return library;
  }

  return { getSettings, updateInstrument, updateApp, getLibrary, saveLibrary };
}

module.exports = { INSTRUMENTS, createStore };
