// TELA 3 — Configurações
(() => {
  const INSTRUMENT_LABELS = { violao: 'violão', piano: 'piano' };
  const FOLDER_LABELS = { violao: 'Diretório das cifras', piano: 'Diretório das partituras' };

  const viewEl = document.getElementById('view-config');
  const subtitleEl = document.getElementById('config-subtitle');
  const folderEl = document.getElementById('config-folder');
  const folderLabelEl = document.getElementById('config-folder-label');
  const renameEl = document.getElementById('config-rename');
  const statusEl = document.getElementById('config-status');
  const generateEl = document.getElementById('config-generate');
  const instrumentEls = viewEl.querySelectorAll('.config__instrument');
  const patternEls = viewEl.querySelectorAll('input[name="config-pattern"]');
  const infoEls = viewEl.querySelectorAll('input[data-info]');
  const instrumentPanelEl = document.getElementById('config-instrument-panel');
  const appPanelEl = document.getElementById('config-app-panel');
  const scaleEls = viewEl.querySelectorAll('input[name="config-scale"]');
  const themeEls = viewEl.querySelectorAll('input[name="config-theme"]');
  const updateStatusEl = document.getElementById('config-update-status');

  let instrument = 'violao';
  let settings = null;

  function setStatus(message, kind = '') {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', kind === 'error');
    statusEl.classList.toggle('is-success', kind === 'success');
  }

  // Preenche o formulário com as configurações do instrumento selecionado.
  function fillForm() {
    const isApp = instrument === 'app';
    instrumentEls.forEach((el) => el.classList.toggle('is-active', el.dataset.instrument === instrument));
    instrumentPanelEl.hidden = isApp;
    appPanelEl.hidden = !isApp;

    if (isApp) {
      subtitleEl.textContent = 'Configurações do aplicativo';
      scaleEls.forEach((el) => {
        el.checked = Number(el.value) === settings.app.scale;
      });
      themeEls.forEach((el) => {
        el.checked = el.value === settings.app.theme;
      });
      return;
    }

    const config = settings.instruments[instrument];
    subtitleEl.textContent = `Configurações para suas notas de ${INSTRUMENT_LABELS[instrument]}`;

    folderLabelEl.textContent = FOLDER_LABELS[instrument];
    folderEl.value = config.folder ?? '';
    renameEl.checked = config.renameFiles;
    patternEls.forEach((el) => {
      el.checked = el.value === config.pattern;
    });
    infoEls.forEach((el) => {
      el.checked = config.info[el.dataset.info];
    });
  }

  async function save(patch) {
    settings = await window.api.updateInstrument(instrument, patch);
    document.dispatchEvent(new CustomEvent('settings:updated'));
  }

  async function saveFolder() {
    await save({ folder: folderEl.value.trim() || null });
  }

  instrumentEls.forEach((el) => {
    el.addEventListener('click', () => {
      instrument = el.dataset.instrument;
      setStatus('');
      fillForm();
    });
  });

  document.getElementById('config-pick-folder').addEventListener('click', async () => {
    const folder = await window.api.pickFolder();
    if (!folder) return;
    folderEl.value = folder;
    await saveFolder();
    setStatus('Diretório salvo.', 'success');
  });

  document.getElementById('config-save').addEventListener('click', async () => {
    await saveFolder();
    setStatus('Diretório salvo.', 'success');
  });

  folderEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') document.getElementById('config-save').click();
  });

  patternEls.forEach((el) => {
    el.addEventListener('change', async () => {
      if (!renameEl.checked) {
        await save({ pattern: el.value });
        return;
      }

      // Com "Renomear arquivos" ligado, trocar o modelo renomeia os arquivos da pasta.
      await saveFolder();
      const result = await window.api.renameFiles(instrument, el.value);
      settings = await window.api.getSettings();
      fillForm();
      if (!result) return;

      const skipped = result.skipped ? ` ${result.skipped} já existiam e foram mantidos.` : '';
      setStatus(`${result.renamed} arquivos renomeados.${skipped}`, 'success');
      document.dispatchEvent(new CustomEvent('library:updated', { detail: { instrument } }));
    });
  });

  renameEl.addEventListener('change', () => save({ renameFiles: renameEl.checked }));

  infoEls.forEach((el) => {
    el.addEventListener('change', () => save({ info: { [el.dataset.info]: el.checked } }));
  });

  generateEl.addEventListener('click', async () => {
    generateEl.disabled = true;
    setStatus('Lendo a pasta…');
    try {
      await saveFolder();
      const { library, failures } = await window.api.scanLibrary(instrument);
      const songCount = library.artists.reduce((total, artist) => total + artist.songs.length, 0);
      const summary = `JSON gerado: ${songCount} músicas de ${library.artists.length} artistas.`;
      setStatus(failures ? `${summary} ${failures} pesquisas falharam.` : summary, 'success');
      document.dispatchEvent(new CustomEvent('library:updated', { detail: { instrument } }));
    } catch (error) {
      // O Electron prefixa a mensagem com "Error invoking remote method ...: Error: ".
      setStatus(error.message.replace(/^.*?Error: /, ''), 'error');
    } finally {
      generateEl.disabled = false;
    }
  });

  window.api.onScanProgress(({ done, total }) => {
    setStatus(`Procurando informações… ${done}/${total}`);
  });

  // ---------- Aplicativo: resolução, tema e versão ----------

  scaleEls.forEach((el) => {
    el.addEventListener('change', async () => {
      settings = await window.api.updateAppSettings({ scale: Number(el.value) });
    });
  });

  themeEls.forEach((el) => {
    el.addEventListener('change', async () => {
      settings = await window.api.updateAppSettings({ theme: el.value });
      document.documentElement.dataset.theme = el.value;
    });
  });

  const updateEl = document.getElementById('config-update');
  let updateReady = false;

  function showUpdate({ status, version, percent, message }) {
    updateReady = status === 'ready';
    updateEl.textContent = updateReady ? 'Reiniciar e instalar' : 'Atualizar versão';
    updateEl.disabled = status === 'checking' || status === 'downloading';
    updateStatusEl.classList.toggle('is-error', status === 'error');
    updateStatusEl.textContent = {
      checking: 'Procurando atualização…',
      'up-to-date': 'Você já está na versão mais recente.',
      downloading: `Baixando a nova versão… ${percent ?? 0}%`,
      ready: `Versão ${version} pronta para instalar.`,
      dev: 'A atualização só funciona no aplicativo instalado.',
      error: `Não foi possível verificar: ${message}`,
    }[status];
  }

  updateEl.addEventListener('click', async () => {
    if (updateReady) {
      window.api.installUpdate();
      return;
    }
    showUpdate({ status: 'checking' });
    showUpdate(await window.api.checkUpdate());
  });

  window.api.onUpdateProgress(showUpdate);

  window.api.getAppInfo().then(({ version }) => {
    document.getElementById('config-version').textContent = version;
  });

  window.api.getSettings().then((loaded) => {
    settings = loaded;
    fillForm();
  });
})();
