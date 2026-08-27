'use client';

export function TenantBrandMark({
  name,
  logoUrl,
  size = 'sm',
}: {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'lg';
}) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-8 w-8 rounded-lg';

  if (logoUrl) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden bg-blue-50 ${box}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-accent text-white ${box} ${
        size === 'lg' ? 'text-2xl' : ''
      }`}
    >
      ▷
    </span>
  );
}
