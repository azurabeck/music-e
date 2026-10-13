// TELA 5 — Treinar Partitura: jogo de leitura de notas na pauta
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SOLFEGE = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

  // `bottomLetter`: nota da linha de baixo da pauta (índice em LETTERS).
  const CLEFS = {
    G: { bottomLetter: 2, glyph: '\u{1D11E}', className: 'trainer__clef--g' }, // Mi
    F: { bottomLetter: 4, glyph: '\u{1D122}', className: 'trainer__clef--f' }, // Sol
  };

  // Geometria da pauta em px do design (o SVG começa em y = 340 na tela).
  const STAFF = { left: 106, right: 1511, bottomLine: 201.5, lineGap: 31 };
  const STEP = STAFF.lineGap / 2;
  // Posições usadas no jogo, em passos a partir da linha de baixo:
  // de uma linha suplementar abaixo (-2) até uma linha suplementar acima (10).
  const MIN_STEP = -2;
  const MAX_STEP = 10;
  const NOTE_X = 794;
  const FEEDBACK_MS = { right: 900, wrong: 2200 };

  const viewEl = document.getElementById('view-treinar');
  const subtitleEl = document.getElementById('trainer-subtitle');
  const targetEl = document.getElementById('trainer-target');
  const inputEl = document.getElementById('trainer-input');
  const submitEl = document.getElementById('trainer-submit');
  const feedbackEl = document.getElementById('trainer-feedback');
  const scoreEl = document.getElementById('trainer-score');
  const staffEl = document.getElementById('trainer-staff');
  const clefEls = viewEl.querySelectorAll('.trainer__clef-option');

  let clef = 'G';
  // mode: 'name' (mostro a nota, você diz qual é) ou 'place' (digo a nota, você marca).
  let round = { mode: 'name', step: 0, locked: false };
  const score = { right: 0, wrong: 0, streak: 0 };
  let nextRoundTimer = null;

  function svg(tag, attributes = {}, text = '') {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
    el.textContent = text;
    return el;
  }

  const stepY = (step) => STAFF.bottomLine - step * STEP;
  const letterAt = (step) => LETTERS[(((CLEFS[clef].bottomLetter + step) % 7) + 7) % 7];
  const describe = (letter) => `${letter} (${SOLFEGE[letter]})`;

  // Aceita a letra (C, D…) ou o nome (dó, re, sol…), com ou sem acento.
  function parseAnswer(text) {
    const typed = text
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    if (!typed) return null;
    const byName = LETTERS.find((letter) => SOLFEGE[letter].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === typed);
    return byName ?? LETTERS.find((letter) => letter.toLowerCase() === typed) ?? '?';
  }

  // ---------- Desenho ----------

  function drawNote(step, x, className) {
    const group = svg('g', { class: `trainer__note ${className}` });
    const y = stepY(step);
    // Linhas suplementares para notas fora da pauta.
    for (let ledger = -2; ledger >= step; ledger -= 2) {
      group.append(svg('line', { class: 'trainer__ledger', x1: x - 26, y1: stepY(ledger), x2: x + 26, y2: stepY(ledger) }));
    }
    for (let ledger = 10; ledger <= step; ledger += 2) {
      group.append(svg('line', { class: 'trainer__ledger', x1: x - 26, y1: stepY(ledger), x2: x + 26, y2: stepY(ledger) }));
    }
    group.append(svg('ellipse', { class: 'trainer__head', cx: x, cy: y, rx: 14, ry: 11 }));
    group.append(svg('path', { class: 'trainer__stem', d: `M${x + 12} ${y - 5} Q${x + 14} ${y - 30} ${x + 26} ${y - 42}` }));
    return group;
  }

  function drawStaff(notes = []) {
    staffEl.replaceChildren();
    for (let line = 0; line < 5; line += 1) {
      const y = stepY(line * 2);
      staffEl.append(svg('line', { class: 'trainer__line', x1: STAFF.left, y1: y, x2: STAFF.right, y2: y }));
    }
    staffEl.append(svg('text', { class: `trainer__clef ${CLEFS[clef].className}` }, CLEFS[clef].glyph));
    notes.forEach(({ step, x = NOTE_X, className = '' }) => staffEl.append(drawNote(step, x, className)));
  }

  function updateScore() {
    scoreEl.textContent = `acertos ${score.right} · erros ${score.wrong} · sequência ${score.streak}`;
  }

  // ---------- Rodadas ----------

  function newRound() {
    clearTimeout(nextRoundTimer);
    let step;
    do {
      step = MIN_STEP + Math.floor(Math.random() * (MAX_STEP - MIN_STEP + 1));
    } while (step === round.step);
    round = { mode: Math.random() < 0.5 ? 'name' : 'place', step, locked: false };

    const isName = round.mode === 'name';
    viewEl.dataset.mode = round.mode;
    subtitleEl.textContent = isName
      ? 'EU TE MOSTRO A NOTA E VOCÊ ME DIZ QUAL É'
      : 'EU TE DIGO A NOTA E VOCÊ MARCA A POSIÇÃO';
    targetEl.textContent = isName ? '' : letterAt(step);
    feedbackEl.textContent = '';
    feedbackEl.className = 'trainer__feedback';
    inputEl.value = '';
    inputEl.disabled = false;
    submitEl.disabled = false;

    drawStaff(isName ? [{ step }] : []);
    if (isName && viewEl.classList.contains('is-active')) inputEl.focus();
  }

  function finishRound(isRight, message) {
    round.locked = true;
    inputEl.disabled = true;
    submitEl.disabled = true;
    score.right += Number(isRight);
    score.wrong += Number(!isRight);
    score.streak = isRight ? score.streak + 1 : 0;
    updateScore();

    feedbackEl.textContent = message;
    feedbackEl.className = `trainer__feedback ${isRight ? 'is-right' : 'is-wrong'}`;
    nextRoundTimer = setTimeout(newRound, isRight ? FEEDBACK_MS.right : FEEDBACK_MS.wrong);
  }

  // Modo "qual é a nota": confere o que foi digitado.
  function submitName() {
    if (round.locked || round.mode !== 'name') return;
    const answer = parseAnswer(inputEl.value);
    if (!answer) return;

    const correct = letterAt(round.step);
    const isRight = answer === correct;
    drawStaff([{ step: round.step, className: isRight ? 'is-right' : 'is-wrong' }]);
    finishRound(isRight, isRight ? `Isso! ${describe(correct)}` : `Era ${describe(correct)}`);
  }

  // Posição da pauta (passo e x, em px do design) debaixo do mouse.
  function pointerPosition(event) {
    const box = staffEl.getBoundingClientRect();
    const scale = staffEl.viewBox.baseVal.width / box.width;
    const x = (event.clientX - box.left) * scale;
    const y = (event.clientY - box.top) * scale;
    const step = Math.round((STAFF.bottomLine - y) / STEP);
    return {
      step: Math.min(MAX_STEP, Math.max(MIN_STEP, step)),
      x: Math.min(STAFF.right - 40, Math.max(STAFF.left + 160, x)),
    };
  }

  // Modo "marque a posição": a nota-fantasma segue o mouse; o clique responde.
  staffEl.addEventListener('pointermove', (event) => {
    if (round.locked || round.mode !== 'place') return;
    drawStaff([{ ...pointerPosition(event), className: 'is-ghost' }]);
  });
  staffEl.addEventListener('pointerleave', () => {
    if (!round.locked && round.mode === 'place') drawStaff();
  });
  staffEl.addEventListener('click', (event) => {
    if (round.locked || round.mode !== 'place') return;
    const { step, x } = pointerPosition(event);
    const target = letterAt(round.step);
    // A mesma nota em qualquer oitava vale como acerto.
    const isRight = letterAt(step) === target;

    const notes = [{ step, x, className: isRight ? 'is-right' : 'is-wrong' }];
    if (!isRight) {
      // Mostra onde a nota pedida fica na pauta.
      for (let answer = MIN_STEP; answer <= MAX_STEP; answer += 1) {
        if (letterAt(answer) === target) notes.push({ step: answer, x: x + (x > 900 ? -90 : 90), className: 'is-answer' });
      }
    }
    drawStaff(notes);
    finishRound(isRight, isRight ? `Isso! ${describe(target)}` : `Você marcou ${describe(letterAt(step))}`);
  });

  submitEl.addEventListener('click', submitName);
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitName();
  });

  clefEls.forEach((el) => {
    el.addEventListener('click', () => {
      clef = el.dataset.clef;
      clefEls.forEach((option) => option.classList.toggle('is-active', option === el));
      newRound();
    });
  });

  updateScore();
  newRound();
})();
