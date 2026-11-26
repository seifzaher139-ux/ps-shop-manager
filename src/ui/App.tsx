import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '../services/store';
import { ar } from '../i18n/ar';
import { Auth } from './Auth';
import { Board } from './Board';
import { Reports } from './Reports';
import { Expenses } from './Expenses';
import { Settings } from './Settings';
export function App() {
  const { data, ready, userId, message } = useStore();
  const [fatal, setFatal] = useState(false);
  const [cached,setCached]=useState(false);
  useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.ready.then(()=>setCached(true));},[]);
  const [online, setOnline] = useState(navigator.onLine);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    void useStore
      .getState()
      .load()
      .catch(() => setFatal(true));
  }, []);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => useStore.getState().notify(''), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!userId || !data.settings.idleMinutes) return;
    let last = Date.now();
    const active = () => {
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last >= data.settings.idleMinutes * 60000)
        useStore.getState().logout();
    };
    const timer = setInterval(check, 1000);
    window.addEventListener('pointerdown', active);
    window.addEventListener('keydown', active);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', active);
      window.removeEventListener('keydown', active);
      window.removeEventListener('focus', check);
    };
  }, [userId, data.settings.idleMinutes]);
  return (
    <HashRouter>
      {fatal ? (
        <main className="auth-shell">
          <p role="alert">{ar.error}</p>
        </main>
      ) : !ready ? (
        <main className="auth-shell">{ar.loading}</main>
      ) : !userId ? (
        <Auth />
      ) : (
        <div className="app-shell">
          <aside className="sidebar">
            <a href="#/" className="brand">
              <img src={data.settings.logo || './icons/icon-192.png'} alt="" />
              <span>
                {data.settings.shopName}
                <small>{ar.app}</small>
              </span>
            </a>
            <nav>
              {[
                ['/', ar.home, '▦'],
                ['/reports', ar.reports, '▤'],
                ['/expenses', ar.expenses, '◷'],
                ['/settings', ar.settings, '⚙'],
              ].map(([path, label, icon]) => (
                <NavLink key={path} to={path} end={path === '/'}>
                  <span aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-footer">
              <span>{ar.localOnly}</span>
              <small>{data.settings.device}</small>
            </div>
          </aside>
          <main className="main-content">
            <header className="topbar">
              <span>{data.settings.shopName}</span>
              <div className="connection">
                <span className="status-dot" />
                {(offlineReady||cached)
                  ? ar.offlineReady
                  : online
                    ? ar.online
                    : ar.offline}
              </div>
            </header>
            <Routes>
              <Route path="/" element={<Board />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Board />} />
            </Routes>
          </main>
        </div>
      )}
      {message && (
        <div
          role="alert"
          className="toast"
          onClick={() => useStore.getState().notify('')}
        >
          {message}
        </div>
      )}
      {needRefresh && (
        <div className="update-banner">
          <span>{ar.update}</span>
          <button
            onClick={() => {
              if (
                !data.sessions.some((s) => s.status === 'running') ||
                window.confirm(ar.update)
              )
                void updateServiceWorker(true);
            }}
          >
            {ar.updateNow}
          </button>
        </div>
      )}
    </HashRouter>
  );
}
