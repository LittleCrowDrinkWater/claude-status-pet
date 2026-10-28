// Stands in for window.__TAURI__ so app.js and scene.js run in a plain browser: assets come over
// HTTP from serve.mjs, status and emote events come from the control panel through petDebug.emit.
(() => {
  const listeners = {};
  const monitor = { workArea: { position: { x: 0, y: 0 }, size: { width: 4000, height: 4000 } }, scaleFactor: 1 };
  const resolved = (value) => Promise.resolve(value);
  const fakeWindow = {
    startDragging: () => { window.petDebug.log('startDragging (drag detected)'); return resolved(); },
    setAlwaysOnTop: () => resolved(),
    setSize: () => resolved(),
    setPosition: () => resolved(),
    onMoved: () => resolved(() => {}),
    currentMonitor: () => resolved(monitor),
    outerPosition: () => resolved({ x: 0, y: 0 }),
    outerSize: () => resolved({ width: 200, height: 240 }),
    close: () => window.petDebug.log('window.close() requested'),
  };
  class Size { constructor(width, height) { this.width = width; this.height = height; } }
  class Position { constructor(x, y) { this.x = x; this.y = y; } }
  let packs = null;

  async function loadPacks() {
    if (!packs) packs = await fetch('/api/packs').then(r => r.json());
    return packs;
  }

  async function invoke(command, args = {}) {
    switch (command) {
      case 'get_assets_dir': return '/pet';
      case 'list_available_dlcs':
        return (await loadPacks()).filter(p => p.group === 'dlc').map(p => ({ id: p.id, name: p.name, installed: true }));
      case 'list_character_packs':
        return (await loadPacks()).map(p => ({ ...p, type: 'png', installed: true, config_path: '' }));
      case 'load_text_asset': {
        const response = await fetch('/pet/' + args.path);
        return response.ok ? response.text() : null;
      }
      case 'load_asset': {
        const response = await fetch('/pet/' + args.path, { method: 'HEAD' });
        return response.ok ? '/pet/' + args.path : null;
      }
      case 'is_aggregate_mode': return false;
      case 'get_session_id': return 'debug';
      case 'get_status': return null;
      case 'set_character': window.petDebug.log('set_character ' + args.character); return null;
      default: window.petDebug.log('invoke ' + command + ' ignored'); return null;
    }
  }

  window.__TAURI__ = {
    core: { invoke },
    event: { listen: (name, callback) => { (listeners[name] ||= []).push(callback); return resolved(() => {}); } },
    window: {
      getCurrentWindow: () => fakeWindow,
      primaryMonitor: () => resolved(monitor),
      availableMonitors: () => resolved([monitor]),
      LogicalSize: Size,
    },
    dpi: { LogicalSize: Size, PhysicalPosition: Position },
    app: { getVersion: () => resolved('debug') },
  };
  window.petDebug = {
    emit: (name, payload) => (listeners[name] || []).forEach(callback => callback({ payload })),
    log: (text) => (window.petDebug.onLog || console.log)(text),
    onLog: null,
  };
  // The page has its own localStorage; start on the drawn character when it is installed
  if (!localStorage.getItem('petMode')) localStorage.setItem('petMode', 'claude-chan-flat');
})();
