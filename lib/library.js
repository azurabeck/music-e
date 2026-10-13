const fs = require('fs');
const path = require('path');

// Tokens aceitos no padrão de nome de arquivo, ex.: "{musica} - {artista}".
const TOKEN_REGEX = /\{(musica|artista)\}/g;
const DEFAULT_PATTERN = '{musica} - {artista}';
const UNKNOWN_ARTIST = 'Outros';
const IGNORED_FILES = new Set(['desktop.ini', 'thumbs.db']);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeKey = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Chave de agrupamento do artista: ignora maiúsculas, acentos, espaços e pontuação.
const artistKey = (name) => normalizeKey(name).replace(/[^a-z0-9]/g, '') || normalizeKey(name);

// Aplica as correções de nome feitas pelo usuário (ex.: erro de digitação no arquivo).
function resolveAlias(name, aliases) {
  let current = name;
  for (let hop = 0; hop < 10 && aliases[artistKey(current)]; hop += 1) {
    current = aliases[artistKey(current)];
  }
  return current;
}

// Converte o padrão em uma função que extrai { title, artist } do nome do arquivo
// (sem extensão). Retorna null quando o nome não segue o padrão.
function createFileNameParser(pattern = DEFAULT_PATTERN) {
  const tokens = [...pattern.matchAll(TOKEN_REGEX)].map((match) => match[1]);
  if (!tokens.includes('musica')) {
    throw new Error('O padrão precisa conter {musica}.');
  }
  if (new Set(tokens).size !== tokens.length) {
    throw new Error('Cada campo só pode aparecer uma vez no padrão.');
  }

  let tokenIndex = 0;
  const source = pattern
    .split(TOKEN_REGEX)
    .map((part, index) => {
      // Índices ímpares são os nomes dos tokens capturados pelo split.
      if (index % 2 === 1) {
        tokenIndex += 1;
        // O último campo é guloso para que separadores repetidos fiquem nele.
        return tokenIndex === tokens.length ? '(.+)' : '(.+?)';
      }
      return escapeRegex(part).replace(/\s+/g, '\\s+');
    })
    .join('');
  const regex = new RegExp(`^\\s*${source}\\s*$`, 'i');

  return (fileName) => {
    const match = regex.exec(fileName);
    if (!match) return null;
    const result = { title: '', artist: '' };
    tokens.forEach((token, index) => {
      result[token === 'musica' ? 'title' : 'artist'] = match[index + 1].trim();
    });
    return result;
  };
}

const formatFileName = (pattern, { title, artist }) =>
  pattern.replace(TOKEN_REGEX, (_match, token) => (token === 'musica' ? title : artist));

function listFiles(folder, relative = '') {
  const entries = fs.readdirSync(path.join(folder, relative), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(relative, entry.name);
    if (entry.name.startsWith('.') || IGNORED_FILES.has(entry.name.toLowerCase())) return [];
    if (entry.isDirectory()) return listFiles(folder, entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

// Lê a pasta e monta a biblioteca agrupada por artista. Dados já pesquisados
// (imagem, links) da biblioteca anterior são preservados.
function buildLibrary({ instrument, folder, pattern = DEFAULT_PATTERN, aliases = {}, previous = null }) {
  const parse = createFileNameParser(pattern);
  const previousArtists = new Map((previous?.artists ?? []).map((artist) => [artistKey(artist.name), artist]));
  const artists = new Map();

  listFiles(folder)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach((file) => {
      const baseName = path.basename(file, path.extname(file));
      const parsed = parse(baseName);
      const fileArtist = parsed?.artist || UNKNOWN_ARTIST;
      const artistName = resolveAlias(fileArtist, aliases);
      const key = artistKey(artistName);
      // Dados antigos podem estar no nome corrigido ou no nome original do arquivo.
      const oldArtists = [previousArtists.get(key), previousArtists.get(artistKey(fileArtist))].filter(Boolean);

      if (!artists.has(key)) {
        artists.set(key, {
          name: artistName,
          image: oldArtists.find((artist) => artist.image)?.image ?? null,
          songs: [],
        });
      }

      const title = parsed?.title || baseName;
      // Compara também pelo título: o arquivo pode ter sido renomeado.
      const oldSong = oldArtists
        .flatMap((artist) => artist.songs)
        .find((song) => song.file === file || normalizeKey(song.title) === normalizeKey(title));
      artists.get(key).songs.push({
        title,
        file,
        matchedPattern: Boolean(parsed),
        album: oldSong?.album ?? null,
        year: oldSong?.year ?? null,
        spotifyUrl: oldSong?.spotifyUrl ?? null,
        youtubeUrl: oldSong?.youtubeUrl ?? null,
        videoLessonUrl: oldSong?.videoLessonUrl ?? null,
      });
    });

  const sorted = [...artists.values()].sort((a, b) => {
    // "Outros" (arquivos fora do padrão) sempre por último.
    if (a.name === UNKNOWN_ARTIST) return 1;
    if (b.name === UNKNOWN_ARTIST) return -1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return {
    version: 1,
    instrument,
    folder,
    pattern,
    generatedAt: new Date().toISOString(),
    artists: sorted,
  };
}

// Lista os arquivos que seguem `fromPattern` e o novo nome de cada um em `toPattern`.
function planRenames({ folder, fromPattern, toPattern }) {
  const parse = createFileNameParser(fromPattern);
  return listFiles(folder).flatMap((file) => {
    const extension = path.extname(file);
    const parsed = parse(path.basename(file, extension));
    if (!parsed?.title || !parsed.artist) return [];
    const target = path.join(path.dirname(file), formatFileName(toPattern, parsed) + extension);
    return target === file ? [] : [{ from: file, to: target }];
  });
}

// Nunca sobrescreve: se já existir um arquivo com o novo nome, o original é mantido.
function applyRenames(folder, renames) {
  let renamed = 0;
  let skipped = 0;
  renames.forEach(({ from, to }) => {
    const target = path.join(folder, to);
    if (fs.existsSync(target)) {
      skipped += 1;
      return;
    }
    fs.renameSync(path.join(folder, from), target);
    renamed += 1;
  });
  return { renamed, skipped };
}

module.exports = {
  DEFAULT_PATTERN,
  UNKNOWN_ARTIST,
  artistKey,
  createFileNameParser,
  buildLibrary,
  planRenames,
  applyRenames,
};
