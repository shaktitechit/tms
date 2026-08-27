import { AuthCard } from '@/components/portals/shared/AuthCard';
import { PortalOptionCard } from '@/components/portals/shared/PortalOptionCard';
import { PORTALS } from '@/components/portals/shared/config';

export function LoginChooserPortal() {
  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Choose how to sign in"
      description="Tenant admins and member users use separate portals."
      showHomeLink={false}
    >
      <div className="grid gap-3">
        <PortalOptionCard
          href={PORTALS.tenant.loginPath}
          title={PORTALS.tenant.label}
          description={PORTALS.tenant.description}
        />
        <PortalOptionCard
          href={PORTALS.member.loginPath}
          title={PORTALS.member.label}
          description={PORTALS.member.description}
        />
      </div>
    </AuthCard>
  );
}
