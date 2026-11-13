import type {
  AdminAnalytics,
  AdminLoginResponse,
  ChatResponse,
  EligibilityCheckResponse,
  HealthResponse,
  IngestedDocument,
  Scholarship,
  ScholarshipDetail,
  ScholarshipListResponse,
  SearchResponse,
  StatsResponse,
  StudentProfile,
} from '../types/scholarship';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') {
        message = body.detail;
      } else if (typeof body?.error === 'string') {
        message = body.error;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}

export function fetchStats(): Promise<StatsResponse> {
  return request<StatsResponse>('/api/stats');
}

export interface ScholarshipQueryParams {
  q?: string;
  type?: string;
  basis?: string;
  education_level?: string;
  course?: string;
  state?: string;
  category?: string;
  max_income?: number;
  source_status?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      sp.set(key, String(val));
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export function fetchScholarships(params: ScholarshipQueryParams = {}): Promise<ScholarshipListResponse> {
  return request<ScholarshipListResponse>(`/api/scholarships${buildQuery(params as Record<string, string | number | undefined>)}`);
}

export function fetchScholarshipDetail(id: string): Promise<ScholarshipDetail> {
  return request<ScholarshipDetail>(`/api/scholarships/${encodeURIComponent(id)}`);
}

export function searchScholarships(params: {
  q: string;
  type?: string;
  basis?: string;
  education_level?: string;
  course?: string;
  state?: string;
  category?: string;
  max_income?: number;
  source_status?: string;
  limit?: number;
}): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/search${buildQuery(params)}`);
}

export function checkEligibility(profile: StudentProfile): Promise<EligibilityCheckResponse> {
  return request<EligibilityCheckResponse>('/api/eligibility/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
}

export function sendChatMessage(payload: {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  profile_context?: StudentProfile | null;
}): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  return request<AdminLoginResponse>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export function fetchAdminMe(token: string): Promise<{ username: string; role: string }> {
  return request('/api/admin/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createScholarship(
  token: string,
  data: Omit<Scholarship, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Scholarship> {
  return request<Scholarship>('/api/admin/scholarships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function updateScholarship(
  token: string,
  id: string,
  data: Partial<Scholarship>
): Promise<Scholarship> {
  return request<Scholarship>(`/api/admin/scholarships/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function deleteScholarship(token: string, id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/admin/scholarships/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function uploadPdfDocument(
  token: string,
  file: File,
  scholarshipId?: string
): Promise<IngestedDocument> {
  const form = new FormData();
  form.append('file', file);
  if (scholarshipId) {
    form.append('scholarship_id', scholarshipId);
  }
  return request<IngestedDocument>('/api/admin/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

export function fetchIngestedDocuments(token: string): Promise<IngestedDocument[]> {
  return request<IngestedDocument[]>('/api/admin/documents', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteIngestedDocument(token: string, docId: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/api/admin/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchAdminAnalytics(token: string): Promise<AdminAnalytics> {
  return request<AdminAnalytics>('/api/admin/analytics', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
