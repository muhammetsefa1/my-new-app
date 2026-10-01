/** Wrap every word of an element in a mask so it can rise into place. Keeps <br> and inline elements. */
export function splitWords(el: HTMLElement) {
  const inners: HTMLElement[] = [];
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (!text.trim()) continue;
        const frag = document.createDocumentFragment();
        const parts = text.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const w = document.createElement('span');
          w.className = 'w';
          const wi = document.createElement('span');
          wi.className = 'wi';
          wi.textContent = part;
          w.appendChild(wi);
          frag.appendChild(w);
          inners.push(wi);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const elc = child as HTMLElement;
        if (elc.tagName === 'BR') continue;
        if (elc.hasAttribute('data-scatter')) {
          // keep scatter words whole: mask the whole word, chars handled elsewhere
          const w = document.createElement('span');
          w.className = 'w';
          const wi = document.createElement('span');
          wi.className = 'wi';
          elc.replaceWith(w);
          wi.appendChild(elc);
          w.appendChild(wi);
          inners.push(wi);
          continue;
        }
        walk(elc);
      }
    }
  };
  walk(el);
  return inners;
}

export function splitChars(el: HTMLElement) {
  const text = el.textContent || '';
  el.textContent = '';
  return Array.from(text).map((ch) => {
    const s = document.createElement('span');
    s.className = 'c';
    s.textContent = ch;
    el.appendChild(s);
    return s;
  });
}

/** Split into plain word spans (no mask) for reading highlights. */
export function splitReading(el: HTMLElement) {
  const out: HTMLElement[] = [];
  const children = Array.from(el.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      (child.textContent || '').split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        const s = document.createElement('span');
        s.className = 'rw';
        s.textContent = part;
        frag.appendChild(s);
        out.push(s);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      (child as HTMLElement).classList.add('rw');
      out.push(child as HTMLElement);
    }
  }
  return out;
}
