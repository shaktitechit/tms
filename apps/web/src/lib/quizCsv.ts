import type { QuizQuestionDto } from '@/lib/types';

export const QUIZ_CSV_HEADERS = [
  'prompt',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correct',
  'durationSeconds',
] as const;

const DEFAULT_DURATION = 30;

export function quizTemplateCsv(): string {
  const sample = [
    QUIZ_CSV_HEADERS.join(','),
    '"What is 2+2?",3,4,5,6,B,30',
    '"Capital of France?",London,Paris,Berlin,Rome,B,45',
    '"Pick the vowel?",B,C,D,A,D,20',
  ];
  return `${sample.join('\n')}\n`;
}

export function downloadQuizTemplate() {
  const blob = new Blob([quizTemplateCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'quiz-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function resolveCorrectIndex(raw: string, optionCount: number): number {
  const value = raw.trim().toUpperCase();
  if (!value) {
    return 0;
  }
  if (/^[A-D]$/.test(value)) {
    return Math.min(value.charCodeAt(0) - 65, optionCount - 1);
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 1) {
    return Math.min(Math.floor(asNumber) - 1, optionCount - 1);
  }
  return 0;
}

export function parseQuizCsv(text: string): { questions: QuizQuestionDto[]; error?: string } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { questions: [], error: 'CSV file is empty.' };
  }

  const startIndex = (() => {
    const header = parseCsvLine(lines[0]!).map((cell) => cell.toLowerCase());
    return header[0] === 'prompt' ? 1 : 0;
  })();

  const questions: QuizQuestionDto[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!);
    const prompt = cells[0] ?? '';
    const options = [cells[1], cells[2], cells[3], cells[4]]
      .map((value) => (value ?? '').trim())
      .filter(Boolean);
    if (!prompt.trim() || options.length < 2) {
      continue;
    }
    const durationRaw = Number(cells[6] ?? DEFAULT_DURATION);
    const duration =
      Number.isFinite(durationRaw) && durationRaw >= 1 ? Math.round(durationRaw) : DEFAULT_DURATION;
    questions.push({
      prompt: prompt.trim(),
      options,
      correctIndex: resolveCorrectIndex(cells[5] ?? 'A', options.length),
      duration,
    });
  }

  if (questions.length === 0) {
    return {
      questions: [],
      error: 'No valid questions found. Need prompt and at least two options per row.',
    };
  }
  return { questions };
}

export function answerLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
