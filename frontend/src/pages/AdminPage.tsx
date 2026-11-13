import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Edit3,
  FileUp,
  LogOut,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { SourceBadge } from '../components/SourceBadge';
import { useScholarData } from '../hooks/useScholarData';
import {
  adminLogin,
  createScholarship,
  deleteIngestedDocument,
  deleteScholarship,
  fetchAdminAnalytics,
  fetchAdminMe,
  fetchIngestedDocuments,
  fetchScholarships,
  updateScholarship,
  uploadPdfDocument,
} from '../services/api';
import type {
  AdminAnalytics,
  IngestedDocument,
  Scholarship,
  ScholarshipBasis,
  ScholarshipType,
  SourceStatus,
} from '../types/scholarship';

const TOKEN_STORAGE_KEY = 'scholarai_admin_jwt';

interface FormState {
  id: string;
  name: string;
  provider: string;
  type: ScholarshipType;
  basis: ScholarshipBasis;
  education_level: string;
  course: string;
  min_percentage: string;
  min_cgpa: string;
  max_family_income: string;
  states: string;
  categories: string;
  amount: string;
  required_documents: string;
  deadline: string;
  official_url: string;
  source_status: SourceStatus;
  last_verified: string;
  description: string;
  eligibility_notes: string;
  application_steps: string;
  gender_requirement: 'All' | 'Female' | 'Male';
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  provider: '',
  type: 'government',
  basis: 'merit',
  education_level: 'UG',
  course: 'B.Tech, Engineering',
  min_percentage: '',
  min_cgpa: '',
  max_family_income: '',
  states: 'All India',
  categories: 'All',
  amount: '',
  required_documents: 'Marksheet, Income Certificate, Bonafide Certificate',
  deadline: '',
  official_url: 'https://scholarships.gov.in/',
  source_status: 'sample',
  last_verified: '',
  description: '',
  eligibility_notes: '',
  application_steps: '',
  gender_requirement: 'All',
};

function toFormState(s: Scholarship): FormState {
  return {
    id: s.id,
    name: s.name,
    provider: s.provider,
    type: s.type,
    basis: s.basis,
    education_level: s.education_level.join(', '),
    course: s.course.join(', '),
    min_percentage: s.min_percentage !== null ? String(s.min_percentage) : '',
    min_cgpa: s.min_cgpa !== null ? String(s.min_cgpa) : '',
    max_family_income: s.max_family_income !== null ? String(s.max_family_income) : '',
    states: s.states.join(', '),
    categories: s.categories.join(', '),
    amount: s.amount || '',
    required_documents: s.required_documents.join(', '),
    deadline: s.deadline || '',
    official_url: s.official_url,
    source_status: s.source_status,
    last_verified: s.last_verified || '',
    description: s.description || '',
    eligibility_notes: s.eligibility_notes || '',
    application_steps: s.application_steps.join('\n'),
    gender_requirement: (s.gender_requirement as 'All' | 'Female' | 'Male') || 'All',
  };
}

