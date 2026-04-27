import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OpenAIProvider } from '@/lib/llm';
import ReactMarkdown from 'react-markdown';

export function Scorecard() {
  const { currentSession, transcripts, profile, setCurrentView, clearSessionData } = useStore();
  const [scorecard, setScorecard] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (!currentSession || !profile) return;

    const generate = async () => {
      let oaKey = 'mock_key';
      
      if ((window as any).electronAPI) {
        // 1. Try local key first (Lifetime mode)
        const localKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        const hasLocalKey = localKey && localKey !== 'mock_key';
        
        if (hasLocalKey) {
          oaKey = localKey;
        } else {
          // 2. Fallback to Cloud Proxy if signed in
          const state = useStore.getState();
          if (state.cloudUser) {
            try {
              const session = await (window as any).electronAPI.cloud.getAuthSession();
              if (session?.access_token) {
                oaKey = `ey-${session.access_token}`;
              }
            } catch (e) {
              console.error('[Scorecard] Cloud session retrieval failed:', e);
            }
          }
        }
      }

      if (oaKey === 'mock_key') {
        setScorecard("Error: API Key missing. Please set your OpenAI API key in Settings or ensure you are signed in to your Cloud account.");
        setIsGenerating(false);
        return;
      }

      const llm = new OpenAIProvider(oaKey);
      const result = await llm.generateScorecard(
        profile.resume_text,
        currentSession.job_description,
        transcripts
      );
      setScorecard(result);
      setIsGenerating(false);
    };

    generate();
  }, [currentSession, profile, transcripts]);

  const handleFinish = () => {
    clearSessionData();
    setCurrentView('home');
  };

  if (!currentSession) {
    return null;
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto h-screen overflow-y-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Interview Scorecard</h1>
        <Button onClick={handleFinish}>Return to Dashboard</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentSession.job_title} @ {currentSession.company_name}</CardTitle>
          <p className="text-sm text-muted-foreground">Post-Interview Evaluation</p>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <div className="text-primary animate-pulse text-xl font-semibold">Generating Scorecard...</div>
              <p className="text-muted-foreground text-sm">Evaluating your transcripts against the job description.</p>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{scorecard || "Failed to generate scorecard."}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
