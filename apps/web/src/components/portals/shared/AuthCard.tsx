import Link from 'next/link';

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  showHomeLink = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showHomeLink?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-glow sm:p-8">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
        <div className="mt-6 space-y-4">{children}</div>
        {footer ? <div className="mt-6 border-t border-blue-100 pt-4">{footer}</div> : null}
      </div>
      {showHomeLink ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-accent">
            ← Back to ST Stream
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-700">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClassName =
  'w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-slate-900 outline-none ring-accent/30 placeholder:text-slate-400 focus:border-accent focus:ring-2';

export const primaryButtonClassName =
  'w-full rounded-full bg-accent py-2.5 font-medium text-white transition hover:bg-accent-dim disabled:opacity-50';
