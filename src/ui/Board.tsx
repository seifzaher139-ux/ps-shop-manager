import { useState } from 'react';
import { can, calculate, totals, parseMoney } from '../core/logic';
import type { Room, Session, Discount } from '../core/model';
import { clock } from '../services/platform';
import { commands, currentUser, useStore } from '../services/store';
import { ar, dayKey, duration, money } from '../i18n/ar';
import {
  AsyncButton,
  Field,
  Modal,
  toLocalInput,
  useNow,
  Gamepad,
} from './shared';
import { SessionReceipt } from './Reports';
export function Board() {
  const { data } = useStore();
  const now = useNow();
  const user = currentUser();
  const shift = data.shifts.find((s) => !s.end);
  const [selected, setSelected] = useState<Room>();
  const [open, setOpen] = useState(false);
  const [close, setClose] = useState(false);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<Session>();
  const running = data.sessions.filter((s) => s.status === 'running');
  const todayShifts = data.shifts
    .filter((s) => s.date === dayKey(now, data.settings.timezone))
    .map((s) => s.id);
  const daily = totals(
    data.sessions.filter((s) => todayShifts.includes(s.shiftId)),
    data.expenses.filter((e) => todayShifts.includes(e.shiftId)),
    now,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{ar.today}</span>
          <h1>{ar.home}</h1>
          <p>{ar.tagline}</p>
        </div>
        <div className="actions">
          {can(user, 'openCloseShift') &&
            (shift ? (
              <button onClick={() => setClose(true)}>{ar.closeShift}</button>
            ) : (
              <button className="primary" onClick={() => setOpen(true)}>
                {ar.openShift}
              </button>
            ))}
        </div>
      </div>
      <section className="stats">
        <div>
          <span>{ar.runningRooms}</span>
          <strong>
            {running.length}
            <small> / {data.rooms.filter((r) => r.active).length}</small>
          </strong>
        </div>
        <div>
          <span>{ar.availableRooms}</span>
          <strong>
            {data.rooms.filter((r) => r.active).length - running.length}
          </strong>
        </div>
        <div>
          <span>{ar.net}</span>
          <strong className="accent">
            <bdi>{money(daily.net, data.settings)}</bdi>
          </strong>
        </div>
      </section>
      <div className={`shift-strip ${shift ? '' : 'muted'}`}>
        <span className="status-dot" />
        {shift ? ar.shiftOpen : ar.noShift}
        {shift && (
          <small>
            <bdi>{duration(now - shift.start)}</bdi>
          </small>
        )}
      </div>
      <section className="room-grid">
        {data.rooms
          .filter((r) => r.active)
          .map((room) => {
            const session = running.find((s) => s.roomId === room.id);
            const bill =
              session && calculate(session, Math.max(now, session.start), 0);
            return (
              <button
                key={room.id}
                className={`room-card ${session ? 'occupied' : 'available'}`}
                onClick={() => setSelected(room)}
              >
                <div className="room-top">
                  <span className="room-type">
                    {
                      data.settings.types.find((t) => t.id === room.typeId)
                        ?.name
                    }
                  </span>
                  <span className="badge">{session ? ar.busy : ar.free}</span>
                </div>
                <span className="controller">
                  <Gamepad />
                </span>
                <h2>
                  <bdi>{room.name}</bdi>
                </h2>
                {session ? (
                  <>
                    <span className="timer" dir="ltr">
                      {duration(now - session.start)}
                    </span>
                    <div className="room-footer">
                      <span>{ar[session.mode]}</span>
                      <strong>
                        <bdi>{money(bill!.total, data.settings)}</bdi>
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="room-idle">{ar.start}</span>
                    <div className="room-footer">
                      <span>{ar.single}</span>
                      <bdi>
                        {money(
                          data.settings.types.find((t) => t.id === room.typeId)
                            ?.single ?? 0,
                          data.settings,
                        )}
                      </bdi>
                    </div>
                  </>
                )}
              </button>
            );
          })}
      </section>
      {selected && (
        <SessionDialog
          room={selected}
          onClose={() => setSelected(undefined)}
          onReceipt={(s) => {
            setSelected(undefined);
            setReceipt(s);
          }}
        />
      )}
      {receipt && (
        <Modal title={ar.receipt} onClose={() => setReceipt(undefined)}>
          <SessionReceipt session={receipt} />
        </Modal>
      )}
      {open && (
        <Modal title={ar.openShift} onClose={() => setOpen(false)}>
          <Field label={ar.shiftNote}>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <AsyncButton
            className="primary"
            onClick={async () => {
              await commands.open(note);
              setOpen(false);
            }}
          >
            {ar.openShift}
          </AsyncButton>
        </Modal>
      )}
      {close && (
        <Modal title={ar.closeShift} onClose={() => setClose(false)}>
          {running.length ? (
            <>
              <p className="notice">{ar.closeBlocked}</p>
              {running.map((s) => (
                <button
                  className="wide"
                  key={s.id}
                  onClick={() => {
                    setClose(false);
                    setSelected(data.rooms.find((r) => r.id === s.roomId));
                  }}
                >
                  {s.roomName} · {ar.end} / {ar.cancel}
                </button>
              ))}
            </>
          ) : (
            <>
              <p>{ar.confirmClose}</p>
              <AsyncButton
                className="primary"
                onClick={async () => {
                  await commands.close();
                  setClose(false);
                  const state = useStore.getState().data;
                  if (
                    state.settings.lastReminder !==
                    dayKey(now, state.settings.timezone)
                  ) {
                    await commands.reminder();
                  }
                  window.location.hash = `/reports?closing=1${state.settings.lastReminder !== dayKey(now, state.settings.timezone) ? '&reminder=1' : ''}`;
                }}
              >
                {ar.closeShift}
              </AsyncButton>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function SessionDialog({
  room,
  onClose,
  onReceipt,
}: {
  room: Room;
  onClose: () => void;
  onReceipt: (s: Session) => void;
}) {
  const { data } = useStore();
  const user = currentUser();
  const now = useNow();
  const session = data.sessions.find(
    (s) => s.roomId === room.id && s.status === 'running',
  );
  const shift = data.shifts.find((s) => !s.end);
  const [mode, setMode] = useState<Session['mode']>('single');
  const [initialStart] = useState(toLocalInput(now));
  const [start, setStart] = useState(initialStart);
  const [note, setNote] = useState('');
  const [service, setService] = useState(
    data.settings.services.find((s) => s.active)?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [checkout, setCheckout] = useState(false);
  const [end, setEnd] = useState(now);
  const [discountKind, setDiscountKind] = useState('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [reason, setReason] = useState('');
  const [paid, setPaid] = useState('');
  const [accept, setAccept] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  let discount: Discount | undefined;
  try {
    if (discountKind !== 'none')
      discount = {
        kind: discountKind as Discount['kind'],
        value: parseMoney(discountValue),
        reason,
      };
  } catch {
    /* Invalid input is blocked before saving. */
  }
  const bill = session
    ? calculate(
        session,
        Math.max(checkout ? end : now, session.start),
        undefined,
        discount,
      )
    : undefined;
  let paidMoney = bill?.total ?? 0;
  try {
    if (paid !== '') paidMoney = parseMoney(paid);
  } catch {
    paidMoney = 0;
  }
  return (
    <Modal title={room.name} onClose={onClose}>
      {!session ? (
        <>
          <div className="segmented">
            <button
              className={mode === 'single' ? 'selected' : ''}
              onClick={() => setMode('single')}
            >
              {ar.single}
            </button>
            <button
              className={mode === 'double' ? 'selected' : ''}
              onClick={() => setMode('double')}
            >
              {ar.double}
            </button>
          </div>
          <Field label={ar.startTime}>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={ar.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {!shift && <p className="notice">{ar.noShift}</p>}
          <AsyncButton
            disabled={!shift || !can(user, 'startSession')}
            className="primary wide"
            onClick={async () => {
              await commands.start(
                room.id,
                mode,
                start === initialStart
                  ? clock.now()
                  : new Date(start).getTime(),
                note,
              );
              onClose();
            }}
          >
            {ar.start}
          </AsyncButton>
        </>
      ) : (
        <>
          <div className="session-hero">
            <span>{ar[session.mode]}</span>
            <strong dir="ltr">
              {duration((checkout ? end : now) - session.start)}
            </strong>
            <bdi>{money(bill!.total, data.settings)}</bdi>
          </div>
          {!checkout ? (
            <>
              <h3>{ar.services}</h3>
              {session.services.map((l) => (
                <div className="line" key={l.id}>
                  <span>
                    {l.name} × {l.quantity}
                  </span>
                  <bdi>{money(l.price * l.quantity, data.settings)}</bdi>
                  {can(user, 'startSession') && (
                    <div className="actions">
                      <AsyncButton
                        onClick={() =>
                          commands.service(session.id, l.id, l.quantity + 1)
                        }
                      >
                        +
                      </AsyncButton>
                      <AsyncButton
                        onClick={() =>
                          commands.service(session.id, l.id, l.quantity - 1)
                        }
                      >
                        −
                      </AsyncButton>
                    </div>
                  )}
                </div>
              ))}
              {can(user, 'startSession') && (
                <div className="service-form">
                  <Field label={ar.service}>
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                    >
                      {data.settings.services
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {money(s.price, data.settings)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={ar.quantity}>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </Field>
                  <AsyncButton
                    disabled={!service}
                    onClick={() =>
                      commands.service(
                        session.id,
                        service,
                        (session.services.find((l) => l.id === service)
                          ?.quantity ?? 0) + quantity,
                      )
                    }
                  >
                    {ar.addService}
                  </AsyncButton>
                </div>
              )}
              {session.note && <p>{session.note}</p>}
              {can(user, 'endSession') && (
                <button
                  className="primary wide"
                  onClick={() => {
                    setCheckout(true);
                    setEnd(now);
                  }}
                >
                  {ar.end}
                </button>
              )}
              <div className="actions">
                {can(user, 'editSessionTime') && (
                  <button
                    onClick={() => {
                      setStart(toLocalInput(session.start));
                      setEditing(true);
                    }}
                  >
                    {ar.editTime}
                  </button>
                )}
                {can(user, 'cancelSession') && (
                  <button
                    className="danger subtle"
                    onClick={() => setCancelling(true)}
                  >
                    {ar.cancel}
                  </button>
                )}
              </div>
              {editing && (
                <div className="inset">
                  <Field label={ar.startTime}>
                    <input
                      type="datetime-local"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </Field>
                  <AsyncButton
                    onClick={async () => {
                      await commands.time(
                        session.id,
                        new Date(start).getTime(),
                      );
                      setEditing(false);
                    }}
                  >
                    {ar.save}
                  </AsyncButton>
                </div>
              )}
              {cancelling && (
                <div className="inset">
                  <p>{ar.cancelConfirm}</p>
                  <Field label={ar.reason}>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <AsyncButton
                    className="danger"
                    onClick={async () => {
                      await commands.cancel(session.id, reason);
                      onClose();
                    }}
                  >
                    {ar.confirm}
                  </AsyncButton>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bill-lines">
                <div>
                  <span>{ar.billed}</span>
                  <bdi>{bill!.billedMinutes}</bdi>
                </div>
                <div>
                  <span>{ar.play}</span>
                  <bdi>{money(bill!.play, data.settings)}</bdi>
                </div>
                <div>
                  <span>{ar.services}</span>
                  <bdi>{money(bill!.services, data.settings)}</bdi>
                </div>
              </div>
              {can(user, 'applyDiscount') && (
                <>
                  <Field label={ar.discount}>
                    <select
                      value={discountKind}
                      onChange={(e) => setDiscountKind(e.target.value)}
                    >
                      <option value="none">{ar.noDiscount}</option>
                      <option value="fixed">{ar.fixed}</option>
                      <option value="percent">{ar.percent}</option>
                    </select>
                  </Field>
                  {discountKind !== 'none' && (
                    <>
                      <Field label={ar.amount}>
                        <input
                          inputMode="decimal"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </Field>
                      <Field label={ar.reason}>
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
              <div className="bill-total">
                <span>{ar.total}</span>
                <strong>
                  <bdi>{money(bill!.total, data.settings)}</bdi>
                </strong>
              </div>
              <Field label={ar.paid}>
                <input
                  inputMode="decimal"
                  value={paid}
                  placeholder={String(bill!.total / 100)}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </Field>
              <p>
                {paidMoney >= bill!.total ? ar.change : ar.unpaid}:{' '}
                <bdi>
                  {money(Math.abs(paidMoney - bill!.total), data.settings)}
                </bdi>
              </p>
              {paidMoney < bill!.total && (
                <label className="check notice">
                  <input
                    type="checkbox"
                    checked={accept}
                    onChange={(e) => setAccept(e.target.checked)}
                  />
                  <span>
                    {ar.warningUnpaid}
                    <br />
                    {ar.acceptUnpaid}
                  </span>
                </label>
              )}
              <AsyncButton
                className="primary wide"
                disabled={paidMoney < bill!.total && !accept}
                onClick={async () => {
                  if (discountKind !== 'none') parseMoney(discountValue);
                  if (paid !== '') parseMoney(paid);
                  await commands.end(
                    session.id,
                    paidMoney,
                    discount,
                    accept,
                    end,
                  );
                  onReceipt(
                    useStore
                      .getState()
                      .data.sessions.find((s) => s.id === session.id)!,
                  );
                }}
              >
                {ar.confirm}
              </AsyncButton>
              <button className="wide" onClick={() => setCheckout(false)}>
                {ar.close}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
