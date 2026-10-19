// Claude Status Pet — supports SVG, GIF, and ASCII art characters

const bubble = document.getElementById('speech-bubble');
const statusText = document.getElementById('status-text');
const stateLabel = document.getElementById('state-label');
const sessionNameEl = document.getElementById('session-name');
const container = document.getElementById('pet-container');
const imgWrapper = document.getElementById('sprite-wrapper');
const imgEl = document.getElementById('sprite-img');
const asciiPre = document.getElementById('ascii-art');
const charMenu = document.getElementById('char-menu');
const menuBackdrop = document.getElementById('menu-backdrop');

// ── Character data ──

const ASCII_SPECIES = {
  chonk: {
    name: 'Voidchisel (Chonk)',
    idle: [
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['            ', '  /\\    /|  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´~ '],
    ],
    thinking: [
      ['     ?      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['    ??      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
    ],
    working: [
      ['            ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ..   ) ', '  `------´  '],
      ['     *      ', '  /\\    /\\  ', ' ( {E}    {E} ) ', ' (   ><   ) ', '  `------´  '],
      ['    **      ', '  /\\    /|  ', ' ( {E}    {E} ) ', ' (   ><   ) ', '  `------´  '],
    ],
    offline: [
      ['    z z     ', '  /\\    /\\  ', ' ( -    - ) ', ' (   ..   ) ', '  `------´  '],
      ['   z z z    ', '  /\\    /\\  ', ' ( -    - ) ', ' (   ..   ) ', '  `------´  '],
    ],
  },
  cat: {
    name: 'Cat',
    idle: [
      ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  ω  )   ', '  (")_(")   '],
      ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  ω  )   ', '  (")_(")~  '],
    ],
    thinking: [
      ['     ?      ', '   /\\_/\\    ', '  ({E}    {E})  ', '  (  ω  )   ', '  (")_(")   '],
    ],
    working: [
      ['     *      ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  >< )   ', '  (")_(")~  '],
    ],
    offline: [
      ['   z z z    ', '   /\\_/\\    ', '  ( -   -)  ', '  (  ω  )   ', '  (")_(")   '],
    ],
  },
  ghost: {
    name: 'Ghost',
    idle: [
      ['            ', '   .----.   ', '  / {E}  {E} \\  ', '  |      |  ', '  ~`~``~`~  '],
      ['            ', '   .----.   ', '  / {E}  {E} \\  ', '  |      |  ', '  `~`~~`~`  '],
    ],
    thinking: [
      ['    ~  ~    ', '   .----.   ', '  / {E}  {E} \\  ', '  |  ??  |  ', '  ~`~``~`~  '],
    ],
    working: [
      ['   ~ ~  ~   ', '   .----.   ', '  / {E}  {E} \\  ', '  |  **  |  ', '  ~~`~~`~~  '],
    ],
    offline: [
      ['            ', '   .----.   ', '  / -  - \\  ', '  |      |  ', '  ~`~``~`~  '],
    ],
  },
  robot: {
    name: 'Robot',
    idle: [
      ['            ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ ==== ]  ', '  `------´  '],
      ['            ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ -==- ]  ', '  `------´  '],
    ],
    thinking: [
      ['    * *     ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ ???? ]  ', '  `------´  '],
    ],
    working: [
      ['    ***     ', '   .[||].   ', '  [ {E}  {E} ]  ', '  [ <<>> ]  ', '  `------´  '],
    ],
    offline: [
      ['            ', '   .[||].   ', '  [ -  - ]  ', '  [ .... ]  ', '  `------´  '],
    ],
  },
  duck: {
    name: 'Duck',
    idle: [
      ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´    '],
      ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´~   '],
    ],
    thinking: [
      ['     ?      ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´    '],
    ],
    working: [
      ['     !      ', '    __      ', '  <({E} )___  ', '   (  .__>  ', '    `--´~   '],
    ],
    offline: [
      ['   z z      ', '    __      ', '  <(- )___  ', '   (  ._>   ', '    `--´    '],
    ],
  },
  snail: {
    name: 'Snail',
    idle: [
      ['            ', ' {E}    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
      ['            ', '  {E}   .--.  ', '  |  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    thinking: [
      ['     ?      ', ' {E}    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    working: [
      ['     !      ', ' {E}    .--.  ', '  \\  ( @  ) ', '   \\_`--´   ', '   ~~~~~~   '],
      ['    !!      ', '  {E}   .--.  ', '  |  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
    offline: [
      ['   z z z    ', ' -    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ],
  },
  axolotl: {
    name: 'Axolotl',
    idle: [
      ['            ', '}~(______)~{', '}~({E} .. {E})~{', '  ( .--. )  ', '  (_/  \\_)  '],
      ['            ', '~}(______){~', '~}({E} .. {E}){~', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
    thinking: [
      ['     ?      ', '}~(______)~{', '}~({E} .. {E})~{', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
    working: [
      ['    !!      ', '~}(______){~', '~}({E} .. {E}){~', '  (  --  )  ', '  ~_/  \\_~  '],
    ],
    offline: [
      ['   z z z    ', '}~(______)~{', '}~(- .. -)~{', '  ( .--. )  ', '  (_/  \\_)  '],
    ],
  },
};

// GIF character maps loaded from character.json files (populated at init)
const GIF_MODES = {};
// Packs whose character.json sets "motion": "none" ship their own frame animation
const STATIC_MOTION_PACKS = new Set();

function registerCharacter(id, jsonStr) {
  const config = JSON.parse(jsonStr);
  GIF_MODES[id] = config.states;
  if (config.scene) CHARACTER_SCENES[id] = config.scene;
  else delete CHARACTER_SCENES[id];
  if (config.motion === 'none') STATIC_MOTION_PACKS.add(id);
  else STATIC_MOTION_PACKS.delete(id);
}

// Reads <id>/character.json from the DLC or custom characters dir; false when missing or unreadable
async function loadCharacter(id) {
  try {
    const jsonStr = await window.__TAURI__.core.invoke('load_text_asset', { path: id + '/character.json' });
    if (!jsonStr) return false;
    registerCharacter(id, jsonStr);
    return true;
  } catch (e) {
    return false;
  }
}

// Drawn in code, so it works before any DLC or character pack is installed
const DEFAULT_MODE = 'chonk';

const ASCII_ANIM_SPEED = {
  working: 300, editing: 300, running: 300,
  thinking: 600, searching: 600,
};
const DEFAULT_ANIM_SPEED = 800;

// ── State ──
let mode = localStorage.getItem('petMode') || DEFAULT_MODE;
let eye = localStorage.getItem('petEye') || '·';
let petColor = localStorage.getItem('petColor') || '';
let petBgColor = localStorage.getItem('petBgColor') || '';
let petFillColor = localStorage.getItem('petFillColor') || '';
let petTextColor = localStorage.getItem('petTextColor') || '';
let petSessionBg = localStorage.getItem('petSessionBg') || '';
let petFontSize = parseInt(localStorage.getItem('petFontSize') || '16');
let petScale = parseFloat(localStorage.getItem('petScale') || '1');
let petMotion = localStorage.getItem('petMotion') !== 'off';
let petSpeech = localStorage.getItem('petSpeech') !== 'off';
let petDeskScene = localStorage.getItem('petDeskScene') !== 'off';
let currentState = 'idle';
let currentImgSrc = '';
let requestedImgSrc = '';
let bubbleTimeout = null;
let stateAnimTimeout = null;
// Length of the pop-in keyframes (.anim-appear in style.css)
const APPEAR_MS = 400;
let appearUntil = 0;
let spriteKey = '';
let asciiFrame = 0;
let asciiInterval = null;
let menuPage = 'main';
let appVersion = '0.0.0';
let customPacks = [];
let availableDlcs = [];  // [{id, name, installed}] from dlc/*.json
let boundSessionId = '';
let sessionPoll = null;
const dlcInstalledCache = {};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startDrag() {
  if (window.__TAURI__) window.__TAURI__.window.getCurrentWindow().startDragging();
}

// ── Apply visual config ──
function applyConfig() {
  const colorProps = [
    [asciiPre, 'color', petColor],
    [stateLabel, 'color', petColor],
    [sessionNameEl, 'background', petSessionBg],
    [sessionNameEl, 'color', petTextColor],
    [container, 'background', petBgColor],
    [container, 'borderRadius', petBgColor ? '12px' : ''],
    [asciiPre, 'background', petFillColor],
  ];
  for (const [el, prop, val] of colorProps) {
    el.style[prop] = val || '';
  }
  // Sync bubble border + tail with label background color
  const bubbleColor = petSessionBg && petSessionBg !== 'transparent' ? petSessionBg : '';
  bubble.style.setProperty('--bubble-color', bubbleColor);
  asciiPre.style.fontSize = petFontSize + 'px';
  container.style.width = Math.round(200 * petScale) + 'px';
  container.style.height = Math.round(240 * petScale) + 'px';

  // Scale inner elements
  imgWrapper.style.width = Math.round(140 * petScale) + 'px';
  imgWrapper.style.height = Math.round(140 * petScale) + 'px';
  statusText.style.fontSize = Math.round(13 * petScale) + 'px';
  sessionNameEl.style.fontSize = Math.round(12 * petScale) + 'px';
  stateLabel.style.fontSize = Math.round(12 * petScale) + 'px';
  bubble.style.maxWidth = Math.round(180 * petScale) + 'px';

  applyMotion();

  // Resize window to match. applyConfig also runs on every color-picker input, so skip the
  // window round-trips unless the scale actually changed.
  if (window.__TAURI__ && petScale !== appliedWindowScale) {
    appliedWindowScale = petScale;
    const w = Math.round(200 * petScale);
    const h = Math.round(240 * petScale);
    const LS = window.__TAURI__.dpi?.LogicalSize || window.__TAURI__.window?.LogicalSize;
    if (LS) {
      // The window grows from its top-left corner, so a bigger scale can push it past the screen edge
      window.__TAURI__.window.getCurrentWindow().setSize(new LS(w, h)).then(keepWindowOnScreen).catch(() => {});
    }
  }
}

// tauri.conf.json creates the window at the 1x size (200x240)
let appliedWindowScale = 1;

// ── Window placement: bottom-right of the primary work area, or wherever the user last dropped it ──
const WINDOW_MARGIN = 16;

function isPointInArea(point, area) {
  return point.x >= area.position.x && point.x < area.position.x + area.size.width
      && point.y >= area.position.y && point.y < area.position.y + area.size.height;
}

async function keepWindowOnScreen() {
  const win = window.__TAURI__.window.getCurrentWindow();
  const monitor = await win.currentMonitor();
  if (!monitor) return;
  const area = monitor.workArea;
  const position = await win.outerPosition();
  const size = await win.outerSize();
  const x = Math.max(area.position.x, Math.min(position.x, area.position.x + area.size.width - size.width));
  const y = Math.max(area.position.y, Math.min(position.y, area.position.y + area.size.height - size.height));
  if (x !== position.x || y !== position.y) {
    await win.setPosition(new window.__TAURI__.dpi.PhysicalPosition(x, y));
  }
}

async function moveToDefaultCorner() {
  const win = window.__TAURI__.window.getCurrentWindow();
  const monitor = (await window.__TAURI__.window.primaryMonitor()) || (await win.currentMonitor());
  const area = monitor.workArea;
  // Size from the scale setting, not outerSize(): applyConfig's resize may still be in flight
  const width = Math.round(200 * petScale * monitor.scaleFactor);
  const height = Math.round(240 * petScale * monitor.scaleFactor);
  const margin = Math.round(WINDOW_MARGIN * monitor.scaleFactor);
  await win.setPosition(new window.__TAURI__.dpi.PhysicalPosition(
    area.position.x + area.size.width - width - margin,
    area.position.y + area.size.height - height - margin));
}

async function placeWindow() {
  const win = window.__TAURI__.window.getCurrentWindow();
  // Register first so drags are still remembered if a monitor query below fails
  let saveTimer = null;
  win.onMoved(({ payload }) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => localStorage.setItem('petPosition', JSON.stringify({ x: payload.x, y: payload.y })), 300);
  });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('petPosition') || 'null'); } catch (e) {}
  const monitors = await window.__TAURI__.window.availableMonitors();
  if (saved && monitors.some(m => isPointInArea(saved, m.workArea))) {
    await win.setPosition(new window.__TAURI__.dpi.PhysicalPosition(saved.x, saved.y));
    // Only the top-left corner was checked; after a resolution change the rest may hang off screen
    await keepWindowOnScreen();
  } else {
    await moveToDefaultCorner();
  }
}

function saveConfig(key, value) {
  localStorage.setItem(key, value);
  applyConfig();
}

// Per-state CSS motion (float, wiggle, pulse...) layered on top of the character image
function applyMotion() {
  const enabled = petMotion && !STATIC_MOTION_PACKS.has(mode);
  document.body.classList.toggle('no-motion', !enabled);
}

// ── Renderers ──

function showImage() {
  imgWrapper.style.display = 'flex';
  asciiPre.style.display = 'none';
}

function showAscii() {
  imgWrapper.style.display = 'none';
  asciiPre.style.display = 'block';
}

function setImage(src, instant = false) {
  requestedImgSrc = src;
  // Not preloaded yet: load it, then show it unless another state asked for a different image meanwhile
  if (!assetCache[src] && !missingAssets.has(src) && hasExternalAssets && window.__TAURI__) {
    loadAsset(src).then(() => {
      if (requestedImgSrc === src) setImage(src, instant);
    });
    return;
  }
  // Without a cached data URL the path is tried relative to the frontend; a miss shows the 404 art below
  const resolved = assetCache[src] || src;
  if (resolved === currentImgSrc) return;
  if (instant) {
    imgEl.src = resolved;
    imgEl.style.opacity = '1';
    currentImgSrc = resolved;
    return;
  }
  imgEl.style.opacity = '0';
  setTimeout(() => {
    imgEl.src = resolved;
    imgEl.style.opacity = '1';
  }, 150);
  currentImgSrc = resolved;
}

// Show ASCII 404 art when image fails to load
imgEl.addEventListener('error', () => {
  if (imgEl.src && imgEl.src !== window.location.href) {
    const name = decodeURIComponent(imgEl.src.split('/').pop().split('?')[0]);
    // Switch to ASCII 404 display; the next status picks a sprite again
    spriteKey = '';
    showAscii();
    asciiPre.textContent = [
      '            ',
      '   4  0  4  ',
      '   ╭──────╮ ',
      '   │ ×  × │ ',
      '   │  __  │ ',
      '   ╰──────╯ ',
    ].join('\n');
    statusText.textContent = 'Image not found: ' + name;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 8000);
  }
});

function renderAsciiFrame(frames, frameIdx) {
  const frame = frames[frameIdx % frames.length];
  asciiPre.textContent = frame.map(line => line.replaceAll('{E}', eye)).join('\n');
}

function startAsciiAnimation(frames) {
  if (asciiInterval) clearInterval(asciiInterval);
  asciiFrame = 0;
  renderAsciiFrame(frames, 0);
  if (frames.length > 1) {
    const speed = ASCII_ANIM_SPEED[currentState] || DEFAULT_ANIM_SPEED;
    asciiInterval = setInterval(() => {
      asciiFrame++;
      renderAsciiFrame(frames, asciiFrame);
    }, speed);
  }
}

// ── Main update ──

// What the agent said replaces the generic tool line. Settings can turn it off, since the pet
// sits on the desktop and would show the conversation during screen sharing.
function spokenText(status) {
  if (!petSpeech) return '';
  if (status.state === 'idle') return status.reply || '';
  if (WORKING_STATES.has(status.state)) return status.thought || '';
  return '';
}

// Mirrors session_meta::state_group in the backend
function stateGroup(state) {
  return WORKING_STATES.has(state) ? 'working' : state;
}

// Pops in only when the state group changes. Tools switch the busy state several times a
// second, and replaying the pop-in each time kept the pet shrinking and bouncing.
function playStateAnimation(state) {
  if (state === currentState) return;
  const groupChanged = stateGroup(state) !== stateGroup(currentState);
  currentState = state;
  // A quick second change would otherwise let an older timer apply the previous state's animation
  clearTimeout(stateAnimTimeout);
  const deskHandled = playDeskScene(state);
  if (groupChanged && !deskHandled) {
    container.className = 'anim-appear';
    appearUntil = Date.now() + APPEAR_MS;
  }
  const appearLeft = appearUntil - Date.now();
  if (appearLeft <= 0) {
    container.className = `anim-${state}`;
  } else {
    stateAnimTimeout = setTimeout(() => { container.className = `anim-${state}`; }, appearLeft);
  }
}

// Keeps the sprite while only the detail changes; picking a new random one on every tool call
// swapped the picture each time the pet read another file.
function renderCharacter(state, instant = false) {
  const key = mode + '|' + state;
  if (key === spriteKey) return;
  spriteKey = key;
  if (GIF_MODES[mode]) {
    showImage();
    const map = GIF_MODES[mode];
    setImage(pickRandom(map[state] || map.idle), instant);
  } else {
    showAscii();
    const species = ASCII_SPECIES[mode];
    if (species) {
      const stateKey = (state === 'delegating') ? 'working' : state;
      startAsciiAnimation(species[stateKey] || species.idle);
    }
  }
}

function updateStatus(status) {
  const state = status.state || 'idle';
  const detail = spokenText(status) || status.detail || '';
  const sessionName = status.session_name || '';

  if (state === 'closed' && window.__TAURI__) {
    window.__TAURI__.window.getCurrentWindow().close();
    return;
  }

  if (sessionName) renderSessionName(sessionName, status.session_color, status.session_tooltip);

  // Before the character: the ASCII frame speed is read from currentState
  playStateAnimation(state);
  // Sprites at the same desk cross-fade; the usual fade through transparent would blink the whole desk
  if (!sceneOwnsSprite()) {
    if (sceneIsSeated()) crossfadeSeatedSwap(state);
    else renderCharacter(state);
  }

  stateLabel.textContent = state;
  bubble.classList.toggle('thought', WORKING_STATES.has(state));
  // Long texts are cut to two lines; hovering shows the rest
  statusText.title = detail;

  // Speech bubble — always visible for active states, 30s timeout for idle/offline
  if (detail && state !== 'offline') {
    if (statusText.textContent !== detail) {
      bubble.style.transition = 'none';
      bubble.style.transform = 'scale(0.95)';
      setTimeout(() => {
        bubble.style.transition = 'opacity 0.3s ease, transform 0.15s ease';
        bubble.style.transform = 'scale(1)';
      }, 50);
    }
    statusText.textContent = detail;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    if (state === 'idle') {
      bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
    }
  } else if (state === 'offline') {
    statusText.textContent = 'Zzz...';
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => { bubble.classList.add('hidden'); }, 30000);
  }
}

function renderSessionName(name, color, tooltip) {
  sessionNameEl.replaceChildren();
  if (color) sessionNameEl.appendChild(createSessionDot(color));
  sessionNameEl.appendChild(document.createTextNode(name));
  sessionNameEl.title = tooltip || '';
}

function createSessionDot(color) {
  const dot = document.createElement('span');
  dot.className = 'session-dot';
  dot.style.background = color;
  return dot;
}

// ── Menu ──

function addMenuItem(parent, text, onclick, cls) {
  const el = document.createElement('div');
  el.className = 'menu-item' + (cls ? ' ' + cls : '');
  el.textContent = text;
  el.onclick = (e) => { e.stopPropagation(); onclick(); };
  parent.appendChild(el);
}

function addDivider(parent) {
  const d = document.createElement('div');
  d.className = 'menu-divider';
  parent.appendChild(d);
}

function addColorRow(parent, label, currentVal, defaultVal, onchange, allowTransparent) {
  const row = document.createElement('div');
  row.className = 'menu-config-row';
  const lbl = document.createElement('span');
  lbl.className = 'menu-config-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'menu-color-input';
  input.value = (currentVal && currentVal !== 'transparent') ? currentVal : defaultVal;
  input.oninput = (e) => onchange(e.target.value);
  const reset = document.createElement('span');
  reset.className = 'menu-reset';
  reset.textContent = 'x';
  reset.title = 'Reset to default';
  reset.onclick = () => { input.value = defaultVal; onchange(''); };
  row.appendChild(lbl);
  row.appendChild(input);
  if (allowTransparent) {
    const tp = document.createElement('span');
    tp.className = 'menu-reset';
    tp.textContent = '◻';
    tp.title = 'Transparent';
    tp.onclick = () => onchange('transparent');
    row.appendChild(tp);
  }
  row.appendChild(reset);
  parent.appendChild(row);
}

function addSliderRow(parent, label, currentVal, min, max, step, onchange, unit) {
  const row = document.createElement('div');
  row.className = 'menu-config-row';
  const lbl = document.createElement('span');
  lbl.className = 'menu-config-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'menu-slider-input';
  input.min = min; input.max = max; input.step = step;
  input.value = currentVal;
  const fmt = (v) => unit === 'px' ? Math.round(v) + 'px' : Math.round(v * 100) + '%';
  const valLabel = document.createElement('span');
  valLabel.className = 'menu-config-value';
  valLabel.textContent = fmt(currentVal);
  input.oninput = (e) => {
    const v = parseFloat(e.target.value);
    valLabel.textContent = fmt(v);
    onchange(v);
  };
  row.appendChild(lbl);
  row.appendChild(input);
  row.appendChild(valLabel);
  parent.appendChild(row);
}

function buildMenu() {
  charMenu.innerHTML = '';
  if (menuPage === 'config') { buildConfigPage(); return; }
  if (menuPage === 'ascii') { buildAsciiPage(); return; }
  if (menuPage === 'dlc') { buildDlcPage(); return; }
  if (menuPage === 'sessions') { buildSessionsPage(); return; }

  if (aggregateMode) {
    const pinned = aggregateSessions.find(s => s.session_id === pinnedSessionId);
    const summary = pinned ? 'pinned: ' + sessionLabel(pinned) : aggregateSessions.length + ' active';
    addMenuItem(charMenu, 'Sessions (' + summary + ') ▸', () => { menuPage = 'sessions'; buildMenu(); });
    addDivider(charMenu);
  }

  // ASCII Buddies → submenu
  const asciiActive = Object.keys(ASCII_SPECIES).includes(mode);
  addMenuItem(charMenu, 'ASCII Buddies ' + (asciiActive ? '(' + ASCII_SPECIES[mode].name + ')' : '') + ' ▸', () => { menuPage = 'ascii'; buildMenu(); }, asciiActive ? 'active' : '');
  addDivider(charMenu);

  // DLC characters → submenu
  if (availableDlcs.length > 0) {
    const dlcActive = availableDlcs.some(d => mode === d.id);
    const activeName = dlcActive ? availableDlcs.find(d => mode === d.id).name : '';
    addMenuItem(charMenu, 'DLC ' + (dlcActive ? '(' + activeName + ')' : '') + ' ▸', () => { menuPage = 'dlc'; buildMenu(); }, dlcActive ? 'active' : '');
  }

  // Custom character packs
  if (customPacks.length > 0) {
    addDivider(charMenu);
    const customLabel = document.createElement('div');
    customLabel.className = 'menu-section-label';
    customLabel.textContent = 'Custom';
    charMenu.appendChild(customLabel);
    for (const pack of customPacks) {
      addMenuItem(charMenu, pack.name, () => selectChar(pack.id), mode === pack.id ? 'active' : '');
    }
  }

  addDivider(charMenu);
  addMenuItem(charMenu, 'Settings...', () => { menuPage = 'config'; buildMenu(); });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Close', () => closeMenu());
  addMenuItem(charMenu, 'Exit', () => {
    closeMenu();
    if (window.__TAURI__) window.__TAURI__.window.getCurrentWindow().close();
  }, 'menu-item-danger');

  const verLabel = document.createElement('div');
  verLabel.className = 'menu-version';
  verLabel.textContent = 'v' + appVersion;
  charMenu.appendChild(verLabel);

  if (boundSessionId) {
    const sidLabel = document.createElement('div');
    sidLabel.className = 'menu-version';
    sidLabel.textContent = boundSessionId.length > 12
      ? boundSessionId.slice(0, 12) + '…'
      : boundSessionId;
    sidLabel.title = boundSessionId;
    charMenu.appendChild(sidLabel);
  }
}

function buildAsciiPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  for (const [key, species] of Object.entries(ASCII_SPECIES)) {
    addMenuItem(charMenu, species.name, () => { selectChar(key); menuPage = 'main'; }, mode === key ? 'active' : '');
  }
}

function buildConfigPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  addSliderRow(charMenu, 'Scale', petScale, 1, 2, 0.1, (v) => { petScale = v; saveConfig('petScale', String(v)); }, '%');
  addColorRow(charMenu, 'Text', petTextColor, '#ffffff', (v) => { petTextColor = v; saveConfig('petTextColor', v); });
  addColorRow(charMenu, 'Label', petSessionBg, '#e06c3c', (v) => { petSessionBg = v; saveConfig('petSessionBg', v); }, true);
  addColorRow(charMenu, 'ASCII Fill', petFillColor, '#ffffff', (v) => { petFillColor = v; saveConfig('petFillColor', v); });
  addColorRow(charMenu, 'Background', petBgColor, '#ffffff', (v) => { petBgColor = v; saveConfig('petBgColor', v); });
  const packOverridesMotion = STATIC_MOTION_PACKS.has(mode);
  const motionLabel = 'Motion: ' + (petMotion ? 'On' : 'Off') + (packOverridesMotion ? ' (off for this character)' : '');
  addMenuItem(charMenu, motionLabel, () => {
    petMotion = !petMotion;
    saveConfig('petMotion', petMotion ? 'on' : 'off');
    buildMenu();
  });
  addMenuItem(charMenu, 'Speech: ' + (petSpeech ? 'On' : 'Off'), () => {
    petSpeech = !petSpeech;
    saveConfig('petSpeech', petSpeech ? 'on' : 'off');
    rerenderAggregate();
    buildMenu();
  });
  addMenuItem(charMenu, 'Desk scene: ' + (petDeskScene ? 'On' : 'Off') + (CHARACTER_SCENES[mode] ? '' : ' (not in this character)'), () => {
    petDeskScene = !petDeskScene;
    saveConfig('petDeskScene', petDeskScene ? 'on' : 'off');
    syncDeskScene(currentState);
    buildMenu();
  });
  addMenuItem(charMenu, 'Reset Position', () => {
    closeMenu();
    if (window.__TAURI__) moveToDefaultCorner().catch(() => {});
  });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Update Assets', async () => {
    closeMenu();
    stateLabel.textContent = 'downloading';
    container.className = 'anim-thinking';
    statusText.textContent = 'Updating assets...';
    bubble.classList.remove('hidden');
    try {
      await window.__TAURI__.core.invoke('update_assets');
      missingAssets.clear();
      // Refresh DLC list after update
      try {
        availableDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
        for (const dlc of availableDlcs) {
          dlcInstalledCache[dlc.id] = dlc.installed;
        }
      } catch(e) {}
      statusText.textContent = 'Assets updated!';
      container.className = '';
      stateLabel.textContent = 'idle';
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    } catch(e) {
      statusText.textContent = 'Update failed: ' + (e || 'unknown error');
      container.className = 'anim-error';
      stateLabel.textContent = 'error';
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => {
        bubble.classList.add('hidden');
        container.className = '';
        stateLabel.textContent = 'idle';
      }, 8000);
    }
  });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Reset Default', () => {
    petScale = 1; petTextColor = ''; petSessionBg = ''; petFillColor = ''; petBgColor = ''; petMotion = true; petSpeech = true; petDeskScene = true;
    localStorage.removeItem('petScale'); localStorage.removeItem('petTextColor');
    localStorage.removeItem('petSessionBg'); localStorage.removeItem('petFillColor');
    localStorage.removeItem('petBgColor'); localStorage.removeItem('petMotion');
    localStorage.removeItem('petSpeech'); localStorage.removeItem('petDeskScene');
    applyConfig();
    syncDeskScene(currentState);
    rerenderAggregate();
    buildConfigPage();
  }, 'menu-item-danger');
}

function buildDlcPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  for (const dlc of availableDlcs) {
    const installed = isDlcInstalled(dlc.id);
    const cls = mode === dlc.id ? 'active' : '';
    if (installed) {
      addMenuItem(charMenu, dlc.name, () => { selectChar(dlc.id); menuPage = 'main'; }, cls);
    } else {
      addMenuItem(charMenu, dlc.name + ' ↓', () => { downloadAndSelectDlc(dlc.id); menuPage = 'main'; }, cls);
    }
  }
}

function isDlcInstalled(dlcName) {
  // Check synchronously from cache first
  if (dlcInstalledCache[dlcName] !== undefined) return dlcInstalledCache[dlcName];
  return false;
}

async function downloadAndSelectDlc(dlcName) {
  if (!window.__TAURI__) return;
  closeMenu();

  // Show downloading state with animation
  stateLabel.textContent = 'downloading';
  container.className = 'anim-thinking';
  statusText.textContent = 'Downloading ' + dlcName + '...';
  bubble.classList.remove('hidden');

  try {
    await window.__TAURI__.core.invoke('download_dlc', { dlcName });
    missingAssets.clear();
    dlcInstalledCache[dlcName] = true;
    // Re-check assets dir (download_dlc may have created it)
    try { hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir')); } catch(e) {}
    await loadCharacter(dlcName);
    await selectChar(dlcName);
  } catch (e) {
    statusText.textContent = 'Download failed: ' + (e || 'unknown error');
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
    container.className = 'anim-error';
    stateLabel.textContent = 'error';
  }
}

async function selectChar(newMode) {
  mode = newMode;
  localStorage.setItem('petMode', mode);
  closeMenu();
  applyMotion();
  currentImgSrc = '';
  imgEl.src = '';
  spriteKey = '';

  // Show the character immediately with whatever is available
  updateStatus({ state: currentState, detail: statusText.textContent });
  syncDeskScene(currentState);

  // Preload remaining assets in the background
  if (GIF_MODES[mode] && hasExternalAssets) {
    preloadAssets();
  }
}

function openMenu() {
  menuPage = 'main';
  buildMenu();
  charMenu.classList.remove('hidden');
  menuBackdrop.classList.remove('hidden');
}

function closeMenu() {
  charMenu.classList.add('hidden');
  menuBackdrop.classList.add('hidden');
}

// Right-click to toggle menu
container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  charMenu.classList.contains('hidden') ? openMenu() : closeMenu();
});

