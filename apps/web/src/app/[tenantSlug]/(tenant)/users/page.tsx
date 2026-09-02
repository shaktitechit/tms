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
import { primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { memberDetailPath } from '@/lib/roles';
import type { TenantUserDto } from '@/lib/types';
import {
  getErrorMessage,
  useCreateUserMutation,
  useDeleteUserMutation,
  useListDepartmentsQuery,
  useListModulesQuery,
  useListUsersQuery,
  useReplaceMemberModulesMutation,
  useUpdateUserMutation,
} from '@/store/api';

export default function TenantUsersPage() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const toast = useToast();
  const { data, error, isLoading, refetch } = useListUsersQuery();
  const { data: departmentsData, isLoading: departmentsLoading } = useListDepartmentsQuery();
  const [allowingMember, setAllowingMember] = useState<TenantUserDto | null>(null);
  const { data: modulesData, isLoading: modulesLoading } = useListModulesQuery(undefined, {
    skip: !allowingMember,
  });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [replaceMemberModules, { isLoading: savingModules }] = useReplaceMemberModulesMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();

  const [formError, setFormError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MemberFormState>(emptyMemberForm);

  const [editingMember, setEditingMember] = useState<TenantUserDto | null>(null);
  const [editForm, setEditForm] = useState<MemberFormState>(emptyMemberForm);
  const [pendingRemove, setPendingRemove] = useState<TenantUserDto | null>(null);
  const [modulesError, setModulesError] = useState<string | null>(null);

  function openCreateModal() {
    setCreateForm(emptyMemberForm);
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
      departmentIds: member.departmentIds ?? [],
      access: member.access === MemberAccess.TUTOR ? MemberAccess.TUTOR : MemberAccess.LEARNER,
    });
    setFormError(null);
  }

  function closeEditModal() {
    setEditingMember(null);
    setEditForm(emptyMemberForm);
    setFormError(null);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const result = await createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: 'user',
        access: createForm.access,
        departmentIds: createForm.departmentIds,
      }).unwrap();
      closeCreateModal();
      toast.success(`Member created as /${result.user.username}`);
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create user'));
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingMember) {
      return;
    }
    setFormError(null);
    try {
      const password = editForm.password.trim();
      await updateUser({
        id: editingMember.id,
        body: {
          name: editForm.name,
          departmentIds: editForm.departmentIds,
          ...(editingMember.role === 'user' ? { access: editForm.access } : {}),
          ...(password ? { password } : {}),
        },
      }).unwrap();
      closeEditModal();
      toast.success('Member updated.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update user'));
    }
  }

  function openModulesPanel(member: TenantUserDto) {
    if (!canAssignModules(member)) {
      return;
    }
    setAllowingMember(member);
    setModulesError(null);
  }

  function closeModulesPanel() {
    setAllowingMember(null);
    setModulesError(null);
  }

  async function onSaveModules(moduleIds: string[]) {
    if (!allowingMember) {
      return;
    }
    setModulesError(null);
    try {
      await replaceMemberModules({
        userId: allowingMember.id,
        moduleIds,
      }).unwrap();
      closeModulesPanel();
      toast.success('Allowed modules updated.');
      await refetch();
    } catch (err) {
      setModulesError(getErrorMessage(err, 'Could not update allowed modules'));
    }
  }

  async function onDelete() {
    if (!pendingRemove) {
      return;
    }
    const id = pendingRemove.id;
    setFormError(null);
    try {
      await deleteUser(id).unwrap();
      setPendingRemove(null);
      if (editingMember?.id === id) {
        closeEditModal();
      }
      if (allowingMember?.id === id) {
        closeModulesPanel();
      }
      toast.success('Member removed.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not delete user'));
    }
  }

  const users = data?.users ?? [];
  const departments = departmentsData?.departments ?? [];
  const allModules = modulesData?.modules ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Members</h1>
          <p className="mt-1 text-slate-500">
            Invite members into your tenant. Assign modules to learners; tutors get every module
            in their assigned departments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
        >
          Add Member
        </button>
      </div>

      {error && !createOpen && !editingMember ? (
        <p className="text-rose-600">{getErrorMessage(error)}</p>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No members yet. Click Add Member to invite one.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {users.map((member) => (
              <li key={member.id} className="rounded-2xl border border-blue-100 bg-white p-4">
                <p className="font-medium text-slate-900">
                  <MemberNameLink tenantSlug={tenantSlug} member={member} />
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <MemberNameLink tenantSlug={tenantSlug} member={member} field="username" />
                </p>
                <p className="truncate text-sm text-slate-500">{member.email}</p>
                <p className="mt-1 text-sm text-slate-600">{formatDepartments(member)}</p>
                <p className="mt-1 text-sm capitalize text-slate-600">{member.role}</p>
                <p className="mt-1 text-sm capitalize text-slate-600">{formatAccess(member)}</p>
                {canAssignModules(member) ? (
                  <div className="mt-2">
                    <AllowedModulesControl member={member} onAllow={() => openModulesPanel(member)} />
                  </div>
                ) : member.role === 'user' ? (
                  <p className="mt-2 text-sm text-slate-500">All department modules</p>
                ) : null}
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(member)}
                    className="text-sm text-slate-600 hover:text-accent"
                  >
                    Edit
                  </button>
                  {member.role === 'user' ? (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setFormError(null);
                        setPendingRemove(member);
                      }}
                      className="text-sm text-rose-500 hover:text-rose-400 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-blue-100 bg-white md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-blue-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Departments</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Access</th>
                  <th className="px-4 py-3 font-medium">Allowed modules</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((member) => (
                  <tr key={member.id} className="border-t border-blue-50">
                    <td className="px-4 py-3 text-slate-900">
                      <MemberNameLink tenantSlug={tenantSlug} member={member} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <MemberNameLink tenantSlug={tenantSlug} member={member} field="username" />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{member.email}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDepartments(member)}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{member.role}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{formatAccess(member)}</td>
                    <td className="px-4 py-3">
                      {canAssignModules(member) ? (
                        <AllowedModulesControl
                          member={member}
                          onAllow={() => openModulesPanel(member)}
                        />
                      ) : member.role === 'user' ? (
                        <span className="text-slate-500">All department modules</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="text-slate-600 hover:text-accent"
                        >
                          Edit
                        </button>
                        {member.role === 'user' ? (
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => {
                              setFormError(null);
                              setPendingRemove(member);
                            }}
                            className="text-rose-500 hover:text-rose-400 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
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
        <MemberModal title="Add Member" onClose={closeCreateModal}>
          <MemberForm
            mode="create"
            form={createForm}
            onChange={setCreateForm}
            onSubmit={(event) => void onCreate(event)}
            submitLabel={creating ? 'Creating…' : 'Add Member'}
            submitting={creating}
            onCancel={closeCreateModal}
            departments={departments}
            departmentsLoading={departmentsLoading}
            error={formError}
          />
        </MemberModal>
      ) : null}

      {editingMember ? (
        <MemberModal title="Edit Member" onClose={closeEditModal}>
          <MemberForm
            mode="edit"
            form={editForm}
            onChange={setEditForm}
            onSubmit={(event) => void onSaveEdit(event)}
            submitLabel={updating ? 'Saving…' : 'Save changes'}
            submitting={updating}
            onCancel={closeEditModal}
            departments={departments}
            departmentsLoading={departmentsLoading}
            showAccess={editingMember.role === 'user'}
            error={formError}
          />
        </MemberModal>
      ) : null}

      {allowingMember ? (
        <MemberModulesPanel
          member={allowingMember}
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
          title="Remove member"
          description={`Remove ${pendingRemove.name} from this tenant? They will lose access to the library.`}
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

function MemberNameLink({
  tenantSlug,
  member,
  field = 'name',
}: {
  tenantSlug: string;
  member: TenantUserDto;
  field?: 'name' | 'username';
}) {
  const label = field === 'username' ? member.username : member.name;
  if (!member.username) {
    return <>{label}</>;
  }
  return (
    <Link href={memberDetailPath(tenantSlug, member.username)} className="hover:text-accent">
      {label}
    </Link>
  );
}

function formatDepartments(member: TenantUserDto) {
  const names = member.departments?.map((department) => department.name).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : '—';
}

function canAssignModules(member: TenantUserDto) {
  return member.role === 'user' && member.access !== MemberAccess.TUTOR;
}

function formatAccess(member: TenantUserDto) {
  if (member.role !== 'user' || !member.access) {
    return '—';
  }
  return member.access;
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
