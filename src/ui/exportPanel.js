import { panel, slider, selectRow, toggleRow, colorRow, textRow, button, buttonRow, hint, el } from './controls.js';
import { CANVAS_PRESETS } from '../core/defaults.js';
import { BRAND_LIST } from '../core/palette.js';
import { state, scheduleSave } from '../core/state.js';
import { emit } from '../core/bus.js';
import { activeApp } from '../core/appRegistry.js';
import { exportStill, exportSequence, estimateSequenceBytes, formatBytes, startRecording, pickVideoFormat } from '../core/exporter.js';
import { toast } from './toast.js';

export function buildCanvasPanel(host) {
  const cv = panel(host, 'Canvas');
  const c = state.canvas;

  selectRow(cv, 'Size', c, 'preset', CANVAS_PRESETS, (id) => {
    const p = CANVAS_PRESETS.find((x) => x.id === id);
    if (p && id !== 'custom') { c.width = p.width; c.height = p.height; }
    emit('canvas:resize');
    emit('ui:rebuild');
    scheduleSave();
  });

  slider(cv, 'Width', c, 'width', {
    min: 200, max: 4096, step: 1,
    onChange: () => { c.preset = 'custom'; emit('canvas:resize'); scheduleSave(); }
  });
  slider(cv, 'Height', c, 'height', {
    min: 200, max: 4096, step: 1,
    onChange: () => { c.preset = 'custom'; emit('canvas:resize'); scheduleSave(); }
  });
  button(cv, 'Swap orientation', () => {
    const w = c.width; c.width = c.height; c.height = w;
    c.preset = 'custom';
    emit('canvas:resize');
    emit('ui:rebuild');
    scheduleSave();
  }, 'btn btn--wide btn--sm');

  colorRow(cv, 'Background', () => c.background, (v) => {
    c.background = v;
    emit('canvas:background');
    scheduleSave();
  }, ['#FFFFFF', ...BRAND_LIST, '#F6D9D4', '#EFEDE8']);

  if (state.tab === 'scene') {
    toggleRow(cv, 'Transparent', c, 'transparent', () => scheduleSave());
    slider(cv, 'Preview DPR', c, 'dpr', {
      min: 0.25, max: 2, step: 0.25,
      onChange: () => { emit('canvas:resize'); scheduleSave(); }
    });
  } else {
    slider(cv, 'Preview quality', state.field, 'quality', {
      min: 0.25, max: 1, step: 0.05,
      onChange: () => { emit('canvas:resize'); scheduleSave(); }
    });
    hint(cv, 'Preview quality only affects the live view — exports always render at full size.');
  }
}

