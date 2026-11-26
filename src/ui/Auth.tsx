import { useState } from 'react';
import { ar } from '../i18n/ar';
import { commands, useStore } from '../services/store';
import { AsyncButton, Field, run } from './shared';
import { RestorePanel } from './Backup';
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
  const { data, login, setup } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [recover, setRecover] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const first = !data.users.length;
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <img src="./icons/icon-192.png" alt="" />
        <h1>{ar.app}</h1>
        <p>{ar.tagline}</p>
        <small>{ar.localOnly}</small>
      </div>
      {code ? (
        <Recovery
          code={code}
          onDone={() => {
            void run(() => login(username.trim(), password));
            setCode('');
          }}
        />
      ) : (
        <section className="auth-card">
          <span className="eyebrow">{first ? ar.welcome : ar.login}</span>
          <h2>{first ? ar.setup : recover ? ar.recoveryReset : ar.app}</h2>
          <p>
            {first ? ar.setupHint : recover ? ar.recoverHint : ar.localOnly}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await run(async () => {
                if (first) {
                  setCode(await setup(username.trim(), password));
                } else if (recover) {
                  await commands.recover(username, recovery, newPassword);
                  setRecover(false);
                  useStore.getState().notify(ar.saved);
                } else await login(username, password);
              });
              setBusy(false);
            }}
          >
            <Field label={ar.username}>
              <input
                required
                autoComplete="username"
                minLength={2}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            {recover ? (
              <>
                <Field label={ar.recovery}>
                  <input
                    required
                    dir="ltr"
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                  />
                </Field>
                <Field label={ar.newPassword}>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <Field label={ar.password}>
                <input
                  required
                  type="password"
                  autoComplete={first ? 'new-password' : 'current-password'}
                  minLength={first ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {first && <small>{ar.passwordHint}</small>}
            <button className="primary wide" disabled={busy}>
              {busy
                ? ar.loading
                : first
                  ? ar.setup
                  : recover
                    ? ar.confirm
                    : ar.login}
            </button>
          </form>
          {!first && (
            <button className="text-btn" onClick={() => setRecover(!recover)}>
              {recover ? ar.login : ar.recover}
            </button>
          )}
          {first && <RestorePanel />}
        </section>
      )}
    </main>
  );
}
