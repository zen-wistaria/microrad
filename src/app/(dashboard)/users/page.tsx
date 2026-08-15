"use client";

import {
  Edit,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  AppUserRoleBadge,
  AppUserStatusBadge,
} from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteUser, getUsers, updateUser } from "@/lib/api/users";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { AppUser, AppUserStatus } from "@/lib/types";
import { formatDate, getErrorMessage } from "@/lib/utils";

export default function UsersPage() {
  const { currentUser } = useAuth();
  const canManageUsers = hasPermission(currentUser, "user.create");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  // Search & Filters (via nuqs — konsisten saat refresh)
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );
  const [roleFilter, setRoleFilter] = useQueryState(
    "role",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs — konsisten saat refresh)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getUsers();
      setUsers(list);
    } catch (_e) {
      toast.error("Gagal memuat pengguna aplikasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered users (search + status + role)
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchSearch =
        q === "" ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "manager"
          ? u.roleId === "role-manager"
          : u.role === roleFilter);
      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  // Pagination slice
  const totalPages = Math.ceil(filteredUsers.length / safeLimit) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * safeLimit;
    return filteredUsers.slice(start, start + safeLimit);
  }, [filteredUsers, safePage, safeLimit]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri.");
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`Pengguna ${deleteTarget.name} berhasil dihapus.`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus pengguna.");
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    if (user.id === currentUser?.id) {
      toast.error("Anda tidak dapat menonaktifkan akun Anda sendiri.");
      return;
    }
    const newStatus: AppUserStatus =
      user.status === "active" ? "disabled" : "active";
    try {
      await updateUser(user.id, { status: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)),
      );
      toast.success(
        `Status ${user.name} diubah menjadi ${newStatus === "active" ? "Aktif" : "Nonaktif"}.`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal mengubah status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Pengguna Aplikasi (App Users)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola akun administrator dan operator yang memiliki akses ke
            dashboard manajemen PPPoE ini.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {canManageUsers && (
            <Button asChild size="sm" className="gap-1.5 text-xs shadow-sm">
              <Link href="/users/new">
                <Plus className="h-4 w-4" />
                Tambah Pengguna Baru
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari nama pengguna atau email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-36">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="disabled">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-44">
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="customer">Pelanggan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(search || statusFilter !== "all" || roleFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setRoleFilter("all");
                    setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nama Pengguna</th>
                  <th className="py-3 px-4 font-semibold">Email Login</th>
                  <th className="py-3 px-4 font-semibold">Role / Hak Akses</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">
                    Tanggal Ditambahkan
                  </th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState
                        icon={ShieldCheck}
                        title={
                          search ||
                          statusFilter !== "all" ||
                          roleFilter !== "all"
                            ? "Tidak ada pengguna yang cocok"
                            : "Belum ada pengguna"
                        }
                        description={
                          search ||
                          statusFilter !== "all" ||
                          roleFilter !== "all"
                            ? "Tidak ada pengguna yang sesuai dengan filter atau pencarian Anda."
                            : "Tambahkan pengguna baru untuk mengelola sistem."
                        }
                        actionLabel={
                          canManageUsers ? "Tambah Pengguna Pertama" : undefined
                        }
                        actionHref={canManageUsers ? "/users/new" : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const isSelf = user.id === currentUser?.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {user.name.charAt(0)}
                            </div>
                            <span>{user.name}</span>
                            {isSelf && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                                Anda
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {user.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <AppUserRoleBadge
                            role={user.role}
                            roleId={user.roleId}
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <AppUserStatusBadge status={user.status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasPermission(currentUser, "user.update") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(user)}
                                disabled={isSelf}
                                title={
                                  user.status === "active"
                                    ? "Nonaktifkan"
                                    : "Aktifkan"
                                }
                                className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                              >
                                {user.status === "active"
                                  ? "Blokir"
                                  : "Aktifkan"}
                              </Button>
                            )}
                            {hasPermission(currentUser, "user.update") && (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                              >
                                <Link href={`/users/${user.id}/edit`}>
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Link>
                              </Button>
                            )}
                            {hasPermission(currentUser, "user.delete") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isSelf}
                                onClick={() => setDeleteTarget(user)}
                                className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && filteredUsers.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(
                      (safePage - 1) * safeLimit + 1,
                      filteredUsers.length,
                    )}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, filteredUsers.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {filteredUsers.length}
                  </span>{" "}
                  pengguna
                </span>
                <Select
                  value={String(safeLimit)}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 px-3 text-xs"
                >
                  Sebelumnya
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hal {safePage} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-8 px-3 text-xs"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Pengguna Dashboard?"
        description={`Apakah Anda yakin ingin menghapus akun '${deleteTarget?.name}' (${deleteTarget?.email})? Pengguna ini tidak akan bisa login kembali ke sistem.`}
        confirmLabel="Hapus Pengguna"
        onConfirm={handleDelete}
      />
    </div>
  );
}