// Close menu on backdrop click, right-click, or window blur
menuBackdrop.addEventListener('click', closeMenu);
menuBackdrop.addEventListener('contextmenu', (e) => { e.preventDefault(); closeMenu(); });
window.addEventListener('blur', closeMenu);

// Drag — single handler for all draggable elements
for (const el of [imgWrapper, asciiPre, bubble, stateLabel]) {
  el.addEventListener('mousedown', startDrag);
}

// ── Session picker ──
async function showSessionPicker() {
  if (sessionPoll) { clearInterval(sessionPoll); sessionPoll = null; }
  const sessions = await window.__TAURI__.core.invoke('list_unlocked_sessions');
  if (sessions.length === 0) {
    statusText.textContent = 'No session found. Please restart your AI assistant.';
    bubble.classList.remove('hidden');
    stateLabel.textContent = 'waiting';
    sessionPoll = setInterval(async () => {
      const s = await window.__TAURI__.core.invoke('list_unlocked_sessions');
      if (s.length > 0) { clearInterval(sessionPoll); sessionPoll = null; showSessionPicker(); }
    }, 2000);
    return;
  }
  // Auto-bind to the most recently updated session; random if tied
  const maxMod = Math.max(...sessions.map(s => s.last_modified));
  const newest = sessions.filter(s => s.last_modified === maxMod);
  const pick = newest[Math.floor(Math.random() * newest.length)];
  await bindToSession(pick.session_id);
}

