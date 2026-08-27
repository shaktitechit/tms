import { TenantWorkspacePortal } from '@/components/portals';

export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  return <TenantWorkspacePortal>{children}</TenantWorkspacePortal>;
}
