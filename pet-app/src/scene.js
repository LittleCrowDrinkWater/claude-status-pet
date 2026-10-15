// Desk scene for character packs whose character.json has a "scene" block: entering a seated
// state slides the desk layer over the standing sprite, then plays the sit-down and open-laptop
// frames; leaving plays the same steps backwards. A state change midway turns the playback
// around at the current frame. Every frame change cross-fades, since a few drawn frames played
// as hard cuts look like a slideshow next to the smooth desk slide.

const fadeLayer = document.getElementById('fade-layer');
const deskHolder = document.getElementById('desk-holder');
const deskLayer = document.getElementById('desk-layer');
// A short turn would otherwise slide the desk in and straight back out
const MIN_SEATED_MS = 2000;
const CROSSFADE_MS = 110;
// The old frame drops fast at the start; an even fade leaves both poses visible longer as a ghost
const CROSSFADE_EASING = 'ease-out';
// The first sit-down frame takes over before the slide ends, so the two moves overlap
const DESK_OVERLAP = 0.8;
const CHARACTER_SCENES = {};

// 0 is standing with no desk, 1..sceneFrames.length shows that transition frame, one more is seated
let scenePos = 0;
let sceneFrames = [];
let sceneWantSeated = false;
let sceneTimer = null;
let sceneLeaveTimer = null;
let arriveTimer = null;
let seatedAt = 0;
let deskAnimation = null;
let deskFadeAnimation = null;
let frameFadeAnimation = null;

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

// Only the Settings toggle counts: a pack's "motion": "none" turns off the program wiggle, not its own scene
function sceneMs(ms) {
  return petMotion ? ms : 0;
}

/** True while the scene draws the character itself, so the caller must not swap the sprite. */
function sceneOwnsSprite() {
  const standingRest = scenePos === 0 && !deskAnimation;
  const seatedRest = scenePos === sceneSeatedPos() && sceneWantSeated && !sceneLeaveTimer;
  return !standingRest && !seatedRest;
}

/** True when both the old and the new sprite sit at the same desk. */
function sceneIsSeated() {
  return activeScene() !== null && scenePos === sceneSeatedPos() && sceneWantSeated;
}

/** Runs apply, which puts the new picture on the sprite, while the old picture fades out above it. */
function crossfadeSprite(apply) {
  if (frameFadeAnimation) frameFadeAnimation.cancel();
  fadeLayer.src = imgEl.src;
  apply();
  frameFadeAnimation = fadeLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sceneMs(CROSSFADE_MS), easing: CROSSFADE_EASING });
}

function showSceneFrame(index) {
  crossfadeSprite(() => {
    const src = assetCache[sceneFrames[index].src];
    imgEl.src = src;
    imgEl.style.opacity = '1';
    currentImgSrc = requestedImgSrc = src;
    spriteKey = '';
  });
}

function showRestSprite() {
  crossfadeSprite(() => {
    spriteKey = '';
    renderCharacter(currentState, true);
  });
}

function clearDesk() {
  clearTimeout(arriveTimer);
  arriveTimer = null;
  if (deskAnimation) deskAnimation.cancel();
  if (deskFadeAnimation) deskFadeAnimation.cancel();
  deskAnimation = deskFadeAnimation = null;
}

function createDeskAnimation() {
  const scene = activeScene();
  deskLayer.src = assetCache[scene.desk];
  deskAnimation = deskLayer.animate([
    { transform: 'translateX(60%)', opacity: 0 },
    { transform: 'translateX(0)', opacity: 1 },
  ], { duration: sceneMs(scene.desk_slide_ms || 400), fill: 'both', easing: 'ease-out' });
  deskAnimation.pause();
  deskAnimation.onfinish = () => {
    if (deskAnimation.playbackRate > 0) return;
    clearDesk();
    // The state may have moved to another standing one while the desk slid away
    spriteKey = '';
    renderCharacter(currentState, true);
  };
}

// The desk reached the sitting spot: cross-fade the standing sprite and the desk layer into the
// first sit-down frame, which has the same desk drawn in
function arriveAtDesk() {
  arriveTimer = null;
  scenePos = 1;
  showSceneFrame(0);
  deskFadeAnimation = deskHolder.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sceneMs(CROSSFADE_MS), fill: 'forwards' });
  deskFadeAnimation.onfinish = clearDesk;
  sceneTimer = setTimeout(runScene, sceneFrames[0].ms);
}

function slideDeskIn() {
  if (!deskAnimation) createDeskAnimation();
  const overlapAt = deskAnimation.effect.getTiming().duration * DESK_OVERLAP;
  if (deskAnimation.currentTime >= overlapAt) {
    arriveAtDesk();
    return;
  }
  deskAnimation.playbackRate = 1;
  deskAnimation.play();
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(arriveAtDesk, overlapAt - deskAnimation.currentTime);
}

function slideDeskOut() {
  clearTimeout(arriveTimer);
  arriveTimer = null;
  deskAnimation.playbackRate = -1;
  deskAnimation.play();
}

// Back at standing: the desk returns to full view, the seated frame cross-fades into the standing
// sprite under it, and the desk starts sliding away halfway through that fade
function leaveDesk() {
  clearDesk();
  createDeskAnimation();
  deskAnimation.currentTime = deskAnimation.effect.getTiming().duration;
  showRestSprite();
  sceneTimer = setTimeout(slideDeskOut, sceneMs(CROSSFADE_MS) / 2);
}

// Moves one step towards the wanted end and schedules the next step
function runScene() {
  clearTimeout(sceneTimer);
  sceneTimer = null;
  const seatedPos = sceneSeatedPos();
  if (scenePos === 0 && deskAnimation) {
    if (sceneWantSeated) slideDeskIn();
    else slideDeskOut();
    return;
  }
  if (sceneWantSeated) {
    if (scenePos === seatedPos) return;
    if (scenePos === 0) {
      slideDeskIn();
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
    leaveDesk();
    return;
  }
  // Turning around while the desk layer is still fading out after arriving
  clearDesk();
  showSceneFrame(scenePos - 1);
  sceneTimer = setTimeout(runScene, sceneFrames[scenePos - 1].ms);
}

function resetDeskScene() {
  clearTimeout(sceneTimer);
  clearTimeout(sceneLeaveTimer);
  sceneTimer = sceneLeaveTimer = null;
  clearDesk();
  if (frameFadeAnimation) frameFadeAnimation.cancel();
  frameFadeAnimation = null;
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
      const standing = scenePos === 0 && !deskAnimation;
      if (standing) sceneFrames = framesFor(scene, state);
      // Without the frames loaded there is nothing to play; jump straight to sitting
      if (standing && !sceneAssetPaths(scene).every(path => assetCache[path])) {
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

/** Cross-fades a sprite swap between two seated states, which share the same desk. */
function crossfadeSeatedSwap(state) {
  crossfadeSprite(() => renderCharacter(state, true));
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
  spriteKey = '';
  renderCharacter(state, true);
}
