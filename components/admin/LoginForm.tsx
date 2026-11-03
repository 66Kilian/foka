'use client';
import { useState } from 'react';
import { api } from '@/lib/client';

export function LoginForm({ configured, devDefault }: { configured: boolean; devDefault: boolean }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="login__box" noValidate onSubmit={async (e) => {
      e.preventDefault();
      if (!pw) { setErr('Írd be a jelszót.'); return; }
      setBusy(true);
      setErr('');
      try {
        await api('/api/admin/login', { method: 'POST', json: { password: pw } });
        location.href = '/admin';
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : 'Hiba történt.');
        setBusy(false);
      }
    }}>
      <span className="login__mark" aria-hidden="true">Z</span>
      <h1>Admin</h1>
      <p className="login__lead">Rendelések, étlap, napi ajánlat és az oldal szerkesztése. 30 napig bejelentkezve maradsz ezen az eszközön.</p>
      {!configured && <p className="login__demo">Még nincs admin jelszó. Vercelen: Settings → Environment Variables → <b>ADMIN_PASSWORD</b>, majd Redeploy.</p>}
      {devDefault && <p className="login__demo">Helyi mód – a jelszó: „konyha”</p>}
      <label className="kf">
        <span>Jelszó</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err || undefined} aria-describedby="login-err" />
      </label>
      <p className="login__err" id="login-err" role="alert">{err}</p>
      <button className="kbtn kbtn--go kbtn--block" type="submit" disabled={busy || !configured}>{busy ? 'Belépés…' : 'Belépés'}</button>
    </form>
  );
}
