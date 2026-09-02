import { redirect } from 'next/navigation';

export default function LegacyTenantLoginPage() {
  redirect('/login');
}
