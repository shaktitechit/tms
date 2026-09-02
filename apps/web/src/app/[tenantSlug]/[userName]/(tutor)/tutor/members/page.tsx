'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MemberAccess } from '@video/shared';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  MemberForm,
  MemberModal,
  emptyMemberForm,
  type MemberFormState,
} from '@/components/MemberFormModal';
import { MemberModulesPanel } from '@/components/MemberModulesPanel';
import { useMemberAccess } from '@/components/portals/member/MemberAccess';
import { primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import type { TenantUserDto } from '@/lib/types';
import {
  getErrorMessage,
  useCreateLearnerMutation,
  useDeleteUserMutation,
  useGetUserQuery,
  useListModulesQuery,
  useListMyLearnersQuery,
  useReplaceMemberModulesMutation,
  useUpdateUserMutation,
} from '@/store/api';

export default function TutorMembersPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const { tenantSlug, userName } = params;
  const toast = useToast();
  const { user } = useMemberAccess();
  const { data: meData, isLoading: meLoading } = useGetUserQuery(user?.id ?? '', {
    skip: !user?.id,
  });

  const tutorDepartments = meData?.user.departments ?? [];
  const tutorDepartmentIds = new Set(meData?.user.departmentIds ?? []);

  const { data, isLoading, error, refetch } = useListMyLearnersQuery();
  const [createLearner, { isLoading: creating }] = useCreateLearnerMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();
  const [replaceMemberModules, { isLoading: savingModules }] = useReplaceMemberModulesMutation();

  const [allowingMember, setAllowingMember] = useState<TenantUserDto | null>(null);
  const { data: modulesData, isLoading: modulesLoading } = useListModulesQuery(undefined, {
    skip: !allowingMember,
  });
  const [modulesError, setModulesError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MemberFormState>(emptyMemberForm);

  const [editingMember, setEditingMember] = useState<TenantUserDto | null>(null);
  const [editForm, setEditForm] = useState<MemberFormState>(emptyMemberForm);

  const [pendingRemove, setPendingRemove] = useState<TenantUserDto | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  function openCreateModal() {
    setCreateForm({
      ...emptyMemberForm,
      departmentIds: [...tutorDepartmentIds],
    });
    setFormError(null);
    setCreateOpen(true);
  }
  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(emptyMemberForm);
    setFormError(null);
  }

  function openEditModal(member: TenantUserDto) {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      email: member.email,
      password: '',
      departmentIds: (member.departmentIds ?? []).filter((id) => tutorDepartmentIds.has(id)),
      access: MemberAccess.LEARNER,
    });
    setFormError(null);
  }
  function closeEditModal() {
    setEditingMember(null);
    setEditForm(emptyMemberForm);
    setFormError(null);
  }

  function openModulesPanel(member: TenantUserDto) {
    setAllowingMember(member);
    setModulesError(null);
  }
  function closeModulesPanel() {
    setAllowingMember(null);
    setModulesError(null);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const result = await createLearner({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        departmentIds: createForm.departmentIds,
      }).unwrap();
      closeCreateModal();
      toast.success(`Learner created as /${result.user.username}`);
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create learner'));
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingMember) return;
    setFormError(null);
    try {
      const password = editForm.password.trim();
      await updateUser({
        id: editingMember.id,
        body: {
          name: editForm.name,
          departmentIds: editForm.departmentIds,
          ...(password ? { password } : {}),
        },
      }).unwrap();
      closeEditModal();
      toast.success('Learner updated.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update learner'));
    }
  }

  async function onSaveModules(moduleIds: string[]) {
    if (!allowingMember) return;
    setModulesError(null);
    try {
      await replaceMemberModules({ userId: allowingMember.id, moduleIds }).unwrap();
      closeModulesPanel();
      toast.success('Allowed modules updated.');
      await refetch();
    } catch (err) {
      setModulesError(getErrorMessage(err, 'Could not update allowed modules'));
    }
  }

  async function onDelete() {
    if (!pendingRemove) return;
    setFormError(null);
    try {
      await deleteUser(pendingRemove.id).unwrap();
      setPendingRemove(null);
      if (editingMember?.id === pendingRemove.id) closeEditModal();
      if (allowingMember?.id === pendingRemove.id) closeModulesPanel();
      toast.success('Learner removed.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not remove learner'));
    }
  }

  const learners = data?.users ?? [];
  const allModules = (modulesData?.modules ?? []).filter(
    (mod) => mod.departmentId && tutorDepartmentIds.has(mod.departmentId),
  );
  const modulesMember = allowingMember
    ? {
        ...allowingMember,
        departments: allowingMember.departments.filter((department) =>
          tutorDepartmentIds.has(department.id),
        ),
        departmentIds: allowingMember.departmentIds.filter((id) => tutorDepartmentIds.has(id)),
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">My Learners</h1>
          <p className="mt-1 text-slate-500">
            Learners in your assigned departments.
          </p>
        </div>
        <button
          type="button"
          id="add-learner-btn"
          onClick={openCreateModal}
          className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
        >
          Add Learner
        </button>
      </div>

      {error && !createOpen && !editingMember ? (
        <p className="text-rose-600">{getErrorMessage(error)}</p>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading&hellip;</p>
      ) : learners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No learners in your assigned departments yet. Click <strong>Add Learner</strong> to
          create one.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {learners.map((learner) => (
              <li key={learner.id} className="rounded-2xl border border-blue-100 bg-white p-4">
                <p className="font-medium text-slate-900">
                  <LearnerLink tenantSlug={tenantSlug} userName={userName} learner={learner} />
                </p>
                {learner.username ? (
                  <p className="mt-0.5 text-sm text-slate-500">
                    <LearnerLink tenantSlug={tenantSlug} userName={userName} learner={learner} field="username" />
                  </p>
                ) : null}
                <p className="mt-0.5 truncate text-sm text-slate-500">{learner.email}</p>
                <p className="mt-1 text-sm text-slate-600">{formatDepartments(learner)}</p>
                <div className="mt-2">
                  <AllowedModulesControl member={learner} onAllow={() => openModulesPanel(learner)} />
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(learner)}
                    className="text-sm text-slate-600 hover:text-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => { setFormError(null); setPendingRemove(learner); }}
                    className="text-sm text-rose-500 hover:text-rose-400 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-blue-100 bg-white md:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-blue-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Departments</th>
                  <th className="px-4 py-3 font-medium">Allowed modules</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {learners.map((learner) => (
                  <tr key={learner.id} className="border-t border-blue-50">
                    <td className="px-4 py-3 text-slate-900">
                      <LearnerLink tenantSlug={tenantSlug} userName={userName} learner={learner} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <LearnerLink tenantSlug={tenantSlug} userName={userName} learner={learner} field="username" />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{learner.email}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDepartments(learner)}</td>
                    <td className="px-4 py-3">
                      <AllowedModulesControl member={learner} onAllow={() => openModulesPanel(learner)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(learner)}
                          className="text-slate-600 hover:text-accent"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => { setFormError(null); setPendingRemove(learner); }}
                          className="text-rose-500 hover:text-rose-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {createOpen ? (
        <MemberModal title="Add Learner" onClose={closeCreateModal}>
          <MemberForm
            mode="create"
            form={createForm}
            onChange={setCreateForm}
            onSubmit={(event) => void onCreate(event)}
            submitLabel={creating ? 'Creating\u2026' : 'Add Learner'}
            submitting={creating}
            onCancel={closeCreateModal}
            departments={tutorDepartments}
            departmentsLoading={meLoading}
            showAccess={false}
            error={formError}
          />
        </MemberModal>
      ) : null}

      {editingMember ? (
        <MemberModal title="Edit Learner" onClose={closeEditModal}>
          <MemberForm
            mode="edit"
            form={editForm}
            onChange={setEditForm}
            onSubmit={(event) => void onSaveEdit(event)}
            submitLabel={updating ? 'Saving\u2026' : 'Save changes'}
            submitting={updating}
            onCancel={closeEditModal}
            departments={tutorDepartments}
            departmentsLoading={meLoading}
            showAccess={false}
            error={formError}
          />
        </MemberModal>
      ) : null}

      {modulesMember ? (
        <MemberModulesPanel
          member={modulesMember}
          modules={allModules}
          modulesLoading={modulesLoading}
          submitting={savingModules}
          error={modulesError}
          onSave={(moduleIds) => void onSaveModules(moduleIds)}
          onClose={closeModulesPanel}
        />
      ) : null}

      {pendingRemove ? (
        <ConfirmDeleteModal
          title="Remove learner"
          description={`Remove ${pendingRemove.name} from your learners? They will lose access to their workspace.`}
          confirmLabel="Remove"
          confirming={deleting}
          error={formError}
          onConfirm={() => void onDelete()}
          onClose={() => setPendingRemove(null)}
        />
      ) : null}
    </div>
  );
}

function LearnerLink({
  tenantSlug,
  userName,
  learner,
  field = 'name',
}: {
  tenantSlug: string;
  userName: string;
  learner: TenantUserDto;
  field?: 'name' | 'username';
}) {
  const label = field === 'username'
    ? (learner.username ? `@${learner.username}` : null)
    : learner.name;

  if (!label) return null;

  if (!learner.username) return <>{label}</>;

  return (
    <Link
      href={`/${tenantSlug}/${userName}/tutor/members/${learner.username}`}
      className="hover:text-accent"
    >
      {label}
    </Link>
  );
}

function formatDepartments(member: TenantUserDto) {
  const names = member.departments?.map((department) => department.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : '—';
}

function AllowedModulesControl({
  member,
  onAllow,
}: {
  member: TenantUserDto;
  onAllow: () => void;
}) {
  const count = member.moduleIds?.length ?? 0;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-slate-700">{count === 0 ? 'None' : `${count} allowed`}</span>
      <button
        type="button"
        onClick={onAllow}
        className="rounded-full border border-blue-100 px-3 py-1 text-xs font-medium text-slate-600 hover:border-accent hover:text-accent"
      >
        Allow modules
      </button>
    </div>
  );
}