async function bindToSession(sessionId) {
  try {
    await window.__TAURI__.core.invoke('bind_session', { sessionId });
    boundSessionId = sessionId;
    charMenu.classList.add('hidden');
    menuBackdrop.classList.add('hidden');
  } catch (e) {
    statusText.textContent = 'Bind failed: ' + e;
    bubble.classList.remove('hidden');
  }
}

// ── Aggregate mode (run --all): one pet showing the most urgent of all sessions ──
const STATE_PRIORITY = { waiting: 5, error: 4, reading: 3, editing: 3, searching: 3, running: 3, delegating: 3, thinking: 2, idle: 1 };
const WORKING_STATES = new Set(['thinking', 'reading', 'editing', 'searching', 'running', 'delegating']);
// A crashed session never sends Stop, so a working state this old is treated as idle
const STALE_WORKING_MS = 10 * 60 * 1000;
// Closing the terminal at a permission prompt leaves "waiting" behind with the top priority
const STALE_WAITING_MS = 30 * 60 * 1000;
const ERROR_VISIBLE_MS = 2 * 60 * 1000;
const HIDE_SESSION_AFTER_MS = 6 * 60 * 60 * 1000;
// Hold the shown session this long so several busy sessions don't make the pet flicker
const MIN_DISPLAY_MS = 1000;

