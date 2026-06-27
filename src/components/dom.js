/**
 * Tiny DOM helper used across the component modules.
 *
 * `el(tag, props, children)` builds an HTMLElement. Text is always assigned via
 * textContent (never innerHTML), so user/API data can never inject markup.
 */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'attrs') {
      for (const [a, v] of Object.entries(value)) node.setAttribute(a, String(v));
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

/** A small pill badge. `kind` maps to a colour token in CSS. */
export function badge(text, kind = 'neutral') {
  return el('span', { class: `badge badge--${kind}`, text });
}
