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

// ─── Per-type example blocks ──────────────────────────────────────────────────

const BEHAVIORAL_EXAMPLES = `EXAMPLE — "Tell me about yourself":
- I've been in recruitment for about four years, mostly in hospitality and healthcare — both remote and on-site roles.
- At BroadPath I built out their remote healthcare staffing from scratch, filling enrollment specialists and claims processors under tight project deadlines.
- At Stratton I moved into luxury hospitality, where I got really good at screening for culture fit and working closely with hiring managers on what they actually needed.
- Now I'm ready for a bigger challenge, and a company like [Company] — where there's real growth happening — is exactly what I've been looking for.

EXAMPLE — "Why did you leave your current job?":
- I'm looking for new challenges and a chance to grow, especially in a faster-moving environment.
- While I've genuinely enjoyed my current role, I feel ready to take on more responsibility and work at a larger scale.
- I'm excited about the opportunity at [Company] specifically — it feels like a place where my background can make a real impact as the business grows.

EXAMPLE — "Tell me about a time you handled a conflict" (Situation → Action → Result):
- Situation: At [Previous Employer], a hiring manager kept changing job requirements mid-process, meaning I'd already screened 40+ candidates against the wrong criteria.
- Action: I set up a structured intake meeting, created a one-page role brief we both signed off on before sourcing, and flagged scope changes immediately with a written update.
- Result: Fill time for that manager dropped from 68 days to 41, and re-work fell by about 80% over the next six months.`;

const TECHNICAL_EXAMPLES = `EXAMPLE — "How would you scale a URL shortener?":
- Approach: Start with a single-region Postgres DB for writes and read replicas for redirect lookups — 99% of traffic is reads, so scaling reads first matters most.
- Tradeoff: A pure hash approach (MD5/base62) is fast but causes collisions; a counter-based approach is collision-free but needs distributed ID generation like Snowflake IDs.
- From my experience: At [Previous Employer] I built something similar for campaign links — the biggest bottleneck turned out to be DNS, not the DB, so I'd instrument that early.

EXAMPLE — "What's the difference between a process and a thread?":
- Approach: A process is an isolated unit of execution with its own memory space; a thread lives inside a process and shares that memory, making threads faster to create but harder to keep safe.
- Tradeoff: Threads communicate faster via shared memory but need locks to avoid race conditions; processes are safer (a crash in one doesn't kill others) but IPC adds latency.
- From my experience: I dealt with thread-safety bugs in a Python ETL pipeline — migrating hot paths to multiprocessing with queue-based IPC fixed a class of bugs and improved throughput by 3×.`;

const GENERAL_EXAMPLES = `EXAMPLE — "Tell me about yourself":
- I've been in recruitment for about four years, mostly in hospitality and healthcare — both remote and on-site roles.
- At BroadPath I built out their remote healthcare staffing from scratch, filling enrollment specialists and claims processors under tight project deadlines.
- At Stratton I moved into luxury hospitality, where I got really good at screening for culture fit and working closely with hiring managers on what they actually needed.
- Now I'm ready for a bigger challenge, and a company like [Company] is exactly where I want to grow.

EXAMPLE — "Why did you leave your current job?":
- I'm looking for new challenges and a chance to grow, especially in a faster-moving environment.
- While I've genuinely enjoyed my current role, I feel ready to take on more responsibility and work at a larger scale.
- I'm excited about the opportunity at [Company] specifically — it feels like a place where my background can make a real impact.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildPrompt(
  resume: string,
  jd: string,
  recentTranscripts: string[],
  question: string,
  interviewType: 'behavioral' | 'technical' | 'general' = 'general',
  language: string = 'en',
  documents: { title: string; content: string }[] = [],
  extraInstructions: string = ''
): string {
  const langMap: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German'
  };
  const targetLang = langMap[language] || 'English';

  // Extract company and role from JD
  const company = jd
    ? (jd.match(/(?:^|\n)\s*(?:company|employer|organization)[:\s]+([^\n,]{2,50})/im)?.[1]?.trim()
      || jd.match(/\bat\s+([A-Z][A-Za-z0-9\s&,.-]{1,40}?)(?:\n|,|\.|we\s)/)?.[1]?.trim()
      || '')
    : '';
  const role = jd
    ? (jd.match(/(?:role|position|title|job)[:\s]+([^\n,]{2,60})/i)?.[1]?.trim() || '')
    : '';

  const contextLine = [
    role && `Role: ${role}`,
    company && `Company: ${company}`,
  ].filter(Boolean).join(' | ');

  let typeBlock: string;
  let typeInstructions: string;
  if (interviewType === 'behavioral') {
    typeBlock = BEHAVIORAL_EXAMPLES;
    typeInstructions = 'For behavioral questions, structure each answer using Situation → Action → Result (STAR). Name the specific company, project, and metric — never leave placeholders.';
  } else if (interviewType === 'technical') {
    typeBlock = TECHNICAL_EXAMPLES;
    typeInstructions = 'For technical questions, structure each answer as: Approach → Tradeoff → Concrete experience from the resume above. Be precise about data structures, scale numbers, and design decisions.';
  } else {
    typeBlock = GENERAL_EXAMPLES;
    typeInstructions = 'Answer conversationally, referencing the candidate\'s actual background and the target company whenever relevant.';
  }

  return `You are a live interview coach. Write bullet points the candidate can read and say out loud naturally, as if speaking — not reading from a resume.

