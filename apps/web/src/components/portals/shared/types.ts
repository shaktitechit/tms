export type WorkspaceNavIcon =
  | 'dashboard'
  | 'library'
  | 'upload'
  | 'departments'
  | 'members'
  | 'settings'
  | 'modules';

export type WorkspaceNavLink = {
  href: string;
  label: string;
  icon: WorkspaceNavIcon;
};
