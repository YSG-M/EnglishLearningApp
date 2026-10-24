import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/ui';
import { zh } from './i18n/zh';
import { AppProvider, useApp, useInitialLoad, type Route } from './state/AppContext';
import { CoursePage } from './pages/CoursePage';
import { PartPage } from './pages/PartPage';
import { PhrasebookPage } from './pages/PhrasebookPage';
import { ProgressPage } from './pages/ProgressPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';

const NAV: { route: Route['name']; label: string; icon: string }[] = [
  { route: 'today', label: zh.nav.today, icon: '🏠' },
  { route: 'course', label: zh.nav.course, icon: '📚' },
  { route: 'review', label: zh.nav.review, icon: '🔁' },
  { route: 'phrasebook', label: zh.nav.phrasebook, icon: '🔍' },
  { route: 'progress', label: zh.nav.progress, icon: '📈' },
  { route: 'settings', label: zh.nav.settings, icon: '⚙️' },
];

function Sidebar() {
  const { route, navigate } = useApp();
  const active = route.name === 'part' ? 'today' : route.name;
  return (
    <nav className="sidebar" aria-label="主菜单">
      <div className="brand">
        <span className="brand-name">{zh.appName}</span>
        <span className="brand-sub">{zh.appSubtitle}</span>
      </div>
      {NAV.map((n) => (
        <button
          key={n.route}
          type="button"
          className={`nav-item ${active === n.route ? 'active' : ''}`}
          aria-current={active === n.route ? 'page' : undefined}
          onClick={() => navigate({ name: n.route } as Route)}
        >
          <span className="nav-icon" aria-hidden>
            {n.icon}
          </span>
          {n.label}
        </button>
      ))}
    </nav>
  );
}

function Screen() {
  const { route, navigate } = useApp();
  let page;
  switch (route.name) {
    case 'today':
      page = <TodayPage />;
      break;
    case 'course':
      page = <CoursePage />;
      break;
    case 'review':
      page = <ReviewPage />;
      break;
    case 'phrasebook':
      page = <PhrasebookPage />;
      break;
    case 'progress':
      page = <ProgressPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'part':
      page = <PartPage key={route.partId} partId={route.partId} />;
      break;
  }
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        {/* Keyed by route so an error on one screen is cleared by navigating away. */}
        <ErrorBoundary
          key={route.name === 'part' ? route.partId : route.name}
          onReset={() => navigate({ name: 'today' })}
        >
          {page}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export function App() {
  const load = useInitialLoad();
  if (load.status === 'loading') {
    return (
      <div className="splash">
        <Loading label={zh.common.loading} />
      </div>
    );
  }
  if (load.status === 'error') {
    return (
      <div className="error-screen" role="alert">
        <h1>📦 {zh.errors.contentMissing}</h1>
        <p>{zh.errors.contentMissingBody}</p>
        <p className="muted small">{load.message}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
          {zh.errors.reload}
        </button>
      </div>
    );
  }
  return (
    <ErrorBoundary>
      <AppProvider bundle={load.bundle} settings={load.settings} speech={load.speech} hints={load.hints}>
        <Screen />
      </AppProvider>
    </ErrorBoundary>
  );
}
