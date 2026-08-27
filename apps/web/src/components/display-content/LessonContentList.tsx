'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useDragAutoScroll } from './useDragAutoScroll';
import { useCanManageCurriculum } from '@/lib/learner-preview';
import type {
  AudioDto,
  ImageDto,
  LessonContentKind,
  LessonContentOrderItem,
  LessonDto,
  PdfDto,
  QuizDto,
  TextAreaDto,
  VideoDto,
} from '@/lib/types';
import { useReorderLessonContentMutation } from '@/store/api';
import { DisplayAudioContent } from './DisplayAudioContent';
import { DisplayImageContent } from './DisplayImageContent';
import { DisplayPdfContent } from './DisplayPdfContent';
import { DisplayQuizContent } from './DisplayQuizContent';
import { DisplayTextContent } from './DisplayTextContent';
import { DisplayVideoContent } from './DisplayVideoContent';

type LessonContentItem =
  | { kind: 'text'; item: TextAreaDto }
  | { kind: 'video'; item: VideoDto }
  | { kind: 'audio'; item: AudioDto }
  | { kind: 'image'; item: ImageDto }
  | { kind: 'quiz'; item: QuizDto }
  | { kind: 'pdf'; item: PdfDto };

function entryKey(kind: LessonContentKind, id: string) {
  return `${kind}:${id}`;
}

function buildOrderedContent(
  lesson: LessonDto,
  order: LessonContentOrderItem[],
): LessonContentItem[] {
  const byKey = new Map<string, LessonContentItem>([
    ...(lesson.textAreas ?? []).map(
      (item) => [entryKey('text', item.id), { kind: 'text' as const, item }] as const,
    ),
    ...(lesson.videos ?? []).map(
      (item) => [entryKey('video', item.id), { kind: 'video' as const, item }] as const,
    ),
    ...(lesson.audios ?? []).map(
      (item) => [entryKey('audio', item.id), { kind: 'audio' as const, item }] as const,
    ),
    ...(lesson.images ?? []).map(
      (item) => [entryKey('image', item.id), { kind: 'image' as const, item }] as const,
    ),
    ...(lesson.quizzes ?? []).map(
      (item) => [entryKey('quiz', item.id), { kind: 'quiz' as const, item }] as const,
    ),
    ...(lesson.pdfs ?? []).map(
      (item) => [entryKey('pdf', item.id), { kind: 'pdf' as const, item }] as const,
    ),
  ]);

  const ordered: LessonContentItem[] = [];
  const seen = new Set<string>();

  for (const entry of order) {
    const key = entryKey(entry.kind, entry.id);
    const item = byKey.get(key);
    if (!item || seen.has(key)) {
      continue;
    }
    ordered.push(item);
    seen.add(key);
  }

  for (const [key, item] of byKey) {
    if (!seen.has(key)) {
      ordered.push(item);
    }
  }

  return ordered;
}

function defaultOrderFromLesson(lesson: LessonDto): LessonContentOrderItem[] {
  if (lesson.contentOrder?.length) {
    return lesson.contentOrder;
  }
  return [
    ...(lesson.textAreas ?? []).map((item) => ({ kind: 'text' as const, id: item.id })),
    ...(lesson.videos ?? []).map((item) => ({ kind: 'video' as const, id: item.id })),
    ...(lesson.audios ?? []).map((item) => ({ kind: 'audio' as const, id: item.id })),
    ...(lesson.images ?? []).map((item) => ({ kind: 'image' as const, id: item.id })),
    ...(lesson.quizzes ?? []).map((item) => ({ kind: 'quiz' as const, id: item.id })),
    ...(lesson.pdfs ?? []).map((item) => ({ kind: 'pdf' as const, id: item.id })),
  ];
}

function DragHandle({
  onGripPointerDown,
}: {
  onGripPointerDown: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-6 cursor-grab items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-slate-600 active:cursor-grabbing"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      onMouseDown={onGripPointerDown}
      onTouchStart={onGripPointerDown}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <circle cx="5" cy="4" r="1.2" />
        <circle cx="11" cy="4" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="11" cy="12" r="1.2" />
      </svg>
    </button>
  );
}

