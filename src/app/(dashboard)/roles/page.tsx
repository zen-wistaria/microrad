"use client";

import {
  Check,
  CheckSquare,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createRole, deleteRole, getRoles, updateRole } from "@/lib/api/roles";
import { RESOURCE_KEYS, RESOURCE_LABELS, type ResourceKey } from "@/lib/rbac";
import type { Permission, Role } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { formatDate, getErrorMessage } from "@/lib/utils";

/** Permission read/create/update/delete per resource */
const ACTION_KEYS = ["read", "create", "update", "delete"] as const;

function permissionOf(resource: ResourceKey, action: string): Permission {
  return `${resource}.${action}` as Permission;
}

interface RoleDialogState {
  open: boolean;
  editing: Role | null;
}

interface RoleDetailState {
  open: boolean;
  role: Role | null;
}

export default function RolesSettingsPage() {
  const { currentUser } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<RoleDialogState>({
    open: false,
    editing: null,
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<RoleDetailState>({
    open: false,
    role: null,
  });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setRoles(await getRoles());
    } catch {
      toast.error("Gagal memuat daftar role.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreate = () => {
    setDialog({ open: true, editing: null });
    setName("");
    setDescription("");
    setPermissions([]);
  };

  const openEdit = (role: Role) => {
    setDialog({ open: true, editing: role });
    setName(role.name);
    setDescription(role.description ?? "");
    setPermissions([...role.permissions]);
  };

  const togglePermission = (permission: Permission) => {
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    );
  };

  const toggleResourceAll = (resource: ResourceKey, checked: boolean) => {
    setPermissions((prev) => {
      const current = new Set(prev);
      ACTION_KEYS.forEach((action) => {
        const p = permissionOf(resource, action);
        if (checked) current.add(p);
        else current.delete(p);
      });
      return [...current];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama role wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      if (dialog.editing) {
        await updateRole(dialog.editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
        });
        toast.success(`Role "${name.trim()}" berhasil diperbarui.`);
      } else {
        await createRole({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
        });
        toast.success(`Role "${name.trim()}" berhasil dibuat.`);
      }
      setDialog({ open: false, editing: null });
      await fetchRoles();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan role.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await deleteRole(deleteTarget.id);
      if (!res.success) {
        toast.error(res.error ?? "Gagal menghapus role.");
        setDeleteTarget(null);
        return;
      }
      toast.success(`Role "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      await fetchRoles();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus role.");
    } finally {
      setDeleting(false);
    }
  };

  const permissionCountByResource = (role: Role, resource: ResourceKey) =>
    ACTION_KEYS.filter((a) =>
      role.permissions.includes(permissionOf(resource, a)),
    ).length;

  const isFilteredEmpty = useMemo(() => roles.length === 0, [roles.length]);

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Lock}
            title="Akses Ditolak"
            description="Hanya Administrator yang dapat mengelola role & permissions."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Role &amp; Permissions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola hak akses (RBAC) untuk setiap role. Administrator memiliki
            akses penuh otomatis.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRoles}
            disabled={loading}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            Buat Role Baru
          </Button>
        </div>
      </div>

      {/* Ringkasan permission per modul */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {RESOURCE_KEYS.map((resource) => {
          const total = ACTION_KEYS.length;
          const summary = roles.some((r) => {
            if (r.id === "role-admin") return true;
            return ACTION_KEYS.some((a) =>
              r.permissions.includes(permissionOf(resource, a)),
            );
          });
          return (
            <Card
              key={resource}
              className="border-slate-100 bg-white/70 dark:border-slate-800"
            >
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  {RESOURCE_LABELS[resource]}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {total} izin
                </p>
                <p className="text-[10px] text-slate-400">
                  {summary ? "Aktif pada role" : "Belum aktif"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Daftar Role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Role</CardTitle>
          <CardDescription>
            Role bawaan (Administrator, Manager, Pelanggan) tidak dapat dihapus.
            Role kustom dapat diedit dan dihapus.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isFilteredEmpty ? (
            <div className="py-12">
              <EmptyState
                icon={KeyRound}
                title="Belum ada role"
                description="Buat role baru untuk mulai mengatur hak akses."
                actionLabel="Buat Role Baru"
                onAction={openCreate}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Permissions</th>
                    <th className="hidden py-3 px-4 font-semibold md:table-cell">
                      Dibuat
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {roles.map((role) => {
                    const isSystem = role.system;
                    const isAdmin = role.id === "role-admin";
                    return (
                      <tr
                        key={role.id}
                        onClick={() => setDetail({ open: true, role })}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        title="Klik untuk lihat detail permission"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                              <Shield className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {role.name}
                                {isSystem && (
                                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Sistem
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500 max-w-md">
                                {role.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                              <CheckSquare className="h-3.5 w-3.5" />
                              Akses Penuh (semua permission)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {RESOURCE_KEYS.map((resource) => {
                                const n = permissionCountByResource(
                                  role,
                                  resource,
                                );
                                if (n === 0) return null;
                                return (
                                  <span
                                    key={resource}
                                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                  >
                                    {RESOURCE_LABELS[resource].split(" ")[0]}{" "}
                                    {n}/4
                                  </span>
                                );
                              })}
                              {role.permissions.length === 0 && (
                                <span className="text-[11px] italic text-slate-400">
                                  Tanpa izin
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="hidden py-3.5 px-4 text-xs text-slate-500 md:table-cell">
                          {formatDate(role.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetail({ open: true, role });
                              }}
                              className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Detail
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSystem}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(role);
                              }}
                              className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSystem}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(role);
                              }}
                              className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Buat/Edit Role */}
      <Dialog
        open={dialog.open}
        onOpenChange={(open) =>
          !open && setDialog({ open: false, editing: null })
        }
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.editing
                ? `Edit Role "${dialog.editing.name}"`
                : "Buat Role Baru"}
            </DialogTitle>
            <DialogDescription>
              Atur nama, deskripsi, dan permission (read / create / update /
              delete) untuk role ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role-name">Nama Role</Label>
                <Input
                  id="role-name"
                  placeholder="mis. Kasir Billing"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-desc">Deskripsi</Label>
                <Input
                  id="role-desc"
                  placeholder="Deskripsi singkat role..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800">
                {RESOURCE_KEYS.map((resource) => {
                  const checkedAll = ACTION_KEYS.every((a) =>
                    permissions.includes(permissionOf(resource, a)),
                  );
                  return (
                    <div
                      key={resource}
                      className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 dark:border-slate-800"
                    >
                      <div className="flex min-w-36 flex-1 items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {RESOURCE_LABELS[resource]}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            toggleResourceAll(resource, !checkedAll)
                          }
                          className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {checkedAll ? "Batal semua" : "Pilih semua"}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {ACTION_KEYS.map((action) => {
                          const permission = permissionOf(resource, action);
                          const checked = permissions.includes(permission);
                          return (
                            <label
                              key={permission}
                              className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(permission)}
                                className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                              />
                              {action}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">
                Terpilih {permissions.length} dari 24 permission.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, editing: null })}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog.editing ? "Simpan Perubahan" : "Buat Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Role */}
      <Dialog
        open={detail.open}
        onOpenChange={(open) => !open && setDetail({ open: false, role: null })}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {detail.role?.name}
                  {detail.role?.system && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Sistem
                    </span>
                  )}
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  {detail.role?.description}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {detail.role?.id === "role-admin" ? (
              <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-4 text-sm text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300">
                🛡️ Administrator memiliki akses penuh otomatis ke seluruh modul
                dan permission (read, create, update, delete). Izin tidak dapat
                diubah.
              </div>
            ) : (
              RESOURCE_KEYS.map((resource) => {
                const granted = ACTION_KEYS.filter((a) =>
                  detail.role?.permissions.includes(permissionOf(resource, a)),
                );
                if (granted.length === 0) return null;
                return (
                  <div
                    key={resource}
                    className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {RESOURCE_LABELS[resource]}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {granted.length}/{ACTION_KEYS.length} izin
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ACTION_KEYS.map((action) => {
                        const has = detail.role?.permissions.includes(
                          permissionOf(resource, action),
                        );
                        return (
                          <span
                            key={action}
                            className={
                              has
                                ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:bg-slate-800/60 dark:text-slate-500"
                            }
                          >
                            {has ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            {action}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            {detail.role &&
              detail.role.id !== "role-admin" &&
              detail.role.permissions.length === 0 && (
                <div className="rounded-lg border border-slate-100 p-4 text-center text-sm text-slate-400 dark:border-slate-800">
                  Role ini tidak memiliki permission apa pun (read-only sistem).
                </div>
              )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetail({ open: false, role: null })}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Role?"
        description={`Apakah Anda yakin ingin menghapus role '${deleteTarget?.name}'? Pengguna dengan role ini tidak akan memiliki akses sampai role lain ditetapkan.`}
        confirmLabel={deleting ? "Menghapus..." : "Hapus Role"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
