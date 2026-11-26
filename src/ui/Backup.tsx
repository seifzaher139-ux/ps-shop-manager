import { useState } from 'react';
import { restore } from '../data/repository';
import { commands, currentUser, useStore } from '../services/store';
import { ar, dateTime } from '../i18n/ar';
import { AsyncButton, Modal, run } from './shared';
export function BackupButton() {
  return (
    <AsyncButton
      onClick={async () => {
        const name = await commands.backup();
        useStore
          .getState()
          .notify(`${ar.backupSaved} ${name}. ${ar.downloadHint}`);
      }}
    >
      {ar.backup}
    </AsyncButton>
  );
}
export function RestorePanel() {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  return (
    <>
      <label className="file-button">
        {ar.restore}
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void run(async () => {
                if (file.size > 100 * 1024 * 1024)
                  throw new Error('invalid-backup');
                const content = await file.text();
                const data = restore(content);
                const times = data.shifts.map((s) => s.start);
                setSummary(
                  `${ar.users}: ${data.users.length} · ${ar.sessions}: ${data.sessions.length} · ${ar.shift}: ${data.shifts.length}${times.length ? ` · ${dateTime(Math.min(...times))} — ${dateTime(Math.max(...times))}` : ''}`,
                );
                setText(content);
              });
            e.target.value = '';
          }}
        />
      </label>
      {text && (
        <Modal title={ar.restoreSummary} onClose={() => setText('')}>
          <p>{summary}</p>
          <p className="notice">{ar.restoreConfirm}</p>
          {currentUser() && <BackupButton />}
          <AsyncButton
            className="danger"
            onClick={async () => {
              await commands.restore(text);
              setText('');
            }}
          >
            {ar.replace}
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}