let aggregateMode = false;
let aggregateSessions = [];
let pinnedSessionId = '';
let displayedSessionId = '';
let displayedSince = 0;
let lastAggregateKey = '';
let aggregateRenderTimer = null;

function sessionPriority(session) {
  return STATE_PRIORITY[session.state] || 0;
}

function effectiveState(session, now) {
  const age = now - session.last_modified;
  // The age guesses only stand in for an unknown process. A live Claude process means a quiet
  // session is really busy (a long build) or really waiting for approval, not crashed.
  const guessByAge = session.alive !== true;
  if (guessByAge && WORKING_STATES.has(session.state) && age > STALE_WORKING_MS) return 'idle';
  if (guessByAge && session.state === 'waiting' && age > STALE_WAITING_MS) return 'idle';
  if (session.state === 'error' && age > ERROR_VISIBLE_MS) return 'idle';
  return session.state;
}

function sessionLabel(session) {
  const name = session.session_name || session.session_id.slice(0, 8);
  const sameName = aggregateSessions.filter(s => s.session_name === session.session_name);
  if (sameName.length < 2) return name;
  // Sessions in one repo usually differ by branch; fall back to the ID when they share one too
  const branchIsUnique = session.branch && sameName.filter(s => s.branch === session.branch).length === 1;
  return name + '·' + (branchIsUnique ? session.branch : session.session_id.slice(0, 4));
}