export function buildExportPanel(host) {
  buildCanvasPanel(host);

  const ex = panel(host, 'Export');
  const e = state.exporter;

  textRow(ex, 'Name', e, 'prefix', () => scheduleSave());
  slider(ex, 'Supersample', e, 'scale', { min: 1, max: 3, step: 0.5, onChange: () => scheduleSave() });

  button(ex, 'Export PNG (current frame)', async () => {
    const app = activeApp();
    if (!app) return;
    await exportStill(app, { prefix: e.prefix, scale: e.scale, time: app.time });
    toast('PNG exported');
  }, 'btn btn--wide btn--primary');

  el('div', 'divider', ex);

  slider(ex, 'FPS', e, 'fps', { min: 6, max: 60, step: 1, onChange: () => { updateEstimate(); scheduleSave(); } });
  slider(ex, 'Duration', e, 'duration', { min: 0.5, max: 30, step: 0.5, unit: 's', onChange: () => { updateEstimate(); scheduleSave(); } });

  const est = el('p', 'hint', ex);
  const bar = el('div', 'progress', ex);
  const fill = el('div', 'progress__bar', bar);
  bar.style.display = 'none';

  const seqBtns = buttonRow(ex);
  const startBtn = button(seqBtns, 'Export PNG sequence', run, 'btn btn--primary');
  const cancelBtn = button(seqBtns, 'Cancel', () => { cancelled = true; }, 'btn');
  cancelBtn.style.display = 'none';

  let cancelled = false;
  let running = false;

  function updateEstimate() {
    const frames = Math.max(1, Math.round(e.fps * e.duration));
    const bytes = estimateSequenceBytes(e, state.canvas);
    est.textContent = `${frames} frames · ${state.canvas.width}×${state.canvas.height}${e.scale > 1 ? ` ×${e.scale}` : ''} · about ${formatBytes(bytes)} zipped`;
    est.style.color = bytes > 1.5 * 1024 ** 3 ? 'var(--accent)' : '';
  }
  updateEstimate();

  async function run() {
    if (running) return;
    const app = activeApp();
    if (!app) return;

    running = true;
    cancelled = false;
    startBtn.disabled = true;
    cancelBtn.style.display = '';
    bar.style.display = '';

    const wasPlaying = state.tab === 'field' ? state.field.playing : state.scene.playing;
    if (state.tab === 'field') state.field.playing = false; else state.scene.playing = false;
    emit('ui:transport');

    try {
      const res = await exportSequence(app, e, {
        onProgress: (p, i, total, label) => {
          fill.style.width = `${Math.round(p * 100)}%`;
          est.textContent = label ? `${label}…` : `Rendering frame ${i} / ${total}`;
        },
        shouldCancel: () => cancelled
      });
      toast(res.cancelled ? `Cancelled after ${res.frames} frames` : `${res.frames} frames exported`);
    } catch (err) {
      console.error(err);
      toast('Export failed — see console');
    } finally {
      running = false;
      startBtn.disabled = false;
      cancelBtn.style.display = 'none';
      bar.style.display = 'none';
      fill.style.width = '0%';
      if (state.tab === 'field') state.field.playing = wasPlaying; else state.scene.playing = wasPlaying;
      emit('ui:transport');
      updateEstimate();
    }
  }

  hint(ex, 'Frames are rendered at exact times, so the sequence matches the preview and is reproducible.');

  buildRecordPanel(host);
}

/** Real-time video capture of the live canvas (pointer interaction included). */
function buildRecordPanel(host) {
  const rc = panel(host, 'Record');
  const e = state.exporter;
  const format = pickVideoFormat();

  if (!format) {
    hint(rc, 'Video recording is not supported in this browser.');
    return;
  }

  const status = el('p', 'hint', rc);
  const btns = buttonRow(rc);
  const recBtn = button(btns, `Record ${format.ext.toUpperCase()}`, toggle, 'btn btn--primary');

  let rec = null;
  let timer = null;
  let savedQuality = null;

  const idle = () => {
    status.textContent = `Live capture · ${state.canvas.width}×${state.canvas.height} · ${e.fps} fps · ${format.ext.toUpperCase()}`;
  };
  idle();

  async function toggle() {
    if (rec) return stop();

    const app = activeApp();
    if (!app) return;

    // Field renders the live view at preview quality; record at full size.
    if (state.tab === 'field' && state.field.quality < 1) {
      savedQuality = state.field.quality;
      state.field.quality = 1;
      emit('canvas:resize');
    }

    try {
      rec = startRecording(app, { fps: e.fps, prefix: e.prefix });
    } catch (err) {
      console.error(err);
      toast('Recording failed — see console');
      restoreQuality();
      return;
    }

    recBtn.textContent = 'Stop';
    recBtn.classList.add('btn--recording');
    timer = setInterval(() => {
      status.textContent = `Recording… ${rec.elapsed().toFixed(1)}s`;
    }, 100);
  }

  async function stop() {
    clearInterval(timer);
    timer = null;
    recBtn.disabled = true;
    status.textContent = 'Encoding…';

    try {
      const res = await rec.stop();
      toast(`${res.ext.toUpperCase()} saved · ${res.seconds.toFixed(1)}s`);
    } catch (err) {
      console.error(err);
      toast('Recording failed — see console');
    } finally {
      rec = null;
      recBtn.disabled = false;
      recBtn.textContent = `Record ${format.ext.toUpperCase()}`;
      recBtn.classList.remove('btn--recording');
      restoreQuality();
      idle();
    }
  }

  function restoreQuality() {
    if (savedQuality == null) return;
    state.field.quality = savedQuality;
    savedQuality = null;
    emit('canvas:resize');
  }

  hint(rc, format.ext === 'mp4'
    ? 'Records the canvas as it plays, including pointer interaction. Encoded live as H.264 MP4.'
    : 'Records the canvas as it plays, including pointer interaction. This browser can only encode WebM — use Chrome, Edge or Safari for MP4.');
}
