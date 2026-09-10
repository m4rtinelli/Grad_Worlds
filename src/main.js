import { state, loadLocal, saveLocal, serialize, hydrate, selectedObject, scheduleSave, removeObject } from './core/state.js';
import { on, emit } from './core/bus.js';
import { apps } from './core/appRegistry.js';
import { Viewport } from './three/Viewport.js';
import { FieldApp } from './field/FieldApp.js';
import { fitFrame, observeResize } from './ui/fit.js';
import { buildSceneLeft, buildSceneRight, renderLayers, applyScenePreset } from './ui/sceneUI.js';
import { buildFieldLeft, buildFieldRight } from './ui/fieldUI.js';
import { buildInspector } from './ui/inspector.js';
import { refreshTree, el } from './ui/controls.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { LightGizmo } from './ui/lightGizmo.js';
import { downloadBlob } from './core/exporter.js';

const stage = document.getElementById('stage');
const frame = document.getElementById('stage-frame');
const left = document.getElementById('sidebar-left');
const right = document.getElementById('sidebar-right');
const hud = document.getElementById('stage-hud');
const tabsEl = document.getElementById('tabs');
const titlebarRight = document.getElementById('titlebar-right');

/* ------------------------------------------------------------------ */
/* renderers                                                           */
/* ------------------------------------------------------------------ */

const viewport = new Viewport(state, frame);
const field = new FieldApp(state, frame);
apps.viewport = viewport;
apps.field = field;

const lightGizmo = new LightGizmo(state, stage, viewport);

/* ------------------------------------------------------------------ */
/* tabs                                                                */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'scene', label: '3D Scene' },
  { id: 'field', label: 'Gradient Field' }
];

function buildTabs() {
  tabsEl.innerHTML = '';
  TABS.forEach((t) => {
    const b = el('button', null, tabsEl);
    b.type = 'button';
    b.role = 'tab';
    b.textContent = t.label;
    b.setAttribute('aria-selected', String(state.tab === t.id));
    b.onclick = () => setTab(t.id);
  });
}

function setTab(id) {
  if (state.tab === id) return;
  state.tab = id;
  buildTabs();
  applyTabVisibility();
  rebuildSidebars();
  buildHud();
  layout();
  scheduleSave();
}

function applyTabVisibility() {
  const isField = state.tab === 'field';
  viewport.canvas.style.display = isField ? 'none' : 'block';
  field.canvas.style.display = isField ? 'block' : 'none';
  stage.dataset.mode = state.tab;
  frame.style.background = state.canvas.background;
}

/* ------------------------------------------------------------------ */
/* titlebar                                                            */
/* ------------------------------------------------------------------ */

function buildTitlebar() {
  titlebarRight.innerHTML = '';

  const save = el('button', 'btn btn--sm', titlebarRight);
  save.textContent = 'Save';
  save.title = 'Download this project as JSON';
  save.onclick = () => {
    downloadBlob(new Blob([serialize()], { type: 'application/json' }), `${state.exporter.prefix}-project.json`);
    saveLocal();
    toast('Project saved');
  };

  const open = el('button', 'btn btn--sm', titlebarRight);
  open.textContent = 'Open';
  open.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        hydrate(JSON.parse(await file.text()));
        toast('Project loaded');
      } catch (err) {
        console.error(err);
        toast('Could not read that file');
      }
    };
    input.click();
  };

  const reset = el('button', 'btn btn--sm btn--ghost', titlebarRight);
  reset.textContent = 'Reset';
  reset.onclick = () => {
    applyScenePreset('Eclipse');
    toast('Scene reset');
  };
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

let hudRefresh = () => {};
let fps = 0;