// Same session, same color on every refresh, without storing anything
function sessionColor(sessionId) {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  return 'hsl(' + (hash % 360) + ', 70%, 60%)';
}

function formatAge(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? hours + 'h' + (minutes % 60) + 'm' : hours + 'h';
}

// Busy states count from the user's prompt, since tools switch the state many times per turn;
// the rest count from when the session entered that state
function stateStartedAt(session) {
  if (WORKING_STATES.has(session.state) && session.turn_started) return session.turn_started;
  return session.state_since || session.last_modified;
}

function sessionTooltip(session, now) {
  const head = session.session_name + (session.branch ? ' [' + session.branch + ']' : '');
  const lines = [head];
  if (session.title) lines.push(session.title);
  lines.push(session.state + ' · ' + formatAge(now - stateStartedAt(session)));
  return lines.join('\n');
}

async function refreshSessions() {
  const now = Date.now();
  let sessions = [];
  try { sessions = await window.__TAURI__.core.invoke('list_all_sessions'); } catch (e) { return; }
  aggregateSessions = sessions
    // alive === false: its Claude process exited without a SessionEnd hook (crash, terminal closed)
    .filter(s => s.state !== 'closed' && s.alive !== false && now - s.last_modified < HIDE_SESSION_AFTER_MS)
    .map(s => ({ ...s, state: effectiveState(s, now) }))
    .sort((a, b) => sessionPriority(b) - sessionPriority(a) || b.last_modified - a.last_modified);
  if (pinnedSessionId && !aggregateSessions.some(s => s.session_id === pinnedSessionId)) pinnedSessionId = '';
  renderAggregate();
}

