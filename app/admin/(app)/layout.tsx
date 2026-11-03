import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function AdminGate({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/admin/login');
  return children;
}