STYLE: Warm, first-person, conversational. Like how a confident person actually talks in an interview. Complete thoughts, natural flow.
${typeInstructions}

FORMAT: Output ONLY a bullet list. No intro, no headers, no closing line. Each bullet starts with "- ".
- 3 to 5 bullets depending on the question depth
- Each bullet is 1-2 complete sentences (not fragments, not one-word answers)
- Avoid hollow filler: "leverage synergies", "results-driven", "go-getter"
- Ground every bullet in the resume above. If a bullet would apply to anyone, rewrite it to name a specific company, project, or metric from the resume.
${extraInstructions ? `- Tone note: ${extraInstructions}` : ''}

${typeBlock}

---
Resume: ${resume || '(not provided)'}
Job Description: ${jd || '(not provided)'}
${contextLine ? `${contextLine}\n` : ''}${documents.length > 0 ? `Additional context: ${documents.map(d => `${d.title}: ${d.content.slice(0, 300)}`).join(' | ')}\n` : ''}Recent conversation: ${recentTranscripts.slice(-8).join(' | ') || 'none'}
Language: ${targetLang}

Question: "${question}"

Write the bullet list in ${targetLang}:`;
}

// ─── Provider interface ───────────────────────────────────────────────────────

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

// ─── OpenAI Provider ──────────────────────────────────────────────────────────

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
        // Proxy path: non-streaming request
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

// ─── Anthropic Provider ───────────────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private readonly ENDPOINT = 'https://api.anthropic.com/v1/messages';
  private readonly API_VERSION = '2023-06-01';

  constructor(apiKey: string) {
    this.apiKey = String(apiKey || '').replace(/["']/g, '').trim();
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.API_VERSION,
      'anthropic-beta': 'prompt-caching-2024-07-31',
    };
  }

  /** Split the combined systemPrompt into a stable cacheable prefix and a
   *  per-question suffix. The split happens at "Recent conversation:" so that
   *  the resume + JD + examples block is cached across every question in the
   *  session (5-minute TTL → cache hits on all questions after the first). */
  private splitForCache(systemPrompt: string): { stableSystem: string; dynamicContext: string } {
    const marker = '\nRecent conversation:';
    const idx = systemPrompt.lastIndexOf(marker);
    if (idx >= 0) {
      return {
        stableSystem: systemPrompt.slice(0, idx),
        dynamicContext: systemPrompt.slice(idx),
      };
    }
    return { stableSystem: systemPrompt, dynamicContext: '' };
  }

  async generateScorecard(resume: string, jd: string, transcripts: any[]): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') return 'Error: Anthropic API Key missing.';
    const formattedTranscripts = transcripts.map(t => `${t.speaker}: ${t.text}`);
    const prompt = buildScorecardPrompt(resume, jd, formattedTranscripts);
    try {
      const body = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: prompt,
        messages: [{ role: 'user', content: 'Generate the scorecard now.' }],
      });
      const response = await fetch(this.ENDPOINT, { method: 'POST', headers: this.headers, body });
      if (!response.ok) throw new Error(response.statusText);
      const data = await response.json();
      return data.content?.[0]?.text || 'No response';
    } catch (error: any) {
      return `Error generating scorecard: ${error.message}`;
    }
  }

  async generateAnswer(question: string, systemPrompt: string, model: string): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') return 'Error: Anthropic API Key missing.';
    try {
      const { stableSystem, dynamicContext } = this.splitForCache(systemPrompt);
      const userContent = dynamicContext
        ? `${dynamicContext}\n\nAnswer the question above:`
        : question;
      const body = JSON.stringify({
        model,
        max_tokens: 400,
        system: [{ type: 'text', text: stableSystem, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
      });
      const response = await fetch(this.ENDPOINT, { method: 'POST', headers: this.headers, body });
      if (!response.ok) throw new Error(response.statusText);
      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error: any) {
      return `Error generating response: ${error.message}`;
    }
  }

  async generateAnswerStream(
    question: string,
    systemPrompt: string,
    model: string,
    onChunk: (partial: string, full: string) => void,
    onDone: (full: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      onError('Error: Please add your Anthropic API Key in Settings to use Claude models.');
      return;
    }
    // Cloud proxy keys (ey-...) are not yet supported for Anthropic
    if (this.apiKey.startsWith('ey-')) {
      onError('Claude models require a direct Anthropic API key. Add one in Settings → API Configuration.');
      return;
    }

    try {
      const { stableSystem, dynamicContext } = this.splitForCache(systemPrompt);
      const userContent = dynamicContext
        ? `${dynamicContext}\n\nAnswer the question above:`
        : question;

      const body = JSON.stringify({
        model,
        max_tokens: 400,
        system: [{ type: 'text', text: stableSystem, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userContent }],
        stream: true,
      });

      const response = await fetch(this.ENDPOINT, { method: 'POST', headers: this.headers, body });
      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
      }

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
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const token = event.delta.text || '';
              if (token) {
                full += token;
                onChunk(token, full);
              }
            }
          } catch {}
        }
      }
      onDone(full);
    } catch (error: any) {
      console.error('Anthropic Stream Error:', error);
      onError(`Error generating response: ${error.message}`);
    }
  }
}
