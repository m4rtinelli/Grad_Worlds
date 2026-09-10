let timer = 0;

export function toast(message, ms = 2200) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  requestAnimationFrame(() => node.setAttribute('data-show', '1'));
  clearTimeout(timer);
  timer = setTimeout(() => {
    node.removeAttribute('data-show');
    setTimeout(() => { node.hidden = true; }, 260);
  }, ms);
}
