import { useEffect, useState } from 'react';
import { can, buildReport } from '../core/logic';
import type { Session } from '../core/model';
import {
  buildReportDocument,
  dateRangeShiftIds,
  shiftName,
  type ReportDocument,
  type ReportField,
  type ReportKind,
} from '../core/reports';
import { commands, currentUser, useStore } from '../services/store';
import { ar, dateTime, dayKey, money, number } from '../i18n/ar';
import { exportExcel, printReport } from '../services/reports';
import { BackupButton } from './Backup';
import { AsyncButton, Empty, Field, Modal, useNow } from './shared';

function valueText(field: ReportField, doc: ReportDocument): string {
  return field.format === 'money'
    ? money(Number(field.value), doc.settings)
    : field.format === 'number'
      ? number(Number(field.value), doc.settings.indic)
      : String(field.value);
}
export function ReportView({
  document: doc,
  onReceipt,
  onVoid,
}: {
  document: ReportDocument;
  onReceipt?: (id: string) => void;
  onVoid?: (id: string) => void;
}) {
  return (
    <article className="print-area report-paper simple-report">
      <header className="report-header">
        <img src={doc.settings.logo || './icons/icon-192.png'} alt="" />
        <div>
          <h2>{doc.settings.shopName}</h2>
          <h3>{doc.title}</h3>
          <p>
            {doc.period} · {doc.settings.device}
          </p>
          <small>
            {ar.generated}: {dateTime(doc.generatedAt, doc.settings.timezone)}
          </small>
        </div>
      </header>
      {doc.notes.map((note, index) => (
        <p className="report-note" key={index}>
          {note}
        </p>
      ))}
      {doc.blocks.length ? (
        doc.blocks.map((block, index) => {
          if (block.type === 'metrics')
            return (
              <dl className="report-totals" key={index}>
                {block.fields.map((f) => (
                  <div key={f.label} data-metric={f.label}>
                    <dt>{f.label}</dt>
                    <dd>
                      <bdi>{valueText(f, doc)}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            );
          if (block.type === 'table')
            return (
              <div className="report-table-scroll" key={index}>
                <table className="shift-list-table">
                  <caption>
                    {ar.currency}: {doc.settings.currency}
                  </caption>
                  <thead>
                    <tr>
                      {block.columns.map((c) => (
                        <th key={c.label} scope="col">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((value, j) => (
                          <td key={j}>
                            <bdi>
                              {block.columns[j].format === 'money'
                                ? number(
                                    Number(value) / 100,
                                    doc.settings.indic,
                                  )
                                : valueText(
                                    {
                                      label: '',
                                      value,
                                      format: block.columns[j].format,
                                    },
                                    doc,
                                  )}
                            </bdi>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          return (
            <section
              className="session-report-card"
              key={block.id}
              data-session={block.id}
            >
              <h3>
                <bdi>{block.title}</bdi>
              </h3>
              <dl>
                {block.fields.map((f) => (
                  <div
                    key={f.label}
                    className={f.label === ar.total ? 'session-total' : ''}
                  >
                    <dt>{f.label}</dt>
                    <dd>
                      <bdi>{valueText(f, doc)}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
              {block.status === 'finished' && (onReceipt || onVoid) && (
                <div className="actions no-print">
                  {onReceipt && (
                    <button onClick={() => onReceipt(block.id)}>
                      {ar.receipt}
                    </button>
                  )}
                  {onVoid && (
                    <button
                      className="danger subtle"
                      onClick={() => onVoid(block.id)}
                    >
                      {ar.void}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })
      ) : (
        <Empty />
      )}
      {doc.footer.length > 0 && (
        <footer className="report-signature">
          {doc.footer.map((f) => (
            <p key={f.label}>
              {f.label}: <bdi>{valueText(f, doc)}</bdi>
            </p>
          ))}
        </footer>
      )}
    </article>
  );
}
export function Reports() {
  const { data } = useStore();
  const now = useNow();
  const user = currentUser();
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const openShift = data.shifts.find((s) => !s.end);
  const initialShift =
    data.shifts.find((s) => s.id === params.get('shift')) ??
    (params.has('closing') ? data.shifts.at(-1) : openShift) ??
    data.shifts.at(-1);
  const today = dayKey(now, data.settings.timezone);
  const [kind, setKind] = useState<ReportKind>(
    params.has('closing') || params.has('shift') ? 'shift' : 'totals',
  );
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [day, setDay] = useState(today);
  const [detailDay, setDetailDay] = useState(initialShift?.date ?? today);
  const [selected, setSelected] = useState(initialShift?.id ?? '');
  const [reminder, setReminder] = useState(params.has('reminder'));
  const [receipt, setReceipt] = useState<Session>();
  const [voidSession, setVoidSession] = useState<Session>();
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (window.location.hash.includes('&reminder=1'))
      history.replaceState(
        null,
        '',
        window.location.hash.replace('&reminder=1', ''),
      );
  }, []);
  const choices = data.shifts.filter((s) => s.date === detailDay);
  const shift =
    choices.find((s) => s.id === selected) ??
    choices.find((s) => !s.end) ??
    choices.at(-1);
  const rangeValid = !!from && !!to && from <= to;
  const ids =
    kind === 'totals'
      ? rangeValid
        ? dateRangeShiftIds(data.shifts, from, to)
        : []
      : kind === 'shifts'
        ? data.shifts.filter((s) => s.date === day).map((s) => s.id)
        : shift
          ? [shift.id]
          : [];
  const period =
    kind === 'totals' ? `${from} — ${to}` : kind === 'shifts' ? day : detailDay;
  const report =
    kind === 'shift' && shift?.frozen
      ? shift.frozen
      : buildReport(data, ids, now, '', period);
  const doc = buildReportDocument(report, kind, data.shifts);
  const exportable =
    (kind !== 'totals' || rangeValid) && (kind !== 'shift' || !!shift);
  if (!can(user, 'viewReports')) return <p>{ar.noPermission}</p>;
  return (
    <>
      <div className="page-heading">
        <h1>{ar.reports}</h1>
      </div>
      <section className="panel report-controls no-print">
        <div
          className="segmented report-tabs"
          role="tablist"
          aria-label={ar.reports}
        >
          {(
            [
              ['totals', ar.totalsReport],
              ['shifts', ar.shiftsReport],
              ['shift', ar.closingReport],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={kind === id}
              aria-controls="report-panel"
              className={kind === id ? 'selected' : ''}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          {kind === 'totals' ? (
            <>
              <Field label={ar.fromDate}>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={ar.toDate}>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </>
          ) : kind === 'shifts' ? (
            <Field label={ar.date}>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </Field>
          ) : (
            <>
              <Field label={ar.date}>
                <input
                  type="date"
                  value={detailDay}
                  onChange={(e) => {
                    setDetailDay(e.target.value);
                    setSelected('');
                  }}
                />
              </Field>
              <Field label={ar.shift}>
                <select
                  value={shift?.id ?? ''}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {choices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {shiftName(s, data.shifts)} ·{' '}
                      {s.end ? ar.shiftClosed : ar.shiftOpen}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
        {kind === 'shift' && openShift && openShift.id !== shift?.id && (
          <button
            className="wide"
            onClick={() => {
              setDetailDay(openShift.date);
              setSelected(openShift.id);
            }}
          >
            {ar.currentShift}
          </button>
        )}
        {kind === 'totals' && !rangeValid && (
          <p role="alert" className="notice">
            {ar.invalidDateRange}
          </p>
        )}
        {can(user, 'exportReports') && (
          <div className="actions">
            <AsyncButton
              disabled={!exportable}
              onClick={() => exportExcel(doc)}
            >
              {ar.excel}
            </AsyncButton>
            <button
              disabled={!exportable}
              onClick={() =>
                printReport(
                  `${doc.settings.shopName}-${doc.title}-${doc.period}-${doc.settings.device}`,
                )
              }
            >
              {ar.print}
            </button>
            <small>{ar.printHint}</small>
          </div>
        )}
      </section>
      <div id="report-panel" role="tabpanel" aria-labelledby={`tab-${kind}`}>
        {exportable ? (
          <ReportView
            document={doc}
            onReceipt={
              kind === 'shift'
                ? (id) => setReceipt(report.sessions.find((s) => s.id === id))
                : undefined
            }
            onVoid={
              kind === 'shift' && !shift?.end && can(user, 'voidSession')
                ? (id) => {
                    setVoidSession(report.sessions.find((s) => s.id === id));
                    setReason('');
                  }
                : undefined
            }
          />
        ) : kind === 'shift' ? (
          <Empty />
        ) : null}
      </div>

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
          <img src={data.settings.logo || './icons/icon-192.png'} alt="" />
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
