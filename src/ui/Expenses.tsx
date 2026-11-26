import { useState } from 'react';
import type { Expense } from '../core/model';
import { can, parseMoney } from '../core/logic';
import { ar, money } from '../i18n/ar';
import { commands, currentUser, useStore } from '../services/store';
import { AsyncButton, Empty, Field, Modal } from './shared';
export function Expenses() {
  const { data } = useStore();
  const shift = data.shifts.find((s) => !s.end);
  const [edit, setEdit] = useState<Partial<Expense>>();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(data.settings.categories[0]);
  const [remove, setRemove] = useState<Expense>();
  const allowed = can(currentUser(), 'manageExpenses');
  const expenses = data.expenses.filter(
    (e) => e.shiftId === shift?.id && !e.voided,
  );
  function open(e: Partial<Expense>) {
    setEdit(e);
    setDescription(e.description ?? '');
    setAmount(e.amount ? String(e.amount / 100) : '');
    setCategory(e.category ?? data.settings.categories[0]);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{ar.shiftOpen}</span>
          <h1>{ar.expenses}</h1>
        </div>
        {allowed && (
          <button
            className="primary"
            disabled={!shift}
            onClick={() => open({})}
          >
            {ar.addExpense}
          </button>
        )}
      </div>
      {!shift && <p className="notice">{ar.noShift}</p>}
      <section className="panel">
        <div className="bill-total">
          <span>{ar.total}</span>
          <bdi>
            {money(
              expenses.reduce((n, e) => n + e.amount, 0),
              data.settings,
            )}
          </bdi>
        </div>
        {expenses.length ? (
          expenses.map((e) => (
            <div className="line" key={e.id}>
              <div>
                <strong>{e.description}</strong>
                <small>{e.category}</small>
              </div>
              <bdi>{money(e.amount, data.settings)}</bdi>
              {allowed && (
                <div className="actions">
                  <button onClick={() => open(e)}>{ar.edit}</button>
                  <button
                    className="danger subtle"
                    onClick={() => setRemove(e)}
                  >
                    {ar.delete}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      {edit && (
        <Modal
          title={edit.id ? ar.expenseEdit : ar.addExpense}
          onClose={() => setEdit(undefined)}
        >
          <Field label={ar.description}>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={ar.amount}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={ar.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {data.settings.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <AsyncButton
            className="primary"
            onClick={async () => {
              await commands.expense(
                { description, amount: parseMoney(amount), category },
                edit.id,
              );
              setEdit(undefined);
            }}
          >
            {ar.save}
          </AsyncButton>
        </Modal>
      )}
      {remove && (
        <Modal title={ar.expenseVoid} onClose={() => setRemove(undefined)}>
          <AsyncButton
            className="danger"
            onClick={async () => {
              await commands.expense(remove, remove.id, true);
              setRemove(undefined);
            }}
          >
            {ar.confirm}
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}
