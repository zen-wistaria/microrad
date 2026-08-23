"use client";

import {
  Ban,
  CheckCircle,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  PowerOff,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { CustomerStatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBulkCustomerActionMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useDisconnectCustomerMutation,
  useInternetProfilesQuery,
  useUpdateCustomerMutation,
} from "@/lib/api/hooks";
import { hasPermission } from "@/lib/rbac";
import type { Customer, CustomerStatus, InternetProfile } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useDebounce } from "@/lib/use-debounce";
import { formatRelativeTime, getErrorMessage } from "@/lib/utils";

export default function CustomersPage() {
  const { currentUser } = useAuth();

  // Filters & Search (via nuqs — konsisten saat refresh)
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );
  const [profileFilter, setProfileFilter] = useQueryState(
    "profile",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs — konsisten saat refresh)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50
  const safePage = Math.max(page, 1);

  // TanStack Query
  const {
    data: custRes,
    isLoading: customersLoading,
    refetch,
    isFetching,
  } = useCustomersQuery({
    search: search.trim() || undefined,
    status: statusFilter,
    profileId: profileFilter,
    page: safePage,
    limit: safeLimit,
  });

  const { data: netProfilesRes } = useInternetProfilesQuery();
  const profiles = netProfilesRes?.data || [];

  const deleteCustomerMutation = useDeleteCustomerMutation();
  const disconnectCustomerMutation = useDisconnectCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();
  const bulkCustomerActionMutation = useBulkCustomerActionMutation();

  const customers = custRes?.data || [];
  const totalCount = custRes?.total || 0;
  const loading = customersLoading && !custRes;
  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog State
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Customer | null>(
    null,
  );
  const [bulkTarget, setBulkTarget] = useState<{
    action: "activate" | "disconnect" | "suspend" | "disable" | "delete";
    title: string;
    description: string;
    confirmLabel: string;
    variant?: "destructive" | "default";
  } | null>(null);

  // Sync debounced search input to nuqs URL state
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search, setSearch, setPage]);

  // Keep local input in sync if URL search param is changed externally
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Reset selection saat page / filter berubah
  useEffect(() => {
    if (page || limit || statusFilter || profileFilter || search) {
      setSelectedIds(new Set());
    }
  }, [page, limit, statusFilter, profileFilter, search]);

  const profileMap = useMemo(() => {
    const map = new Map<string, InternetProfile>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    return map;
  }, [profiles]);

  // Selection handlers
  const allCurrentPageSelected =
    customers.length > 0 && customers.every((c) => selectedIds.has(c.id));
  const someCurrentPageSelected =
    customers.some((c) => selectedIds.has(c.id)) && !allCurrentPageSelected;

  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of customers) next.delete(c.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of customers) next.add(c.id);
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Actions
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomerMutation.mutateAsync(deleteTarget.id);
      toast.success(`Pelanggan ${deleteTarget.username} berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus pelanggan.");
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    try {
      await disconnectCustomerMutation.mutateAsync(disconnectTarget.id);
      toast.success(
        `Koneksi pelanggan ${disconnectTarget.username} berhasil diputuskan.`,
      );
      setDisconnectTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan koneksi.");
    }
  };

  const handleBulkAction = async () => {
    if (!bulkTarget || selectedIds.size === 0) return;
    const customerIds = Array.from(selectedIds);
    try {
      const res = await bulkCustomerActionMutation.mutateAsync({
        action: bulkTarget.action,
        customerIds,
      });
      toast.success(res.message || "Aksi massal berhasil diproses.");
      setSelectedIds(new Set());
      setBulkTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memproses aksi massal.");
    }
  };

  const handleUpdateStatus = async (
    customer: Customer,
    newStatus: CustomerStatus,
  ) => {
    try {
      await updateCustomerMutation.mutateAsync({
        id: customer.id,
        updates: { status: newStatus },
      });
      if (newStatus !== "active") {
        try {
          await disconnectCustomerMutation.mutateAsync(customer.id);
        } catch {
          // best-effort
        }
      }
      const labelMap: Record<CustomerStatus, string> = {
        active: "Aktif",
        suspended: "Suspend (Isolir)",
        disabled: "Dinonaktifkan (Disabled)",
      };
      toast.success(
        `Status pelanggan ${customer.username} diubah menjadi ${labelMap[newStatus]}${
          newStatus !== "active" ? " & koneksi aktif diputuskan" : ""
        }.`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal mengubah status pelanggan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Pelanggan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola akun pelanggan, konfigurasi paket bandwidth, IP statis, dan
            status layanan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            <span>Segarkan</span>
          </Button>
          {hasPermission(currentUser, "customer.create") && (
            <Link href="/customers/new">
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Pelanggan</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                Total Pelanggan
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalCount}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Pelanggan Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                {customers.filter((c) => c.status === "active").length}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Sedang Online (PPPoE)
              </p>
              <h3 className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-100">
                {customers.filter((c) => c.isOnline).length}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Suspend / Isolir
              </p>
              <h3 className="mt-1 text-2xl font-bold text-rose-950 dark:text-rose-100">
                {customers.filter((c) => c.status === "suspended").length}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari username PPPoE, nama, telepon, IP..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            {/* Filter Selects */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-40">
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
                    <SelectItem value="suspended">
                      Suspend (Terisolir)
                    </SelectItem>
                    <SelectItem value="disabled">Non-aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-44">
                <Select
                  value={profileFilter}
                  onValueChange={(v) => {
                    setProfileFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Profil Paket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Paket</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(search ||
                statusFilter !== "all" ||
                profileFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStatusFilter("all");
                    setProfileFilter("all");
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

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      indeterminate={someCurrentPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua di halaman ini"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Username PPPoE</th>
                  <th className="py-3 px-4 font-semibold">Nama Lengkap</th>
                  <th className="py-3 px-4 font-semibold">Profil Paket</th>
                  <th className="py-3 px-4 font-semibold">Status / Koneksi</th>
                  <th className="py-3 px-4 font-semibold">IP Statis</th>
                  <th className="py-3 px-4 font-semibold">Terakhir Online</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={Users}
                        title="Tidak ada pelanggan ditemukan"
                        description="Coba ubah kata kunci pencarian atau filter yang dipilih."
                        actionLabel="Tambah Pelanggan Baru"
                        actionHref="/customers/new"
                      />
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const isOnline = Boolean(customer.isOnline);
                    const profile = profileMap.get(customer.profileId);
                    const isSelected = selectedIds.has(customer.id);

                    return (
                      <tr
                        key={customer.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50/60 dark:bg-blue-950/30"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="py-3.5 px-4 w-10 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(customer.id)}
                            aria-label={`Pilih ${customer.username}`}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={`/customers/${customer.id}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            >
                              {customer.username}
                            </Link>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          <div className="font-medium">
                            {customer.fullName || "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {profile ? (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                              <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                              {profile.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <CustomerStatusBadge
                            status={customer.status}
                            isOnline={isOnline}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {customer.staticIp || (
                            <span className="text-slate-400 italic">
                              Dynamic
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {isOnline ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Sedang Online
                            </span>
                          ) : (
                            formatRelativeTime(customer.lastSeenAt)
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <span className="sr-only">Buka menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-xs">
                                Aksi Pelanggan
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/customers/${customer.id}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Lihat Detail</span>
                                </Link>
                              </DropdownMenuItem>

                              {hasPermission(
                                currentUser,
                                "customer.update",
                              ) && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/customers/${customer.id}/edit`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Edit Data</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/billing?customerId=${customer.id}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Receipt className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Lihat Tagihan</span>
                                </Link>
                              </DropdownMenuItem>

                              {hasPermission(
                                currentUser,
                                "customer.update",
                              ) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[11px] text-slate-400 font-normal">
                                    Ubah Status Layanan
                                  </DropdownMenuLabel>

                                  {customer.status !== "active" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(customer, "active")
                                      }
                                      className="text-emerald-600 focus:text-emerald-700 cursor-pointer gap-2"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      <span>Aktifkan Kembali</span>
                                    </DropdownMenuItem>
                                  )}

                                  {customer.status !== "suspended" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(
                                          customer,
                                          "suspended",
                                        )
                                      }
                                      className="text-amber-600 focus:text-amber-700 cursor-pointer gap-2"
                                    >
                                      <CircleAlert className="h-3.5 w-3.5" />
                                      <span>Suspend (Isolir)</span>
                                    </DropdownMenuItem>
                                  )}

                                  {customer.status !== "disabled" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(customer, "disabled")
                                      }
                                      className="text-slate-600 focus:text-slate-700 cursor-pointer gap-2"
                                    >
                                      <CircleX className="h-3.5 w-3.5" />
                                      <span>Nonaktifkan</span>
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}

                              {isOnline &&
                                hasPermission(
                                  currentUser,
                                  "session.update",
                                ) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setDisconnectTarget(customer)
                                      }
                                      className="text-rose-600 focus:text-rose-700 cursor-pointer gap-2"
                                    >
                                      <PowerOff className="h-3.5 w-3.5" />
                                      <span>Putus Koneksi PPPoE</span>
                                    </DropdownMenuItem>
                                  </>
                                )}

                              {hasPermission(
                                currentUser,
                                "customer.delete",
                              ) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteTarget(customer)}
                                    className="text-rose-600 focus:text-rose-700 cursor-pointer gap-2"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Hapus Pelanggan</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Baris per halaman:</span>
                <Select
                  value={String(safeLimit)}
                  onValueChange={(val) => {
                    setLimit(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue placeholder={String(safeLimit)} />
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

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 px-4 py-2.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
              {selectedIds.size} dipilih
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {hasPermission(currentUser, "session.update") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setBulkTarget({
                    action: "disconnect",
                    title: "Putuskan Koneksi Massal",
                    description: `Apakah Anda yakin ingin memutuskan koneksi aktif untuk ${selectedIds.size} pelanggan yang dipilih? Perintah Disconnect-Request CoA akan dikirimkan ke router.`,
                    confirmLabel: "Putuskan Semua",
                    variant: "destructive",
                  })
                }
                className="h-8 gap-1.5 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-950/50"
              >
                <PowerOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Putuskan Koneksi</span>
              </Button>
            )}

            {hasPermission(currentUser, "customer.update") && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setBulkTarget({
                      action: "activate",
                      title: "Aktifkan Pelanggan Massal",
                      description: `Apakah Anda yakin ingin mengaktifkan kembali status ${selectedIds.size} pelanggan yang dipilih? Pelanggan dapat kembali melakukan dial-in PPPoE.`,
                      confirmLabel: "Aktifkan Semua",
                      variant: "default",
                    })
                  }
                  className="h-8 gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Aktifkan</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setBulkTarget({
                      action: "suspend",
                      title: "Suspend Pelanggan Massal",
                      description: `Apakah Anda yakin ingin mengubah status ${selectedIds.size} pelanggan yang dipilih menjadi Suspend (Isolir)? Login PPPoE akan ditolak dan koneksi aktif akan diputuskan.`,
                      confirmLabel: "Suspend Semua",
                      variant: "destructive",
                    })
                  }
                  className="h-8 gap-1.5 text-xs text-orange-300 hover:text-orange-200 hover:bg-orange-950/50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Suspend</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setBulkTarget({
                      action: "disable",
                      title: "Nonaktifkan Pelanggan Massal",
                      description: `Apakah Anda yakin ingin menonaktifkan ${selectedIds.size} pelanggan yang dipilih? Pelanggan tidak dapat login PPPoE maupun portal langganan.`,
                      confirmLabel: "Nonaktifkan Semua",
                      variant: "destructive",
                    })
                  }
                  className="h-8 gap-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
                >
                  <CircleX className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nonaktifkan</span>
                </Button>
              </>
            )}

            {hasPermission(currentUser, "customer.delete") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setBulkTarget({
                    action: "delete",
                    title: "Hapus Pelanggan Massal",
                    description: `PERINGATAN: Tindakan ini tidak dapat dibatalkan! Apakah Anda yakin ingin menghapus ${selectedIds.size} pelanggan yang dipilih beserta seluruh data RADIUS dan histori sesi terkait?`,
                    confirmLabel: "Hapus Permanen",
                    variant: "destructive",
                  })
                }
                className="h-8 gap-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hapus</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Akun Pelanggan?"
        description={`Apakah Anda yakin ingin menghapus pelanggan '${deleteTarget?.username}'? Data autentikasi RADIUS dan histori sesi terkait akan dihapus permanen.`}
        confirmLabel="Hapus Pelanggan"
        onConfirm={handleDelete}
      />

      {/* Disconnect Single Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        title="Putuskan Sesi PPPoE?"
        description={`Apakah Anda yakin ingin memutuskan koneksi aktif untuk '${disconnectTarget?.username}'? Perintah disconnect CoA akan dikirimkan ke router MikroTik.`}
        confirmLabel="Putuskan Sekarang"
        variant="destructive"
        onConfirm={handleDisconnect}
      />

      {/* Bulk Action Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(bulkTarget)}
        onOpenChange={(open) => !open && setBulkTarget(null)}
        title={bulkTarget?.title || "Konfirmasi Aksi Massal"}
        description={bulkTarget?.description || ""}
        confirmLabel={bulkTarget?.confirmLabel || "Konfirmasi"}
        variant={bulkTarget?.variant || "default"}
        onConfirm={handleBulkAction}
      />
    </div>
  );
}
