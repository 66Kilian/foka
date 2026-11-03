import { redirect } from 'next/navigation';
import { adminPassword, isAdmin } from '@/lib/server/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Belépés – Admin', robots: { index: false, follow: false } };

export default async function Login() {
  if (await isAdmin()) redirect('/admin');
  const configured = !!adminPassword();
  const devDefault = !process.env.ADMIN_PASSWORD && configured;
  return (
    <div className="adm">
      <main className="login">
        <LoginForm configured={configured} devDefault={devDefault} />
      </main>
    </div>
  );
}
