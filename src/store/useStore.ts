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
  selectedModel: string;
  extraInstructions: string;

  setCurrentView: (view: AppState['currentView']) => void;
  setProfile: (profile: Profile) => void;
  setCloudUser: (user: { id: string; email: string } | null) => void;
  setLicensed: (status: boolean, key: string | null) => void;
  setCurrentSession: (session: Session) => void;
  addTranscript: (transcript: Transcript) => void;
  addAnswer: (answer: Answer) => void;
  updateLatestAnswer: (text: string) => void;
  setDocuments: (docs: any[]) => void;
  clearTranscripts: () => void;
  clearSessionData: () => void;
  setSelectedModel: (model: string) => void;
  setExtraInstructions: (instructions: string) => void;
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
  selectedModel: 'gpt-4o-mini',
  extraInstructions: 'Use everyday words so it sounds natural.',

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
  addAnswer: (answer) => set((state) => ({ answers: [answer, ...state.answers] })),
  updateLatestAnswer: (text) => set((state) => {
    if (state.answers.length === 0) return state;
    const updated = [...state.answers];
    updated[0] = { ...updated[0], generated_text: text };
    return { answers: updated };
  }),
  setDocuments: (docs) => set({ documents: docs }),
  clearTranscripts: () => set({ transcripts: [], answers: [] }),
  clearSessionData: () => set({ currentSession: null, transcripts: [], answers: [] }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setExtraInstructions: (extraInstructions) => set({ extraInstructions }),
}));
