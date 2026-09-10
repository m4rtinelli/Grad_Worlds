import { state } from './state.js';

/** Filled in by main.js once the renderers exist. */
export const apps = {
  viewport: null,
  field: null
};

export function activeApp() {
  return state.tab === 'field' ? apps.field : apps.viewport;
}
