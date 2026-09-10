const svg = (paths, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

export const ICONS = {
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  sphere: svg('<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3.4"/>'),
  roundedBox: svg('<rect x="3" y="7" width="18" height="10" rx="5"/>'),
  capsule: svg('<rect x="8" y="3" width="8" height="18" rx="4"/>'),
  torus: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  cylinder: svg('<ellipse cx="12" cy="6.5" rx="6" ry="2.6"/><path d="M6 6.5v11c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-11"/>'),
  metaballs: svg('<circle cx="8.5" cy="9" r="4.2"/><circle cx="15" cy="15" r="4.6"/>'),
  eye: svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.3 3.9M6.3 8.2A17 17 0 002 12s3.6 6.5 10 6.5a10 10 0 003.3-.5"/>'),
  trash: svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3.4" height="13" rx="1"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1"/></svg>',
  rewind: svg('<path d="M4 5v14M20 6l-11 6 11 6z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  download: svg('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>'),
  light: svg('<circle cx="12" cy="12" r="3.6"/><path d="M12 2v2.6M12 19.4V22M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M2 12h2.6M19.4 12H22M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9"/>'),
  wave: svg('<path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 5-6 5 0"/>'),
  reset: svg('<path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 005.6 6.6"/><path d="M3.5 3.5v4h4"/>')
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = ICONS[name] || '';
  const s = span.querySelector('svg');
  if (s) { s.style.width = '100%'; s.style.height = '100%'; s.style.display = 'block'; }
  return span;
}