function renderAggregate() {
  clearTimeout(aggregateRenderTimer);
  if (aggregateSessions.length === 0) {
    displayedSessionId = '';
    applyAggregateStatus({ state: 'offline', detail: '', session_name: 'No session' });
    return;
  }
  let pick = aggregateSessions.find(s => s.session_id === pinnedSessionId) || aggregateSessions[0];
  const current = aggregateSessions.find(s => s.session_id === displayedSessionId);
  const heldFor = Date.now() - displayedSince;
  if (!pinnedSessionId && current && pick !== current && heldFor < MIN_DISPLAY_MS
      && sessionPriority(pick) <= sessionPriority(current)) {
    aggregateRenderTimer = setTimeout(renderAggregate, MIN_DISPLAY_MS - heldFor);
    pick = current;
  }
  if (pick.session_id !== displayedSessionId) {
    displayedSessionId = pick.session_id;
    displayedSince = Date.now();
  }
  const otherBusy = aggregateSessions.filter(s => s !== pick && (WORKING_STATES.has(s.state) || s.state === 'waiting')).length;
  const label = sessionLabel(pick) + (otherBusy ? ' +' + otherBusy : '');
  const now = Date.now();
  applyAggregateStatus({
    state: pick.state,
    detail: pick.detail,
    session_name: label,
    session_color: sessionColor(pick.session_id),
    session_tooltip: sessionTooltip(pick, now),
    thought: pick.thought,
    reply: pick.reply,
  }, stateDuration(pick, now));
}

// Draws the shown session again after a setting changed how it looks
function rerenderAggregate() {
  if (!aggregateMode) return;
  lastAggregateKey = '';
  renderAggregate();
}

// Shown only for states that need attention or are taking a while; idle needs no clock
function stateDuration(session, now) {
  if (!WORKING_STATES.has(session.state) && session.state !== 'waiting') return '';
  const elapsed = now - stateStartedAt(session);
  return elapsed >= 60000 ? formatAge(elapsed) : '';
}

// The duration sits on the state label, not in the bubble, where a two-line thought would cut it off
function renderStateLabel(state, duration) {
  stateLabel.textContent = state;
  if (!duration) return;
  const span = document.createElement('span');
  span.className = 'state-duration';
  span.textContent = ' · ' + duration;
  stateLabel.appendChild(span);
}

// Polling re-renders the same status every few seconds; skip unchanged ones so the idle bubble can time out.
// A ticking duration only rewrites the label, so it neither replays the bubble animation nor re-rolls the sprite.
function applyAggregateStatus(status, duration = '') {
  const text = spokenText(status) || status.detail;
  const key = status.state + '|' + text + '|' + status.session_name + '|' + status.session_color;
  sessionNameEl.title = status.session_tooltip || '';
  if (key === lastAggregateKey) {
    renderStateLabel(status.state, duration);
    return;
  }
  lastAggregateKey = key;
  updateStatus({ ...status, detail: text, thought: '', reply: '' });
  renderStateLabel(status.state, duration);
  // updateStatus leaves the bubble alone when detail is empty, which would keep showing the
  // previously displayed session's text under this session's label
  if (!text && status.state !== 'offline') {
    clearTimeout(bubbleTimeout);
    bubble.classList.add('hidden');
  }
}

function buildSessionsPage() {
  addMenuItem(charMenu, '← Back', () => { menuPage = 'main'; buildMenu(); });
  addDivider(charMenu);
  addMenuItem(charMenu, 'Auto (most urgent)', () => {
    pinnedSessionId = '';
    lastAggregateKey = '';
    closeMenu();
    renderAggregate();
  }, pinnedSessionId ? '' : 'active');
  const now = Date.now();
  for (const session of aggregateSessions) {
    addMenuItem(charMenu, sessionLabel(session), () => {
      pinnedSessionId = session.session_id;
      lastAggregateKey = '';
      closeMenu();
      renderAggregate();
    }, pinnedSessionId === session.session_id ? 'active' : '');
    const item = charMenu.lastElementChild;
    item.prepend(createSessionDot(sessionColor(session.session_id)));
    item.title = sessionTooltip(session, now);
    // State and time go first: in the 200px window the title is what gets cut off
    const subtext = document.createElement('div');
    subtext.className = 'menu-subtext';
    subtext.textContent = session.state + ' ' + formatAge(now - stateStartedAt(session))
      + (session.title ? ' · ' + session.title : '');
    item.appendChild(subtext);
  }
}

async function startAggregateMode() {
  aggregateMode = true;
  let refreshTimer = null;
  window.__TAURI__.event.listen('sessions-changed', () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshSessions, 150);
  });
  // Staleness thresholds are time based, so re-evaluate even when no file changes
  setInterval(refreshSessions, 5000);
  await refreshSessions();
}

