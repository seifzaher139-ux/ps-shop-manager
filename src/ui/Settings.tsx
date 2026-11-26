import { useState } from 'react';
import {
  permissions,
  type Settings as ShopSettings,
  type User,
} from '../core/model';
import { can, parseMoney } from '../core/logic';
import { ar, actionLabels, dateTime, permissionLabels } from '../i18n/ar';
import { commands, currentUser, useStore } from '../services/store';
import { resizeLogo } from '../services/images';
import { AsyncButton, Field, Modal, run } from './shared';
import { BackupButton, RestorePanel } from './Backup';
import { Recovery } from './Auth';
export function Settings() {
  const { data, ownerEmail } = useStore();
  const user = currentUser()!;
  const [draft, setDraft] = useState<ShopSettings>(
    structuredClone(data.settings),
  );
  const [categoryText, setCategoryText] = useState(draft.categories.join('، '));
  const [userEdit, setUserEdit] = useState<User>();
  const [password, setPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [account, setAccount] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const allowed = can(user, 'editSettings');
  const change = <K extends keyof ShopSettings>(
    key: K,
    value: ShopSettings[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{ar.localOnly}</span>
          <h1>{ar.settings}</h1>
        </div>
      </div>
      {allowed && (
        <>
          <section className="panel">
            <h2>{ar.shop}</h2>
            <div className="form-grid">
              <Field label={ar.shop}>
                <input
                  value={draft.shopName}
                  onChange={(e) => change('shopName', e.target.value)}
                />
              </Field>
              <Field label={ar.device}>
                <input
                  value={draft.device}
                  onChange={(e) => change('device', e.target.value)}
                />
              </Field>
              <Field label={ar.currency}>
                <input
                  value={draft.currency}
                  onChange={(e) => change('currency', e.target.value)}
                />
              </Field>
              <Field label={ar.timezone}>
                <input
                  dir="ltr"
                  value={draft.timezone}
                  onChange={(e) => change('timezone', e.target.value)}
                />
              </Field>
              <Field label={ar.logo}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void run(async () =>
                        change('logo', await resizeLogo(file)),
                      );
                  }}
                />
              </Field>
              {draft.logo && (
                <img className="logo-preview" src={draft.logo} alt={ar.logo} />
              )}
            </div>
          </section>
          <section className="panel">
            <h2>{ar.roomTypes}</h2>
            {draft.types.map((type, index) => (
              <fieldset key={type.id}>
                <legend>
                  <bdi>{type.name}</bdi>
                </legend>
                <div className="form-grid">
                  <Field label={ar.typeName}>
                    <input
                      value={type.name}
                      onChange={(e) =>
                        change(
                          'types',
                          draft.types.map((t, i) =>
                            i === index ? { ...t, name: e.target.value } : t,
                          ),
                        )
                      }
                    />
                  </Field>
                  {(['single', 'double'] as const).map((mode) => (
                    <Field
                      key={mode}
                      label={mode === 'single' ? ar.rateSingle : ar.rateDouble}
                    >
                      <MoneyInput
                        value={type[mode]}
                        onChange={(v) =>
                          change(
                            'types',
                            draft.types.map((t, i) =>
                              i === index ? { ...t, [mode]: v } : t,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                  <Field label={ar.roomCount}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={type.count}
                      onChange={(e) =>
                        change(
                          'types',
                          draft.types.map((t, i) =>
                            i === index
                              ? { ...t, count: Number(e.target.value) }
                              : t,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            <button
              onClick={() =>
                change('types', [
                  ...draft.types,
                  {
                    id: crypto.randomUUID(),
                    name: ar.newType,
                    single: 2500,
                    double: 5000,
                    count: 0,
                  },
                ])
              }
            >
              {ar.addType}
            </button>
          </section>
          <section className="panel">
            <h2>{ar.catalog}</h2>
            {draft.services.map((service, index) => (
              <fieldset key={service.id}>
                <div className="form-grid">
                  <Field label={ar.name}>
                    <input
                      value={service.name}
                      onChange={(e) =>
                        change(
                          'services',
                          draft.services.map((s, i) =>
                            i === index ? { ...s, name: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={ar.price}>
                    <MoneyInput
                      value={service.price}
                      onChange={(v) =>
                        change(
                          'services',
                          draft.services.map((s, i) =>
                            i === index ? { ...s, price: v } : s,
                          ),
                        )
                      }
                    />
                  </Field>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={service.active}
                      onChange={(e) =>
                        change(
                          'services',
                          draft.services.map((s, i) =>
                            i === index
                              ? { ...s, active: e.target.checked }
                              : s,
                          ),
                        )
                      }
                    />
                    {ar.active}
                  </label>
                </div>
              </fieldset>
            ))}
            <button
              onClick={() =>
                change('services', [
                  ...draft.services,
                  {
                    id: crypto.randomUUID(),
                    name: ar.service,
                    price: 1000,
                    active: true,
                  },
                ])
              }
            >
              {ar.addService}
            </button>
          </section>
          <section className="panel">
            <h2>{ar.roundTime}</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.roundTime}
                onChange={(e) => change('roundTime', e.target.checked)}
              />
              {ar.roundTime}
            </label>
            <p className="muted">{ar.thresholds}</p>
            <Field label={ar.roundPrice}>
              <select
                value={draft.priceRound}
                onChange={(e) =>
                  change(
                    'priceRound',
                    e.target.value as ShopSettings['priceRound'],
                  )
                }
              >
                {(['pound', 'half', 'none'] as const).map((v) => (
                  <option key={v} value={v}>
                    {ar[v]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={ar.idle}>
              <input
                type="number"
                min="0"
                max="1440"
                value={draft.idleMinutes}
                onChange={(e) => change('idleMinutes', Number(e.target.value))}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.indic}
                onChange={(e) => change('indic', e.target.checked)}
              />
              {ar.indic}
            </label>
            <Field label={ar.expenseCategories}>
              <input
                value={categoryText}
                onChange={(e) => setCategoryText(e.target.value)}
              />
              <small>{ar.categoriesHint}</small>
            </Field>
          </section>
          <div className="settings-save">
            <AsyncButton
              className="primary"
              onClick={async () => {
                await commands.settings({
                  ...draft,
                  categories: [
                    ...new Set(
                      categoryText
                        .split(/[,،]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    ),
                  ],
                });
                useStore.getState().notify(ar.saved);
              }}
            >
              {ar.save}
            </AsyncButton>
          </div>
        </>
      )}
      <section className="panel">
        <h2>{ar.backup}</h2>
        <p>{ar.cloudBackupHint}</p>

        <p>
          {navigator.onLine ? ar.online : ar.offline} ·{' '}
          {window.matchMedia('(display-mode: standalone)').matches
            ? ar.installed
            : ar.browser}
        </p>
        <p className="muted">{ar.installHint}</p>
        <div className="actions">
          {can(user, 'manageBackup') && <BackupButton />}
          {user.admin && <RestorePanel />}
        </div>
      </section>
      <section className="panel">
        <h2>{ar.account}</h2>
        <p>
          {user.username} · {user.admin ? ar.admin : ar.users}
        </p>
        {user.authProvider === 'firebase' && (
          <p>
            {ar.email}: <bdi>{ownerEmail}</bdi>
          </p>
        )}
        <div className="actions">
          <button onClick={() => setAccount(true)}>{ar.changePassword}</button>
          {user.admin && user.authProvider !== 'firebase' && (
            <button onClick={() => setRecovery(true)}>{ar.newRecovery}</button>
          )}
          <button onClick={() => useStore.getState().lock()}>
            {ar.switchUser}
          </button>
          <AsyncButton onClick={() => useStore.getState().logout()}>
            {ar.logout}
          </AsyncButton>
        </div>
        <p className="muted">{ar.cloudSecurityHint}</p>
      </section>
      {user.admin && (
        <>
          <section className="panel">
            <h2>{ar.users}</h2>
            {data.users.map((u) => (
              <div className="line" key={u.id}>
                <span>
                  {u.username} ·{' '}
                  {u.admin ? ar.admin : u.active ? ar.active : ar.cancelled}
                </span>
                <button onClick={() => setUserEdit(structuredClone(u))}>
                  {ar.edit}
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setUserEdit({
                  id: crypto.randomUUID(),
                  username: '',
                  admin: false,
                  active: true,
                  permissions: ['startSession', 'endSession'],
                  password: '',
                })
              }
            >
              {ar.addUser}
            </button>
          </section>
          <section className="panel">
            <h2>{ar.audit}</h2>
            <div className="audit-list">
              {[...data.audit].reverse().map((log) => (
                <div key={log.id}>
                  <bdi>{dateTime(log.at, data.settings.timezone)}</bdi>
                  <span>
                    {data.users.find((u) => u.id === log.userId)?.username} ·{' '}
                    {actionLabels[log.action] ?? log.action}
                  </span>
                  <small>
                    <bdi>{log.detail}</bdi>
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {userEdit && (
        <UserDialog user={userEdit} onClose={() => setUserEdit(undefined)} />
      )}
      {(account || recovery) && (
        <Modal
          title={account ? ar.changePassword : ar.newRecovery}
          onClose={() => {
            setAccount(false);
            setRecovery(false);
            setCurrent('');
            setPassword('');
          }}
        >
          <Field label={ar.currentPassword}>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          {account && (
            <Field label={ar.newPassword}>
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <AsyncButton
            className="primary"
            onClick={async () => {
              if (account) await commands.password(current, password);
              else setCode(await commands.recovery(current));
              setAccount(false);
              setRecovery(false);
              setCurrent('');
              setPassword('');
              useStore.getState().notify(ar.saved);
            }}
          >
            {ar.save}
          </AsyncButton>
        </Modal>
      )}
      {code && (
        <Modal title={ar.recovery} onClose={() => setCode('')}>
          <Recovery code={code} onDone={() => setCode('')} />
        </Modal>
      )}
    </>
  );
}
function MoneyInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value / 100));
  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(parseMoney(e.target.value));
        } catch {
          /* Keep incomplete input local. */
        }
      }}
      onBlur={() => setText(String(value / 100))}
    />
  );
}
function UserDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [draft, setDraft] = useState(user);
  const [password, setPassword] = useState('');
  return (
    <Modal title={ar.users} onClose={onClose}>
      <Field label={ar.username}>
        <input
          value={draft.username}
          onChange={(e) => setDraft({ ...draft, username: e.target.value })}
        />
      </Field>
      {draft.authProvider === 'firebase' ? (
        <p>{ar.cloudOwnerPassword}</p>
      ) : (
        <Field label={ar.newPassword}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>{ar.passwordHint}</small>
        </Field>
      )}
      {!draft.admin && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            {ar.active}
          </label>
          <div className="permission-grid">
            {permissions.map((p) => (
              <label className="check" key={p}>
                <input
                  type="checkbox"
                  checked={draft.permissions.includes(p)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      permissions: e.target.checked
                        ? [...draft.permissions, p]
                        : draft.permissions.filter((x) => x !== p),
                    })
                  }
                />
                {permissionLabels[p]}
              </label>
            ))}
          </div>
        </>
      )}
      <AsyncButton
        className="primary"
        onClick={async () => {
          await commands.user(draft, password || undefined);
          onClose();
        }}
      >
        {ar.save}
      </AsyncButton>
    </Modal>
  );
}
