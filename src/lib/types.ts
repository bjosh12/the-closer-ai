export interface Session {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  job_description: string;
  interview_type: string;
  language: string;
  created_at: string;
}

export interface Transcript {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
  is_final: boolean;
}

export interface Answer {
  id: string;
  session_id: string;
  trigger_transcript_id: string;
  question_text: string;
  generated_text: string;
  mode: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  resume_text: string;
  parsed_resume: string; // JSON string
  default_style: string;
}
