import { createPortal } from 'react-dom';
import {
  useEffect,
  useRef,
  useState,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ar, errorText } from '../i18n/ar';
import { useStore } from '../services/store';
import { clock } from '../services/platform';
export function useNow() {
  const [now, setNow] = useState(clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
export async function run(work: () => Promise<unknown>) {
  try {
    await work();
    return true;
  } catch (e) {
    useStore.getState().notify(errorText(e));
    return false;
  }
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        (typeof child.type !== 'string' ||
          ['input', 'select', 'textarea'].includes(child.type))
          ? cloneElement(child as ReactElement<{ id: string }>, { id })
          : child,
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label={ar.close} onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
export function AsyncButton({
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => Promise<unknown>;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await run(onClick);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? ar.loading : children}
    </button>
  );
}
export function Empty() {
  return (
    <div className="empty">
      <span>◈</span>
      <p>{ar.noData}</p>
    </div>
  );
}
export function toLocalInput(ms: number) {
  const date = new Date(ms);
  return new Date(ms - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function Gamepad() {
  return (
    <svg
      className="gamepad"
      viewBox="0 0 120 70"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M31 12h58c10 0 15 8 18 19l8 25c3 12-7 16-14 9L84 49H36L19 65C12 72 2 68 5 56l8-25c3-11 8-19 18-19Z"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        d="M32 24v22M21 35h22"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="84" cy="29" r="4" fill="currentColor" />
      <circle cx="96" cy="41" r="4" fill="currentColor" />
      <path d="m48 12 6-7h12l6 7" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
