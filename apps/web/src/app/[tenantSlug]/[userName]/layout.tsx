import { MemberWorkspacePortal } from '@/components/portals';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <MemberWorkspacePortal>{children}</MemberWorkspacePortal>;
}
