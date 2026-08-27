'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { primaryButtonClassName } from '@/components/portals';
import type { ModuleDto, TenantUserDto } from '@/lib/types';

export function MemberModulesPanel({
  member,
  modules,
  modulesLoading,
  submitting,
  error,
  onSave,
  onClose,
}: {
  member: TenantUserDto;
  modules: ModuleDto[];
  modulesLoading: boolean;
  submitting: boolean;
  error?: string | null;
  onSave: (moduleIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(member.moduleIds ?? []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const groups = useMemo(() => {
    const departments = member.departments ?? [];
    return departments.map((department) => ({
      department,
      modules: modules.filter((mod) => mod.departmentId === department.id),
    }));
  }, [member.departments, modules]);

  const selectableIds = useMemo(
    () => new Set(groups.flatMap((group) => group.modules.map((mod) => mod.id))),
    [groups],
  );

  function toggleModule(moduleId: string) {
    setSelectedIds((current) =>
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId],
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(selectedIds.filter((id) => selectableIds.has(id)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modules-title"
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="member-modules-title" className="text-xl font-semibold text-slate-900">
              Allow modules
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose modules {member.name} can access in their assigned departments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-blue-100 px-3 py-1 text-sm text-slate-500 hover:text-accent"
          >
            Close
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-blue-100 bg-blue-50/50 px-4 py-6 text-center text-sm text-slate-500">
              Assign this member to a department first.
            </p>
          ) : modulesLoading ? (
            <p className="text-sm text-slate-500">Loading modules…</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <section key={group.department.id} className="rounded-xl border border-blue-100">
                  <h3 className="border-b border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-slate-800">
                    {group.department.name}
                  </h3>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto p-1.5">
                    {group.modules.length === 0 ? (
                      <p className="px-2 py-1.5 text-sm text-slate-400">No modules in this department</p>
                    ) : (
                      group.modules.map((mod) => (
                        <label
                          key={mod.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-blue-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(mod.id)}
                            onChange={() => toggleModule(mod.id)}
                            className="h-4 w-4 rounded border-blue-200 text-accent accent-accent"
                          />
                          {mod.name}
                        </label>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || groups.length === 0}
              className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
            >
              {submitting ? 'Saving…' : 'Save modules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