function buildHud() {
  hud.innerHTML = '';
  const pill = el('div', 'hud-pill', hud);

  const rew = el('button', 'btn btn--ghost btn--sm', pill);
  rew.appendChild(icon('rewind'));
  rew.firstElementChild.style.width = '14px';
  rew.firstElementChild.style.height = '14px';
  rew.title = 'Back to 0s';
  rew.onclick = () => {
    if (state.tab === 'field') field.time = 0; else viewport.setTime(0);
  };

  const play = el('button', 'btn btn--ghost btn--sm', pill);
  const setPlayIcon = () => {
    const playing = state.tab === 'field' ? state.field.playing : state.scene.playing;
    play.innerHTML = '';
    play.appendChild(icon(playing ? 'pause' : 'play'));
    play.firstElementChild.style.width = '14px';
    play.firstElementChild.style.height = '14px';
  };
  play.onclick = () => {
    if (state.tab === 'field') state.field.playing = !state.field.playing;
    else state.scene.playing = !state.scene.playing;
    setPlayIcon();
  };
  setPlayIcon();

  el('div', 'hud-sep', pill);
  const timeLabel = el('span', null, pill);
  el('div', 'hud-sep', pill);
  const info = el('span', null, pill);

  hudRefresh = () => {
    const t = state.tab === 'field' ? field.time : viewport.time;
    timeLabel.textContent = `${t.toFixed(2)}s`;
    info.textContent = `${state.canvas.width}×${state.canvas.height} · ${fps} fps`;
    setPlayIcon();
  };
  hudRefresh();
}

/* ------------------------------------------------------------------ */
/* sidebars                                                            */
/* ------------------------------------------------------------------ */

function rebuildSidebars() {
  if (state.tab === 'field') {
    buildFieldLeft(left);
    buildFieldRight(right);
  } else {
    buildSceneLeft(left);
    buildSceneRight(right);
  }
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

function layout() {
  fitFrame(stage, frame, state.canvas.width, state.canvas.height);
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

on('scene:objects', () => viewport.manager.syncObjects());
on('scene:material', () => viewport.manager.syncMaterials());
on('scene:selection', () => renderLayers(document.getElementById('layer-list')));

on('canvas:resize', () => {
  viewport.resize();
  field.resize();
  frame.style.background = state.canvas.background;
  layout();
});
on('canvas:background', () => { frame.style.background = state.canvas.background; });

on('ui:rebuild', () => {
  buildTabs();
  applyTabVisibility();
  rebuildSidebars();
  buildHud();
  layout();
});
on('ui:inspector', () => {
  const host = document.getElementById('inspector-host');
  if (host && state.tab === 'scene') buildInspector(host, selectedObject());
});
on('ui:layers', () => renderLayers(document.getElementById('layer-list')));
on('ui:camera', () => refreshTree(left));
/* Values changed by dragging in the viewport — repaint controls without rebuilding
   them, so nothing loses focus mid-interaction. */
on('ui:values', () => { refreshTree(left); refreshTree(right); });
on('ui:transport', () => hudRefresh());

/* ------------------------------------------------------------------ */
/* keyboard                                                            */
/* ------------------------------------------------------------------ */

window.addEventListener('keydown', (e) => {
  const typing = /input|textarea|select/i.test(e.target?.tagName || '');
  if (typing) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (state.tab === 'field') state.field.playing = !state.field.playing;
    else state.scene.playing = !state.scene.playing;
    hudRefresh();
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    setTab(state.tab === 'scene' ? 'field' : 'scene');
  }
  if ((e.key === 'Backspace' || e.key === 'Delete') && state.tab === 'scene') {
    const sel = selectedObject();
    if (sel) removeObject(sel.id);
  }
});

window.addEventListener('beforeunload', saveLocal);

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

/* Restore the last session, or start from a preset the first time.
   This runs after the bus listeners above are registered, so the events it
   emits (resize, rebuild) actually reach the renderers. */
if (!loadLocal()) applyScenePreset('Eclipse');

buildTitlebar();
buildTabs();
applyTabVisibility();
rebuildSidebars();
buildHud();
viewport.manager.syncObjects();
viewport.manager.syncMaterials();
viewport.resize();
field.resize();
layout();
observeResize(stage, layout);

if (import.meta.env?.DEV) {
  window.__zivo = { state, apps, applyScenePreset, emit };
}

let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;

function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc > 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }

  if (state.tab === 'field') field.step(dt);
  else viewport.step(dt);

  lightGizmo.update();

  hudRefresh();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
