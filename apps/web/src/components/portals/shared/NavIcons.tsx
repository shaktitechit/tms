import type { WorkspaceNavIcon } from '@/components/portals/shared/types';

const iconClass = 'h-5 w-5 shrink-0 fill-current';

export function NavIcon({ name }: { name: WorkspaceNavIcon }) {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      );
    case 'library':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
        </svg>
      );
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
        </svg>
      );
    case 'departments':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      );
    case 'members':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
        </svg>
      );
    case 'modules':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
        </svg>
      );
    default:
      return null;
  }
}

export function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path d="M10 6l6 6-6 6-1.4-1.4L13.2 12 8.6 7.4 10 6z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path d="M14 6l1.4 1.4L10.8 12l4.6 4.6L14 18l-6-6 6-6z" />
    </svg>
  );
}
