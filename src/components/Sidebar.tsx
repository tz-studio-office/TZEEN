import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  Timer,
  FileText,
  LogOut,
  X,
  Shield,
  BookOpenCheck,
  SpellCheck,
  PenTool,
  MessageCircle,
  BarChart3,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const sharedLinks = [{ to: '/settings', icon: Settings, label: 'Settings' }];
const adminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Shield, label: 'User Management' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/study-plans', icon: CalendarDays, label: 'Study Plans' },
  { to: '/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/materials', icon: BookOpen, label: 'Materials' },
];
const coachLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/study-plans', icon: CalendarDays, label: 'Study Plans' },
  { to: '/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/reading-materials', icon: BookOpenCheck, label: 'Reading Materials' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/materials', icon: BookOpen, label: 'Materials' },
];
const studentLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/study-plan', icon: CalendarDays, label: 'Study Plan' },
  { to: '/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/timer', icon: Timer, label: 'Study Timer' },
  { to: '/reading', icon: BookOpenCheck, label: 'Reading' },
  { to: '/vocab-test', icon: SpellCheck, label: 'Vocab Test' },
  { to: '/vocab-results', icon: ClipboardList, label: 'Vocab Results' },
  { to: '/vocab-analytics', icon: BarChart3, label: 'Vocab Analytics' },
  { to: '/grammar-test', icon: PenTool, label: 'Grammar Test' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/student-materials', icon: BookOpen, label: 'Materials' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const role = profile?.role || 'student';
  const name = profile?.full_name || 'User';
  const links = role === 'admin' ? adminLinks : role === 'coach' ? coachLinks : studentLinks;

  return (
    <>
      {open && <button onClick={onClose} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" aria-label="Close navigation" />}

      <aside
        className={`theme-sidebar fixed inset-y-0 left-0 z-50 w-[17.5rem] border-r px-4 py-5 transition-transform duration-300 lg:px-4 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="theme-logo-mark flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold">T</div>
              <div>
                <p className="font-display text-xl font-black tracking-[-0.04em] theme-text">TZeen</p>
              </div>
            </div>
            <button onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border theme-border theme-panel">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="theme-logo-mark flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold">T</div>
            <div>
              <p className="font-display text-[1.75rem] font-black tracking-[-0.05em] theme-text">TZeen</p>
              <p className="text-[10px] font-semibold uppercase tracking-caps theme-muted">Learning System</p>
            </div>
          </div>

          <div className="theme-panel-strong rounded-[1.8rem] border theme-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-caps theme-muted">Current profile</p>
                <p className="mt-3 text-[2rem] font-display font-black leading-none tracking-[-0.05em] theme-text">{name}</p>
              </div>
              <span className="theme-role-pill rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-caps">
                {role}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-6">
              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-caps theme-muted">Navigation</p>
                <nav className="mt-3 space-y-2">
                  {links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group flex items-center justify-between rounded-[1.3rem] px-3 py-3 transition-all duration-200 ${
                            isActive ? 'theme-nav-active shadow-soft' : 'theme-nav-idle'
                          }`
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="theme-nav-icon flex h-11 w-11 items-center justify-center rounded-full border theme-border transition-all duration-200">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{link.label}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-55 transition group-hover:translate-x-0.5" />
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-caps theme-muted">System</p>
                <nav className="mt-3 space-y-2">
                  {sharedLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group flex items-center justify-between rounded-[1.3rem] px-3 py-3 transition-all duration-200 ${
                            isActive ? 'theme-nav-active shadow-soft' : 'theme-nav-idle'
                          }`
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="theme-nav-icon flex h-11 w-11 items-center justify-center rounded-full border theme-border transition-all duration-200">
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="truncate text-sm font-semibold">{link.label}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-55 transition group-hover:translate-x-0.5" />
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="theme-panel-strong flex items-center justify-between rounded-[1.5rem] border theme-border px-4 py-4 text-left transition hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="theme-nav-icon flex h-11 w-11 items-center justify-center rounded-full border theme-border">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">Sign out</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 theme-muted" />
          </button>
        </div>
      </aside>
    </>
  );
}
