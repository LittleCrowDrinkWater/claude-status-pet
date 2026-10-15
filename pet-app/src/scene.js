// Desk scene for character packs whose character.json has a "scene" block: entering a seated
// state slides the desk layer over the standing sprite, then plays the sit-down and open-laptop
// frames; leaving plays the same steps backwards. A state change midway turns the playback
// around at the current frame instead of waiting for it to finish.

const deskLayer = document.getElementById('desk-layer');
// A short turn would otherwise slide the desk in and straight back out
const MIN_SEATED_MS = 2000;
const CHARACTER_SCENES = {};

// 0 is standing with no desk, 1..sceneFrames.length shows that transition frame, one more is seated
let scenePos = 0;
let sceneFrames = [];
let sceneWantSeated = false;
let sceneTimer = null;
let sceneLeaveTimer = null;
let seatedAt = 0;
let deskAnimation = null;

function activeScene() {
  return petDeskScene ? CHARACTER_SCENES[mode] || null : null;
}

function sceneAssetPaths(scene) {
  return [scene.desk, ...scene.sit_down.frames, ...(scene.open_laptop?.frames || [])];
}

function loadSceneAssets(scene) {
  return Promise.all(sceneAssetPaths(scene).map(path => loadAsset(path)));
}

// Sleeping at the desk keeps the laptop closed, so offline skips the open-laptop frames
function framesFor(scene, state) {
  const steps = [];
  const add = (part) => part.frames.forEach((src, i) => steps.push({ src, ms: part.durations[i] }));
  add(scene.sit_down);
  if (scene.open_laptop && state !== 'offline') add(scene.open_laptop);
  return steps;
}

function sceneSeatedPos() {
  return sceneFrames.length + 1;
}

/** True while the scene draws the character itself, so the caller must not swap the sprite. */
function sceneOwnsSprite() {
  const standingRest = scenePos === 0 && !deskAnimation;
  const seatedRest = scenePos === sceneSeatedPos() && sceneWantSeated && !sceneLeaveTimer;
  return !standingRest && !seatedRest;
}

/** True when both the old and the new sprite sit at the same desk, so they swap without a fade. */
function sceneIsSeated() {
  return activeScene() !== null && scenePos === sceneSeatedPos() && sceneWantSeated;
}

function showSceneFrame(index) {
  const src = assetCache[sceneFrames[index].src];
  imgEl.src = src;
  imgEl.style.opacity = '1';
  currentImgSrc = requestedImgSrc = src;
  spriteKey = '';
}

function showRestSprite() {
  spriteKey = '';
  renderCharacter(currentState, true);
}

function slideDesk(direction) {
  if (deskAnimation) {
    deskAnimation.playbackRate = direction;
    return;
  }
  const scene = activeScene();
  deskLayer.src = assetCache[scene.desk];
  // Only the Settings toggle counts: a pack's "motion": "none" turns off the program wiggle, not its own scene
  const duration = petMotion ? scene.desk_slide_ms || 400 : 1;
  deskAnimation = deskLayer.animate([
    { transform: 'translateX(60%)', opacity: 0 },
    { transform: 'translateX(0)', opacity: 1 },
  ], { duration, fill: 'both', easing: 'ease-out' });
  if (direction < 0) {
    deskAnimation.currentTime = duration;
    deskAnimation.playbackRate = -1;
  }
  deskAnimation.onfinish = () => {
    const arrived = deskAnimation.playbackRate > 0;
    deskAnimation.cancel();
    deskAnimation = null;
    if (arrived) {
      scenePos = 1;
      showSceneFrame(0);
      sceneTimer = setTimeout(runScene, sceneFrames[0].ms);
    } else {
      scenePos = 0;
      showRestSprite();
    }
  };
}

// Moves one step towards the wanted end and schedules the next step
function runScene() {
  clearTimeout(sceneTimer);
  sceneTimer = null;
  const seatedPos = sceneSeatedPos();
  if (deskAnimation) {
    slideDesk(sceneWantSeated ? 1 : -1);
    return;
  }
  if (sceneWantSeated) {
    if (scenePos === seatedPos) return;
    if (scenePos === 0) {
      slideDesk(1);
      return;
    }
    scenePos++;
    if (scenePos === seatedPos) {
      showRestSprite();
      return;
    }
    showSceneFrame(scenePos - 1);
    sceneTimer = setTimeout(runScene, sceneFrames[scenePos - 1].ms);
    return;
  }
  if (scenePos === 0) return;
  scenePos--;
  if (scenePos === 0) {
    // The standing sprite goes back under the desk, then the desk slides away
    showRestSprite();
    slideDesk(-1);
    return;
  }
  showSceneFrame(scenePos - 1);
  sceneTimer = setTimeout(runScene, sceneFrames[scenePos - 1].ms);
}

function resetDeskScene() {
  clearTimeout(sceneTimer);
  clearTimeout(sceneLeaveTimer);
  sceneTimer = sceneLeaveTimer = null;
  if (deskAnimation) deskAnimation.cancel();
  deskAnimation = null;
  scenePos = 0;
  sceneWantSeated = false;
  sceneFrames = [];
}

/** Returns true when the desk scene handles the change, so the caller skips the pop-in. */
function playDeskScene(state) {
  const scene = activeScene();
  if (!scene) {
    resetDeskScene();
    return false;
  }
  if (scene.seated_states.includes(state)) {
    clearTimeout(sceneLeaveTimer);
    sceneLeaveTimer = null;
    if (!sceneWantSeated) {
      sceneWantSeated = true;
      seatedAt = Date.now();
      if (scenePos === 0 && !deskAnimation) sceneFrames = framesFor(scene, state);
      const ready = sceneAssetPaths(scene).every(path => assetCache[path]);
      // Without the frames loaded there is nothing to play; jump straight to sitting
      if (!ready && scenePos === 0 && !deskAnimation) {
        scenePos = sceneSeatedPos();
        loadSceneAssets(scene);
        return true;
      }
      runScene();
    }
    return true;
  }
  if (sceneWantSeated && !sceneLeaveTimer) {
    sceneLeaveTimer = setTimeout(() => {
      sceneLeaveTimer = null;
      sceneWantSeated = false;
      runScene();
    }, Math.max(0, seatedAt + MIN_SEATED_MS - Date.now()));
  }
  return sceneWantSeated || sceneOwnsSprite();
}

/** Shows the current state at rest, without a transition, after the character or the setting changed. */
function syncDeskScene(state) {
  resetDeskScene();
  const scene = activeScene();
  if (scene) {
    loadSceneAssets(scene);
    if (scene.seated_states.includes(state)) {
      sceneFrames = framesFor(scene, state);
      sceneWantSeated = true;
      scenePos = sceneSeatedPos();
    }
  }
  showRestSprite();
}
