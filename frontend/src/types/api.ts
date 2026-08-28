export type UserRole = "student" | "admin" | "super_admin";

export type ElectionStatus = "draft" | "open" | "closed" | "published";

export interface ClassRoom {
  id: string;
  name: string;
  level: string;
  field: string;
  created_at: string;
}

export interface Me {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  photo_url: string | null;
  is_active: boolean;
  classroom: ClassRoom | null;
}

export interface StudentBrief {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export interface Election {
  id: string;
  title: string;
  description: string | null;
  class_id: string;
  starts_at: string;
  ends_at: string;
  status: ElectionStatus;
  blockchain_id: number | null;
  created_at: string;
}

export interface Candidate {
  id: string;
  election_id: string;
  student: StudentBrief;
  slogan: string | null;
  program: string | null;
  biography: string | null;
  photo_url: string | null;
  blockchain_id: number | null;
  created_at: string;
}

export interface CandidateResult {
  candidate_id: string;
  student_id: string;
  full_name: string;
  photo_url: string | null;
  votes: number;
  percentage: number;
}

export interface ElectionResults {
  election_id: string;
  total_eligible: number;
  total_votes: number;
  blank_votes?: number;
  participation_rate: number;
  candidates: CandidateResult[];
}

export interface VoteReceipt {
  id: string;
  election_id: string;
  candidate_id: string;
  vote_hash: string;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}

export interface VoteVerification {
  valid: boolean;
  vote_hash: string;
  election_title: string | null;
  created_at: string | null;
  block_number: number | null;
  message: string;
}

export interface AdminDashboard {
  active_elections: number;
  total_votes: number;
  total_students: number;
  total_classes: number;
  participation_by_class: Array<{ class: string; votes: number }>;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
}

export interface ImportRowResult {
  row: number;
  matricule: string | null;
  status: "ok" | "skipped" | "error";
  message: string | null;
}

export interface ImportReport {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  rows: ImportRowResult[];
}

export interface NonVoter {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  is_activated: boolean;
}
