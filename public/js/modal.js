/**
 * Modal Helper — modulo riusabile per mostrare modali in-page.
 * Uso: import { showModal, closeModal } from './modal.js';
 *
 * showModal({
 *   title: 'Modifica Profilo',
 *   body: '<form>...</form>',
 *   onMount: (el) => { // attach events },
 *   onClose: () => {},
 * });
 */

let activeOverlay = null;

export function showModal({ title = '', body = '', onMount = null, onClose = null, wide = false }) {
  closeModal(); // chiude eventuale modale aperto

  const overlay = document.createElement('div');
  overlay.id = '__modal_overlay__';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:50000;display:flex;align-items:center;justify-content:center;
    background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);
    opacity:0;transition:opacity 0.2s ease;
  `;

  const maxW = wide ? 'max-width:640px' : 'max-width:480px';
  overlay.innerHTML = `
    <div class="__modal_card__" style="
      background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);
      width:90%;${maxW};max-height:85vh;display:flex;flex-direction:column;
      transform:scale(0.95);transition:transform 0.2s ease;overflow:hidden;
    ">
      <div style="
        display:flex;align-items:center;justify-content:space-between;
        padding:18px 24px;border-bottom:1px solid #f1f5f9;background:#f8fafc;flex-shrink:0;
      ">
        <h3 style="font-size:17px;font-weight:800;color:#0f172a;margin:0;">${title}</h3>
        <button id="__modal_close__" style="
          background:none;border:none;cursor:pointer;color:#94a3b8;font-size:24px;line-height:1;
          padding:0;transition:color .15s;
        " onmouseenter="this.style.color='#475569'" onmouseleave="this.style.color='#94a3b8'">×</button>
      </div>
      <div id="__modal_body__" style="padding:24px;overflow-y:auto;flex:1;">${body}</div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Animate in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('.__modal_card__').style.transform = 'scale(1)';
  });

  // Close handlers
  const close = () => {
    closeModal();
    if (onClose) onClose();
  };
  overlay.querySelector('#__modal_close__').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Escape key
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  if (onMount) onMount(overlay.querySelector('#__modal_body__'));
}

export function closeModal() {
  if (!activeOverlay) return;
  activeOverlay.style.opacity = '0';
  const card = activeOverlay.querySelector('.__modal_card__');
  if (card) card.style.transform = 'scale(0.95)';
  const ref = activeOverlay;
  setTimeout(() => ref.remove(), 220);
  activeOverlay = null;
}
