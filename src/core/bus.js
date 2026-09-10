/** Tiny pub/sub. Topics are plain strings, e.g. 'scene:objects', 'ui:rebuild'. */
const handlers = new Map();

export function on(topic, fn) {
  if (!handlers.has(topic)) handlers.set(topic, new Set());
  handlers.get(topic).add(fn);
  return () => off(topic, fn);
}

export function off(topic, fn) {
  handlers.get(topic)?.delete(fn);
}

export function emit(topic, payload) {
  handlers.get(topic)?.forEach((fn) => fn(payload));
  // Wildcard listeners: 'scene:*' receives every 'scene:…' topic.
  const ns = topic.split(':')[0] + ':*';
  if (ns !== topic) handlers.get(ns)?.forEach((fn) => fn(payload, topic));
}
