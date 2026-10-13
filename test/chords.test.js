// Confere que cada posição de violão e de piano toca exatamente as notas do acorde.
// Rodar com: npm test
const assert = require('node:assert');
const { test } = require('node:test');
const { NOTES, TUNING, QUALITIES, CATALOG, guitarFrets, pianoKeys, search } = require('../src/data/chords');

const pitchClasses = (root, quality) =>
  new Set(quality.intervals.map((interval) => (NOTES.indexOf(root) + interval) % 12));

test('catálogo tem 12 notas x 16 tipos', () => {
  assert.strictEqual(CATALOG.length, 12 * QUALITIES.length);
});

for (const quality of QUALITIES) {
  for (const root of NOTES) {
    const name = `${root}${quality.suffix}`;

    test(`violão: ${name}`, () => {
      const frets = guitarFrets(root, quality.id);
      assert.strictEqual(frets.length, 6);

      const played = frets.map((fret, string) => (fret === null ? null : (TUNING[string] + fret) % 12));
      const sounding = played.filter((note) => note !== null);
      const expected = pitchClasses(root, quality);

      assert.ok(sounding.length >= 3, 'precisa de pelo menos 3 cordas');
      assert.strictEqual(sounding[0], NOTES.indexOf(root), 'a nota mais grave deve ser a tônica');
      sounding.forEach((note) => assert.ok(expected.has(note), `nota ${NOTES[note]} não pertence ao acorde`));

      // Em acordes de 4 ou mais notas é normal omitir a quinta no violão (ex.: C7 = x32310).
      const optional = quality.intervals.length >= 4 ? (NOTES.indexOf(root) + 7) % 12 : null;
      expected.forEach((note) => {
        if (note !== optional) assert.ok(sounding.includes(note), `falta a nota ${NOTES[note]}`);
      });

      const fretted = frets.filter((fret) => fret > 0);
      assert.ok(Math.max(...fretted, 0) - Math.min(...fretted, 99) <= 4 || fretted.length === 0, 'abertura maior que 5 casas');
    });

    test(`piano: ${name}`, () => {
      const keys = pianoKeys(root, quality.id);
      keys.forEach((key) => assert.ok(key >= 0 && key <= 23, 'tecla fora das duas oitavas'));
      assert.deepStrictEqual(new Set(keys.map((key) => key % 12)), pitchClasses(root, quality));
      assert.strictEqual(keys[0], NOTES.indexOf(root));
    });
  }
}

test('busca', () => {
  const names = (query) => search(query).map((chord) => chord.name);
  assert.strictEqual(search('').length, CATALOG.length);
  assert.strictEqual(names('C').length, QUALITIES.length);
  assert.strictEqual(names('C')[0], 'C');
  assert.deepStrictEqual(names('C#m7'), ['C#m7', 'C#m7(b5)']);
  assert.deepStrictEqual(names('Bb'), names('A#'));
  assert.deepStrictEqual(names('Cmaj7'), ['C7M']);
  assert.deepStrictEqual(names('C7M'), ['C7M']);
  assert.deepStrictEqual(names('C7'), ['C7', 'C7sus4']);
  assert.deepStrictEqual(names('G°'), ['Gdim', 'Gdim7']);
  assert.deepStrictEqual(names('E5+'), ['Eaug']);
  assert.strictEqual(names('dim').length, 24);
  assert.strictEqual(names('sus').length, 24);
  assert.strictEqual(names('c')[0], 'C');
  assert.deepStrictEqual(names('H'), []);
});
