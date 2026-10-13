const fs = require('fs');
const path = require('path');
const { UNKNOWN_ARTIST } = require('./library');

const DEEZER_API = 'https://api.deezer.com';
// A Deezer permite 50 chamadas a cada 5 segundos.
const REQUEST_DELAY_MS = 120;
const INSTRUMENT_SEARCH_TERMS = { violao: 'violão', piano: 'piano' };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function fetchArtistImage(artist, imagesDir) {
  const { data } = await getJson(`${DEEZER_API}/search/artist?limit=1&q=${encodeURIComponent(artist.name)}`);
  const picture = data[0]?.picture_xl;
  // Artistas sem foto na Deezer vêm com uma imagem padrão (hash vazio na URL).
  if (!picture || picture.includes('/artist//')) return;

  const response = await fetch(picture);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  fs.mkdirSync(imagesDir, { recursive: true });
  const file = path.join(imagesDir, `${slugify(artist.name)}.jpg`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  artist.image = file;
}

async function fetchSongDetails(song, artistName, { album, year }) {
  const query = `${song.title} ${artistName}`;
  const { data } = await getJson(`${DEEZER_API}/search?limit=5&q=${encodeURIComponent(query)}`);
  // Só aceita resultados do mesmo artista, para não gravar dados de outra música.
  const track = data.find((item) => slugify(item.artist.name) === slugify(artistName));
  if (!track) return;

  if (album) song.album = track.album.title;
  if (year) {
    const details = await getJson(`${DEEZER_API}/album/${track.album.id}`);
    song.year = details.release_date ? Number(details.release_date.slice(0, 4)) : null;
  }
}

// Os links apontam para a busca já preenchida (o link exato exigiria chave de API).
function addSearchLinks(song, artistName, instrument, info) {
  const term = encodeURIComponent(`${song.title} ${artistName}`);
  if (info.spotify) song.spotifyUrl ??= `https://open.spotify.com/search/${term}`;
  if (info.youtube) song.youtubeUrl ??= `https://www.youtube.com/results?search_query=${term}`;
  if (info.videoLesson) {
    const lesson = encodeURIComponent(`como tocar ${song.title} ${artistName} ${INSTRUMENT_SEARCH_TERMS[instrument]}`);
    song.videoLessonUrl ??= `https://www.youtube.com/results?search_query=${lesson}`;
  }
}

// Completa a biblioteca (in-place) com as informações marcadas nas configurações.
// Só pesquisa o que ainda está faltando. Retorna o número de pesquisas que falharam.
async function enrichLibrary(library, { info, imagesDir, onProgress = () => {} }) {
  const tasks = [];

  library.artists.forEach((artist) => {
    const known = artist.name !== UNKNOWN_ARTIST;

    if (known && info.artistImage && !(artist.image && fs.existsSync(artist.image))) {
      tasks.push(() => fetchArtistImage(artist, imagesDir));
    }

    artist.songs.forEach((song) => {
      if (!known) return;
      addSearchLinks(song, artist.name, library.instrument, info);

      const needs = { album: info.album && !song.album, year: info.year && !song.year };
      if (needs.album || needs.year) tasks.push(() => fetchSongDetails(song, artist.name, needs));
    });
  });

  let failures = 0;
  for (let index = 0; index < tasks.length; index += 1) {
    try {
      await tasks[index]();
    } catch {
      failures += 1;
    }
    onProgress({ done: index + 1, total: tasks.length });
    await wait(REQUEST_DELAY_MS);
  }
  return failures;
}

module.exports = { enrichLibrary };
