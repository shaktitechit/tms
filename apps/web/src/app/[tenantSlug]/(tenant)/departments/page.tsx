'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  DepartmentForm,
  DepartmentModal,
  emptyDepartmentForm,
  type DepartmentFormState,
} from '@/components/DepartmentFormModal';
import { DepartmentIconBadge } from '@/components/DepartmentsListView';
import { primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import type { DepartmentDto } from '@/lib/types';
import { departmentDetailPath } from '@/lib/roles';
import {
  getErrorMessage,
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useListDepartmentsQuery,
  useUpdateDepartmentMutation,
} from '@/store/api';

export default function TenantDepartmentsPage() {
  const toast = useToast();
  const params = useParams<{ tenantSlug: string }>();
  const { data, error, isLoading, refetch } = useListDepartmentsQuery();
  const [createDepartment, { isLoading: creating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: updating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: deleting }] = useDeleteDepartmentMutation();

  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DepartmentFormState>(emptyDepartmentForm);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentDto | null>(null);
  const [editForm, setEditForm] = useState<DepartmentFormState>(emptyDepartmentForm);
  const [pendingDelete, setPendingDelete] = useState<DepartmentDto | null>(null);

  function openCreateModal() {
    setCreateForm(emptyDepartmentForm);
    setFormError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(emptyDepartmentForm);
    setFormError(null);
  }

  function openEditModal(department: DepartmentDto) {
    setEditingDepartment(department);
    setEditForm({
      name: department.name,
      description: department.description,
      thumbnail: null,
    });
    setFormError(null);
  }

  function closeEditModal() {
    setEditingDepartment(null);
    setEditForm(emptyDepartmentForm);
    setFormError(null);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const result = await createDepartment({
        name: createForm.name,
        description: createForm.description,
        thumbnail: createForm.thumbnail,
      }).unwrap();
      closeCreateModal();
      toast.success(`Department “${result.department.name}” created.`);
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create department'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingDepartment) {
      return;
    }
    setFormError(null);
    try {
      await updateDepartment({
        id: editingDepartment.id,
        body: {
          name: editForm.name,
          description: editForm.description,
          thumbnail: editForm.thumbnail,
        },
      }).unwrap();
      closeEditModal();
      toast.success('Department updated.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update department'));
    }
  }

  async function onDelete() {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.id;
    setFormError(null);
    try {
      await deleteDepartment(id).unwrap();
      setPendingDelete(null);
      if (editingDepartment?.id === id) {
        closeEditModal();
      }
      toast.success('Department deleted.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not delete department'));
    }
  }

  const departments = data?.departments ?? [];
  const tenantSlug = params.tenantSlug;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Departments</h1>
          <p className="mt-1 text-slate-500">Group modules by department in your tenant.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
        >
          Add department
        </button>
      </div>

      {error && !createOpen && !editingDepartment ? (
        <p className="text-rose-600">{getErrorMessage(error)}</p>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : departments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No departments yet. Click Add department to create one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
              detailHref={departmentDetailPath(tenantSlug, department.slug)}
              deleting={deleting}
              onEdit={() => openEditModal(department)}
              onDelete={() => {
                setFormError(null);
                setPendingDelete(department);
              }}
            />
          ))}
        </div>
      )}

      {createOpen ? (
        <DepartmentModal title="Add department" onClose={closeCreateModal}>
          <DepartmentForm
            form={createForm}
            onChange={setCreateForm}
            onSubmit={(event) => void onCreate(event)}
            submitLabel={creating ? 'Creating…' : 'Create department'}
            submitting={creating}
            onCancel={closeCreateModal}
            error={formError}
          />
        </DepartmentModal>
      ) : null}

      {editingDepartment ? (
        <DepartmentModal title="Edit department" onClose={closeEditModal}>
          <DepartmentForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={(event) => void onSaveEdit(event)}
            submitLabel={updating ? 'Saving…' : 'Save changes'}
            submitting={updating}
            onCancel={closeEditModal}
            thumbnailLabel="Replace thumbnail"
            existingThumbnailUrl={editingDepartment.thumbnailUrl}
            error={formError}
          />
        </DepartmentModal>
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete department"
          description={`Delete department “${pendingDelete.name}”? Modules in this department will stay in the library.`}
          confirming={deleting}
          error={formError}
          onConfirm={() => void onDelete()}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

function DepartmentCard({
  department,
  detailHref,
  deleting,
  onEdit,
  onDelete,
}: {
  department: DepartmentDto;
  detailHref: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const moduleCount = department.moduleCount ?? 0;

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4">
      <Link href={detailHref} className="flex gap-4">
        <DepartmentIconBadge />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 hover:text-accent">{department.name}</h2>
          <p className="text-sm text-slate-500">
            /{department.slug} · {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
          </p>
          {department.description ? (
            <p className="line-clamp-2 text-sm text-slate-500">{department.description}</p>
          ) : null}
        </div>
      </Link>
      <div className="mt-3 flex gap-3 pl-16">
        <button type="button" onClick={onEdit} className="text-slate-600 hover:text-accent">
          Edit
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="text-rose-500 hover:text-rose-400 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
