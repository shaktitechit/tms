import Link from 'next/link';

export function PortalFooterLinks({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <p className="text-sm text-slate-500">
      <Link href={primaryHref} className="text-accent hover:underline">
        {primaryLabel}
      </Link>
      {secondaryHref && secondaryLabel ? (
        <>
          <span className="mx-2 text-slate-300">·</span>
          <Link href={secondaryHref} className="text-slate-500 hover:text-accent">
            {secondaryLabel}
          </Link>
        </>
      ) : null}
    </p>
  );
}
