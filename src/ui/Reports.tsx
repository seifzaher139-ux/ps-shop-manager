import { useState } from 'react';
import { can, buildReport, totals } from '../core/logic';
import type { Report, Session } from '../core/model';
import { commands, currentUser, useStore } from '../services/store';
import { ar, dateTime, dayKey, money } from '../i18n/ar';
import { exportExcel, printReport, reportRows } from '../services/reports';
import { BackupButton } from './Backup';
import { AsyncButton, Empty, Field, Modal, useNow } from './shared';
export function Summary({ report }: { report: Report }) {
  return (
    <div className="report-totals">
      {(
        ['play', 'services', 'discounts', 'expenses', 'net', 'unpaid'] as const
      ).map((key) => (
        <div key={key}>
          <span>{ar[key]}</span>
          <strong>
            <bdi>{money(report.totals[key], report.settings)}</bdi>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function ReportView({ report }: { report: Report }) {
  const rows = reportRows(report);
  return (
    <article className="print-area report-paper">
      <header className="report-header">
        {report.settings.logo && <img src={report.settings.logo} alt="" />}
        <div>
          <h2>{report.settings.shopName}</h2>
          <h3>{report.title}</h3>
          <p>
            {report.period} · {report.settings.device}
          </p>
          <small>
            {ar.generated}:{' '}
            {dateTime(report.generatedAt, report.settings.timezone)}
          </small>
        </div>
      </header>
      <Summary report={report} />
      <p className="muted">{ar.totalsFinal}</p>
      {rows.slice(5).map((row, i) =>
        row.length === 0 ? (
          <div key={i} className="report-break" />
        ) : row.length === 1 ? (
          <h3 key={i} className="report-section">
            {row[0]}
          </h3>
        ) : (
          <div className={`report-row cols-${row.length}`} key={i}>
            {row.map((cell, j) => (
              <span key={j}>
                <bdi>
                  {typeof cell === 'number'
                    ? new Intl.NumberFormat('en-US', {
                        maximumFractionDigits: 2,
                      }).format(cell)
                    : cell}
                </bdi>
              </span>
            ))}
          </div>
        ),
      )}
    </article>
  );
}
export function Reports() {
  const { data } = useStore();
  const now = useNow();
  const user = currentUser();
  const closing = new URLSearchParams(window.location.hash.split('?')[1]).has(
    'closing',
  );
  const [reminder, setReminder] = useState(
    new URLSearchParams(window.location.hash.split('?')[1]).has('reminder'),
  );
  const [date, setDate] = useState(
    data.shifts.find((s) => !s.end)?.date ??
      dayKey(now, data.settings.timezone),
  );
  const [kind, setKind] = useState<'shift' | 'day'>(closing ? 'shift' : 'day');
  const [selected, setSelected] = useState('');
  const [receipt, setReceipt] = useState<Session>();
  const [voidSession, setVoidSession] = useState<Session>();
  const [reason, setReason] = useState('');
  const shifts = data.shifts.filter((s) => s.date === date);
  const shift =
    shifts.find((s) => s.id === selected) ??
    (closing ? shifts.at(-1) : shifts.find((s) => !s.end)) ??
    shifts.at(-1);
  const ids =
    kind === 'day' ? shifts.map((s) => s.id) : shift ? [shift.id] : [];
  const report =
    kind === 'shift' && shift?.frozen
      ? shift.frozen
      : buildReport(
          data,
          ids,
          now,
          kind === 'day' ? ar.dayReport : ar.shiftReport,
          date,
        );
  if (!can(user, 'viewReports')) return <p>{ar.noPermission}</p>;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{ar.history}</span>
          <h1>{ar.reports}</h1>
        </div>
      </div>
      <section className="panel report-controls no-print">
        <div className="segmented">
          <button
            className={kind === 'day' ? 'selected' : ''}
            onClick={() => setKind('day')}
          >
            {ar.dayReport}
          </button>
          <button
            className={kind === 'shift' ? 'selected' : ''}
            onClick={() => setKind('shift')}
          >
            {ar.shiftReport}
          </button>
        </div>
        <div className="form-grid">
          <Field label={ar.date}>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelected('');
              }}
            />
          </Field>
          {kind === 'shift' && (
            <Field label={ar.shift}>
              <select
                value={shift?.id ?? ''}
                onChange={(e) => setSelected(e.target.value)}
              >
                {shifts.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1} · {dateTime(s.start)} ·{' '}
                    {s.end ? ar.shiftClosed : ar.shiftOpen}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {can(user, 'exportReports') && (
          <div className="actions">
            <AsyncButton onClick={() => exportExcel(report)}>
              {ar.excel}
            </AsyncButton>
            <button
              onClick={() =>
                printReport(
                  `${data.settings.shopName}-${report.title}-${date}-${data.settings.device}`,
                )
              }
            >
              {ar.print}
            </button>
            <small>{ar.printHint}</small>
          </div>
        )}
      </section>
      {ids.length ? (
        <>
          <ReportView report={report} />
          <section className="panel no-print">
            <h2>{ar.sessions}</h2>
            {report.sessions.map((s) => (
              <div className="line" key={s.id}>
                <span>
                  <bdi>{s.roomName}</bdi> · {ar[s.status]}
                </span>
                <div className="actions">
                  <button onClick={() => setReceipt(s)}>{ar.receipt}</button>
                  {s.status === 'finished' &&
                    !data.shifts.find((x) => x.id === s.shiftId)?.end &&
                    can(user, 'voidSession') && (
                      <button
                        className="danger subtle"
                        onClick={() => setVoidSession(s)}
                      >
                        {ar.void}
                      </button>
                    )}
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <Empty />
      )}
      <section className="panel no-print">
        <h2>{ar.history}</h2>
        {[...new Set(data.shifts.map((s) => s.date))]
          .sort()
          .reverse()
          .map((day) => {
            const ids = data.shifts
              .filter((s) => s.date === day)
              .map((s) => s.id);
            const t = totals(
              data.sessions.filter((s) => ids.includes(s.shiftId)),
              data.expenses.filter((e) => ids.includes(e.shiftId)),
              now,
            );
            return (
              <button
                className="history-item"
                key={day}
                onClick={() => {
                  setDate(day);
                  setKind('day');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <bdi>{day}</bdi>
                <span>
                  {ar.play}: {money(t.play, data.settings)} · {ar.services}:{' '}
                  {money(t.services, data.settings)} · {ar.discounts}:{' '}
                  {money(t.discounts, data.settings)} · {ar.expenses}:{' '}
                  {money(t.expenses, data.settings)}
                </span>
                <strong>
                  {ar.net}: <bdi>{money(t.net, data.settings)}</bdi>
                </strong>
              </button>
            );
          })}
      </section>
      {reminder && (
        <Modal title={ar.backupReminder} onClose={() => setReminder(false)}>
          <p>{ar.backupHint}</p>
          <BackupButton />
          <button onClick={() => setReminder(false)}>{ar.dismiss}</button>
        </Modal>
      )}
      {receipt && (
        <Modal title={ar.receipt} onClose={() => setReceipt(undefined)}>
          <SessionReceipt session={receipt} />
        </Modal>
      )}
      {voidSession && (
        <Modal title={ar.void} onClose={() => setVoidSession(undefined)}>
          <p>{ar.voidConfirm}</p>
          <Field label={ar.reason}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <AsyncButton
            disabled={!reason.trim()}
            className="danger"
            onClick={async () => {
              await commands.void(voidSession.id, reason);
              setVoidSession(undefined);
            }}
          >
            {ar.confirm}
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}
export function SessionReceipt({ session }: { session: Session }) {
  const { data } = useStore();
  const b = session.bill;
  return (
    <>
      <article className="print-area receipt">
        <header className="report-header">
          {data.settings.logo && <img src={data.settings.logo} alt="" />}
          <div>
            <h2>{data.settings.shopName}</h2>
            <p>
              {ar.receipt} · {session.roomName} · {ar[session.mode]}
            </p>
            <small>{data.settings.device}</small>
          </div>
        </header>
        <p>
          {ar.startTime}: {dateTime(session.start, session.timezone)}
        </p>
        <p>
          {ar.endTime}:{' '}
          {session.end ? dateTime(session.end, session.timezone) : ar.running}
        </p>
        <p>
          {ar.billed}: {b?.billedMinutes ?? 0}
        </p>
        <div className="bill-lines">
          <div>
            <span>{ar.play}</span>
            <bdi>{money(b?.play ?? 0, data.settings)}</bdi>
          </div>
          {session.services.map((l) => (
            <div key={l.id}>
              <span>
                {l.name} × {l.quantity}
              </span>
              <bdi>{money(l.quantity * l.price, data.settings)}</bdi>
            </div>
          ))}
          {(['discount', 'total', 'paid', 'change', 'unpaid'] as const).map(
            (key) => (
              <div key={key}>
                <span>{ar[key]}</span>
                <bdi>{money(b?.[key] ?? 0, data.settings)}</bdi>
              </div>
            ),
          )}
        </div>
        {session.discount?.reason && (
          <p>
            {ar.reason}: {session.discount.reason}
          </p>
        )}
        <p>
          {ar.status}: {ar[session.status]}
        </p>
      </article>
      {can(currentUser(), 'exportReports') && (
        <>
          <button
            className="no-print"
            onClick={() =>
              printReport(
                `${data.settings.shopName}-${ar.receipt}-${dayKey(session.start)}-${data.settings.device}`,
              )
            }
          >
            {ar.print}
          </button>
          <small className="no-print">{ar.printHint}</small>
        </>
      )}
    </>
  );
}
