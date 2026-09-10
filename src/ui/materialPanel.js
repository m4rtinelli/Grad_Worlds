import { panel, slider, selectRow, colorRow, chips, button, buttonRow, hint, el, reciprocalOf } from './controls.js';
import { RAMP_PRESETS, BRAND_LIST } from '../core/palette.js';
import {
  listPresets, savePreset, deletePreset, getPreset, applyMaterial,
  exportPresets, importPresets, setDefaultMaterial
} from '../core/materialPresets.js';
import { downloadBlob } from '../core/exporter.js';
import { emit } from '../core/bus.js';
import { toast } from './toast.js';

const RAMP_NAMES = Object.keys(RAMP_PRESETS);

/**
 * Editor for one gradient-material parameter block.
 * `opts.lighting` hides the 3D light-response section for the 2D field.
 */
export function materialPanel(parent, m, onChange, opts = {}) {
  const { lighting = true, titlePrefix = '', spaceControl = true, presets = true } = opts;
  const changed = () => onChange?.();

  if (presets) buildPresetLibrary(parent, m, changed, titlePrefix);

  /* ---------------- ramp ---------------- */
  const ramp = panel(parent, `${titlePrefix}Gradient ramp`);

  chips(ramp, RAMP_NAMES, (n) => m.ramp === n, (n) => {
    m.ramp = n;
    m.colors = [...RAMP_PRESETS[n].colors];
    m.stops = [...RAMP_PRESETS[n].stops];
    changed();
    rebuildStops();
  });

  const stopHost = el('div', null, ramp);

  function rebuildStops() {
    stopHost.innerHTML = '';
    const labels = ['Light', 'Mid 1', 'Mid 2', 'Shadow'];
    for (let i = 0; i < 4; i++) {
      colorRow(
        stopHost, labels[i],
        () => m.colors[i],
        (v) => { m.colors[i] = v; m.ramp = 'Custom'; changed(); },
        BRAND_LIST
      );
      slider(stopHost, `↳ position`, m.stops, i, {
        min: 0, max: 1, step: 0.005,
        onChange: () => { changed(); }
      });
    }
  }
  rebuildStops();

  buttonRow(ramp).append(
    Object.assign(document.createElement('button'), {
      className: 'btn btn--sm', textContent: 'Reverse',
      onclick: () => {
        m.colors.reverse();
        m.stops = m.stops.map((s, i, a) => 1 - a[3 - i]).reverse();
        m.ramp = 'Custom';
        changed(); rebuildStops();
      }
    }),
    Object.assign(document.createElement('button'), {
      className: 'btn btn--sm', textContent: 'Even stops',
      onclick: () => {
        m.stops = [0, 1 / 3, 2 / 3, 1];
        changed(); rebuildStops();
      }
    })
  );

  /* ---------------- light response ---------------- */
  if (lighting) {
    const li = panel(parent, `${titlePrefix}Light response`);
    hint(li, 'Light does not shade a surface here — it slides each pixel along the ramp.');
    slider(li, 'Light gain', m, 'lightGain', { min: 0, max: 3, step: 0.01, onChange: changed });
    slider(li, 'Wrap', m, 'lightWrap', { min: 0, max: 2, step: 0.01, onChange: changed });
    slider(li, 'Ambient', m, 'ambient', { min: -0.5, max: 1.5, step: 0.01, onChange: changed });
    slider(li, 'Rim mix', m, 'fresnelMix', { min: -1, max: 1, step: 0.01, onChange: changed });
    slider(li, 'Rim power', m, 'fresnelPower', { min: 0.2, max: 8, step: 0.05, onChange: changed });
    slider(li, 'Specular', m, 'specular', { min: 0, max: 1.5, step: 0.01, onChange: changed });
    slider(li, 'Spec size', m, 'specPower', { min: 2, max: 200, step: 1, onChange: changed });
  }

  /* ---------------- noise ---------------- */
  const nz = panel(parent, `${titlePrefix}Noise`);
  // Size, not frequency: bigger number = bigger blobs. Stored as 1/noiseScale.
  // The curve gives the small sizes most of the track, where the useful range is.
  slider(nz, 'Size', reciprocalOf(m, 'noiseScale'), 'value',
    { min: 0.04, max: 8, step: 0.005, curve: 2.5, onChange: changed });
  slider(nz, 'Amount', m, 'noiseAmount', { min: 0, max: 1.5, step: 0.005, onChange: changed });
  slider(nz, 'Detail', m, 'octaves', { min: 1, max: 6, step: 1, onChange: changed });
  slider(nz, 'Warp', m, 'warpAmount', { min: 0, max: 3, step: 0.01, onChange: changed });
  slider(nz, 'Warp size', reciprocalOf(m, 'warpScale'), 'value',
    { min: 0.1, max: 8, step: 0.01, curve: 2, onChange: changed });
  slider(nz, 'Flow speed', m, 'flowSpeed', { min: -1, max: 1, step: 0.005, onChange: changed });
  if (spaceControl) {
    hint(nz, 'World keeps the pattern fixed in space; Local sticks it to the object so it scales and rotates with it.');
    selectRow(nz, 'Space', m, 'noiseSpace', [
      { id: 'world', label: 'World (stays put)' },
      { id: 'local', label: 'Local (sticks to object)' },
      { id: 'screen', label: 'Screen' }
    ], changed);
  }

  /* ---------------- shaping ---------------- */
  const sh = panel(parent, `${titlePrefix}Ramp shaping`);
  slider(sh, 'Offset', m, 'rampOffset', { min: -1, max: 1, step: 0.005, onChange: changed });
  slider(sh, 'Contrast', m, 'contrast', { min: 0.05, max: 4, step: 0.01, onChange: changed });
  slider(sh, 'Smear', m, 'smear', { min: -1.5, max: 1.5, step: 0.01, onChange: changed });
  slider(sh, 'Posterize', m, 'posterize', { min: 0, max: 24, step: 1, onChange: changed });
  slider(sh, 'Band dither', m, 'dither', { min: 0, max: 1.5, step: 0.01, onChange: changed });

  /* ---------------- finish ---------------- */
  const fin = panel(parent, `${titlePrefix}Finish`);
  slider(fin, 'Grain', m, 'grain', { min: 0, max: 0.3, step: 0.001, onChange: changed });
  slider(fin, 'Opacity', m, 'opacity', { min: 0, max: 1, step: 0.01, onChange: changed });
}


