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
          max_tokens: 400,
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
          max_tokens: 400,
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

  return `You are a live interview coach. Your job is to write bullet points the candidate can read and say out loud naturally, as if they're speaking — not reading from a resume.

STYLE: Warm, first-person, conversational. Like how a confident person actually talks in an interview. Complete thoughts, natural flow. Reference the candidate's real experience AND the target company when relevant.

FORMAT: Output ONLY a bullet list. No intro, no headers, no closing line. Each bullet starts with "- ".
- 3 to 5 bullets depending on the question
- Each bullet is 1-2 complete sentences (not fragments, not one-word answers)
- Avoid hollow filler: "leverage synergies", "results-driven", "go-getter"
${extraInstructions ? `- Tone note: ${extraInstructions}` : ''}

EXAMPLE — "Tell me about yourself" (notice the tone and sentence length):
- I've been in recruitment for about four years, mostly in hospitality and healthcare — both remote and on-site roles.
- At BroadPath I built out their remote healthcare staffing from scratch, filling things like enrollment specialists and claims processors under tight project deadlines.
- At Stratton I moved into luxury hospitality, where I got really good at screening for culture fit and working closely with hiring managers on what they actually needed.
- Now I'm ready for a bigger challenge, and a company like [Company] — where there's real growth happening — is exactly what I've been looking for.

EXAMPLE — "Why did you leave your current job?" (notice it references the target company):
- I'm looking for new challenges and a chance to grow, especially in a faster-moving environment.
- While I've genuinely enjoyed my current role and learned a lot, I feel ready to take on more responsibility and work at a larger scale.
- I'm excited about the opportunity at [Company] specifically — it feels like a place where my recruitment experience can make a real impact as the business grows.

---
Resume: ${resume || '(not provided)'}
Job Description: ${jd || '(not provided)'}
Company: ${jd ? (jd.match(/company[:\s]+([^\n,]+)/i)?.[1] || '') : ''}
${documents.length > 0 ? `Additional context: ${documents.map(d => `${d.title}: ${d.content.slice(0, 300)}`).join(' | ')}\n` : ''}Recent conversation: ${recentTranscripts.slice(-3).join(' | ') || 'none'}
Language: ${targetLang}

Question: "${question}"

Write the bullet list in ${targetLang}:`;
}
