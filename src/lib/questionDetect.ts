export type QuestionType = 'behavioral' | 'technical' | 'general' | 'not-a-question';

const FILLER = /^(um|uh|right|okay|ok|got it|sounds good|yeah|yes|no|sure|alright|cool|great)[\s.,!?]*$/i;

const QUESTION_WORDS = /^(what|how|why|when|where|who|which|can you|could you|do you|would you|have you|are you|is there|will you|did you|should i)\b/i;
const IMPERATIVE_PHRASES = /^(tell me about|walk me through|describe|give me an example|give me a|explain|talk (to me )?about|share|walk through|let's talk about|let me hear|run me through)\b/i;

const BEHAVIORAL = /\b(tell me about a time|describe a (situation|time)|give me an example of (when|a time)|have you ever|talk about a time|share a (situation|time|moment)|what would you do (if|when)|how do you handle|how have you handled|biggest (challenge|mistake|achievement)|conflict|disagreement|teamwork|leadership)\b/i;
const TECHNICAL = /\b(design a|design an|implement a|implement an|how would you (build|architect|scale|approach|design|implement)|what's the difference between|whats the difference between|explain (the|how) [a-z]+ (works|is implemented)|big o|complexity|algorithm|data structure|system design|trade-?offs?|database schema|api endpoint|optimi[sz]e|debug|refactor)\b/i;

export function detectQuestion(text: string): { isQuestion: boolean; type: QuestionType } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 8) return { isQuestion: false, type: 'not-a-question' };
  if (FILLER.test(trimmed)) return { isQuestion: false, type: 'not-a-question' };

  const hasMark = /\?/.test(trimmed);
  const matchesQuestionWord = QUESTION_WORDS.test(trimmed);
  const matchesImperative = IMPERATIVE_PHRASES.test(trimmed);

  const isQuestion = hasMark || matchesQuestionWord || matchesImperative;
  if (!isQuestion) return { isQuestion: false, type: 'not-a-question' };

  if (BEHAVIORAL.test(trimmed)) return { isQuestion: true, type: 'behavioral' };
  if (TECHNICAL.test(trimmed)) return { isQuestion: true, type: 'technical' };
  return { isQuestion: true, type: 'general' };
}
