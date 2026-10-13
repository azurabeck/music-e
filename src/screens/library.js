// TELA 2 — Cifras (violão) e Partituras (piano): a mesma tela para cada instrumento
(() => {
  const UNKNOWN_ARTIST = 'Outros';
  // Distância (px) que o mouse precisa andar para virar arrasto em vez de clique.
  const DRAG_THRESHOLD = 6;
  // Quanto cada clique nas setas percorre: dois cards.
  const ARROW_STEP = 700;

  const searchEl = document.getElementById('search-input');

  const normalize = (text) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();

  function createLibraryView(viewEl) {
    const { instrument, noun } = viewEl.dataset;
    const bandsEl = viewEl.querySelector('.bands');
    const emptyEl = viewEl.querySelector('.bands__empty');
    const pathEl = viewEl.querySelector('.library__path-value');
    const prevEl = viewEl.querySelector('.bands__arrow--prev');
    const nextEl = viewEl.querySelector('.bands__arrow--next');

    // Menu "...": modo lista e ordenação.
    viewEl.insertAdjacentHTML(
      'beforeend',
      `<button class="library__options-toggle" aria-label="Opções" aria-expanded="false">
         <img src="assets/ellipsis-circle.svg" alt="" />
       </button>
       <div class="library__menu" hidden>
         <label class="library__menu-row">
           <span>modo lista</span>
           <input type="checkbox" />
           <span class="toggle toggle--small"><span class="toggle__knob"></span></span>
         </label>
         <hr class="library__menu-divider" />
         <button class="library__menu-item" data-sort="alpha">ordem alfabética</button>
         <button class="library__menu-item" data-sort="count">ordem numérica</button>
         <button class="library__menu-item" data-action="sequence" title="Em breve">criar sequência</button>
       </div>`
    );
    const optionsEl = viewEl.querySelector('.library__options-toggle');
    const menuEl = viewEl.querySelector('.library__menu');
    const listModeEl = menuEl.querySelector('input');
    const sortEls = menuEl.querySelectorAll('[data-sort]');

    let bands = [];
    // No design a primeira banda já aparece aberta.
    let expandedIndex = 0;
    // list: uma linha por artista em vez de cards. sort: 'alpha' ou 'count' (nº de músicas).
    let view = { list: false, sort: 'alpha' };

    function updateArrows() {
      const maxScroll = bandsEl.scrollWidth - bandsEl.clientWidth;
      prevEl.hidden = view.list || bandsEl.scrollLeft <= 1;
      nextEl.hidden = view.list || bandsEl.scrollLeft >= maxScroll - 1;
    }

    function sortBands() {
      bands.sort((first, second) => {
        // "Outros" (arquivos fora do padrão) sempre por último.
        if (first.name === UNKNOWN_ARTIST) return 1;
        if (second.name === UNKNOWN_ARTIST) return -1;
        if (view.sort === 'count' && first.songs.length !== second.songs.length) {
          return second.songs.length - first.songs.length;
        }
        return first.name.localeCompare(second.name, 'pt-BR');
      });
    }

    function setMenuOpen(open) {
      menuEl.hidden = !open;
      optionsEl.setAttribute('aria-expanded', String(open));
    }

    async function changeView(patch) {
      view = { ...view, ...patch };
      sortBands();
      expandedIndex = 0;
      render();
      bandsEl.scrollTo(0, 0);
      updateArrows();
      await window.api.updateInstrument(instrument, { view });
    }

    optionsEl.addEventListener('click', () => setMenuOpen(menuEl.hidden));
    listModeEl.addEventListener('change', () => changeView({ list: listModeEl.checked }));
    sortEls.forEach((el) => {
      el.addEventListener('click', () => changeView({ sort: el.dataset.sort }));
    });
    // "criar sequência" ainda não tem tela: por enquanto só fecha o menu.
    menuEl.querySelector('[data-action="sequence"]').addEventListener('click', () => setMenuOpen(false));

    document.addEventListener('pointerdown', (event) => {
      if (!menuEl.hidden && !menuEl.contains(event.target) && !optionsEl.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    });

    // Troca o nome por um campo de texto para corrigir o artista. Se o novo nome
    // já existir no catálogo, as músicas são agrupadas nele.
    function startRename(card, band) {
      if (card.querySelector('.band__name-input')) return;

      const input = document.createElement('input');
      input.className = 'band__name-input';
      input.type = 'text';
      input.value = band.name;
      input.spellcheck = false;
      card.append(input);
      input.focus();
      input.select();

      let finished = false;
      const finish = async (confirm) => {
        if (finished) return;
        finished = true;
        const name = input.value.trim();
        input.remove();
        if (!confirm || !name || name === band.name) return;
        await window.api.renameArtist(instrument, band.name, name);
        await load(name);
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(false));
    }

    function createCard(band, index) {
      const card = document.createElement('article');
      card.className = 'band';
      card.classList.toggle('is-expanded', index === expandedIndex);

      const header = document.createElement('button');
      header.className = 'band__header';
      header.setAttribute('aria-expanded', String(index === expandedIndex));

      // Artistas ainda sem imagem pesquisada mostram a inicial do nome.
      const image = document.createElement(band.image ? 'img' : 'span');
      image.className = 'band__image';
      if (band.image) {
        image.src = band.image;
        image.alt = '';
      } else {
        image.classList.add('band__image--empty');
        image.textContent = band.name.charAt(0).toUpperCase();
      }

      const name = document.createElement('span');
      name.className = 'band__name';
      name.textContent = band.name;
      name.title = band.name;

      const note = document.createElement('img');
      note.className = 'band__note';
      note.src = 'assets/music-note.svg';
      note.alt = '';

      const count = document.createElement('span');
      count.className = 'band__count';
      count.textContent = `(${band.songs.length})`;

      header.append(image, name, note, count);
      header.addEventListener('click', () => {
        expandedIndex = expandedIndex === index ? -1 : index;
        bandsEl.querySelectorAll('.band').forEach((el) => {
          const isExpanded = Number(el.dataset.index) === expandedIndex;
          el.classList.toggle('is-expanded', isExpanded);
          el.querySelector('.band__header').setAttribute('aria-expanded', String(isExpanded));
        });
      });

      const details = document.createElement('div');
      details.className = 'band__details';

      const inner = document.createElement('div');
      inner.className = 'band__details-inner';

      const divider = document.createElement('img');
      divider.className = 'band__divider';
      divider.src = 'assets/divider.svg';
      divider.alt = '';

      const songs = document.createElement('ul');
      songs.className = 'band__songs';
      band.songs.forEach(({ title, file }) => {
        const item = document.createElement('li');
        const song = document.createElement('button');
        song.className = 'band__song';
        song.textContent = title;
        song.title = title;
        // Clicar na música abre o arquivo no programa padrão.
        song.addEventListener('click', async () => {
          try {
            await window.api.openSong(instrument, file);
          } catch (error) {
            song.title = error.message.replace(/^.*?Error: /, '');
            song.classList.add('is-missing');
          }
        });
        item.append(song);
        songs.append(item);
      });

      inner.append(divider, songs);
      details.append(inner);

      card.dataset.index = String(index);
      card.append(header, details);

      if (band.name !== UNKNOWN_ARTIST) {
        const edit = document.createElement('button');
        edit.className = 'band__edit';
        edit.title = 'Corrigir nome do artista';
        edit.setAttribute('aria-label', 'Corrigir nome do artista');
        const pencil = document.createElement('img');
        pencil.src = 'assets/pencil.svg';
        pencil.alt = '';
        edit.append(pencil);
        edit.addEventListener('click', () => startRename(card, band));
        card.append(edit);
      }
      return card;
    }

    function render() {
      const query = normalize(searchEl.value);
      bandsEl.replaceChildren();
      bandsEl.classList.toggle('bands--list', view.list);
      listModeEl.checked = view.list;
      sortEls.forEach((el) => el.classList.toggle('is-active', el.dataset.sort === view.sort));

      let visible = 0;
      bands.forEach((band, index) => {
        const matches =
          !query ||
          normalize(band.name).includes(query) ||
          band.songs.some((song) => normalize(song.title).includes(query));
        if (!matches) return;
        bandsEl.append(createCard(band, index));
        visible += 1;
      });

      emptyEl.hidden = visible > 0;
      emptyEl.textContent = bands.length
        ? 'Nenhuma música ou artista encontrado'
        : `Nenhuma ${noun} por aqui ainda. Escolha o diretório em Configurações e clique em Gerar JSON.`;
      updateArrows();
    }

    // `focusName` mantém aberto (e visível) o artista que acabou de ser corrigido.
    async function load(focusName = null) {
      const [settings, library] = await Promise.all([window.api.getSettings(), window.api.getLibrary(instrument)]);
      pathEl.textContent = settings.instruments[instrument].folder ?? 'não configurado';
      bands = (library?.artists ?? []).map((artist) => ({
        name: artist.name,
        // O caminho local da imagem vira uma URL file:// para o <img>.
        image: artist.image && encodeURI(`file:///${artist.image.replace(/\\/g, '/')}`),
        songs: artist.songs.map((song) => ({ title: song.title, file: song.file })),
      }));

      view = settings.instruments[instrument].view;
      sortBands();

      const focusIndex = focusName ? bands.findIndex((band) => band.name === focusName) : -1;
      expandedIndex = Math.max(focusIndex, 0);
      render();
      if (focusIndex >= 0) {
        bandsEl.querySelector(`.band[data-index="${focusIndex}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
      } else {
        bandsEl.scrollTo(0, 0);
      }
      updateArrows();
    }

    searchEl.addEventListener('input', render);
    bandsEl.addEventListener('scroll', updateArrows);

    prevEl.addEventListener('click', () => bandsEl.scrollBy({ left: -ARROW_STEP, behavior: 'smooth' }));
    nextEl.addEventListener('click', () => bandsEl.scrollBy({ left: ARROW_STEP, behavior: 'smooth' }));

    // A roda do mouse rola o catálogo na horizontal.
    bandsEl.addEventListener(
      'wheel',
      (event) => {
        if (view.list) return;
        const songs = event.target.closest('.band__songs');
        if (event.deltaY === 0 || (songs && songs.scrollHeight > songs.clientHeight)) return;
        event.preventDefault();
        bandsEl.scrollLeft += event.deltaY;
      },
      { passive: false }
    );

    // Clicar e arrastar também percorre o catálogo.
    let drag = null;
    bandsEl.addEventListener('pointerdown', (event) => {
      if (view.list || event.button !== 0 || event.target.closest('input')) return;
      drag = { startX: event.clientX, startScroll: bandsEl.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
      drag.moved = true;
      bandsEl.classList.add('is-dragging');
      bandsEl.scrollLeft = drag.startScroll - delta;
    });
    window.addEventListener('pointerup', () => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      bandsEl.classList.remove('is-dragging');
      if (!moved) return;
      // O clique que encerra um arrasto não deve abrir/fechar o card.
      const stop = (event) => event.stopPropagation();
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, true));
    });

    document.addEventListener('library:updated', (event) => {
      if (event.detail.instrument === instrument) load();
    });
    document.addEventListener('settings:updated', () => load());

    load();
  }

  document.querySelectorAll('.view.library').forEach(createLibraryView);
})();