// ── Listen for status updates ──
if (window.__TAURI__) {
  const revealPet = () => document.body.classList.add('placed');
  placeWindow().finally(revealPet);
  // Never leave the pet invisible if placement hangs on a monitor query
  setTimeout(revealPet, 3000);
  // Another topmost window (task manager, a player's mini window) can cover the pet. Re-assert when
  // the pet loses focus, plus a slow fallback poll: a fast poll would fight other windows that also
  // keep re-asserting topmost, making both flicker.
  const reassertTopmost = () => window.__TAURI__.window.getCurrentWindow().setAlwaysOnTop(true).catch(() => {});
  window.addEventListener('blur', reassertTopmost);
  setInterval(reassertTopmost, 10000);
  window.__TAURI__.core.invoke('is_aggregate_mode').then((isAggregate) => {
    if (isAggregate) {
      startAggregateMode();
      return;
    }
    window.__TAURI__.event.listen('status-update', (e) => updateStatus(e.payload));
    window.__TAURI__.core.invoke('get_session_id').then((sid) => {
      if (sid) {
        boundSessionId = sid;
      } else {
        // No explicit session — show session picker
        showSessionPicker();
      }
    });
    window.__TAURI__.core.invoke('get_status').then((s) => { if (s) updateStatus(s); });
  });
} else {
  document.body.classList.add('placed');
  const demos = [
    { state: 'idle', detail: 'Waiting...' },
    { state: 'thinking', detail: 'Processing prompt...' },
    { state: 'editing', detail: 'Editing main.rs' },
    { state: 'searching', detail: 'Searching: TODO' },
    { state: 'delegating', detail: 'Spawning agent...' },
    { state: 'idle', detail: 'Done!' },
    { state: 'offline', detail: 'Session ended' },
  ];
  let i = 0;
  setInterval(() => updateStatus(demos[i++ % demos.length]), 2500);
}

// ── Asset loading ──
let hasExternalAssets = false;
const assetCache = {};
const missingAssets = new Set();

async function initAssets() {
  if (window.__TAURI__) {
    try {
      hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir'));
    } catch(e) {}

    // Auto-download assets if the directory doesn't exist yet
    if (hasExternalAssets) {
      const assetsDir = await window.__TAURI__.core.invoke('get_assets_dir');
      // Check if the dlc/ subdirectory exists by trying to list DLCs
      const dlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
      if (dlcs.length === 0) {
        // Assets dir exists but has no DLC configs — need to download
        stateLabel.textContent = 'downloading';
        container.className = 'anim-thinking';
        statusText.textContent = 'Downloading assets...';
        bubble.classList.remove('hidden');
        try {
          await window.__TAURI__.core.invoke('update_assets');
          missingAssets.clear();
          statusText.textContent = 'Assets ready!';
          clearTimeout(bubbleTimeout);
          bubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 3000);
        } catch(e) {
          statusText.textContent = 'Assets download failed: ' + (e || 'unknown error');
          container.className = 'anim-error';
          stateLabel.textContent = 'error';
          clearTimeout(bubbleTimeout);
          bubbleTimeout = setTimeout(() => {
            bubble.classList.add('hidden');
            container.className = '';
            stateLabel.textContent = 'idle';
          }, 8000);
        }
      }
    }
  }
}

// Caches the data URL, or remembers the miss so status updates stop asking the backend again
async function loadAsset(path) {
  if (!hasExternalAssets || !window.__TAURI__) return;
  if (assetCache[path] || missingAssets.has(path)) return;
  let dataUrl = null;
  try {
    dataUrl = await window.__TAURI__.core.invoke('load_asset', { path });
  } catch(e) {}
  if (dataUrl) assetCache[path] = dataUrl;
  else missingAssets.add(path);
}

// Preload only the active mode's assets
async function preloadAssets() {
  let paths = [];
  if (GIF_MODES[mode]) {
    for (const gifs of Object.values(GIF_MODES[mode])) for (const g of gifs) paths.push(g);
  }
  await Promise.all([...new Set(paths)].map(p => loadAsset(p)));
}

// ── Init ──
(async () => {
  await initAssets();

  // Get app version
  if (window.__TAURI__) {
    try { appVersion = await window.__TAURI__.app.getVersion(); } catch(e) {}
  }

  // Discover DLC and custom characters
  if (window.__TAURI__) {
    // Load available DLCs from dlc/*.json configs
    try {
      availableDlcs = await window.__TAURI__.core.invoke('list_available_dlcs');
      for (const dlc of availableDlcs) {
        dlcInstalledCache[dlc.id] = dlc.installed;
        if (dlc.installed) await loadCharacter(dlc.id);
      }
    } catch(e) {}

    // Custom character packs
    if (hasExternalAssets) {
      try {
        const packs = await window.__TAURI__.core.invoke('list_character_packs');
        customPacks = packs.filter(p => p.group === 'custom' && p.installed);
        for (const pack of customPacks) await loadCharacter(pack.id);
      } catch(e) {}
    }
  }

  // If current mode is a DLC that's not installed, auto-download it
  const isDlcMode = availableDlcs.some(d => d.id === mode);
  if (isDlcMode && !dlcInstalledCache[mode] && window.__TAURI__) {
    statusText.textContent = 'Downloading ' + mode + '...';
    bubble.classList.remove('hidden');
    try {
      await window.__TAURI__.core.invoke('download_dlc', { dlcName: mode });
      missingAssets.clear();
      dlcInstalledCache[mode] = true;
      // Re-check assets dir (download_dlc may have created it)
      try { hasExternalAssets = !!(await window.__TAURI__.core.invoke('get_assets_dir')); } catch(e) {}
      if (!(await loadCharacter(mode))) {
        throw new Error('character.json not found after download');
      }
    } catch(e) {
      statusText.textContent = 'Download failed, using ' + ASCII_SPECIES[DEFAULT_MODE].name;
      mode = DEFAULT_MODE;
      localStorage.setItem('petMode', mode);
    }
  }

  // Fallback: the saved mode may name a character that is no longer available, reset to the default
  const knownMode = GIF_MODES[mode] || ASCII_SPECIES[mode] || customPacks.some(p => p.id === mode);
  if (!knownMode) {
    mode = DEFAULT_MODE;
    localStorage.setItem('petMode', mode);
  }

  // If current mode is a DLC that's installed, preload it
  if (GIF_MODES[mode] && dlcInstalledCache[mode]) {
    await preloadAssets();
  }

  applyConfig();
  // The sprite maps were still the bundled defaults when the first status arrived
  spriteKey = '';
  syncDeskScene(currentState);
  if (aggregateMode) {
    // Character packs finished loading after the first aggregate render; draw again with them
    rerenderAggregate();
  } else {
    updateStatus({ state: 'idle', detail: '' });
  }
})();
