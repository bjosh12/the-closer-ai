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

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7,
        })
      });

      const data = await response.json();
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

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          max_tokens: 500,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.statusText}`);
      }

      const data = await response.json();
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
  interviewType: 'behavioral' | 'technical' = 'behavioral',
  language: string = 'en',
  documents: { title: string; content: string }[] = []
): string {
  const langMap: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German'
  };
  const targetLang = langMap[language] || 'English';

  let instructions = `
You are an expert interview coach generating a live, real-time suggested answer for a candidate during a video interview.
CRITICAL INSTRUCTIONS:
1. Provide a clear, well-structured answer. When asked about past experiences or challenges, use a conversational version of the STAR method (Situation, Task, Action, Result).
2. You MUST pull specific, concrete examples and metrics directly from the Candidate's Resume to support your statements. Do not be vague.
3. Your answer MUST sound 100% human, casual, and conversational. Do NOT use complex vocabulary, corporate jargon, or typical AI buzzwords. Write the response exactly as a normal person would speak it out loud.
4. Keep the delivery concise and punchy. Avoid repeating phrases and do not ramble, but ensure the structural narrative and concrete examples remain fully intact.
You must generate the final spoken answer in ${targetLang}.
`;

  if (interviewType === 'technical') {
    instructions = `
You are an expert technical interview coach. The candidate is being asked a coding or system design question.
CRITICAL INSTRUCTION: Generate a structured technical answer. Your output MUST include:
1. The Core Algorithm / Approach (Concise explanation)
2. Time and Space Complexity
3. Edge Cases to mention
You must respond in ${targetLang}. Use markdown for code snippets.
`;
  }

  return `
${instructions}

Ground your answer in the candidate's resume and the job description.

=== Job Description ===
${jd}

=== Candidate Resume ===
${resume}

${documents.length > 0 ? `=== Knowledge Base (Supporting Documents) ===\n${documents.map(d => `Document: ${d.title}\n${d.content}`).join('\n\n')}\n` : ''}

=== Recent Conversation Context ===
${recentTranscripts.join('\n')}

=== Question to Answer ===
${question}

Provide the suggested answer below:
`;
}
