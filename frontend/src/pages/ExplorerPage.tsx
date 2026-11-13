import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  FileText,
  Filter,
  RotateCcw,
  Search,
  AlertCircle,
} from 'lucide-react';
import { ScholarshipCard } from '../components/ScholarshipCard';
import { fetchScholarships, fetchStats, searchScholarships } from '../services/api';
import { exportToCSV, formatINR, printReportAsPDF } from '../services/export';
import type { Scholarship, StatsResponse } from '../types/scholarship';

export function ExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [basisFilter, setBasisFilter] = useState(searchParams.get('basis') || '');
  const [levelFilter, setLevelFilter] = useState(searchParams.get('education_level') || '');
  const [courseFilter, setCourseFilter] = useState(searchParams.get('course') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [sourceStatusFilter, setSourceStatusFilter] = useState(searchParams.get('source_status') || '');
  const [maxIncome, setMaxIncome] = useState(searchParams.get('max_income') || '');
  const [sortBy, setSortBy] = useState('verified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [items, setItems] = useState<Scholarship[]>([]);
  const [matchedReasonsMap, setMatchedReasonsMap] = useState<Record<string, string[]>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
  }, []);

  const loadResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanQ = query.trim();
      const parsedIncome = maxIncome ? Number(maxIncome) : undefined;
      if (cleanQ && sortBy === 'verified') {
        // Use hybrid semantic + keyword search when user enters a natural query
        const res = await searchScholarships({
          q: cleanQ,
          type: typeFilter || undefined,
          basis: basisFilter || undefined,
          education_level: levelFilter || undefined,
          course: courseFilter || undefined,
          state: stateFilter || undefined,
          category: categoryFilter || undefined,
          source_status: sourceStatusFilter || undefined,
          max_income: parsedIncome,
          limit: 30,
        });
        const reasons: Record<string, string[]> = {};
        const hits = res.results.map((h) => {
          reasons[h.scholarship.id] = h.matched_reasons;
          return h.scholarship;
        });
        const pageSize = 9;
        const start = (page - 1) * pageSize;
        setMatchedReasonsMap(reasons);
        setItems(hits.slice(start, start + pageSize));
        setTotal(hits.length);
        setTotalPages(Math.max(1, Math.ceil(hits.length / pageSize)));
      } else {
        const res = await fetchScholarships({
          q: cleanQ || undefined,
          type: typeFilter || undefined,
          basis: basisFilter || undefined,
          education_level: levelFilter || undefined,
          course: courseFilter || undefined,
          state: stateFilter || undefined,
          category: categoryFilter || undefined,
          source_status: sourceStatusFilter || undefined,
          max_income: parsedIncome,
          sort_by: sortBy,
          sort_order: sortOrder,
          page,
          page_size: 9,
        });
        setMatchedReasonsMap({});
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scholarships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, basisFilter, levelFilter, courseFilter, stateFilter, categoryFilter, sourceStatusFilter, maxIncome, sortBy, sortOrder, page]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (query.trim()) {
      setSearchParams({ q: query.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    loadResults();
  };

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('');
    setBasisFilter('');
    setLevelFilter('');
    setCourseFilter('');
    setStateFilter('');
    setCategoryFilter('');
    setSourceStatusFilter('');
    setMaxIncome('');
    setSortBy('verified');
    setSortOrder('asc');
    setPage(1);
    setSearchParams({}, { replace: true });
  };

  const handleExportCSV = () => {
    exportToCSV(
      'scholarai-scholarships.csv',
      ['Name', 'Provider', 'Type', 'Basis', 'Max Income (INR)', 'Amount', 'Deadline', 'Status', 'Official URL'],
      items.map((s) => [
        s.name,
        s.provider,
        s.type,
        s.basis,
        s.max_family_income ?? 'No cap',
        s.amount || 'Not available',
        s.deadline || 'Not available',
        s.source_status,
        s.official_url,
      ])
    );
  };

  const handleExportPDF = () => {
    const html = items
      .map(
        (s) => `
      <div class="card">
        <div><strong>${s.name}</strong> <span class="badge ${s.source_status}">${s.source_status === 'verified' ? 'Verified' : 'Sample data – verify on official site'}</span></div>
        <div class="meta">${s.provider} · ${s.type} / ${s.basis} · Income Cap: ${formatINR(s.max_family_income)}</div>
        <div>Benefit: ${s.amount || 'Not available'} | Deadline: ${s.deadline || 'Not available'}</div>
        <div class="meta">Portal: ${s.official_url}</div>
      </div>`
      )
      .join('');
    printReportAsPDF('ScholarAI Scholarship Explorer Export', `Showing ${items.length} filtered schemes`, html);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Scholarship Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Search using natural language (ChromaDB semantic + keyword hybrid) or filter by state, income, course &amp; category.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Search & Filter Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs mb-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search e.g. B.Tech student 8.5 CGPA below 3 lakh, AICTE, Maharashtra..."
              aria-label="Search scholarships"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <select
            aria-label="Filter by provider type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Types</option>
            <option value="government">Government</option>
            <option value="private">Private Foundation</option>
            <option value="university">University</option>
          </select>

          <select
            aria-label="Filter by scholarship basis"
            value={basisFilter}
            onChange={(e) => { setBasisFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Basis</option>
            <option value="merit">Merit-Based</option>
            <option value="need">Need / Means</option>
            <option value="category">Category / Special</option>
          </select>

          <select
            aria-label="Filter by education level"
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Education Levels</option>
            {(stats?.filter_options.education_levels || ['UG', 'PG', 'Diploma', 'Class 11-12', 'PhD']).map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </select>

          <select
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Courses</option>
            <option value="B.Tech">B.Tech / B.E.</option>
            <option value="CSE">CSE / AI&amp;ML</option>
            <option value="Diploma">Diploma</option>
            <option value="M.Tech">M.Tech / PG</option>
          </select>

          <select
            aria-label="Filter by state"
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All States / India</option>
            {(stats?.filter_options.states || ['All India', 'Maharashtra', 'Uttar Pradesh', 'West Bengal', 'Karnataka', 'Tamil Nadu']).map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Categories</option>
            {['General', 'OBC', 'SC', 'ST', 'EWS', 'Minority', 'PwD'].map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            aria-label="Filter by student annual family income"
            value={maxIncome}
            onChange={(e) => { setMaxIncome(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">Any Family Income</option>
            <option value="200000">My income ≤ ₹2.0 Lakh</option>
            <option value="250000">My income ≤ ₹2.5 Lakh</option>
            <option value="300000">My income ≤ ₹3.0 Lakh</option>
            <option value="450000">My income ≤ ₹4.5 Lakh</option>
            <option value="800000">My income ≤ ₹8.0 Lakh</option>
          </select>

          <select
            aria-label="Filter by verification status"
            value={sourceStatusFilter}
            onChange={(e) => { setSourceStatusFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="">All Source Status</option>
            <option value="verified">Verified Only</option>
            <option value="sample">Sample Data Only</option>
          </select>

          <select
            aria-label="Sort scholarships"
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder((so as 'asc' | 'desc') || 'asc');
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="verified:asc">Sort: Verified / Relevance</option>
            <option value="name:asc">Sort: Name (A → Z)</option>
            <option value="name:desc">Sort: Name (Z → A)</option>
            <option value="income_limit:asc">Sort: Lowest Income Cap</option>
            <option value="income_limit:desc">Sort: Highest Income Cap</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Showing {items.length} of {total} matching scholarships
          </span>
        </div>
      </div>

      {/* Results Area */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={loadResults}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-5"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <Search className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
            No scholarships matched your filters
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try clearing one or more filters or broadening your search query.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((sch) => (
              <ScholarshipCard
                key={sch.id}
                scholarship={sch}
                matchedReasons={matchedReasonsMap[sch.id]}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
