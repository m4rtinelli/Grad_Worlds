/**
 * Brand palette.
 * Sampled from the supplied brand strip: ink / warm gray / signal red / paper.
 */
export const BRAND = {
  ink:   '#1A1A1A',
  gray:  '#8E8B85',
  red:   '#F73A52',
  paper: '#FAF7F2'
};

export const BRAND_LIST = [BRAND.ink, BRAND.gray, BRAND.red, BRAND.paper];

/** Ramp presets: 4 colour stops + 4 positions, tuned to the reference imagery. */
export const RAMP_PRESETS = {
  'Molecule': {
    colors: [BRAND.paper, '#FFB6B6', BRAND.red, '#3A3A3A'],
    stops: [0.0, 0.34, 0.62, 1.0]
  },
  'Gel Blot': {
    colors: [BRAND.paper, BRAND.red, '#5E1721', BRAND.ink],
    stops: [0.0, 0.38, 0.74, 1.0]
  },
  'Metaball': {
    colors: ['#FFFFFF', BRAND.red, BRAND.ink, '#000000'],
    stops: [0.0, 0.3, 0.66, 1.0]
  },
  'Eclipse': {
    colors: [BRAND.paper, '#FF8D8D', BRAND.red, BRAND.ink],
    stops: [0.0, 0.28, 0.55, 0.88]
  },
  'Chrome': {
    colors: [BRAND.paper, BRAND.gray, '#4A4844', BRAND.ink],
    stops: [0.0, 0.4, 0.7, 1.0]
  },
  'Ember': {
    colors: [BRAND.ink, '#7D1424', BRAND.red, BRAND.paper],
    stops: [0.0, 0.3, 0.62, 1.0]
  }
};

/** #rrggbb -> [r,g,b] in 0..1 (sRGB, three converts to linear on Color.set) */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function normalizeHex(value, fallback = '#000000') {
  if (typeof value !== 'string') return fallback;
  let h = value.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : fallback;
}
