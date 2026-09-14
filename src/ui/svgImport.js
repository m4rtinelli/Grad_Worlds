import { state, addObject, scheduleSave } from '../core/state.js';
import { defaultGeometry } from '../core/defaults.js';
import { emit } from '../core/bus.js';
import { toast } from './toast.js';

/** Open a file dialog for an SVG and resolve with `{ name, text }`, or null if cancelled. */
export function pickSvgFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/svg+xml,.svg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        if (!/<svg[\s>]/i.test(text)) throw new Error('not an svg');
        resolve({ name: file.name, text });
      } catch (err) {
        console.error(err);
        toast('Could not read that SVG');
        resolve(null);
      }
    };
    input.click();
  });
}

/** Put an SVG document into an existing object, converting it to the SVG type if needed. */
export function loadSvgInto(obj, { name, text }) {
  if (obj.type !== 'svg') {
    obj.type = 'svg';
    obj.geometry = defaultGeometry('svg');
  }
  obj.geometry.svg = text;
  obj.geometry.fileName = name;
  emit('scene:objects');
  emit('ui:layers');
  emit('ui:inspector');
  scheduleSave();
}

/** Add a new SVG object from a file dialog. Resolves with the object, or null if cancelled. */
export async function addSvgObject() {
  const file = await pickSvgFile();
  if (!file) return null;
  const obj = addObject('svg');
  obj.name = file.name.replace(/\.svg$/i, '') || `SVG ${state.scene.objects.length}`;
  loadSvgInto(obj, file);
  toast(`Extruded ${file.name}`);
  return obj;
}
