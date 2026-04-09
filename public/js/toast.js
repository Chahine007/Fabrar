/**
 * Toast Notification System
 * Sostituisce alert() nativi. Zero dipendenze esterne.
 * Uso: import { toast } from './toast.js';
 *      toast.success('Salvato!'); toast.error('Errore'); toast.info('...'); toast.warn('...');
 */

const MAX_TOASTS = 3;
const DURATION_MS = 4000;

const ICONS = {
  success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  error:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
  warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  info:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
};

const COLORS = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '#22c55e' },
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '#ef4444' },
  warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '#f59e0b' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: '#3b82f6' },
};

function ensureContainer() {
  let el = document.getElementById('__toast_container__');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast_container__';
    el.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column-reverse; gap: 10px;
      z-index: 99999; pointer-events: none;
    `;
    document.body.appendChild(el);
  }
  return el;
}

function show(message, type = 'info') {
  const container = ensureContainer();

  // Limita a MAX_TOASTS
  while (container.children.length >= MAX_TOASTS) {
    container.removeChild(container.firstChild);
  }

  const c = COLORS[type] || COLORS.info;
  const icon = ICONS[type] || ICONS.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    display: flex; align-items: flex-start; gap: 12px;
    background: ${c.bg}; border: 1px solid ${c.border}; border-left: 4px solid ${c.icon};
    color: ${c.text}; border-radius: 12px;
    padding: 14px 16px; max-width: 360px; min-width: 260px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    pointer-events: all; cursor: default;
    font-family: inherit; font-size: 14px; font-weight: 500; line-height: 1.4;
    opacity: 0; transform: translateX(40px);
    transition: opacity 0.25s ease, transform 0.25s ease;
  `;

  toast.innerHTML = `
    <span style="color:${c.icon}; flex-shrink:0; margin-top:1px;">${icon}</span>
    <span style="flex:1;">${message}</span>
    <button style="
      background:none; border:none; cursor:pointer; color:${c.text}; opacity:0.5;
      font-size:18px; line-height:1; padding:0; margin-left:4px; flex-shrink:0;
      transition:opacity 0.15s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.5'"
      onclick="this.closest('[data-toast]').remove()">×</button>
  `;
  toast.setAttribute('data-toast', type);

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
  });

  // Auto-dismiss
  const timer = setTimeout(() => dismiss(toast), DURATION_MS);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => setTimeout(() => dismiss(toast), 1500));
}

function dismiss(toast) {
  if (!toast.isConnected) return;
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(40px)';
  setTimeout(() => toast.remove(), 280);
}

export const toast = {
  success: (msg) => show(msg, 'success'),
  error:   (msg) => show(msg, 'error'),
  warn:    (msg) => show(msg, 'warning'),
  info:    (msg) => show(msg, 'info'),
};
