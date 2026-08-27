import Link from 'next/link';

export function PortalOptionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-4 transition hover:border-accent/40 hover:bg-blue-50"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}
