import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Store DB in the app userData directory so it persists across updates
const dbDir = path.join(app.getPath('userData'), 'InterviewCopilot');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'app.db');
const db = new Database(dbPath);

// Initialize Schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, 
      email TEXT, 
      name TEXT
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, 
      user_id TEXT, 
      resume_text TEXT, 
      parsed_resume JSON, 
      default_style TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, 
      user_id TEXT, 
      job_title TEXT, 
      company_name TEXT, 
      job_description TEXT, 
      interview_type TEXT, 
      language TEXT,
      created_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY, 
      session_id TEXT, 
      speaker TEXT, 
      text TEXT, 
      start_time REAL, 
      end_time REAL, 
      is_final BOOLEAN
    );
    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      trigger_transcript_id TEXT,
      question_text TEXT,
      generated_text TEXT,
      mode TEXT,
      created_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      title TEXT,
      company TEXT,
      jd_text TEXT,
      created_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      created_at DATETIME
    );
  `);
}

initDB();

// Migrations for existing databases — safe to re-run, errors are swallowed
try { db.prepare('ALTER TABLE answers ADD COLUMN question_text TEXT').run(); } catch(_e) {}
try { db.prepare('ALTER TABLE sessions ADD COLUMN language TEXT').run(); } catch(_e) {}

export const dbHelpers = {
  getSessions: () => {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    return stmt.all();
  },
  createSession: (session: any) => {
    try {
      // Gracefully handle older schemas by attempting to add column if missing
      db.prepare('ALTER TABLE sessions ADD COLUMN language TEXT').run();
    } catch(e) {}
    
    const stmt = db.prepare('INSERT INTO sessions (id, user_id, job_title, company_name, job_description, interview_type, language, created_at) VALUES (@id, @user_id, @job_title, @company_name, @job_description, @interview_type, @language, @created_at)');
    stmt.run({ ...session, language: session.language || 'en' });
  },
  getSession: (id: string) => {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id);
  },
  saveTranscript: (transcript: any) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO transcripts (id, session_id, speaker, text, start_time, end_time, is_final) VALUES (@id, @session_id, @speaker, @text, @start_time, @end_time, @is_final)');
    stmt.run(transcript);
  },
  getTranscripts: (sessionId: string) => {
    const stmt = db.prepare('SELECT * FROM transcripts WHERE session_id = ? ORDER BY start_time ASC');
    return stmt.all(sessionId);
  },
  saveAnswer: (answer: any) => {
    const stmt = db.prepare('INSERT INTO answers (id, session_id, trigger_transcript_id, question_text, generated_text, mode, created_at) VALUES (@id, @session_id, @trigger_transcript_id, @question_text, @generated_text, @mode, @created_at)');
    stmt.run({ ...answer, question_text: answer.question_text ?? null });
  },
  getAnswers: (sessionId: string) => {
    const stmt = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY created_at ASC');
    return stmt.all(sessionId);
  },
  getProfile: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ?');
    return stmt.get(userId);
  },
  saveProfile: (profile: any) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO profiles (id, user_id, resume_text, parsed_resume, default_style) VALUES (@id, @user_id, @resume_text, @parsed_resume, @default_style)');
    stmt.run(profile);
  },
  getTemplates: () => {
    const stmt = db.prepare('SELECT * FROM templates ORDER BY created_at DESC');
    return stmt.all();
  },
  saveTemplate: (template: any) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO templates (id, title, company, jd_text, created_at) VALUES (@id, @title, @company, @jd_text, @created_at)');
    stmt.run(template);
  },
  deleteTemplate: (id: string) => {
    const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
    stmt.run(id);
  },
  getDocuments: () => {
    const stmt = db.prepare('SELECT * FROM documents ORDER BY created_at DESC');
    return stmt.all();
  },
  saveDocument: (document: any) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO documents (id, title, content, created_at) VALUES (@id, @title, @content, @created_at)');
    stmt.run(document);
  },
  deleteDocument: (id: string) => {
    const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
    stmt.run(id);
  }
};
