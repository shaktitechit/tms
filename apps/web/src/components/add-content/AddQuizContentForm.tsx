'use client';

import { useMemo, useRef, useState } from 'react';
import { Field, inputClassName, primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { answerLetter, downloadQuizTemplate, parseQuizCsv } from '@/lib/quizCsv';
import type { QuizQuestionDto } from '@/lib/types';
import { getErrorMessage, useCreateQuizMutation } from '@/store/api';
import { ContentFormActions } from './ContentFormActions';
import type { LessonContentFormProps } from './types';

const DEFAULT_DURATION = 30;

const emptyQuestion = (): QuizQuestionDto => ({
  prompt: '',
  options: ['', ''],
  correctIndex: 0,
  duration: DEFAULT_DURATION,
});

export function AddQuizContentForm({ lessonId, onCancel, onSuccess }: LessonContentFormProps) {
  const toast = useToast();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuizQuestionDto[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [createQuiz, { isLoading }] = useCreateQuizMutation();

  const answerSheet = useMemo(
    () =>
      questions.map((question, index) => ({
        number: index + 1,
        letter: answerLetter(question.correctIndex),
        text: question.options[question.correctIndex]?.trim() || '—',
        duration: question.duration || DEFAULT_DURATION,
        ready: Boolean(question.prompt.trim() && question.options.filter((o) => o.trim()).length >= 2),
      })),
    [questions],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const cleaned = questions
      .map((q) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correctIndex: q.correctIndex,
        duration:
          Number.isFinite(q.duration) && q.duration >= 1 ? Math.round(q.duration) : DEFAULT_DURATION,
      }))
      .filter((q) => q.prompt && q.options.length >= 2)
      .map((q) => ({
        ...q,
        correctIndex: Math.min(Math.max(0, q.correctIndex), q.options.length - 1),
      }));

    if (cleaned.length === 0) {
      setError('Add at least one question with two options.');
      return;
    }

    try {
      await createQuiz({
        title: title.trim(),
        description: description.trim(),
        questions: cleaned,
        lessonId,
      }).unwrap();
      toast.success('Quiz added.');
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add quiz'));
    }
  }

  async function onBulkFile(file: File | null) {
    if (!file) {
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseQuizCsv(text);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      setQuestions(parsed.questions);
      toast.success(`Imported ${parsed.questions.length} questions.`);
    } catch {
      setError('Could not read CSV file.');
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Required"
          className={inputClassName}
        />
      </Field>
      <Field label="Description">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional"
          className={inputClassName}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-slate-50 p-3">
        <button
          type="button"
          onClick={downloadQuizTemplate}
          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50"
        >
          Download template
        </button>
        <button
          type="button"
          onClick={() => bulkInputRef.current?.click()}
          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/40 hover:bg-blue-50"
        >
          Bulk upload CSV
        </button>
        <input
          ref={bulkInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            void onBulkFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        <p className="text-xs text-slate-500">
          Columns: prompt, optionA–D, correct (A–D or 1–4), durationSeconds
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-blue-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Answer sheet</p>
          <p className="text-xs text-slate-500">{answerSheet.filter((row) => row.ready).length} ready</p>
        </div>
        {answerSheet.every((row) => !row.ready) ? (
          <p className="text-sm text-slate-500">Answers appear here as you build questions.</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {answerSheet.map((row) =>
              row.ready ? (
                <li
                  key={row.number}
                  className="flex items-start gap-2 rounded-lg border border-blue-50 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-accent">
                    {row.number}. {row.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{row.text}</span>
                  <span className="shrink-0 text-xs text-slate-400">{row.duration}s</span>
                </li>
              ) : null,
            )}
          </ol>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((question, questionIndex) => (
          <div
            key={questionIndex}
            className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Question {questionIndex + 1}</p>
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((current) =>
                      current.filter((_, index) => index !== questionIndex),
                    )
                  }
                  className="text-sm text-rose-500 hover:text-rose-400"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <Field label="Prompt">
              <input
                required
                value={question.prompt}
                onChange={(event) =>
                  setQuestions((current) =>
                    current.map((item, index) =>
                      index === questionIndex ? { ...item, prompt: event.target.value } : item,
                    ),
                  )
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Duration (seconds)">
              <input
                type="number"
                min={1}
                step={1}
                required
                value={question.duration}
                onChange={(event) =>
                  setQuestions((current) =>
                    current.map((item, index) =>
                      index === questionIndex
                        ? {
                            ...item,
                            duration: Math.max(1, Number(event.target.value) || DEFAULT_DURATION),
                          }
                        : item,
                    ),
                  )
                }
                className={inputClassName}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Options</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${questionIndex}`}
                    checked={question.correctIndex === optionIndex}
                    onChange={() =>
                      setQuestions((current) =>
                        current.map((item, index) =>
                          index === questionIndex
                            ? { ...item, correctIndex: optionIndex }
                            : item,
                        ),
                      )
                    }
                    aria-label={`Mark option ${answerLetter(optionIndex)} correct`}
                  />
                  <span className="w-5 text-xs font-semibold text-slate-500">
                    {answerLetter(optionIndex)}
                  </span>
                  <input
                    required
                    value={option}
                    onChange={(event) =>
                      setQuestions((current) =>
                        current.map((item, index) =>
                          index === questionIndex
                            ? {
                                ...item,
                                options: item.options.map((value, oi) =>
                                  oi === optionIndex ? event.target.value : value,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                    placeholder={`Option ${answerLetter(optionIndex)}`}
                    className={inputClassName}
                  />
                  {question.options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((current) =>
                          current.map((item, index) => {
                            if (index !== questionIndex) {
                              return item;
                            }
                            const options = item.options.filter((_, oi) => oi !== optionIndex);
                            return {
                              ...item,
                              options,
                              correctIndex: Math.min(item.correctIndex, options.length - 1),
                            };
                          }),
                        )
                      }
                      className="shrink-0 text-sm text-slate-400 hover:text-rose-500"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
              {question.options.length < 4 ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((current) =>
                      current.map((item, index) =>
                        index === questionIndex
                          ? { ...item, options: [...item.options, ''] }
                          : item,
                      ),
                    )
                  }
                  className="text-sm text-accent hover:underline"
                >
                  Add option
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
          className={`${primaryButtonClassName} sm:w-auto sm:px-5`}
        >
          Add question
        </button>
      </div>

      <ContentFormActions submitLabel="Add quiz" submitting={isLoading} onCancel={onCancel} />
    </form>
  );
}