export function AdminPage() {
  const { showToast } = useScholarData();
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<'scholarships' | 'documents' | 'analytics'>('scholarships');
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfScholarshipId, setPdfScholarshipId] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadDashboardData = async (jwt: string) => {
    try {
      const [schRes, docRes, anaRes] = await Promise.all([
        fetchScholarships({ page: 1, page_size: 100 }),
        fetchIngestedDocuments(jwt),
        fetchAdminAnalytics(jwt),
      ]);
      setScholarships(schRes.items);
      setDocuments(docRes);
      setAnalytics(anaRes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to refresh admin data');
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAdminMe(token)
      .then((me) => {
        setAdminUser(me.username);
        loadDashboardData(token);
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken('');
        setAdminUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await adminLogin(username, password);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, res.access_token);
      setToken(res.access_token);
      setAdminUser(res.username);
      setPassword('');
      showToast('Signed in to Admin Console');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setAdminUser(null);
  };

  const splitCsv = (val: string) =>
    val.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSaveScholarship = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      type: form.type,
      basis: form.basis,
      education_level: splitCsv(form.education_level),
      course: splitCsv(form.course),
      min_percentage: form.min_percentage ? Number(form.min_percentage) : null,
      min_cgpa: form.min_cgpa ? Number(form.min_cgpa) : null,
      max_family_income: form.max_family_income ? Number(form.max_family_income) : null,
      states: splitCsv(form.states),
      categories: splitCsv(form.categories),
      amount: form.amount.trim() || null,
      required_documents: splitCsv(form.required_documents),
      deadline: form.deadline.trim() || null,
      official_url: form.official_url.trim(),
      source_status: form.source_status,
      last_verified: form.last_verified.trim() || null,
      description: form.description.trim() || null,
      eligibility_notes: form.eligibility_notes.trim() || null,
      application_steps: form.application_steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      gender_requirement: form.gender_requirement,
      is_active: true,
    };

    try {
      if (editingId) {
        await updateScholarship(token, editingId, payload);
        showToast('Scholarship updated and re-indexed in ChromaDB');
      } else {
        await createScholarship(token, {
          ...payload,
          id: form.id.trim() || undefined,
        });
        showToast('Scholarship created and indexed in ChromaDB');
      }
      setModalOpen(false);
      await loadDashboardData(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVerification = async (sch: Scholarship) => {
    const nextStatus: SourceStatus = sch.source_status === 'verified' ? 'sample' : 'verified';
    try {
      await updateScholarship(token, sch.id, {
        source_status: nextStatus,
        last_verified: nextStatus === 'verified' ? new Date().toISOString().slice(0, 10) : sch.last_verified,
      });
      showToast(`Marked as ${nextStatus}`);
      await loadDashboardData(token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDeleteScholarship = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This removes it from SQLite and ChromaDB.`)) return;
    try {
      await deleteScholarship(token, id);
      showToast('Scholarship deleted');
      await loadDashboardData(token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleUploadPdf = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;
    setUploadingPdf(true);
    setPdfError(null);
    try {
      await uploadPdfDocument(token, pdfFile, pdfScholarshipId || undefined);
      setPdfFile(null);
      setPdfScholarshipId('');
      showToast('PDF extracted & indexed into ChromaDB');
      await loadDashboardData(token);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF ingestion failed');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteIngestedDocument(token, docId);
      showToast('Document deleted from ChromaDB');
      await loadDashboardData(token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  if (!adminUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Console</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">JWT Authenticated Management</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm"
              />
            </div>

            {authError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Credentials are configured in backend <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">.env</code> (<code className="px-1 rounded bg-slate-100 dark:bg-slate-800">ADMIN_USERNAME</code> / <code className="px-1 rounded bg-slate-100 dark:bg-slate-800">ADMIN_PASSWORD</code>).
            </p>
          </form>
        </div>
      </div>
    );
  }

  const filteredScholarships = scholarships.filter(
    (s) =>
      !searchFilter.trim() ||
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.provider.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Signed in as <strong>{adminUser}</strong> · Changes sync immediately to SQLite, Knowledge Graph &amp; ChromaDB
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 self-start"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'scholarships', label: `Scholarships (${scholarships.length})`, icon: Database },
          { id: 'documents', label: `PDF Ingestion (${documents.length})`, icon: FileUp },
          { id: 'analytics', label: 'Analytics & Failed Searches', icon: BarChart3 },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Scholarships CRUD */}
      {tab === 'scholarships' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter scholarships table..."
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm sm:w-80"
            />
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setFormError(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Scholarship
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-4 font-bold">Scholarship</th>
                  <th className="py-3 px-4 font-bold">Type / Basis</th>
                  <th className="py-3 px-4 font-bold">Verification</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredScholarships.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                      <p className="text-[11px] text-slate-500">{s.provider}</p>
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {s.type} · {s.basis}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleVerification(s)}
                        title="Click to toggle verified/sample status"
                      >
                        <SourceBadge status={s.source_status} lastVerified={s.last_verified} compact />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(s.id);
                          setForm(toFormState(s));
                          setFormError(null);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScholarship(s.id, s.name)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2.5 py-1 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: PDF Ingestion */}
      {tab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleUploadPdf}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-600" />
              Upload Official PDF Circular
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extracts text via PyPDF, splits into overlapping chunks, embeds, and indexes into ChromaDB for RAG citations.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">PDF File (.pdf, max 15 MB)</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Link to Scholarship (Optional)</label>
              <select
                value={pdfScholarshipId}
                onChange={(e) => setPdfScholarshipId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">General / Unlinked Circular</option>
                {scholarships.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {pdfError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                {pdfError}
              </div>
            )}
            <button
              type="submit"
              disabled={uploadingPdf || !pdfFile}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingPdf ? 'Extracting & Indexing...' : 'Upload & Ingest PDF'}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Indexed PDF Documents ({documents.length})
            </h2>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500">No PDF circulars uploaded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{d.original_filename}</p>
                      <p className="text-[11px] text-slate-500">
                        {d.chunk_count} chunks · {d.char_count.toLocaleString()} chars · {d.scholarship_id || 'General'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(d.id)}
                      className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg"
                      aria-label="Delete PDF"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Analytics & Failed Searches */}
      {tab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Searches', value: analytics.total_searches },
              { label: 'AI Chat Turns', value: analytics.total_chats },
              { label: 'Eligibility Checks', value: analytics.total_eligibility_checks },
              { label: 'Failed Searches (0 hits)', value: analytics.failed_searches_count },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Verification &amp; Vector Store Status
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Verified Schemes</span>
                  <strong>{analytics.verified_count}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Sample Schemes</span>
                  <strong>{analytics.sample_count}</strong>
                </div>
                <div className="flex justify-between">
                  <span>ChromaDB Indexed Scholarships</span>
                  <strong>{analytics.vector_counts.scholarships_indexed}</strong>
                </div>
                <div className="flex justify-between">
                  <span>ChromaDB Indexed PDF Chunks</span>
                  <strong>{analytics.vector_counts.document_chunks_indexed}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Embedding Mode</span>
                  <strong className="uppercase">{analytics.vector_counts.embedding_mode}</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold mb-2">Intent Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(analytics.intent_breakdown).map(([k, v]) => (
                    <span key={k} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs">
                      {k}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Recent Failed Searches (Content Gaps)
              </h2>
              {analytics.recent_failed_searches.length === 0 ? (
                <p className="text-xs text-slate-500">No zero-result searches recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analytics.recent_failed_searches.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{f.query}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{f.endpoint}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Scholarship' : 'Add New Scholarship'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveScholarship} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!editingId && (
                  <div>
                    <label className="block font-semibold mb-1">Slug ID (optional)</label>
                    <input
                      type="text"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      placeholder="auto-generated if empty"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                )}
                <div className={editingId ? 'sm:col-span-2' : ''}>
                  <label className="block font-semibold mb-1">Scholarship Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Provider Organization *</label>
                  <input
                    type="text"
                    required
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Official URL *</label>
                  <input
                    type="url"
                    required
                    value={form.official_url}
                    onChange={(e) => setForm({ ...form, official_url: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as ScholarshipType })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  >
                    <option value="government">government</option>
                    <option value="private">private</option>
                    <option value="university">university</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Basis</label>
                  <select
                    value={form.basis}
                    onChange={(e) => setForm({ ...form, basis: e.target.value as ScholarshipBasis })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  >
                    <option value="merit">merit</option>
                    <option value="need">need</option>
                    <option value="category">category</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Education Levels (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    value={form.education_level}
                    onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Courses (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    value={form.course}
                    onChange={(e) => setForm({ ...form, course: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.min_percentage}
                    onChange={(e) => setForm({ ...form, min_percentage: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min CGPA (0-10)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.min_cgpa}
                    onChange={(e) => setForm({ ...form, min_cgpa: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Max Family Income (₹ INR)</label>
                  <input
                    type="number"
                    value={form.max_family_income}
                    onChange={(e) => setForm({ ...form, max_family_income: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount / Benefit</label>
                  <input
                    type="text"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">States (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    value={form.states}
                    onChange={(e) => setForm({ ...form, states: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Categories (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    value={form.categories}
                    onChange={(e) => setForm({ ...form, categories: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Deadline (YYYY-MM-DD or blank)</label>
                  <input
                    type="text"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    placeholder="Leave blank if unconfirmed"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Source Status</label>
                  <select
                    value={form.source_status}
                    onChange={(e) => setForm({ ...form, source_status: e.target.value as SourceStatus })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  >
                    <option value="verified">verified</option>
                    <option value="sample">sample</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Required Documents (comma-separated)</label>
                <input
                  type="text"
                  value={form.required_documents}
                  onChange={(e) => setForm({ ...form, required_documents: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>

              {formError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 px-3 py-2 text-rose-700 dark:text-rose-200">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Scholarship' : 'Create Scholarship'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
