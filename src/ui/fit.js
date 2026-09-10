/**
 * Lays the fixed-size canvas frame inside the flexible stage area:
 * real pixel dimensions stay exact (so exports match), CSS transform scales it to fit.
 */
export function fitFrame(stageEl, frameEl, width, height, padding = 56) {
  const availW = Math.max(64, stageEl.clientWidth - padding * 2);
  const availH = Math.max(64, stageEl.clientHeight - padding * 2);
  const scale = Math.min(availW / width, availH / height, 1);

  frameEl.style.width = width + 'px';
  frameEl.style.height = height + 'px';
  // Centred with translate rather than by grid alignment: an item larger than its
  // container gets pinned to the start edge by grid/flex centring, which clipped it.
  frameEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  return scale;
}

export function observeResize(el, fn) {
  const ro = new ResizeObserver(() => fn());
  ro.observe(el);
  return () => ro.disconnect();
}
