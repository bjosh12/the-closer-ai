import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ajzoaozjhkhrpxsclcoi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqem9hb3pqaGtocnB4c2NsY29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTI3OTAsImV4cCI6MjA5MjYyODc5MH0.EKMKY62X-UiqYuk0MmmCxozED-H2FLdAsUde4L8V3Kk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface CloudSyncHelpers {
  signIn: (email: string, password: string) => Promise<{ user: any; error: any }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ user: any; session: any; error: any }>;
  signOut: () => Promise<void>;
  getUser: () => Promise<any>;
  getAuthSession: () => Promise<any>;
  getProfile: (userId: string) => Promise<any>;
  syncDocument: (doc: { id: string; title: string; content: string }, userId: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  getDocuments: (userId: string) => Promise<any[]>;
  syncSession: (session: any, userId: string) => Promise<void>;
  getSessions: (userId: string) => Promise<any[]>;
  incrementMinutes: (userId: string, minutes: number) => Promise<void>;
  checkTrial: (userId: string) => Promise<{ new_minutes: number, next_reset: string } | null>;
  verifyLicense: (licenseKey: string, machineId: string, userId?: string) => Promise<{ data: any, error: any }>;
}

export const cloudSync: CloudSyncHelpers = {
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user ?? null, error };
  },

  signUp: async (email, password, metadata) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: metadata
      }
    });
    return { user: data?.user ?? null, session: data?.session ?? null, error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  getAuthSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  getProfile: async (userId: string) => {
    const { data } = await supabase.from('profiles').select('resume_text,resume_filename,plan,total_session_minutes').eq('user_id', userId).single();
    return data ?? null;
  },

  syncDocument: async (doc, userId) => {
    await supabase.from('documents').upsert({
      id: doc.id,
      user_id: userId,
      title: doc.title,
      content: doc.content,
      created_at: new Date().toISOString()
    });
  },

  deleteDocument: async (id) => {
    await supabase.from('documents').delete().eq('id', id);
  },

  getDocuments: async (userId) => {
    const { data } = await supabase.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  },

  syncSession: async (session, userId) => {
    await supabase.from('sessions').upsert({
      id: session.id,
      user_id: userId,
      job_title: session.job_title,
      company_name: session.company_name,
      job_description: session.job_description,
      interview_type: session.interview_type,
      language: session.language,
      created_at: session.created_at
    });
  },

  getSessions: async (userId) => {
    const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  },

  incrementMinutes: async (userId: string, minutes: number) => {
    await supabase.rpc('increment_session_minutes', { uid: userId, mins: minutes });
  },

  checkTrial: async (userId: string) => {
    const { data } = await supabase.rpc('check_and_reset_trial', { uid: userId });
    return (data && data[0]) ? data[0] : null;
  },

  verifyLicense: async (licenseKey: string, machineId: string, userId?: string) => {
    return await supabase.rpc('activate_license', { 
      key_text: licenseKey, 
      hw_id: machineId,
      cloud_uid: userId || null
    });
  }
};
