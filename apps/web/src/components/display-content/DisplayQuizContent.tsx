'use client';

import { useEffect, useMemo, useState } from 'react';
import { ContentSeenStatus } from '@video/shared';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { useToast } from '@/components/Toaster';
import { useCanManageCurriculum } from '@/lib/learner-preview';
import { answerLetter } from '@/lib/quizCsv';
import type { QuizAnswerResultDto, QuizDto, QuizQuestionDto } from '@/lib/types';
import { getErrorMessage, useDeleteQuizMutation, useMarkQuizSeenMutation } from '@/store/api';
import { ContentItemShell } from './ContentItemShell';
import type { ContentDragProps } from './types';

type Phase = 'ready' | 'active' | 'results';
type QuestionState = 'answering' | 'correct' | 'wrong' | 'timedOut';

type AnswerRecord = {
  selectedIndex: number | null;
  state: Exclude<QuestionState, 'answering'>;
};

const DEFAULT_DURATION = 30;

function questionDuration(question: QuizQuestionDto): number {
  return typeof question.duration === 'number' && question.duration > 0
    ? question.duration
    : DEFAULT_DURATION;
}

function fromSavedResult(answers: QuizAnswerResultDto[]): AnswerRecord[] {
  return answers.map((answer) => ({
    selectedIndex: answer.selectedIndex,
    state: answer.outcome,
  }));
}

