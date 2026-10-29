import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/ui';
import { zh } from './i18n/zh';
import { AppProvider, useApp, useInitialLoad, type Route } from './state/AppContext';
import { CoursePage } from './pages/CoursePage';
import { PartPage } from './pages/PartPage';
import { PhrasebookPage } from './pages/PhrasebookPage';
import { UnitSummaryPage, WeekSummaryPage } from './pages/SummaryPage';
import { ProgressPage } from './pages/ProgressPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { Button, Card, PageHeader } from './components/ui';
import { useEffect } from 'react';
import { PlaybackNotice } from '../../web/ui/WebServices';

const NAV: { route: Route['name']; label: string; icon: string }[] = [
  { route: 'today', label: zh.nav.today, icon: '🏠' },
  { route: 'course', label: zh.nav.course, icon: '📚' },
  { route: 'review', label: zh.nav.review, icon: '🔁' },
  { route: 'mine', label: '我的', icon: '👤' },
];

function Sidebar() {
  const { route, navigate } = useApp();
  const active =
    route.name === 'part'
      ? (route.from ?? 'today')
      : route.name === 'unitSummary' || route.name === 'weekSummary'
        ? 'course'
        : ['phrasebook', 'progress', 'settings'].includes(route.name)
          ? 'mine'
          : route.name;
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

export function Screen() {
  const { route, navigate, goBack } = useApp();
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      document.documentElement.style.removeProperty('--app-height');
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);
  let page;
  switch (route.name) {
    case 'mine':
      page = (
        <div className="page">
          <PageHeader title="我的" />
          <Card>
            <p>每天开口一点点，慢慢看见自己的进步。</p>
            <div className="mine-links">
              {(['phrasebook', 'progress', 'settings'] as const).map((name) => (
                <Button key={name} onClick={() => navigate({ name })}>
                  {zh.nav[name]} →
                </Button>
              ))}
            </div>
          </Card>
        </div>
      );
      break;
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
    case 'unitSummary':
      page = <UnitSummaryPage unitId={route.unitId} {...(route.from ? { from: route.from } : {})} />;
      break;
    case 'weekSummary':
      page = <WeekSummaryPage week={route.week} {...(route.from ? { from: route.from } : {})} />;
      break;
    case 'part':
      page = (
        <PartPage key={route.partId} partId={route.partId} {...(route.from ? { from: route.from } : {})} />
      );
      break;
  }
  return (
    <div className={`shell ${route.name === 'part' ? 'learning-shell' : ''}`}>
      <header className="mobile-topbar">
        {!NAV.some((tab) => tab.route === route.name) ? (
          <Button variant="ghost" onClick={goBack}>
            ← 返回
          </Button>
        ) : null}
        <span>{zh.appName}</span>
      </header>
      {route.name !== 'part' ? <Sidebar /> : null}
      <main className="content">
        <PlaybackNotice />
        {/* Keyed by route so an error on one screen is cleared by navigating away. */}
        <ErrorBoundary
          key={
            route.name === 'part'
              ? route.partId
              : route.name === 'unitSummary'
                ? route.unitId
                : route.name === 'weekSummary'
                  ? `w${route.week}`
                  : route.name
          }
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
