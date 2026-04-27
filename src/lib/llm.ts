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
  generateAnswer(prompt: string, context: string): Promise<string>;
  generateScorecard(resume: string, jd: string, transcripts: any[]): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateScorecard(resume: string, jd: string, transcripts: any[]): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') return "Error: API Key missing.";

    const formattedTranscripts = transcripts.map(t => `${t.speaker}: ${t.text}`);
    const prompt = buildScorecardPrompt(resume, jd, formattedTranscripts);

    try {
      const isProxy = this.apiKey.startsWith('ey-');
      const token = isProxy ? this.apiKey.substring(3) : this.apiKey;
      const url = isProxy ? 'https://project-vw750.vercel.app/api/desktop/openai' : 'https://api.openai.com/v1/chat/completions';

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const bodyStr = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      let data;
      if ((window as any).electronAPI && isProxy) {
        const res = await (window as any).electronAPI.url.post(url, headers, bodyStr);
        if (!res.ok) throw new Error(res.error || 'Failed to fetch');
        data = res.data;
      } else {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyStr
        });
        if (!response.ok) throw new Error(response.statusText);
        data = await response.json();
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      return `Error generating scorecard: ${error.message}`;
    }
  }

  async generateAnswer(question: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      return "Error: Please add your OpenAI API Key in Settings to generate answers.";
    }

    try {
      const isProxy = this.apiKey.startsWith('ey-');
      const token = isProxy ? this.apiKey.substring(3) : this.apiKey;
      const url = isProxy ? 'https://project-vw750.vercel.app/api/desktop/openai' : 'https://api.openai.com/v1/chat/completions';

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const bodyStr = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      let data;
      if ((window as any).electronAPI && isProxy) {
        const res = await (window as any).electronAPI.url.post(url, headers, bodyStr);
        if (!res.ok) throw new Error(`OpenAI API Error: ${res.error}`);
        data = res.data;
      } else {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyStr
        });
        if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`);
        data = await response.json();
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      console.error('LLM Generation Error:', error);
      return `Error generating response: ${error.message}`;
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
  documents: { title: string; content: string }[] = []
): string {
  const langMap: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German'
  };
  const targetLang = langMap[language] || 'English';

  return `
You are an invisible interview coach whispering in a candidate's ear during a live interview. Your job is to give them a natural-sounding answer they can adapt and say in their own words.

IMPORTANT: Write how real people actually talk in interviews. Not how AI writes. Not how a LinkedIn post sounds. How a confident, prepared person actually speaks out loud to another human.

RULES:
- Use the candidate's real experience from their resume, but phrase it the way they'd actually say it out loud
- Keep each point to ONE short line they can glance at mid-conversation
- No corporate jargon. No filler. No "I'm passionate about..." or "I thrive in..." — nobody actually talks like that
- 3 points max. Less is more.

FORMAT (follow this exactly):

**🎯 Start with:** [A casual, natural opening sentence — the kind of thing you'd actually say]

**📌 Key points:**
- [Something specific from their resume, phrased casually]
- [Another specific thing, focused on what they actually did or achieved]
- [Connect it back to why they're here / this role]

**🎬 Wrap up:** [A natural closing that sounds human, not rehearsed]

EXAMPLE — if asked "Tell me about yourself":

**🎯 Start with:** "Yeah, so I've been in recruiting for about four years now, mostly hospitality and healthcare..."

**📌 Key points:**
- At BroadPath I basically built out their remote healthcare hiring from the ground up
- Then at Stratton I shifted to luxury hospitality — learned a ton about screening for culture fit
- Been wanting to get into fintech for a while, which is what led me here

**🎬 Wrap up:** "So yeah, I want to take what I've learned and bring it somewhere that's growing fast — and this seemed like the right fit."

^ That's the tone. Natural, confident, sounds like a real person. Match that energy.


### CONTEXT:
=== Target Language ===
${targetLang}

=== Job Description ===
${jd}

=== Candidate Resume ===
${resume}

${documents.length > 0 ? `=== Knowledge Base ===\n${documents.map(d => `Document: ${d.title}\n${d.content}`).join('\n\n')}\n` : ''}

=== Recent Conversation (Last 5 mins) ===
${recentTranscripts.join('\n')}

=== Exact Interviewer Question ===
${question}

Generate the response in ${targetLang} now.
`;
}
