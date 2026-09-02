const MEMBER_LAYERS = new Set(['learner', 'tutor']);

const LIST_LABELS: Record<string, string> = {
  departments: 'Departments list',
  users: 'Members',
  members: 'Members',
  videos: 'Library',
  audios: 'Library',
  'live-sessions': 'Live Sessions',
  modules: 'Modules',
  settings: 'Settings',
  upload: 'Upload',
};

export type WorkspaceBackTarget = {
  href: string;
  label: string;
};

function workspaceRoot(parts: string[]): string[] {
  if (MEMBER_LAYERS.has(parts[2] ?? '')) {
    return parts.slice(0, 3);
  }
  return parts.slice(0, 1);
}

function hrefOf(parts: string[]): string {
  return `/${parts.join('/')}`;
}

/**
 * Parent of generic workspace pages (lists and non-department details).
 * Department → module → lesson backs are rendered on those pages so the
 * label can be the parent name (department page lists modules, module page lists lessons).
 */
export function workspaceBack(pathname: string): WorkspaceBackTarget | null {
  const parts = pathname.split('/').filter(Boolean);
  const root = workspaceRoot(parts);
  if (parts.length <= root.length) {
    return null;
  }

  const rest = parts.slice(root.length);

  // List / settings / upload → dashboard
  if (rest.length === 1) {
    return { href: hrefOf(root), label: 'Dashboard' };
  }

  // Watch is a sibling of /videos; go back to that video's details page.
  if (rest[0] === 'watch' && rest.length === 2) {
    return { href: hrefOf([...root, 'videos', rest[1]!]), label: 'Video' };
  }

  // Department tree pages render their own named back link.
  if (rest[0] === 'departments' && rest.length >= 2) {
    return null;
  }

  // Collection details → that collection's list
  if (rest.length === 2 && rest[0] && LIST_LABELS[rest[0]]) {
    return { href: hrefOf([...root, rest[0]]), label: LIST_LABELS[rest[0]]! };
  }

  return null;
}
