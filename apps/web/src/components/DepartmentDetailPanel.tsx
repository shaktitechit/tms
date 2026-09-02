'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  ModuleForm,
  ModuleModal,
  emptyModuleForm,
  type ModuleFormState,
} from '@/components/ModuleFormModal';
import { primaryButtonClassName } from '@/components/portals';
import { WorkspaceBackAnchor } from '@/components/portals/shared/WorkspaceBackLink';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { isTenantAdmin, isTutor } from '@/lib/roles';
import type { ModuleDto } from '@/lib/types';
import {
  getErrorMessage,
  useCreateModuleMutation,
  useDeleteModuleMutation,
  useGetDepartmentQuery,
  useGetUserQuery,
  useListModulesQuery,
  useUpdateModuleMutation,
} from '@/store/api';

export function DepartmentDetailPanel({
  departmentSlug,
  moduleDetailHref,
  listHref,
}: {
  departmentSlug: string;
  moduleDetailHref: (moduleSlug: string) => string;
  listHref: string;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = isTenantAdmin(user);
  const tutor = isTutor(user);
  const canAddModule = canManage || tutor;
  const canSeeAllModules = canManage || tutor;
  const { data: memberData, isLoading: memberLoading, refetch: refetchMember } = useGetUserQuery(
    user?.id ?? '',
    {
      skip: !user?.id || canSeeAllModules,
    },
  );
  const { data, error, isLoading } = useGetDepartmentQuery(departmentSlug, {
    skip: !departmentSlug,
  });

  const department = data?.department;

  const {
    data: modulesData,
    error: modulesError,
    isLoading: modulesLoading,
    refetch: refetchModules,
  } = useListModulesQuery(
    { departmentId: department?.id },
    { skip: !department?.id },
  );

  const [createModule, { isLoading: creating }] = useCreateModuleMutation();
  const [updateModule, { isLoading: updating }] = useUpdateModuleMutation();
  const [deleteModule, { isLoading: deleting }] = useDeleteModuleMutation();

  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ModuleFormState>(emptyModuleForm);
  const [editingModule, setEditingModule] = useState<ModuleDto | null>(null);
  const [editForm, setEditForm] = useState<ModuleFormState>(emptyModuleForm);
  const [pendingDelete, setPendingDelete] = useState<ModuleDto | null>(null);

  const allModules = modulesData?.modules ?? department?.modules ?? [];
  const assignedModuleIds = new Set(memberData?.user.moduleIds ?? []);
  const modules = canSeeAllModules
    ? allModules
    : allModules.filter((mod) => assignedModuleIds.has(mod.id));
  const listingLoading = modulesLoading || (!canSeeAllModules && memberLoading);
  const departmentOptions = department
    ? [{ id: department.id, name: department.name }]
    : [];

  function openCreateModal() {
    if (!department) {
      return;
    }
    setCreateForm({
      ...emptyModuleForm,
      authorName: user?.name ?? '',
      authorEmail: user?.email ?? '',
      departmentId: department.id,
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(emptyModuleForm);
    setFormError(null);
  }

  function openEditModal(mod: ModuleDto) {
    if (!department) {
      return;
    }
    setEditingModule(mod);
    setEditForm({
      name: mod.name,
      description: mod.description,
      authorName: mod.authorName,
      authorEmail: mod.authorEmail,
      departmentId: department.id,
      thumbnail: null,
    });
    setFormError(null);
  }

  function closeEditModal() {
    setEditingModule(null);
    setEditForm(emptyModuleForm);
    setFormError(null);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!department) {
      return;
    }
    setFormError(null);
    try {
      const result = await createModule({
        name: createForm.name,
        description: createForm.description,
        authorName: createForm.authorName,
        authorEmail: createForm.authorEmail,
        departmentId: department.id,
        thumbnail: createForm.thumbnail,
      }).unwrap();
      closeCreateModal();
      toast.success(`Module “${result.module.name}” created.`);
      await Promise.all([
        refetchModules(),
        canSeeAllModules ? Promise.resolve() : refetchMember(),
      ]);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create module'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!department || !editingModule) {
      return;
    }
    setFormError(null);
    try {
      await updateModule({
        id: editingModule.id,
        body: {
          name: editForm.name,
          description: editForm.description,
          authorName: editForm.authorName,
          authorEmail: editForm.authorEmail,
          departmentId: department.id,
          thumbnail: editForm.thumbnail,
        },
      }).unwrap();
      closeEditModal();
      toast.success('Module updated.');
      await refetchModules();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update module'));
    }
  }

  async function onDelete() {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.id;
    setFormError(null);
    try {
      await deleteModule(id).unwrap();
      setPendingDelete(null);
      if (editingModule?.id === id) {
        closeEditModal();
      }
      toast.success('Module deleted.');
      await refetchModules();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not delete module'));
    }
  }

  const back = <WorkspaceBackAnchor href={listHref} label="Departments list" />;

  if (error && !department) {
    return (
      <>
        {back}
        <p className="text-rose-600">{getErrorMessage(error, 'Failed to load department')}</p>
      </>
    );
  }

  if (isLoading || !department) {
    return (
      <>
        {back}
        <p className="text-slate-500">Loading…</p>
      </>
    );
  }

  return (
    <>
      {back}
      <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">/{department.slug}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
            {department.name}
          </h1>
          {department.description ? (
            <p className="mt-2 max-w-2xl text-slate-500">{department.description}</p>
          ) : null}
        </div>
        {canAddModule ? (
          <button
            type="button"
            onClick={openCreateModal}
            className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
          >
            Add module
          </button>
        ) : null}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Modules</h2>
          <p className="mt-1 text-sm text-slate-500">
            {listingLoading
              ? 'Loading modules…'
              : modules.length === 0
                ? canSeeAllModules
                  ? 'No modules in this department yet'
                  : 'No assigned modules in this department'
                : `${modules.length} ${modules.length === 1 ? 'module' : 'modules'}`}
          </p>
        </div>
        {modulesError && !createOpen && !editingModule ? (
          <p className="text-rose-600">{getErrorMessage(modulesError, 'Failed to load modules')}</p>
        ) : null}
        {listingLoading ? (
          <p className="text-slate-500">Loading modules…</p>
        ) : modules.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
            {canSeeAllModules
              ? canAddModule
                ? 'No modules yet. Click Add module to create one.'
                : 'No modules in this department yet.'
              : 'No assigned modules in this department.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((mod) => (
              <article
                key={mod.id}
                className="overflow-hidden rounded-2xl border border-blue-100 bg-white"
              >
                <Link href={moduleDetailHref(mod.slug)} className="block">
                  <div className="relative aspect-video bg-blue-50">
                    {mod.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mod.thumbnailUrl}
                        alt={mod.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        No thumbnail
                      </div>
                    )}
                  </div>
                </Link>
                <div className="space-y-3 p-4">
                  <div>
                    <Link href={moduleDetailHref(mod.slug)} className="hover:text-accent">
                      <h3 className="text-lg font-semibold text-slate-900">{mod.name}</h3>
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">/{mod.slug}</p>
                  </div>
                  {mod.description ? (
                    <p className="line-clamp-2 text-sm text-slate-500">{mod.description}</p>
                  ) : null}
                  <div className="rounded-xl border border-blue-50 bg-blue-50/60 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">{mod.authorName}</p>
                    <p className="truncate text-slate-500">{mod.authorEmail}</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(mod)}
                        className="text-slate-600 hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => {
                          setFormError(null);
                          setPendingDelete(mod);
                        }}
                        className="text-rose-500 hover:text-rose-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {canAddModule && createOpen ? (
        <ModuleModal title="Add module" onClose={closeCreateModal}>
          <ModuleForm
            form={createForm}
            onChange={setCreateForm}
            onSubmit={(event) => void onCreate(event)}
            submitLabel={creating ? 'Creating…' : 'Create module'}
            submitting={creating}
            onCancel={closeCreateModal}
            departments={departmentOptions}
            departmentLocked
            error={formError}
          />
        </ModuleModal>
      ) : null}

      {canManage && editingModule ? (
        <ModuleModal title="Edit module" onClose={closeEditModal}>
          <ModuleForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={(event) => void onSaveEdit(event)}
            submitLabel={updating ? 'Saving…' : 'Save changes'}
            submitting={updating}
            onCancel={closeEditModal}
            thumbnailLabel="Replace thumbnail"
            existingThumbnailUrl={editingModule.thumbnailUrl}
            departments={departmentOptions}
            departmentLocked
            error={formError}
          />
        </ModuleModal>
      ) : null}

      {canManage && pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete module"
          description={`Delete module “${pendingDelete.name}”? Videos in this module will stay in the library.`}
          confirming={deleting}
          error={formError}
          onConfirm={() => void onDelete()}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
    </>
  );
}
