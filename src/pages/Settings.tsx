import { Check, LayoutPanelTop, MoonStar, Sparkles, SwatchBook } from 'lucide-react';
import { useTheme, type ThemeName } from '../contexts/ThemeContext';

const iconMap: Record<ThemeName, typeof LayoutPanelTop> = {
  current: LayoutPanelTop,
  dark: MoonStar,
  studyplus: Sparkles,
  screenshot: SwatchBook,
};

export default function SettingsPage() {
  const { theme, setTheme, options } = useTheme();

  return (
    <div className="space-y-6">
      <section className="theme-panel rounded-[2rem] border theme-border p-6 shadow-soft lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-kicker">Theme system</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.06em] theme-text lg:text-5xl">
              Switch between
              <br className="hidden lg:block" />
              four clear directions.
            </h2>
          </div>

          <div className="rounded-full border theme-border px-4 py-2 text-[11px] font-semibold uppercase tracking-caps theme-muted">
            Active / {options.find((option) => option.id === theme)?.label}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {options.map((option) => {
          const Icon = iconMap[option.id];
          const active = option.id === theme;

          return (
            <article
              key={option.id}
              className={`rounded-[2rem] border p-5 transition-all duration-200 lg:p-6 ${
                active ? 'theme-panel-strong theme-border shadow-soft' : 'theme-panel theme-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="theme-kicker">Theme {option.shortLabel}</p>
                  <h3 className="mt-2 font-display text-2xl font-black tracking-[-0.05em] theme-text">{option.label}</h3>
                  <p className="mt-1 text-sm theme-muted">{option.tone}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border theme-border theme-panel theme-text">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 theme-muted">{option.description}</p>

              <div className="mt-6 grid grid-cols-1 gap-4 rounded-[1.6rem] border theme-border p-4 lg:grid-cols-[1.2fr_1fr]">
                <div className={`theme-preview ${option.id}`}>
                  <div className="theme-preview-sidebar" />
                  <div className="theme-preview-body">
                    <div className="theme-preview-title" />
                    <div className="theme-preview-card" />
                    <div className="theme-preview-grid">
                      <span />
                      <span />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="rounded-[1.4rem] border theme-border p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-caps theme-muted">Best for</p>
                    <p className="mt-2 text-sm font-semibold theme-text">
                      {option.id === 'current' && 'The existing TZeen operational UI.'}
                      {option.id === 'dark' && 'A sharper monochrome presentation.'}
                      {option.id === 'studyplus' && 'A more colorful, motivating daily study flow.'}
                      {option.id === 'screenshot' && 'A brighter, softer, screenshot-inspired dashboard.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                      active ? 'theme-button-primary' : 'theme-button-secondary'
                    }`}
                  >
                    {active ? <Check className="h-4 w-4" /> : null}
                    {active ? 'Currently applied' : 'Apply this theme'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
