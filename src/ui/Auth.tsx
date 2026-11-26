import { useEffect, useState } from 'react';
import { ar } from '../i18n/ar';
import { commands, useStore } from '../services/store';
import { DexieRepository } from '../data/repository';
import { AsyncButton, Field, run } from './shared';
export function Recovery({
  code,
  onDone,
}: {
  code: string;
  onDone: () => void;
}) {
  return (
    <section className="auth-card">
      <h1>{ar.recovery}</h1>
      <p>{ar.recoveryHint}</p>
      <output className="recovery" dir="ltr">
        {code}
      </output>
      <AsyncButton
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          useStore.getState().notify(ar.savedRecovery);
        }}
      >
        {ar.copy}
      </AsyncButton>
      <button className="primary" onClick={onDone}>
        {ar.continue}
      </button>
    </section>
  );
}

export function Auth() {
  const {
    data,
    cloudUid,
    ownerEmail,
    cloudError,
    needsShop,
    login,
    setup,
    finishShop,
    unlock,
    logout,
    load,
  } = useStore();
  const [mode, setMode] = useState<'choose' | 'create' | 'existing' | 'reset'>(
    'choose',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shop, setShop] = useState('');
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [useLegacy, setUseLegacy] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [role, setRole] = useState('');
  useEffect(() => {
    void new DexieRepository()
      .load()
      .then((old) => setLegacy(old.users.length > 0))
      .catch(() => {});
  }, []);
  const roles = data.users.filter((u) => u.active);
  const selected =
    role ||
    roles.find((u) => u.authProvider === 'firebase')?.id ||
    roles[0]?.id ||
    '';
  const creating = mode === 'create' || needsShop;
  const migration =
    legacy && creating ? (
      <div className="notice">
        <p>{ar.legacyFound}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={useLegacy}
            onChange={(e) => setUseLegacy(e.target.checked)}
          />
          {ar.importLegacy}
        </label>
        {useLegacy && (
          <Field label={ar.legacyPassword}>
            <input
              required
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </Field>
        )}
        <small>{ar.legacyHint}</small>
      </div>
    ) : null;
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <img src="./icons/icon-192.png" alt="" />
        <h1>{ar.app}</h1>
        <p>{ar.tagline}</p>
        <small>{ar.cloudData}</small>
      </div>
      <section className="auth-card">
        {cloudError ? (
          <>
            <h2>{ar.cloudFailure}</h2>
            <p role="alert">{cloudError}</p>
            <AsyncButton className="primary wide" onClick={load}>
              {ar.cloudRetry}
            </AsyncButton>
            <AsyncButton className="wide" onClick={logout}>
              {ar.cloudSignOut}
            </AsyncButton>
          </>
        ) : cloudUid && !needsShop ? (
          <>
            <h2>{ar.unlock}</h2>
            <p>{ar.cloudRoleHint}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                await run(() => unlock(selected, password));
                setBusy(false);
              }}
            >
              <Field label={ar.username}>
                <select
                  value={selected}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roles.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={ar.password}>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button className="primary wide" disabled={busy}>
                {busy ? ar.loading : ar.unlock}
              </button>
            </form>
            <AsyncButton className="wide" onClick={logout}>
              {ar.cloudSignOut}
            </AsyncButton>
          </>
        ) : mode === 'choose' && !needsShop ? (
          <>
            <span className="eyebrow">{ar.welcome}</span>
            <h2>{ar.cloudStart}</h2>
            <p>{ar.cloudIntro}</p>
            <button className="primary wide" onClick={() => setMode('create')}>
              {ar.createShop}
            </button>
            <button className="wide" onClick={() => setMode('existing')}>
              {ar.useShop}
            </button>
          </>
        ) : (
          <>
            <h2>
              {needsShop
                ? ar.finishShop
                : mode === 'reset'
                  ? ar.resetEmail
                  : creating
                    ? ar.createShop
                    : ar.useShop}
            </h2>
            <p>{ar.cloudIntro}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                await run(async () => {
                  if (needsShop)
                    await finishShop(shop, useLegacy ? oldPassword : undefined);
                  else if (mode === 'create')
                    await setup(
                      email,
                      password,
                      shop,
                      useLegacy ? oldPassword : undefined,
                    );
                  else if (mode === 'reset') {
                    await commands.resetOwnerPassword(email);
                    useStore.getState().notify(ar.resetSent);
                    setMode('existing');
                  } else await login(email, password);
                });
                setBusy(false);
              }}
            >
              {needsShop ? (
                <p>
                  <bdi>{ownerEmail}</bdi>
                </p>
              ) : (
                <Field label={ar.email}>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
              {creating && (
                <Field label={ar.shop}>
                  <input
                    required
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                  />
                </Field>
              )}
              {!needsShop && mode !== 'reset' && (
                <Field label={ar.password}>
                  <input
                    required
                    type="password"
                    minLength={creating ? 8 : 1}
                    autoComplete={
                      creating ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
              {migration}
              <button className="primary wide" disabled={busy}>
                {busy
                  ? ar.loading
                  : needsShop
                    ? ar.finishShop
                    : mode === 'reset'
                      ? ar.resetEmail
                      : creating
                        ? ar.createShop
                        : ar.login}
              </button>
            </form>
            {!creating && mode !== 'reset' && (
              <button className="text-btn" onClick={() => setMode('reset')}>
                {ar.recover}
              </button>
            )}
            {needsShop ? (
              <AsyncButton className="wide" onClick={logout}>
                {ar.cloudSignOut}
              </AsyncButton>
            ) : (
              <button className="wide" onClick={() => setMode('choose')}>
                {ar.close}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