export function DisplayQuizContent({
  item,
  ...dragProps
}: { item: QuizDto } & ContentDragProps) {
  const toast = useToast();
  const canManage = useCanManageCurriculum();
  const [markSeen, { isLoading: saving }] = useMarkQuizSeenMutation();
  const [deleteQuiz, { isLoading: deleting }] = useDeleteQuizMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (item.result ? 'results' : 'ready'));
  const [index, setIndex] = useState(0);
  const [questionState, setQuestionState] = useState<QuestionState>('answering');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>(() =>
    item.result ? fromSavedResult(item.result.answers) : [],
  );
  const [savedResult, setSavedResult] = useState(item.result);
  const [error, setError] = useState<string | null>(null);

  const questions = item.questions ?? [];
  const current = questions[index];
  const count = questions.length;

  const seenStatus =
    item.seenStatus === ContentSeenStatus.COMPLETED || savedResult
      ? ContentSeenStatus.COMPLETED
      : ContentSeenStatus.PENDING;

  const score = useMemo(
    () =>
      savedResult?.score ??
      answers.filter((answer) => answer.state === 'correct').length,
    [answers, savedResult],
  );

  useEffect(() => {
    setSavedResult(item.result);
    if (item.result) {
      setAnswers(fromSavedResult(item.result.answers));
      setPhase((currentPhase) => (currentPhase === 'active' ? currentPhase : 'results'));
    }
  }, [item.result]);

  useEffect(() => {
    if (phase !== 'active' || questionState !== 'answering' || !current) {
      return;
    }
    if (secondsLeft <= 0) {
      setQuestionState('timedOut');
      setAnswers((prev) => {
        const next = [...prev];
        next[index] = { selectedIndex: null, state: 'timedOut' };
        return next;
      });
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, questionState, secondsLeft, current, index]);

  function startQuiz() {
    if (questions.length === 0) {
      return;
    }
    setPhase('active');
    setIndex(0);
    setAnswers([]);
    setSelectedIndex(null);
    setQuestionState('answering');
    setSecondsLeft(questionDuration(questions[0]!));
    setError(null);
  }

  function onSelectOption(optionIndex: number) {
    if (questionState !== 'answering' || !current) {
      return;
    }
    const correct = optionIndex === current.correctIndex;
    const state: QuestionState = correct ? 'correct' : 'wrong';
    setSelectedIndex(optionIndex);
    setQuestionState(state);
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = { selectedIndex: optionIndex, state };
      return next;
    });
  }

  async function finishWithAnswers(finalAnswers: AnswerRecord[]) {
    setPhase('results');
    try {
      const result = await markSeen({
        id: item.id,
        body: {
          answers: questions.map((_, questionIndex) => ({
            selectedIndex: finalAnswers[questionIndex]?.selectedIndex ?? null,
          })),
        },
      }).unwrap();
      setSavedResult(result.quiz.result);
      if (result.quiz.result) {
        setAnswers(fromSavedResult(result.quiz.result.answers));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save quiz result'));
    }
  }

  async function goNext() {
    if (index + 1 >= questions.length) {
      await finishWithAnswers(answers);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelectedIndex(null);
    setQuestionState('answering');
    setSecondsLeft(questionDuration(questions[nextIndex]!));
  }

  function retry() {
    startQuiz();
    toast.success('Quiz restarted.');
  }

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteQuiz({ id: item.id, lessonId: item.lessonId }).unwrap();
      toast.success('Quiz deleted.');
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete quiz'));
    }
  }

  const canGoNext = questionState !== 'answering' && !saving;
  const progressPct = count > 0 ? ((index + (phase === 'results' ? 1 : 0)) / count) * 100 : 0;
  const displayAnswers =
    savedResult && phase === 'results' ? fromSavedResult(savedResult.answers) : answers;

  return (
    <>
    <ContentItemShell
      kind="Quiz"
      title={item.title}
      subtitle={
        [
          item.description || null,
          `${count} question${count === 1 ? '' : 's'}`,
          savedResult ? `Last score · ${savedResult.score}/${savedResult.totalQuestions}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || null
      }
      badge={<SeenStatusBadge status={seenStatus} />}
      {...dragProps}
    >
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {phase === 'ready' ? (
        <div className="space-y-3 rounded-xl border border-blue-100 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            One question at a time with a countdown. Correct answers turn green, wrong answers turn
            red, and unanswered timeouts turn gray. Your result is saved for your account.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={count === 0}
              onClick={startQuiz}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {count === 0 ? 'No questions' : savedResult ? 'Retake quiz' : 'Start quiz'}
            </button>
            {savedResult ? (
              <button
                type="button"
                onClick={() => {
                  setAnswers(fromSavedResult(savedResult.answers));
                  setPhase('results');
                }}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50"
              >
                View saved result
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'active' && current ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              Question {index + 1} of {count}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                questionState === 'timedOut'
                  ? 'bg-slate-200 text-slate-600'
                  : secondsLeft <= 5
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-blue-50 text-accent'
              }`}
            >
              {questionState === 'answering'
                ? `${secondsLeft}s`
                : questionState === 'timedOut'
                  ? 'Time up'
                  : questionState === 'correct'
                    ? 'Correct'
                    : 'Incorrect'}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-blue-50">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.max(8, progressPct)}%` }}
            />
          </div>

          <p className="text-base font-medium text-slate-900">{current.prompt}</p>

          <div className="space-y-2">
            {current.options.map((option, optionIndex) => {
              const isSelected = selectedIndex === optionIndex;
              const isCorrectOption = optionIndex === current.correctIndex;
              let optionClass =
                'border-blue-100 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50';

              if (questionState === 'answering') {
                // default
              } else if (questionState === 'timedOut') {
                optionClass = 'border-slate-200 bg-slate-100 text-slate-500';
              } else if (isCorrectOption) {
                optionClass = 'border-emerald-300 bg-emerald-50 text-emerald-800';
              } else if (isSelected && questionState === 'wrong') {
                optionClass = 'border-rose-300 bg-rose-50 text-rose-800';
              } else {
                optionClass = 'border-slate-100 bg-slate-50 text-slate-500';
              }

              return (
                <button
                  key={optionIndex}
                  type="button"
                  disabled={questionState !== 'answering'}
                  onClick={() => onSelectOption(optionIndex)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${optionClass}`}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold">
                    {answerLetter(optionIndex)}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => void goNext()}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving
                ? 'Saving…'
                : index + 1 >= count
                  ? 'See results'
                  : 'Next'}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'results' ? (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-slate-50 p-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              Score · {score}/{count}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {savedResult?.attemptCount
                ? `Attempt ${savedResult.attemptCount} · saved to your account.`
                : 'Saved to your account.'}{' '}
              {score === count
                ? 'Perfect score.'
                : score === 0
                  ? 'No correct answers this round.'
                  : 'Review the answer sheet below, then retry if you like.'}
            </p>
          </div>
          <ol className="space-y-2">
            {questions.map((question, questionIndex) => {
              const record = displayAnswers[questionIndex];
              const badge =
                record?.state === 'correct'
                  ? 'bg-emerald-100 text-emerald-700'
                  : record?.state === 'wrong'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-200 text-slate-600';
              const label =
                record?.state === 'correct'
                  ? 'Correct'
                  : record?.state === 'wrong'
                    ? `Yours ${answerLetter(record.selectedIndex ?? 0)} · Answer ${answerLetter(question.correctIndex)}`
                    : `No answer · Answer ${answerLetter(question.correctIndex)}`;
              return (
                <li
                  key={questionIndex}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-50 bg-white px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-800">
                    {questionIndex + 1}. {question.prompt}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={retry}
            className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-accent hover:border-accent/40 hover:bg-blue-50"
          >
            Retry quiz
          </button>
        </div>
      ) : null}
    </ContentItemShell>
    {confirmDelete ? (
      <ConfirmDeleteModal
        title="Delete quiz"
        description={`Delete quiz “${item.title}”?`}
        confirming={deleting}
        error={deleteError}
        onConfirm={() => void onDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    ) : null}
    </>
  );
}
