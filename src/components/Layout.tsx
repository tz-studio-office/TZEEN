import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

const pageMeta: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'System', title: 'Learning OS' },
  '/admin/users': { eyebrow: 'Admin', title: 'User Directory' },
  '/students': { eyebrow: 'People', title: 'Students' },
  '/study-plans': { eyebrow: 'Curriculum', title: 'Study Plans' },
  '/assignments': { eyebrow: 'Execution', title: 'Assignments' },
  '/templates': { eyebrow: 'Library', title: 'Templates' },
  '/reading-materials': { eyebrow: 'Content', title: 'Reading Materials' },
  '/study-plan': { eyebrow: 'Student', title: 'Study Plan' },
  '/timer': { eyebrow: 'Student', title: 'Study Timer' },
  '/reading': { eyebrow: 'Student', title: 'Reading' },
  '/vocab-test': { eyebrow: 'Student', title: 'Vocab Test' },
  '/grammar-test': { eyebrow: 'Student', title: 'Grammar Test' },
  '/chat': { eyebrow: 'Communication', title: 'Coach Chat' },
  '/reports': { eyebrow: 'Insights', title: 'Reports' },
  '/settings': { eyebrow: 'System', title: 'Settings' },
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { activeTheme } = useTheme();

  const meta = useMemo(() => pageMeta[location.pathname] || pageMeta['/'], [location.pathname]);

  return (
    <div className="app-shell min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[18.5rem]">
        <div className="px-4 py-4 lg:px-8 lg:py-6">
          <header className="glass-panel sticky top-4 z-30 rounded-[2rem] border px-5 py-4 shadow-soft lg:px-8 theme-border">
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="theme-header-button inline-flex h-11 w-11 items-center justify-center rounded-full border transition lg:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="editorial-kicker">{meta.eyebrow}</p>
                    <h1 className="mt-1 font-display text-[clamp(2rem,4vw,4rem)] font-bold leading-[0.95] tracking-[-0.05em] theme-text">
                      {meta.title}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex lg:items-center">
                <div className="rounded-full border theme-border theme-panel px-4 py-2 text-[11px] font-semibold uppercase tracking-caps theme-muted">
                  TZEEN / {activeTheme.label}
                </div>
              </div>
            </div>
          </header>
        </div>

        <main className="px-4 pb-8 lg:px-8 lg:pb-10">
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
