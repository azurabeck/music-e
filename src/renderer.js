// Tempo mínimo da tela de loading antes de entrar nas telas internas.
const LOADING_DURATION_MS = 2600;

// Abas do rodapé que já têm tela pronta.
const AVAILABLE_VIEWS = ['cifras', 'partituras', 'treinar', 'acordes', 'config'];

document.getElementById('btn-minimize').addEventListener('click', () => {
  window.windowControls.minimize();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.windowControls.close();
});

// Áreas marcadas com data-window-drag arrastam a janela (menos campos e botões).
document.querySelectorAll('[data-window-drag]').forEach((area) => {
  area.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('input, button, label')) return;
    area.setPointerCapture(event.pointerId);
    window.windowControls.dragStart();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
    area.addEventListener(type, () => window.windowControls.dragEnd());
  });
});

// Tema salvo nas configurações ('dark' ou 'light').
window.api.getSettings().then((settings) => {
  document.documentElement.dataset.theme = settings.app.theme;
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('is-active', screen.id === id);
  });
}

function showView(name) {
  if (!AVAILABLE_VIEWS.includes(name)) return;
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('is-active', view.id === `view-${name}`);
  });
  document.querySelectorAll('.tabs__item').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  });
}

document.querySelectorAll('.tabs__item').forEach((tab) => {
  tab.addEventListener('click', () => showView(tab.dataset.tab));
});

// `index.html#cifras`, `#partituras`, `#acordes` ou `#config` abre direto na tela (útil durante o desenvolvimento).
const initialView = location.hash.slice(1);
if (AVAILABLE_VIEWS.includes(initialView)) {
  showView(initialView);
  showScreen('screen-main');
} else {
  setTimeout(() => showScreen('screen-main'), LOADING_DURATION_MS);
}
