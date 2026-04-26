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
        oaKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        
        // If no local key, try cloud proxy
        const hasLocalKey = oaKey && oaKey !== 'mock_key';
        if (!hasLocalKey) {
          const state = useStore.getState();
          if (state.cloudUser) {
            try {
              const session = await (window as any).electronAPI.cloud.getAuthSession();
              if (session?.access_token) {
                const res = await fetch('https://project-vw750.vercel.app/api/desktop/openai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                  body: JSON.stringify({ model: 'gpt-4o-mini', messages: [], max_tokens: 1 })
                });
                if (res.ok || res.status === 401) {
                  // Proxy is reachable — use proxy token
                  oaKey = `ey-${session.access_token}`;
                }
              }
            } catch (e) {
              console.error('[Scorecard] Cloud proxy check failed:', e);
            }
          }
        }
      }

      const llm = new OpenAIProvider(oaKey || 'mock_key');
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
