export { PortalChrome } from './PortalChrome';

export { PORTALS, resolvePortalFromPath, isWorkspacePath } from './shared/config';
export type { PortalId, PortalConfig } from './shared/config';

export {
  AuthCard,
  Field,
  inputClassName,
  primaryButtonClassName,
} from './shared/AuthCard';
export { AuthCredentialsForm } from './shared/AuthCredentialsForm';
export { PortalFooterLinks } from './shared/PortalFooterLinks';
export { PortalGate } from './shared/PortalGate';
export { PortalOptionCard } from './shared/PortalOptionCard';
export { Sidebar } from './shared/Sidebar';
export { WorkspaceShell } from './shared/WorkspaceShell';
export type { WorkspaceNavIcon, WorkspaceNavLink } from './shared/types';

export { PublicNavbar } from './public/PublicNavbar';
export { PublicHomePortal } from './public/PublicHomePortal';
export { LoginChooserPortal } from './public/LoginChooserPortal';

export { TenantLoginPortal, TenantRegisterPortal } from './tenant/TenantAuthPortal';
export { TenantUploadPortal } from './tenant/TenantUploadPortal';
export { TenantWorkspacePortal } from './tenant/TenantWorkspacePortal';

export { MemberLoginPortal } from './member/MemberAuthPortal';
export { MemberUploadPortal } from './member/MemberUploadPortal';
export { MemberWorkspacePortal } from './member/MemberWorkspacePortal';
