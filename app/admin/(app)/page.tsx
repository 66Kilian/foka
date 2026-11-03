import { AdminApp } from '@/components/admin/AdminApp';
import { getContent, getStatus } from '@/lib/server/content';

export const metadata = { title: 'Admin – rendelések és oldal', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const [c, s] = await Promise.all([getContent(), getStatus()]);
  return <AdminApp content={c} status={s} />;
}