export function LessonContentList({
  lesson,
  onContentReady,
}: {
  lesson: LessonDto;
  onContentReady?: () => void;
}) {
  const canManage = useCanManageCurriculum();
  const listRef = useRef<HTMLUListElement>(null);
  const [order, setOrder] = useState<LessonContentOrderItem[]>(() => defaultOrderFromLesson(lesson));
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragEnabledKey, setDragEnabledKey] = useState<string | null>(null);
  const [reorderContent, { isLoading: isReordering }] = useReorderLessonContentMutation();

  useDragAutoScroll(Boolean(draggingKey), listRef);

  useEffect(() => {
    setOrder(defaultOrderFromLesson(lesson));
  }, [lesson]);

  const content = useMemo(() => buildOrderedContent(lesson, order), [lesson, order]);

  const counts = lesson.contentCounts;
  const totalCount = counts
    ? counts.textAreas +
      counts.videos +
      counts.audios +
      counts.images +
      counts.quizzes +
      counts.pdfs
    : content.length;

  async function persistOrder(next: LessonContentOrderItem[]) {
    setOrder(next);
    try {
      await reorderContent({ lessonId: lesson.id, items: next }).unwrap();
    } catch {
      setOrder(defaultOrderFromLesson(lesson));
    }
  }

  function moveItem(fromKey: string, toKey: string) {
    if (fromKey === toKey) {
      return;
    }
    const next = [...order];
    const fromIndex = next.findIndex((item) => entryKey(item.kind, item.id) === fromKey);
    const toIndex = next.findIndex((item) => entryKey(item.kind, item.id) === toKey);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    void persistOrder(next);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Content</h2>
        <p className="mt-1 text-sm text-slate-500">
          {totalCount === 0
            ? 'No content in this lesson yet'
            : `${totalCount} item${totalCount === 1 ? '' : 's'}${canManage ? ' · drag to reorder' : ''}`}
        </p>
      </div>

      {totalCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No content in this lesson yet.
        </p>
      ) : (
        <ul
          ref={listRef}
          className={`space-y-3 ${isReordering ? 'opacity-80' : ''}`}
          onDragOver={(event) => {
            if (!draggingKey) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
        >
          {content.map((entry) => {
            const key = entryKey(entry.kind, entry.item.id);
            const dragProps = canManage
              ? {
                  dragHandle: (
                    <DragHandle onGripPointerDown={() => setDragEnabledKey(key)} />
                  ),
                  draggable: dragEnabledKey === key,
                  onDragStart: (event: DragEvent) => {
                    setDraggingKey(key);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', key);
                  },
                  onDragOver: (event: DragEvent) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  },
                  onDrop: (event: DragEvent) => {
                    event.preventDefault();
                    const fromKey = event.dataTransfer.getData('text/plain') || draggingKey;
                    if (fromKey) {
                      moveItem(fromKey, key);
                    }
                    setDraggingKey(null);
                    setDragEnabledKey(null);
                  },
                  onDragEnd: () => {
                    setDraggingKey(null);
                    setDragEnabledKey(null);
                  },
                  className: draggingKey === key ? 'opacity-50 ring-2 ring-accent/30' : undefined,
                }
              : {};

            switch (entry.kind) {
              case 'text':
                return (
                  <DisplayTextContent key={key} item={entry.item} {...dragProps} />
                );
              case 'video':
                return (
                  <DisplayVideoContent
                    key={key}
                    item={entry.item}
                    onReady={onContentReady}
                    {...dragProps}
                  />
                );
              case 'audio':
                return (
                  <DisplayAudioContent
                    key={key}
                    item={entry.item}
                    onReady={onContentReady}
                    {...dragProps}
                  />
                );
              case 'image':
                return (
                  <DisplayImageContent key={key} item={entry.item} {...dragProps} />
                );
              case 'quiz':
                return (
                  <DisplayQuizContent key={key} item={entry.item} {...dragProps} />
                );
              case 'pdf':
                return (
                  <DisplayPdfContent key={key} item={entry.item} {...dragProps} />
                );
            }
          })}
        </ul>
      )}
    </section>
  );
}
