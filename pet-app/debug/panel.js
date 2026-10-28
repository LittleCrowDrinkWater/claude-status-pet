// Control panel: drives app.js through the same events and settings the backend and menu use.
const STATES = ['idle', 'thinking', 'reading', 'editing', 'searching', 'running', 'delegating', 'waiting', 'error', 'offline'];
const EMOTES = ['cheer', 'wave', 'nod', 'sorry', 'surprised', 'blush', 'puzzled', 'thanks'];
const CYCLE_MS = 2500;
const logEl = document.getElementById('debug-log');
const infoEl = document.getElementById('debug-info');
let cycleTimer = null;

function log(text) {
  const line = document.createElement('div');
  line.textContent = new Date().toLocaleTimeString() + '  ' + text;
  logEl.prepend(line);
  while (logEl.childElementCount > 80) logEl.lastChild.remove();
}
window.petDebug.onLog = log;

function sendStatus(state) {
  const detail = document.getElementById('detail-input').value || 'Debug: ' + state;
  window.petDebug.emit('status-update', { state, detail, tool: '', event: 'Debug', session_id: 'debug', session_name: 'debug' });
  log('status ' + state);
}

function sendEmote(name) {
  const say = document.getElementById('say-input').value;
  const ms = Number(document.getElementById('ms-input').value) || 0;
  window.petDebug.emit('emote', { emote: name, say, ms, at: Date.now(), session_id: 'debug' });
  log('emote ' + name + (say ? ' "' + say + '"' : '') + (ms ? ' ' + ms + 'ms' : ''));
}

function buildButtons(containerId, names, handler) {
  const container = document.getElementById(containerId);
  for (const name of names) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = () => handler(name);
    container.appendChild(button);
  }
}

buildButtons('state-buttons', STATES, sendStatus);
buildButtons('emote-buttons', EMOTES, sendEmote);
document.getElementById('custom-emote').onclick = () => sendEmote(document.getElementById('emote-name').value.trim() || 'cheer');
document.getElementById('cycle-toggle').onclick = (e) => {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
    e.target.textContent = '自动轮播状态';
    return;
  }
  let index = 0;
  cycleTimer = setInterval(() => sendStatus(STATES[index++ % STATES.length]), CYCLE_MS);
  e.target.textContent = '停止轮播';
};

// Settings are the same top-level variables app.js reads; saveConfig stores and re-applies them
const toggles = [
  ['desk-toggle', () => petDeskScene, (on) => { petDeskScene = on; saveConfig('petDeskScene', on ? 'on' : 'off'); syncDeskScene(currentState); }],
  ['motion-toggle', () => petMotion, (on) => { petMotion = on; saveConfig('petMotion', on ? 'on' : 'off'); }],
  ['speech-toggle', () => petSpeech, (on) => { petSpeech = on; saveConfig('petSpeech', on ? 'on' : 'off'); }],
];
for (const [id, read, write] of toggles) {
  const box = document.getElementById(id);
  box.checked = read();
  box.onchange = () => write(box.checked);
}
const scaleInput = document.getElementById('scale-input');
scaleInput.value = petScale;
scaleInput.oninput = () => { petScale = Number(scaleInput.value); saveConfig('petScale', String(petScale)); };

function fillCharacters() {
  const select = document.getElementById('char-select');
  select.replaceChildren();
  const entries = [
    ...customPacks.map(p => [p.id, p.name + ' (custom)']),
    ...availableDlcs.map(d => [d.id, d.name + ' (dlc)']),
    ...Object.entries(ASCII_SPECIES).map(([id, species]) => [id, species.name + ' (ascii)']),
  ];
  for (const [id, label] of entries) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    option.selected = id === mode;
    select.appendChild(option);
  }
  select.onchange = () => selectChar(select.value);
}
// app.js discovers packs in its async init; fill once it has, then keep the list fresh on demand
setTimeout(fillCharacters, 800);
document.getElementById('char-refresh').onclick = fillCharacters;

setInterval(() => {
  infoEl.textContent = [
    'mode ' + mode,
    'state ' + currentState,
    'emote ' + (emoteActive ? emoteActive.name : '-'),
    'seated ' + sceneIsSeated(),
    'scenePos ' + scenePos,
    'ownsSprite ' + sceneOwnsSprite(),
  ].join('   ');
}, 200);
