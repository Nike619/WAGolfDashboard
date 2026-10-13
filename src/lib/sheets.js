// Bottom sheets on <dialog>: modal, Esc or a tap outside closes, Done closes, and on phones
// the grabber/header can be dragged down to dismiss. Wide screens show a centered card.
const PHONE = matchMedia('(max-width: 699px)');

// dlg: a <dialog class="sheet"> holding <div class="sheet-grab"> and <div class="sheet-content">.
// onClose runs after the sheet closes for any reason.
export function initSheet(dlg, onClose) {
  dlg.addEventListener('close', () => { dlg.classList.remove('closing'); dlg.style.transform = ''; onClose(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); dismiss(dlg); }); // Esc
  dlg.addEventListener('click', e => {
    if (e.target === dlg) dismiss(dlg); // the backdrop
    else if (e.target.closest('[data-dismiss]')) dismiss(dlg);
  });
  dragToDismiss(dlg);
}

// Show (or refresh) a sheet's content, keeping its scroll position across re-renders.
export function showSheet(dlg, html) {
  const box = dlg.querySelector('.sheet-content');
  if (box.dataset.html !== html) {
    const top = box.querySelector('.sheet-body')?.scrollTop || 0;
    box.innerHTML = html; box.dataset.html = html;
    const body = box.querySelector('.sheet-body'); if (body) body.scrollTop = top;
  }
  if (!dlg.open) { dlg.showModal(); dlg.querySelector('.sheet-body')?.scrollTo(0, 0); }
}

// Close without animation (state already cleared, e.g. on tab change).
export function hideSheet(dlg) { if (dlg.open) dlg.close(); }

// Close with the slide-down animation.
export function dismiss(dlg) {
  if (!dlg.open || dlg.classList.contains('closing')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { dlg.close(); return; }
  dlg.classList.add('closing');
  setTimeout(() => dlg.open && dlg.close(), 220);
}

function dragToDismiss(dlg) {
  let y0 = null, dy = 0, t0 = 0;
  dlg.addEventListener('pointerdown', e => {
    if (!PHONE.matches || !e.target.closest('.sheet-grab, .sheet-head') || e.target.closest('button, a')) return;
    y0 = e.clientY; dy = 0; t0 = performance.now(); dlg.style.transition = 'none';
    dlg.setPointerCapture(e.pointerId);
  });
  dlg.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    dlg.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    const fast = dy / Math.max(1, performance.now() - t0) > 0.6; // px per ms
    y0 = null; dlg.style.transition = '';
    if (dy > 110 || (fast && dy > 30)) dismiss(dlg); else dlg.style.transform = '';
  };
  dlg.addEventListener('pointerup', end);
  dlg.addEventListener('pointercancel', end);
}
