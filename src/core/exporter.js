import JSZip from 'jszip';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas capture failed'))), 'image/png');
  });
}

const stamp = () => new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
const pad = (n, w = 4) => String(n).padStart(w, '0');

/** One PNG of the current frame. */
export async function exportStill(app, { prefix = 'zivo', scale = 1, time = null } = {}) {
  app.beginExport(scale);
  try {
    app.renderExportFrame(time ?? app.time);
    const blob = await canvasToBlob(app.canvas);
    downloadBlob(blob, `${prefix}_${stamp()}.png`);
  } finally {
    app.endExport();
  }
}

/**
 * PNG sequence, zipped. Frames are rendered at exact times (frame / fps) so the
 * result is deterministic and matches the preview.
 */
export async function exportSequence(app, opts, hooks = {}) {
  const { fps = 30, duration = 4, prefix = 'zivo', scale = 1 } = opts;
  const total = Math.max(1, Math.round(fps * duration));
  const { onProgress = () => {}, shouldCancel = () => false } = hooks;

  const zip = new JSZip();
  const folder = zip.folder(`${prefix}_${stamp()}`);

  app.beginExport(scale);
  try {
    for (let i = 0; i < total; i++) {
      if (shouldCancel()) return { cancelled: true, frames: i };
      const t = i / fps;
      app.renderExportFrame(t);
      const blob = await canvasToBlob(app.canvas);
      folder.file(`${prefix}_${pad(i)}.png`, blob);
      onProgress((i + 1) / total, i + 1, total);
      // Yield so the UI (and the progress bar) stays alive between frames.
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    app.endExport();
  }

  onProgress(1, total, total, 'zipping');
  const zipped = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) => {
    onProgress(1, total, total, `zipping ${Math.round(meta.percent)}%`);
  });
  downloadBlob(zipped, `${prefix}_${stamp()}_${total}f.zip`);
  return { cancelled: false, frames: total };
}

/** Rough uncompressed size estimate, for the warning in the export panel. */
export function estimateSequenceBytes({ fps, duration, scale }, { width, height }) {
  const frames = Math.max(1, Math.round(fps * duration));
  // PNG of smooth gradients compresses hard; ~0.55 bytes/px is a fair guess.
  return frames * width * height * scale * scale * 0.55;
}

export function formatBytes(n) {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
