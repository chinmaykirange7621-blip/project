import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchHealth } from '../services/api';
import type {
  ChatSession,
  DeadlineReminder,
  HealthResponse,
  StudentProfile,
} from '../types/scholarship';

const STORAGE_KEYS = {
  theme: 'scholarai_theme',
  bookmarks: 'scholarai_bookmarks',
  checklists: 'scholarai_checklists',
  reminders: 'scholarai_reminders',
  chatSessions: 'scholarai_chat_sessions',
  privacyConsent: 'scholarai_privacy_consent',
  eligibilityProfile: 'scholarai_eligibility_profile',
};

interface ScholarDataContextValue {
  darkMode: boolean;
  toggleDarkMode: () => void;
  health: HealthResponse | null;
  demoMode: boolean;
  bookmarks: string[];
  toggleBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  checklists: Record<string, string[]>;
  toggleChecklistDoc: (scholarshipId: string, docName: string) => void;
  reminders: DeadlineReminder[];
  upsertReminder: (reminder: DeadlineReminder) => void;
  removeReminder: (scholarshipId: string) => void;
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  privacyAccepted: boolean;
  acceptPrivacy: () => void;
  savedProfile: StudentProfile;
  setSavedProfile: React.Dispatch<React.SetStateAction<StudentProfile>>;
  clearAllUserData: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  privacyModalOpen: boolean;
  setPrivacyModalOpen: (open: boolean) => void;
  bookmarksDrawerOpen: boolean;
  setBookmarksDrawerOpen: (open: boolean) => void;
}

const ScholarDataContext = createContext<ScholarDataContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ScholarDataProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.theme) === 'dark');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>(() => readJson(STORAGE_KEYS.bookmarks, []));
  const [checklists, setChecklists] = useState<Record<string, string[]>>(() => readJson(STORAGE_KEYS.checklists, {}));
  const [reminders, setReminders] = useState<DeadlineReminder[]>(() => readJson(STORAGE_KEYS.reminders, []));
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => readJson(STORAGE_KEYS.chatSessions, []));
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.privacyConsent) === 'true');
  const [savedProfile, setSavedProfile] = useState<StudentProfile>(() => readJson(STORAGE_KEYS.eligibilityProfile, {}));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem(STORAGE_KEYS.theme, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => {
        setHealth(null);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.checklists, JSON.stringify(checklists));
  }, [checklists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chatSessions, JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.eligibilityProfile, JSON.stringify(savedProfile));
  }, [savedProfile]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode((prev) => !prev), []);

  const toggleBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const exists = prev.includes(id);
        showToast(exists ? 'Removed from bookmarks' : 'Saved to bookmarks');
        return exists ? prev.filter((item) => item !== id) : [...prev, id];
      });
    },
    [showToast]
  );

  const isBookmarked = useCallback((id: string) => bookmarks.includes(id), [bookmarks]);

  const toggleChecklistDoc = useCallback((scholarshipId: string, docName: string) => {
    setChecklists((prev) => {
      const current = prev[scholarshipId] || [];
      const updated = current.includes(docName)
        ? current.filter((d) => d !== docName)
        : [...current, docName];
      return { ...prev, [scholarshipId]: updated };
    });
  }, []);

  const upsertReminder = useCallback(
    (reminder: DeadlineReminder) => {
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.scholarshipId !== reminder.scholarshipId);
        return [...filtered, reminder];
      });
      showToast('Deadline reminder saved locally');
    },
    [showToast]
  );

  const removeReminder = useCallback(
    (scholarshipId: string) => {
      setReminders((prev) => prev.filter((r) => r.scholarshipId !== scholarshipId));
      showToast('Reminder removed');
    },
    [showToast]
  );

  const acceptPrivacy = useCallback(() => {
    setPrivacyAccepted(true);
    localStorage.setItem(STORAGE_KEYS.privacyConsent, 'true');
  }, []);

  const clearAllUserData = useCallback(() => {
    setBookmarks([]);
    setChecklists({});
    setReminders([]);
    setChatSessions([]);
    setPrivacyAccepted(false);
    setSavedProfile({});
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (k !== STORAGE_KEYS.theme) {
        localStorage.removeItem(k);
      }
    });
    showToast('All your local ScholarAI data has been cleared.');
  }, [showToast]);

  const demoMode = health ? health.demo_mode : true;

  return (
    <ScholarDataContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        health,
        demoMode,
        bookmarks,
        toggleBookmark,
        isBookmarked,
        checklists,
        toggleChecklistDoc,
        reminders,
        upsertReminder,
        removeReminder,
        chatSessions,
        setChatSessions,
        privacyAccepted,
        acceptPrivacy,
        savedProfile,
        setSavedProfile,
        clearAllUserData,
        toastMessage,
        showToast,
        privacyModalOpen,
        setPrivacyModalOpen,
        bookmarksDrawerOpen,
        setBookmarksDrawerOpen,
      }}
    >
      {children}
    </ScholarDataContext.Provider>
  );
}

export function useScholarData() {
  const ctx = useContext(ScholarDataContext);
  if (!ctx) throw new Error('useScholarData must be used within ScholarDataProvider');
  return ctx;
}
