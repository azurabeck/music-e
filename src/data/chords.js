// Dicionário de acordes: 12 notas x 16 tipos, para violão (casas) e piano (teclas).
// Funciona no navegador (window.Chords) e no Node (testes).
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.Chords = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'];
  const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };

  // Afinação padrão do violão, da 6ª para a 1ª corda (E A D G B E).
  const TUNING = [4, 9, 2, 7, 11, 4];
  const X = null; // corda abafada

  // `intervals`: semitons a partir da tônica. `e`/`a`: formato móvel com a tônica
  // na 6ª corda (forma de E) ou na 5ª (forma de A), em casas relativas à tônica.
  const QUALITIES = [
    { id: 'maj', suffix: '', intervals: [0, 4, 7], e: [0, 2, 2, 1, 0, 0], a: [X, 0, 2, 2, 2, 0] },
    { id: 'm', suffix: 'm', intervals: [0, 3, 7], e: [0, 2, 2, 0, 0, 0], a: [X, 0, 2, 2, 1, 0] },
    { id: '7', suffix: '7', intervals: [0, 4, 7, 10], e: [0, 2, 0, 1, 0, 0], a: [X, 0, 2, 0, 2, 0] },
    { id: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10], e: [0, 2, 0, 0, 0, 0], a: [X, 0, 2, 0, 1, 0] },
    { id: '7M', suffix: '7M', intervals: [0, 4, 7, 11], e: [0, 2, 1, 1, 0, 0], a: [X, 0, 2, 1, 2, 0] },
    { id: '6', suffix: '6', intervals: [0, 4, 7, 9], e: [0, 2, 2, 1, 2, 0], a: [X, 0, 2, 2, 2, 2] },
    { id: 'm6', suffix: 'm6', intervals: [0, 3, 7, 9], e: [0, 2, 2, 0, 2, 0], a: [X, 0, 2, 2, 1, 2] },
    { id: '9', suffix: '9', intervals: [0, 4, 7, 10, 14], e: [0, 2, 0, 1, 0, 2], a: [X, 0, -1, 0, 0, X] },
    { id: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14], e: [0, 2, 2, 1, 0, 2], a: [X, 0, 2, 4, 2, 0] },
    // A forma de E do sus2 exige abertura grande: só é usada com cordas soltas.
    { id: 'sus2', suffix: 'sus2', intervals: [0, 2, 7], e: [0, 2, 4, 4, 0, 0], eOpenOnly: true, a: [X, 0, 2, 2, 0, 0] },
    { id: 'sus4', suffix: 'sus4', intervals: [0, 5, 7], e: [0, 2, 2, 2, 0, 0], a: [X, 0, 2, 2, 3, 0] },
    { id: '7sus4', suffix: '7sus4', intervals: [0, 5, 7, 10], e: [0, 2, 0, 2, 0, 0], a: [X, 0, 2, 0, 3, 0] },
    { id: 'dim', suffix: 'dim', intervals: [0, 3, 6], e: [0, 1, 2, 0, X, X], a: [X, 0, 1, 2, 1, X] },
    { id: 'dim7', suffix: 'dim7', intervals: [0, 3, 6, 9], e: [0, 1, 2, 0, 2, 0], a: [X, 0, 1, 2, 1, 2] },
    { id: 'm7b5', suffix: 'm7(b5)', intervals: [0, 3, 6, 10], e: [0, 1, 0, 0, X, X], a: [X, 0, 1, 0, 1, X] },
    { id: 'aug', suffix: 'aug', intervals: [0, 4, 8], e: [0, 3, 2, 1, 1, 0], a: [X, 0, 3, 2, 2, 1] },
  ];

  // Acordes com posição aberta mais usada do que a pestana gerada pela regra.
  const parseFrets = (text) => [...text].map((char) => (char === 'x' ? X : Number(char)));
  const GUITAR_OVERRIDES = Object.fromEntries(
    Object.entries({
      'C:maj': 'x32010', 'C:7': 'x32310', 'C:7M': 'x32000', 'C:6': 'x32210', 'C:9': 'x32330',
      'C:add9': 'x32030', 'C:sus4': 'x33011', 'C:sus2': 'x30033',
      'D:maj': 'xx0232', 'D:m': 'xx0231', 'D:7': 'xx0212', 'D:m7': 'xx0211', 'D:7M': 'xx0222',
      'D:6': 'xx0202', 'D:m6': 'xx0201', 'D:sus2': 'xx0230', 'D:sus4': 'xx0233', 'D:7sus4': 'xx0213',
      'D:dim': 'xx0131', 'D:dim7': 'xx0101', 'D:m7b5': 'xx0111', 'D:aug': 'xx0332',
      'G:maj': '320003', 'G:7': '320001', 'G:7M': '320002', 'G:6': '320000', 'G:add9': '320203',
      'G:sus4': '330013', 'G:sus2': '300033',
      'F:7M': 'xx3210',
      'B:7': 'x21202',
      'A:9': 'x02423',
    }).map(([key, frets]) => [key, parseFrets(frets)])
  );

  const QUALITY_BY_ID = Object.fromEntries(QUALITIES.map((quality) => [quality.id, quality]));

  const chordName = (root, quality) => `${root}${quality.suffix}`;

  // Casas do acorde no violão: [6ª, 5ª, 4ª, 3ª, 2ª, 1ª]; null = corda abafada, 0 = solta.
  function guitarFrets(root, qualityId) {
    const override = GUITAR_OVERRIDES[`${root}:${qualityId}`];
    if (override) return override;

    const quality = QUALITY_BY_ID[qualityId];
    const rootIndex = NOTES.indexOf(root);
    const candidates = [
      { shape: quality.e, position: (rootIndex - TUNING[0] + 12) % 12, openOnly: quality.eOpenOnly },
      { shape: quality.a, position: (rootIndex - TUNING[1] + 12) % 12 },
    ]
      .filter(({ openOnly, position }) => !openOnly || position === 0)
      .map(({ shape, position }) => shape.map((offset) => (offset === X ? X : offset + position)))
      .filter((frets) => frets.every((fret) => fret === X || fret >= 0));

    // Fica com a posição mais perto da pestana (menor casa mais alta).
    const highest = (frets) => Math.max(...frets.filter((fret) => fret !== X));
    return candidates.sort((first, second) => highest(first) - highest(second))[0];
  }

  // Teclas do acorde no piano, em semitons a partir do primeiro Dó (0 a 23).
  function pianoKeys(root, qualityId) {
    const rootIndex = NOTES.indexOf(root);
    return QUALITY_BY_ID[qualityId].intervals.map((interval) => {
      const key = rootIndex + interval;
      return key > 23 ? key - 12 : key;
    });
  }

  // Todos os acordes na ordem do catálogo: cada tipo com as 7 notas naturais,
  // depois cada tipo com os 5 sustenidos.
  const CATALOG = [NATURALS, SHARPS].flatMap((roots) =>
    QUALITIES.flatMap((quality) =>
      roots.map((root, column) => ({ root, quality: quality.id, name: chordName(root, quality), column }))
    )
  );

  // Deixa o sufixo comparável: "maj7" = "7M", "°" = "dim", "5+" = "aug", "m7b5" = "m7(b5)".
  const normalizeSuffix = (text) =>
    text
      .replace(/[\s()]/g, '')
      .replace(/7M/g, 'maj7')
      .toLowerCase()
      .replace(/7\+/g, 'maj7')
      .replace(/[°º]/g, 'dim')
      .replace(/ø/g, 'm7b5')
      .replace(/^min/, 'm')
      .replace(/(5\+|#5|\+)$/, 'aug');

  const NORMALIZED_SUFFIX = Object.fromEntries(QUALITIES.map((quality) => [quality.id, normalizeSuffix(quality.suffix)]));

  function searchWithRoot(letter, accidental, rest) {
    const typedRoot = letter.toUpperCase() + accidental.replace('♯', '#').replace('♭', 'b');
    const root = FLAT_TO_SHARP[typedRoot] ?? typedRoot;
    if (!NOTES.includes(root)) return [];
    const suffix = normalizeSuffix(rest);
    return CATALOG.filter((chord) => chord.root === root && NORMALIZED_SUFFIX[chord.quality].startsWith(suffix)).sort(
      (first, second) =>
        Number(NORMALIZED_SUFFIX[second.quality] === suffix) - Number(NORMALIZED_SUFFIX[first.quality] === suffix)
    );
  }

  // Busca: "C" (todos de Dó), "C#m7", "Bb", "maj7"/"7M", ou só o tipo ("sus", "dim").
  function search(query) {
    const text = query.trim();
    if (!text) return CATALOG;

    const withRoot = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(text);
    if (withRoot && /[A-G]/.test(text[0])) return searchWithRoot(...withRoot.slice(1));

    if (text.length > 1) {
      const suffix = normalizeSuffix(text);
      const byType = CATALOG.filter((chord) => suffix && NORMALIZED_SUFFIX[chord.quality].startsWith(suffix));
      if (byType.length) return byType;
    }
    return withRoot ? searchWithRoot(...withRoot.slice(1)) : [];
  }

  return { NOTES, TUNING, QUALITIES, CATALOG, guitarFrets, pianoKeys, search };
});
