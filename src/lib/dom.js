// Small DOM helpers shared by every view.
export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Mark the button in a segmented control whose data-v matches.
export function setPressed(sel, isOn) { $$(sel).forEach(b => b.setAttribute('aria-pressed', String(isOn(b.dataset.v)))); }

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 4000);
}
