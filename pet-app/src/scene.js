// Desk scene for Ferris: entering the working group slides a desk in, sinks Ferris behind it as
// if sitting down and opens the laptop. Busy states only swap the icon on the screen.
// Other characters keep the plain pop-in.

const deskScene = document.getElementById('desk-scene');
const laptopLid = document.getElementById('laptop-lid');
// Waiting for approval and errors happen mid-turn, so the desk stays for them
const DESK_GROUPS = new Set(['working', 'waiting', 'error']);
const DESK_SCENE_MS = 1000;
// A short turn would otherwise slide the desk in and straight back out
const MIN_SEATED_MS = 2000;

let deskAnimations = null;
let deskShown = false;
let seatedAt = 0;
let deskLeaveTimer = null;

function deskSceneEnabled() {
  return petDeskScene && mode === 'ferris';
}

// All parts share one timeline, so reversing it halfway keeps them in step:
// the desk slides in over 0-40%, Ferris sinks over 30-60%, the lid opens over 60-100%.
function createDeskAnimations() {
  const timing = { duration: DESK_SCENE_MS, fill: 'both' };
  const animations = [
    deskScene.animate([
      { transform: 'translateX(60%)', opacity: 0, offset: 0, easing: 'ease-out' },
      { transform: 'translateX(0)', opacity: 1, offset: 0.4 },
      { transform: 'translateX(0)', opacity: 1, offset: 1 },
    ], timing),
    imgEl.animate([
      { transform: 'translateY(0)', offset: 0 },
      { transform: 'translateY(0)', offset: 0.3, easing: 'ease-in-out' },
      { transform: 'translateY(7%)', offset: 0.6 },
      { transform: 'translateY(7%)', offset: 1 },
    ], timing),
    laptopLid.animate([
      { transform: 'scaleY(0.08)', offset: 0 },
      { transform: 'scaleY(0.08)', offset: 0.6, easing: 'ease-out' },
      { transform: 'scaleY(1)', offset: 1 },
    ], timing),
  ];
  for (const animation of animations) animation.pause();
  return animations;
}

// rate 1 plays towards seated, -1 back towards standing, from wherever the timeline is now
function runDeskAnimations(rate) {
  deskAnimations ||= createDeskAnimations();
  const duration = document.body.classList.contains('no-motion') ? 1 : DESK_SCENE_MS;
  for (const animation of deskAnimations) {
    animation.effect.updateTiming({ duration });
    animation.playbackRate = rate;
    animation.play();
  }
}

function resetDeskScene() {
  clearTimeout(deskLeaveTimer);
  deskLeaveTimer = null;
  deskShown = false;
  if (!deskAnimations) return;
  for (const animation of deskAnimations) animation.cancel();
  deskAnimations = null;
}

/** Returns true when the desk scene handles the change, so the caller skips the pop-in. */
function playDeskScene(state) {
  deskScene.dataset.screen = state;
  if (!deskSceneEnabled()) {
    resetDeskScene();
    return false;
  }
  if (DESK_GROUPS.has(stateGroup(state))) {
    clearTimeout(deskLeaveTimer);
    deskLeaveTimer = null;
    if (!deskShown) {
      deskShown = true;
      seatedAt = Date.now();
      runDeskAnimations(1);
    }
    return true;
  }
  if (!deskShown) return false;
  if (!deskLeaveTimer) {
    deskLeaveTimer = setTimeout(() => {
      deskLeaveTimer = null;
      deskShown = false;
      runDeskAnimations(-1);
    }, Math.max(0, seatedAt + MIN_SEATED_MS - Date.now()));
  }
  return true;
}

/** Shows the scene for the current state again after the character or the setting changed. */
function syncDeskScene(state) {
  resetDeskScene();
  playDeskScene(state);
}
