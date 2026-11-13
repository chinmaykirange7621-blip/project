import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  History,
  Menu,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { SourceBadge } from '../components/SourceBadge';
import { TypingDots } from '../components/TypingDots';
import { useScholarData } from '../hooks/useScholarData';
import { sendChatMessage } from '../services/api';
import type { ChatMessage, ChatSession } from '../types/scholarship';

const SUGGESTED_CHIPS = [
  'Am I eligible for a scholarship?',
  'What scholarships are available for B.Tech students?',
  'What documents are required for NSP scholarships?',
  'How do I apply for a merit-based scholarship?',
  'Find scholarships for students from low-income families.',
  'What is the last date to apply?',
];

function createEmptySession(): ChatSession {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Scholarship Chat',
    updatedAt: new Date().toISOString(),
    messages: [],
    profileContext: {},
  };
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { chatSessions, setChatSessions, clearAllUserData, showToast } = useScholarData();

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return chatSessions[0]?.id || '';
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialQueryHandled = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure at least one session exists
  useEffect(() => {
    if (chatSessions.length === 0) {
      const fresh = createEmptySession();
      setChatSessions([fresh]);
      setActiveSessionId(fresh.id);
    } else if (!activeSessionId || !chatSessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(chatSessions[0].id);
    }
  }, [chatSessions, activeSessionId, setChatSessions]);

  const activeSession = chatSessions.find((s) => s.id === activeSessionId) || chatSessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, sending]);

  const submitQuery = async (textToSend: string, targetSession?: ChatSession) => {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    const currentSession = targetSession || activeSession || createEmptySession();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: clean,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...currentSession.messages, userMsg];
    const nextTitle =
      currentSession.messages.length === 0 ? clean.slice(0, 46) + (clean.length > 46 ? '…' : '') : currentSession.title;

    setChatSessions((prev) => {
      const exists = prev.some((s) => s.id === currentSession.id);
      const updated = exists
        ? prev.map((s) =>
            s.id === currentSession.id
              ? { ...s, title: nextTitle, updatedAt: new Date().toISOString(), messages: nextMessages }
              : s
          )
        : [{ ...currentSession, title: nextTitle, messages: nextMessages }, ...prev];
      return updated;
    });

    setInput('');
    setSending(true);
    setErrorMsg(null);

    try {
      const historyPayload = nextMessages.slice(-7, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendChatMessage({
        message: clean,
        history: historyPayload,
        profile_context: currentSession.profileContext,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        createdAt: new Date().toISOString(),
        metadata: {
          intent: res.intent,
          sources: res.sources,
          eligibility_reasoning: res.eligibility_reasoning,
          confidence: res.confidence,
          limitations: res.limitations,
          follow_up_questions: res.follow_up_questions,
          extracted_profile: res.extracted_profile,
          privacy_warnings: res.privacy_warnings,
          disclaimer: res.disclaimer,
          demo_mode: res.demo_mode,
          trace: res.trace,
        },
      };

      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id
            ? {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [...s.messages, assistantMsg],
                profileContext: res.extracted_profile,
              }
            : s
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach ScholarAI backend.');
    } finally {
      setSending(false);
    }
  };

  // Handle ?q=... deep link from Landing page
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !initialQueryHandled.current && activeSession) {
      initialQueryHandled.current = true;
      setSearchParams({}, { replace: true });
      const fresh = createEmptySession();
      setActiveSessionId(fresh.id);
      submitQuery(q, fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeSession?.id]);

  const handleFollowUpClick = (question: string) => {
    const lower = question.toLowerCase();
    const isAskingUserProfile =
      lower.includes('your ') &&
      (lower.includes('course') ||
        lower.includes('income') ||
        lower.includes('cgpa') ||
        lower.includes('percentage') ||
        lower.includes('state') ||
        lower.includes('domicile') ||
        lower.includes('category') ||
        lower.includes('education level'));

    if (!isAskingUserProfile) {
      submitQuery(question);
      return;
    }

    let starter = 'About my profile: ';
    if (lower.includes('course') || lower.includes('degree') || lower.includes('branch')) {
      starter = 'My course is ';
    } else if (lower.includes('income')) {
      starter = 'My annual family income is ₹';
    } else if (lower.includes('cgpa') || lower.includes('percentage') || lower.includes('score')) {
      starter = 'My CGPA/percentage is ';
    } else if (lower.includes('state') || lower.includes('domicile')) {
      starter = 'My domicile state is ';
    } else if (lower.includes('category')) {
      starter = 'My category is ';
    } else if (lower.includes('education level')) {
      starter = 'My education level is ';
    }
    setInput(starter);
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuery(input);
  };

  const handleNewChat = () => {
    const fresh = createEmptySession();
    setChatSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setSidebarOpen(false);
    setErrorMsg(null);
  };

  const handleClearCurrentChat = () => {
    if (!activeSession) return;
    setChatSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, title: 'New Scholarship Chat', messages: [], profileContext: {}, updatedAt: new Date().toISOString() }
          : s
      )
    );
    showToast('Current chat cleared');
  };

  const handleDeleteSession = (id: string) => {
    setChatSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptySession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleResetContext = () => {
    if (!activeSession) return;
    setChatSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, profileContext: {} } : s))
    );
    showToast('Session profile context reset');
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((p) => (p === id ? null : p)), 1800);
    });
  };

  const handleExportChat = () => {
    if (!activeSession || activeSession.messages.length === 0) return;
    const md = activeSession.messages
      .map((m) => `## ${m.role === 'user' ? 'Student' : 'ScholarAI'}\n\n${m.content}\n`)
      .join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholarai-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const profileEntries = Object.entries(
    (activeSession?.profileContext || {}) as Record<string, unknown>
  ).filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)] min-h-[500px] lg:h-[calc(100vh-10.5rem)] lg:min-h-[580px]">
        {/* Mobile sidebar toggle */}
        <div className="flex lg:hidden items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Menu className="w-4 h-4" />
            <span>Chat History ({chatSessions.length})</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={handleClearCurrentChat}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        <aside
          aria-label="Conversation history"
          className={`${
            sidebarOpen ? 'fixed inset-0 z-50 flex bg-slate-950/50 p-4 lg:static lg:bg-transparent lg:p-0' : 'hidden lg:flex'
          } lg:w-72 shrink-0 flex-col`}
        >
          <div className="w-72 max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-full shadow-xs">
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Chat History
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close history sidebar"
                  className="lg:hidden p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleNewChat}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
                {chatSessions.map((sess) => {
                  const isActive = sess.id === activeSession?.id;
                  return (
                    <div
                      key={sess.id}
                      className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSessionId(sess.id);
                          setSidebarOpen(false);
                        }}
                        className="flex-1 text-left truncate"
                      >
                        {sess.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id)}
                        aria-label={`Delete conversation ${sess.title}`}
                        className="opacity-60 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleExportChat}
                disabled={!activeSession || activeSession.messages.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Chat (.md)</span>
              </button>
              <button
                type="button"
                onClick={handleClearCurrentChat}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Current Chat</span>
              </button>
              <button
                type="button"
                onClick={clearAllUserData}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Clear My Data</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Chat Panel */}
        <section className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden min-w-0">
          {/* Chat Top Bar: Non-identifying Context Pills */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  ScholarAI Advisory Assistant
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Do not enter Aadhaar, bank details, passwords, or OTPs.
                </p>
              </div>
            </div>

            {profileEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {profileEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300"
                  >
                    {k}: {k === 'family_income' ? `₹${Number(v).toLocaleString('en-IN')}` : String(v)}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleResetContext}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 underline ml-1"
                >
                  Reset context
                </button>
              </div>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {(!activeSession || activeSession.messages.length === 0) && (
              <div className="max-w-2xl mx-auto py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                  Ask anything about Indian Scholarships
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                  Get cited answers grounded in ChromaDB retrieval and deterministic eligibility rules.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => submitQuery(chip)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSession?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              const meta = msg.metadata;
              const traceOpen = !!expandedTraces[msg.id];

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end gap-2.5">
                    <div className="max-w-xl rounded-2xl rounded-tr-xs bg-blue-600 text-white px-4 py-3 text-sm shadow-xs">
                      {msg.content}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              }

              const confColors: Record<string, string> = {
                High: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
                Medium: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
                Low: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
              };

              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Privacy Warnings if any */}
                    {meta?.privacy_warnings && meta.privacy_warnings.length > 0 && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          {meta.privacy_warnings.map((w) => (
                            <p key={w}>{w}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Main Answer Card */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
                        <div className="flex flex-wrap items-center gap-2">
                          {meta && (
                            <>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  confColors[meta.confidence] || confColors.Medium
                                }`}
                              >
                                Retrieval Confidence: {meta.confidence}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-200/70 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 capitalize">
                                Intent: {meta.intent.replace('_', ' ')}
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-blue-600 dark:prose-a:text-blue-400">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>

                      {/* Eligibility Reasoning */}
                      {meta?.eligibility_reasoning && (
                        <div className="mt-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-900 dark:text-white">Eligibility Reasoning: </strong>
                          {meta.eligibility_reasoning}
                        </div>
                      )}

                      {/* Limitations */}
                      {meta?.limitations && meta.limitations.length > 0 && (
                        <div className="mt-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 p-3 text-xs text-amber-900 dark:text-amber-200">
                          <p className="font-semibold flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Limitations &amp; Verification Notes
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {meta.limitations.map((lim) => (
                              <li key={lim}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Citations Grid */}
                    {meta?.sources && meta.sources.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Retrieved Sources &amp; Citations ({meta.sources.length})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {meta.sources.map((src, idx) => (
                            <div
                              key={src.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/scholarships/${src.id}`}
                                  className="font-bold text-slate-900 dark:text-white hover:text-blue-600 leading-snug"
                                >
                                  [{idx + 1}] {src.name}
                                </Link>
                                <SourceBadge status={src.source_status} lastVerified={src.last_verified} compact />
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {src.provider} · Benefit: {src.amount || 'Not available'}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Deadline: {src.deadline || 'Not available'}
                                </span>
                                <a
                                  href={src.official_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Official Site <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expandable "How did AI reach this result?" Trace */}
                    {meta?.trace && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTraces((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          aria-expanded={traceOpen}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            How did AI reach this result? ({meta.trace.provider_mode})
                          </span>
                          {traceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {traceOpen && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                            {meta.trace.steps.map((step) => (
                              <div key={step.stage} className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2.5">
                                <span className="self-start rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-semibold shrink-0">
                                  {step.stage}
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                                    {step.title}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-400">{step.detail}</p>
                                </div>
                              </div>
                            ))}
                            {meta.trace.sources_used && meta.trace.sources_used.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                <strong className="text-slate-700 dark:text-slate-200">Sources used: </strong>
                                {meta.trace.sources_used.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow-up Questions */}
                    {meta?.follow_up_questions && meta.follow_up_questions.length > 0 && (
                      <div className="rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          Suggested follow-ups:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {meta.follow_up_questions.map((fq) => (
                            <button
                              key={fq}
                              type="button"
                              onClick={() => handleFollowUpClick(fq)}
                              className="rounded-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left"
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
                {errorMsg}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about eligibility, NSP documents, B.Tech scholarships, deadlines..."
                aria-label="Chat message input"
                disabled={sending}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
            <p className="mt-2 text-[11px] text-center text-slate-400 dark:text-slate-500">
              Final eligibility is decided by the provider. Verify sample records on official portals.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
