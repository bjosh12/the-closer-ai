export function buildScorecardPrompt(resume: string, jd: string, transcripts: string[]) {
  return `
You are an expert interview evaluator. Review the following interview transcript where "Interviewer" asks questions and "You" (the candidate) answers.
Evaluate the candidate's performance based on their resume and the job description.

=== Job Description ===
${jd}

=== Candidate Resume ===
${resume}

=== Interview Transcript ===
${transcripts.join('\n')}

Generate a comprehensive Scorecard for the candidate. Use the following markdown structure:
# Overall Score: [0-100]/100

## Strengths
- Point 1
- Point 2

## Areas for Improvement
- Point 1
- Point 2

## Detailed Feedback
(Provide a brief paragraph analyzing their technical accuracy, conciseness, and delivery)
`;
}

export interface LLMProvider {
  generateAnswer(prompt: string, context: string, model: string): Promise<string>;
  generateAnswerStream(
    question: string,
    systemPrompt: string,
    model: string,
    onChunk: (partial: string, full: string) => void,
    onDone: (full: string) => void,
    onError: (err: string) => void
  ): Promise<void>;
  generateScorecard(resume: string, jd: string, transcripts: any[]): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get isProxy() { return this.apiKey.startsWith('ey-'); }
  private get token() { return this.isProxy ? this.apiKey.substring(3) : this.apiKey; }
  private get url() { return this.isProxy ? 'https://project-vw750.vercel.app/api/desktop/openai' : 'https://api.openai.com/v1/chat/completions'; }

  async generateScorecard(resume: string, jd: string, transcripts: any[]): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') return "Error: API Key missing.";

    const formattedTranscripts = transcripts.map(t => `${t.speaker}: ${t.text}`);
    const prompt = buildScorecardPrompt(resume, jd, formattedTranscripts);

    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` };
      const bodyStr = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      let data;
      if ((window as any).electronAPI && this.isProxy) {
        const res = await (window as any).electronAPI.url.post(this.url, headers, bodyStr);
        if (!res.ok) throw new Error(res.error || 'Failed to fetch');
        data = res.data;
      } else {
        const response = await fetch(this.url, { method: 'POST', headers, body: bodyStr });
        if (!response.ok) throw new Error(response.statusText);
        data = await response.json();
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      return `Error generating scorecard: ${error.message}`;
    }
  }

  async generateAnswer(question: string, systemPrompt: string, model: string = 'gpt-4o-mini'): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      return "Error: Please add your OpenAI API Key in Settings to generate answers.";
    }

    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` };
      const bodyStr = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 350,
        temperature: 0.7,
      });

      let data;
      if ((window as any).electronAPI && this.isProxy) {
        const res = await (window as any).electronAPI.url.post(this.url, headers, bodyStr);
        if (!res.ok) throw new Error(`OpenAI API Error: ${res.error}`);
        data = res.data;
      } else {
        const response = await fetch(this.url, { method: 'POST', headers, body: bodyStr });
        if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`);
        data = await response.json();
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      console.error('LLM Generation Error:', error);
      return `Error generating response: ${error.message}`;
    }
  }

  async generateAnswerStream(
    question: string,
    systemPrompt: string,
    model: string = 'gpt-4o-mini',
    onChunk: (partial: string, full: string) => void,
    onDone: (full: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      onError("Error: Please add your OpenAI API Key in Settings to generate answers.");
      return;
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` };

    try {
      if ((window as any).electronAPI && this.isProxy) {
        // Proxy path: proxy server doesn't support SSE streaming, use regular request
        const bodyStr = JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          max_tokens: 350,
          temperature: 0.7,
        });
        const res = await (window as any).electronAPI.url.post(this.url, headers, bodyStr);
        if (!res.ok) throw new Error(res.error || 'API Error');
        const text = res.data.choices[0].message.content;
        onDone(text);
      } else {
        const bodyStr = JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          max_tokens: 350,
          temperature: 0.7,
          stream: true,
        });
        // Direct path: browser fetch with ReadableStream
        const response = await fetch(this.url, { method: 'POST', headers, body: bodyStr });
        if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let full = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              const token = data.choices?.[0]?.delta?.content || '';
              if (token) {
                full += token;
                onChunk(token, full);
              }
            } catch {}
          }
        }
        onDone(full);
      }
    } catch (error: any) {
      console.error('LLM Stream Error:', error);
      onError(`Error generating response: ${error.message}`);
    }
  }
}

export function buildPrompt(
  resume: string,
  jd: string,
  recentTranscripts: string[],
  question: string,
  _interviewType: 'behavioral' | 'technical' = 'behavioral',
  language: string = 'en',
  documents: { title: string; content: string }[] = [],
  extraInstructions: string = ''
): string {
  const langMap: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German'
  };
  const targetLang = langMap[language] || 'English';

  return `
You are an invisible interview coach whispering answers into a candidate's ear during a live interview.

YOUR JOB: Give them a natural, speakable answer they can say out loud — word for word if needed.

RULES:
- Write 3-4 bullet points. Each bullet is one complete sentence they can speak aloud.
- Sound like a real person talking, not an essay or a LinkedIn post.
- Ground every answer in facts from their resume. Never invent employers, projects, or numbers.
- Keep the whole answer under 100 words total.
- No headers, no labels like "Start with:", no emojis.
- First bullet answers the question directly. Remaining bullets add evidence or context.
${extraInstructions ? `- ${extraInstructions}` : ''}

EXAMPLE — "Why did you leave your current job?":
- I'm looking for new challenges and a faster-moving environment than where I am now.
- I've learned a lot at my current company, but I'm ready to take on more ownership and scope.
- A company like this, where things are growing fast, is exactly what I've been looking for.

CONTEXT:
=== Language ===
${targetLang}

=== Job Description ===
${jd || '(not provided)'}

=== Candidate Resume ===
${resume || '(not provided)'}
${documents.length > 0 ? `\n=== Knowledge Base ===\n${documents.map(d => `${d.title}:\n${d.content}`).join('\n\n')}\n` : ''}
=== Recent Conversation ===
${recentTranscripts.join('\n') || '(none yet)'}

=== Question ===
${question}

Respond in ${targetLang}. Bullet points only. No preamble.
`;
}
