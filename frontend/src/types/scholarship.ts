export type ScholarshipType = 'government' | 'private' | 'university';
export type ScholarshipBasis = 'merit' | 'need' | 'category';
export type SourceStatus = 'verified' | 'sample';
export type GenderRequirement = 'All' | 'Female' | 'Male';

export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  type: ScholarshipType;
  basis: ScholarshipBasis;
  education_level: string[];
  course: string[];
  min_percentage: number | null;
  min_cgpa: number | null;
  max_family_income: number | null;
  states: string[];
  categories: string[];
  amount: string | null;
  required_documents: string[];
  deadline: string | null;
  official_url: string;
  source_status: SourceStatus;
  last_verified: string | null;
  description?: string | null;
  eligibility_notes?: string | null;
  application_steps: string[];
  gender_requirement?: GenderRequirement | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KnowledgeEdge {
  source_type: string;
  source_id: string;
  relation: string;
  target_type: string;
  target_id: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface IngestedDocument {
  id: string;
  filename: string;
  original_filename: string;
  scholarship_id: string | null;
  chunk_count: number;
  char_count: number;
  uploaded_by: string;
  created_at: string;
}

export interface ScholarshipDetail extends Scholarship {
  knowledge_graph: {
    scholarship_id: string;
    nodes: Array<{ id: string; type: string; label: string }>;
    edges: KnowledgeEdge[];
  };
  related_documents: IngestedDocument[];
}

export interface ScholarshipListResponse {
  items: Scholarship[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StatsResponse {
  total_scholarships: number;
  verified_count: number;
  sample_count: number;
  government_count: number;
  private_count: number;
  university_count: number;
  states_covered: number;
  demo_mode: boolean;
  filter_options: {
    states: string[];
    courses: string[];
    education_levels: string[];
    categories: string[];
  };
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  demo_mode: boolean;
  chat_model: string;
  embedding_model: string;
  scholarships_indexed: number;
  document_chunks_indexed: number;
  embedding_mode: string;
}

export interface StudentProfile {
  education_level?: string | null;
  course?: string | null;
  percentage?: number | null;
  cgpa?: number | null;
  family_income?: number | null;
  state?: string | null;
  category?: string | null;
  gender?: string | null;
}

export interface EligibilityEvaluation {
  scholarship: Scholarship;
  status: 'eligible' | 'potentially_eligible' | 'not_eligible';
  met_conditions: string[];
  unmet_conditions: string[];
  missing_requirements: string[];
  notes: string[];
}

export interface EligibilityCheckResponse {
  profile: StudentProfile;
  eligible: EligibilityEvaluation[];
  potentially_eligible: EligibilityEvaluation[];
  not_eligible: EligibilityEvaluation[];
  summary: {
    total_evaluated: number;
    eligible_count: number;
    potentially_eligible_count: number;
    not_eligible_count: number;
  };
  missing_profile_fields: string[];
  disclaimer: string;
}

export interface CitationSource {
  id: string;
  name: string;
  provider: string;
  type: string;
  basis: string;
  official_url: string;
  source_status: SourceStatus;
  last_verified: string | null;
  deadline: string | null;
  amount: string | null;
  relevance_score: number;
  eligibility_status?: 'eligible' | 'potentially_eligible' | 'not_eligible' | null;
  snippet?: string | null;
}

export interface AgentTraceStep {
  stage: string;
  title: string;
  detail: string;
}

export interface AgentExplanationTrace {
  intent: string;
  extracted_entities: Record<string, unknown>;
  sources_used: string[];
  provider_mode: string;
  steps: AgentTraceStep[];
}

export interface ChatResponse {
  answer: string;
  intent: string;
  sources: CitationSource[];
  eligibility_reasoning?: string | null;
  confidence: 'High' | 'Medium' | 'Low';
  limitations: string[];
  follow_up_questions: string[];
  extracted_profile: StudentProfile;
  privacy_warnings: string[];
  disclaimer: string;
  demo_mode: boolean;
  trace: AgentExplanationTrace;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: Omit<ChatResponse, 'answer'>;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  profileContext: StudentProfile;
}

export interface SearchHit {
  scholarship: Scholarship;
  score: number;
  semantic_score: number;
  keyword_score: number;
  matched_reasons: string[];
}

export interface SearchResponse {
  query: string;
  total: number;
  confidence: string;
  results: SearchHit[];
  document_chunks: Array<{
    chunk_id: string;
    doc_id: string;
    filename: string;
    scholarship_id: string | null;
    text: string;
    score: number;
  }>;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: string;
}

export interface AdminAnalytics {
  total_scholarships: number;
  verified_count: number;
  sample_count: number;
  total_searches: number;
  total_chats: number;
  total_eligibility_checks: number;
  failed_searches_count: number;
  recent_failed_searches: Array<{
    id: number;
    query: string;
    endpoint: string;
    intent: string | null;
    created_at: string;
  }>;
  intent_breakdown: Record<string, number>;
  type_breakdown: Record<string, number>;
  vector_counts: {
    scholarships_indexed: number;
    document_chunks_indexed: number;
    embedding_mode: string;
  };
  ingested_documents_count: number;
}

export interface DeadlineReminder {
  scholarshipId: string;
  scholarshipName: string;
  reminderDate: string;
  note: string;
  officialUrl: string;
}
