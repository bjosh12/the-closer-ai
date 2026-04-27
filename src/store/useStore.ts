import { create } from 'zustand';
import { Session, Transcript, Answer, Profile } from '@/lib/types';

interface AppState {
  currentView: 'onboarding' | 'home' | 'new-session' | 'live-session' | 'history' | 'settings' | 'scorecard' | 'knowledge-base' | 'cloud-login';
  profile: Profile | null;
  cloudUser: { id: string; email: string } | null;
  currentSession: Session | null;
  transcripts: Transcript[];
  answers: Answer[];
  documents: { id: string; title: string; content: string; created_at: string }[];
  isLicensed: boolean;
  licenseKey: string | null;
  
  setCurrentView: (view: AppState['currentView']) => void;
  setProfile: (profile: Profile) => void;
  setCloudUser: (user: { id: string; email: string } | null) => void;
  setLicensed: (status: boolean, key: string | null) => void;
  setCurrentSession: (session: Session) => void;
  addTranscript: (transcript: Transcript) => void;
  addAnswer: (answer: Answer) => void;
  setDocuments: (docs: any[]) => void;
  clearTranscripts: () => void;
  clearSessionData: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentView: 'cloud-login',
  profile: null,
  cloudUser: null,
  currentSession: null,
  transcripts: [],
  answers: [],
  documents: [],
  isLicensed: false,
  licenseKey: null,

  setCurrentView: (view) => set({ currentView: view }),
  setProfile: (profile) => set({ profile }),
  setCloudUser: (cloudUser) => set({ cloudUser }),
  setLicensed: (isLicensed, licenseKey) => set({ isLicensed, licenseKey }),
  setCurrentSession: (session) => set({ currentSession: session }),
  addTranscript: (transcript) => set((state) => {
    const existingIndex = state.transcripts.findIndex(t => t.id === transcript.id);
    if (existingIndex >= 0) {
      const updated = [...state.transcripts];
      updated[existingIndex] = transcript;
      return { transcripts: updated };
    }
    return { transcripts: [...state.transcripts, transcript] };
  }),
  addAnswer: (answer) => set((state) => ({ answers: [...state.answers, answer] })),
  setDocuments: (docs) => set({ documents: docs }),
  clearTranscripts: () => set({ transcripts: [], answers: [] }),
  clearSessionData: () => set({ currentSession: null, transcripts: [], answers: [] }),
}));
