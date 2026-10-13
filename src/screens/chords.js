// TELA 4 — Dicionário de Acordes
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const { CATALOG, guitarFrets, pianoKeys, search } = window.Chords;

  const viewEl = document.getElementById('view-acordes');
  const gridEl = document.getElementById('chords-grid');
  const emptyEl = document.getElementById('chords-empty');
  const inputEl = document.getElementById('chords-input');
  const instrumentEls = viewEl.querySelectorAll('.chords__instrument');

  let instrument = 'violao';

  function svg(tag, attributes = {}, text = '') {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
    el.textContent = text;
    return el;
  }

  // ---------- Violão: braço com 6 cordas e 6 casas ----------

  const GUITAR = { margin: 4, width: 130, nut: 13, stringGap: 25, fretGap: 30, frets: 6 };

  function drawGuitar(frets) {
    const { margin, width, nut, stringGap, fretGap } = GUITAR;
    const height = nut + fretGap * GUITAR.frets;
    const stringX = (string) => margin + 2.5 + stringGap * string;

    const fretted = frets.filter((fret) => fret > 0);
    // Acordes altos demais para caber começam a contar da casa mais baixa usada.
    const baseFret = Math.max(...fretted, 0) > GUITAR.frets ? Math.min(...fretted) : 1;
    const fretY = (fret) => nut + fretGap * (fret - baseFret + 0.5);

    const root = svg('svg', {
      class: 'chord__diagram',
      width: width + margin * 2,
      height: height + 1,
      viewBox: `0 0 ${width + margin * 2} ${height + 1}`,
    });
    root.append(svg('rect', { class: 'chord__nut', x: margin, y: 0, width, height: nut }));

    for (let fret = 1; fret <= GUITAR.frets; fret += 1) {
      const y = nut + fretGap * fret - 0.5;
      root.append(svg('line', { class: 'chord__fret', x1: stringX(0), y1: y, x2: stringX(5), y2: y }));
    }
    frets.forEach((fret, string) => {
      const x = stringX(string);
      root.append(svg('line', { class: 'chord__string', x1: x, y1: nut, x2: x, y2: height }));
      // Corda abafada: "x" dentro da pestana.
      if (fret === null) root.append(svg('text', { class: 'chord__mute', x, y: nut - 2 }, '×'));
    });

    // Pestana: sem cordas soltas e com duas ou mais cordas na casa mais baixa.
    const lowest = Math.min(...fretted);
    const barreStrings = frets.flatMap((fret, string) => (fret === lowest ? [string] : []));
    const hasBarre = !frets.includes(0) && barreStrings.length >= 2;
    if (hasBarre) {
      root.append(
        svg('line', {
          class: 'chord__barre',
          x1: stringX(barreStrings[0]) - 6,
          y1: fretY(lowest),
          x2: stringX(barreStrings.at(-1)) + 6,
          y2: fretY(lowest),
        })
      );
    }

    frets.forEach((fret, string) => {
      if (!fret || (hasBarre && fret === lowest)) return;
      root.append(svg('circle', { class: 'chord__dot', cx: stringX(string), cy: fretY(fret), r: 5 }));
    });

    return { diagram: root, note: baseFret > 1 ? `${baseFret}ª casa` : '' };
  }

  // ---------- Piano: duas oitavas ----------

  const PIANO = { margin: 2, width: 182, bar: 13, whiteKeys: 14, keyHeight: 96, blackWidth: 8, blackHeight: 58 };
  const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11];

  function drawPiano(keys) {
    const { margin, width, bar, whiteKeys, keyHeight, blackWidth, blackHeight } = PIANO;
    const keyWidth = width / whiteKeys;
    const height = bar + keyHeight;
    const whiteIndex = (key) => Math.floor(key / 12) * 7 + WHITE_NOTES.indexOf(key % 12);
    const isWhite = (key) => WHITE_NOTES.includes(key % 12);
    // Centro horizontal da tecla (as pretas ficam na divisa entre duas brancas).
    const keyX = (key) => margin + (isWhite(key) ? (whiteIndex(key) + 0.5) * keyWidth : (whiteIndex(key - 1) + 1) * keyWidth);

    const root = svg('svg', {
      class: 'chord__diagram',
      width: width + margin * 2,
      height: height + 1,
      viewBox: `0 0 ${width + margin * 2} ${height + 1}`,
    });
    root.append(svg('rect', { class: 'chord__nut', x: margin, y: 0, width, height: bar }));

    for (let index = 0; index < whiteKeys; index += 1) {
      root.append(
        svg('rect', { class: 'chord__white-key', x: margin + index * keyWidth, y: bar, width: keyWidth, height: keyHeight })
      );
    }

    for (let key = 0; key < 24; key += 1) {
      if (isWhite(key)) continue;
      root.append(
        svg('rect', { class: 'chord__black-key', x: keyX(key) - blackWidth / 2, y: bar, width: blackWidth, height: blackHeight })
      );
    }

    keys.forEach((key) => {
      const cy = isWhite(key) ? height - 13 : bar + blackHeight - 10;
      root.append(svg('circle', { class: 'chord__dot', cx: keyX(key), cy, r: isWhite(key) ? 4.5 : 3.5 }));
    });

    return { diagram: root, note: '' };
  }

  // ---------- Lista ----------

  function createCard(chord, breakRow) {
    const card = document.createElement('article');
    card.className = 'chord';
    // No catálogo completo cada tipo de acorde começa uma linha nova.
    if (breakRow) card.classList.add('chord--row-start');

    const { diagram, note } =
      instrument === 'violao'
        ? drawGuitar(guitarFrets(chord.root, chord.quality))
        : drawPiano(pianoKeys(chord.root, chord.quality));

    const name = document.createElement('p');
    name.className = 'chord__name';
    name.textContent = chord.name;
    if (note) {
      const position = document.createElement('span');
      position.className = 'chord__position';
      position.textContent = note;
      name.append(position);
    }

    card.append(name, diagram);
    return card;
  }

  function render() {
    const chords = search(inputEl.value);
    const isFullCatalog = chords === CATALOG;

    viewEl.dataset.instrument = instrument;
    instrumentEls.forEach((el) => el.classList.toggle('is-active', el.dataset.instrument === instrument));
    gridEl.replaceChildren(...chords.map((chord) => createCard(chord, isFullCatalog && chord.column === 0)));
    gridEl.scrollTop = 0;
    emptyEl.hidden = chords.length > 0;
  }

  instrumentEls.forEach((el) => {
    el.addEventListener('click', () => {
      instrument = el.dataset.instrument;
      render();
    });
  });

  // O campo cresce para a esquerda conforme o texto (mínimo: o traço do design).
  function resizeInput() {
    inputEl.style.width = '0';
    inputEl.style.width = `${Math.max(64, inputEl.scrollWidth)}px`;
  }

  inputEl.addEventListener('input', () => {
    resizeInput();
    render();
  });
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') render();
  });

  render();
})();
