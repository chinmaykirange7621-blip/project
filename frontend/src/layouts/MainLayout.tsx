import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bookmark,
  Menu,
  MessageSquareText,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import scholarMark from '../assets/scholarai-mark.svg';
import { BookmarksDrawer } from '../components/BookmarksDrawer';
import { DemoBanner } from '../components/DemoBanner';
import { PrivacyModal } from '../components/PrivacyModal';
import { useScholarData } from '../hooks/useScholarData';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
  { to: '/explore', label: 'Explorer', icon: Search },
  { to: '/eligibility', label: 'Eligibility Check', icon: SlidersHorizontal },
  { to: '/admin', label: 'Admin', icon: Shield },
];

export function MainLayout({ children }: { children: ReactNode }) {
  const {
    darkMode,
    toggleDarkMode,
    bookmarks,
    reminders,
    setBookmarksDrawerOpen,
    setPrivacyModalOpen,
    clearAllUserData,
    toastMessage,
  } = useScholarData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const savedCount = bookmarks.length + reminders.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090e1a] text-slate-900 dark:text-slate-100 transition-colors">
      <DemoBanner />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={scholarMark} alt="ScholarAI logo" className="w-8 h-8 rounded-lg shadow-xs" />
            <div className="leading-tight">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Scholar<span className="text-blue-600 dark:text-blue-400">AI</span>
              </span>
              <span className="hidden sm:block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Intelligent Scholarship Assistant
              </span>
            </div>
          </Link>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`
                }
              >
                {link.icon && <link.icon className="w-4 h-4" />}
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setBookmarksDrawerOpen(true)}
              aria-label="Open saved bookmarks and reminders"
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Bookmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Saved</span>
              {savedCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {savedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPrivacyModalOpen(true)}
              aria-label="Privacy policy and data controls"
              title="Privacy & Clear Data"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-1"
          >
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                {link.icon && <link.icon className="w-4 h-4" />}
                <span>{link.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                clearAllUserData();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear my data</span>
            </button>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              ScholarAI — &ldquo;Your Future. Your Scholarship. One Intelligent Assistant.&rdquo;
            </p>
            <p className="mt-1">
              Final eligibility is decided by the provider. Sample records must always be verified on official portals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setPrivacyModalOpen(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={clearAllUserData}
              className="hover:text-rose-600 dark:hover:text-rose-400 font-medium"
            >
              Clear my data
            </button>
            <Link to="/explore" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">
              Browse Schemes
            </Link>
          </div>
        </div>
      </footer>

      <PrivacyModal />
      <BookmarksDrawer />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