/* ------------------------------------------------------------------ */
/* saved material presets                                             */
/* ------------------------------------------------------------------ */

/**
 * Save the current look under a name, bring it back later, share it as a file.
 * Presets live in localStorage; export/import moves them between machines.
 */
function buildPresetLibrary(parent, m, changed, titlePrefix) {
  const host = panel(parent, `${titlePrefix}Material presets`);

  const listEl = el('div', 'chips', host);

  const renderList = () => {
    listEl.innerHTML = '';
    const saved = listPresets();

    if (!saved.length) {
      const e = el('span', 'hint', listEl);
      e.style.margin = '0';
      e.textContent = 'No saved presets yet.';
      return;
    }

    saved.forEach((p) => {
      const chip = el('button', 'chip chip--preset', listEl);
      chip.type = 'button';
      chip.title = `Apply "${p.name}"`;
      const label = el('span', null, chip);
      label.textContent = p.name;

      const x = el('span', 'chip__x', chip);
      x.textContent = '×';
      x.title = `Delete "${p.name}"`;
      x.onclick = (e) => {
        e.stopPropagation();
        deletePreset(p.name);
        renderList();
        toast(`Deleted "${p.name}"`);
      };

      chip.onclick = () => {
        const preset = getPreset(p.name);
        if (!preset) return;
        applyMaterial(m, preset.material);
        changed();
        // Rebuild so the colour rows and every slider show the loaded values.
        emit('ui:rebuild');
        toast(`Applied "${p.name}"`);
      };
    });
  };
  renderList();

  /* ---- inline naming row, shown by "Save current" ---- */
  const saveRow = el('div', 'save-row', host);
  saveRow.hidden = true;
  const nameInput = el('input', null, saveRow);
  nameInput.type = 'text';
  nameInput.placeholder = 'Preset name';
  nameInput.maxLength = 40;

  const confirmSave = () => {
    const name = savePreset(nameInput.value, m);
    if (!name) { nameInput.focus(); return; }
    saveRow.hidden = true;
    nameInput.value = '';
    renderList();
    toast(`Saved "${name}"`);
  };

  const ok = el('button', 'btn btn--sm btn--primary', saveRow);
  ok.type = 'button';
  ok.textContent = 'Save';
  ok.onclick = confirmSave;

  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') confirmSave();
    if (e.key === 'Escape') { saveRow.hidden = true; nameInput.value = ''; }
  };

  const row1 = buttonRow(host);
  button(row1, 'Save current…', () => {
    saveRow.hidden = false;
    nameInput.focus();
  }, 'btn btn--sm');
  button(row1, 'Set as default', () => {
    setDefaultMaterial(m)
      ? toast('New objects will use this look')
      : toast('Could not store the default');
  }, 'btn btn--sm');

  const row2 = buttonRow(host);
  button(row2, 'Export…', () => {
    const saved = listPresets();
    if (!saved.length) { toast('Nothing to export yet'); return; }
    downloadBlob(new Blob([exportPresets()], { type: 'application/json' }), 'zivo-material-presets.json');
    toast(`Exported ${saved.length} preset${saved.length === 1 ? '' : 's'}`);
  }, 'btn btn--sm');
  button(row2, 'Import…', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const added = importPresets(JSON.parse(await file.text()));
        renderList();
        toast(added ? `Imported ${added} preset${added === 1 ? '' : 's'}` : 'No presets in that file');
      } catch (err) {
        console.error(err);
        toast('Could not read that preset file');
      }
    };
    input.click();
  }, 'btn btn--sm');
}
