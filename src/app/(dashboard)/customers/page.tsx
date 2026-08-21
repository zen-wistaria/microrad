"use client";

import {
  AlertCircle,
  Ban,
  CheckCircle2,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { CustomerStatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  deleteCustomer,
  disconnectCustomer,
  getCustomersPaginated,
  updateCustomer,
} from "@/lib/api/customers";
import { getProfiles } from "@/lib/api/profiles";
import { hasPermission } from "@/lib/rbac";
import type { BandwidthProfile, Customer, CustomerStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useDebounce } from "@/lib/use-debounce";
import { formatRelativeTime, getErrorMessage } from "@/lib/utils";

export default function CustomersPage() {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [profiles, setProfiles] = useState<BandwidthProfile[]>([]);
  const [loading, setLoading] = useState(true);

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
  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  // Dialog State
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Customer | null>(
    null,
  );

  // Sync debounced search input to nuqs URL state
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search, setSearch, setPage]);

  // Keep local input in sync if URL search param is changed externally (e.g. back/forward or reset)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, profList] = await Promise.all([
        getCustomersPaginated({
          search: search.trim() || undefined,
          status: statusFilter,
          profileId: profileFilter,
          page: safePage,
          limit: safeLimit,
        }),
        getProfiles(),
      ]);
      setCustomers(custRes.data);
      setTotalCount(custRes.total);
      setProfiles(profList);
    } catch (_e) {
      toast.error("Gagal memuat data pelanggan.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, profileFilter, safePage, safeLimit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profileMap = useMemo(() => {
    const map = new Map<string, BandwidthProfile>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    return map;
  }, [profiles]);

  // Actions
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      toast.success(`Pelanggan ${deleteTarget.username} berhasil dihapus.`);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus pelanggan.");
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    try {
      await disconnectCustomer(disconnectTarget.id);
      toast.success(
        `Koneksi pelanggan ${disconnectTarget.username} berhasil diputuskan.`,
      );
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === disconnectTarget.id
            ? {
                ...c,
                currentSessionId: undefined,
                lastSeenAt: new Date().toISOString(),
              }
            : c,
        ),
      );
      setDisconnectTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan koneksi.");
    }
  };

  const handleUpdateStatus = async (
    customer: Customer,
    newStatus: CustomerStatus,
  ) => {
    try {
      await updateCustomer(customer.id, { status: newStatus });
      // Jika diubah menjadi non-aktif (suspended/disabled) dan memiliki sesi online, putus koneksi
      if (newStatus !== "active") {
        try {
          await disconnectCustomer(customer.id);
        } catch {
          // best-effort, backend PUT juga memutus sesi otomatis
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
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id ? { ...c, status: newStatus } : c,
        ),
      );
      await fetchData();
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
            onClick={fetchData}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {hasPermission(currentUser, "customer.create") && (
            <Button asChild size="sm" className="gap-1.5 text-xs shadow-sm">
              <Link href="/customers/new">
                <Plus className="h-4 w-4" />
                Tambah Pelanggan
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari username, nama, telepon, atau IP..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            {/* Faceted Filters */}
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
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="suspended">🟡 Suspended</SelectItem>
                    <SelectItem value="disabled">⚪ Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-48">
                <Select
                  value={profileFilter}
                  onValueChange={(v) => {
                    setProfileFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semua Paket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Paket Bandwidth</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(search ||
                searchInput ||
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
                  Reset Filter
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
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        icon={Users}
                        title="Tidak ada pelanggan ditemukan"
                        description={
                          search ||
                          statusFilter !== "all" ||
                          profileFilter !== "all"
                            ? "Coba ubah kata kunci pencarian atau filter yang dipilih."
                            : "Belum ada pelanggan yang terdaftar."
                        }
                        actionLabel={
                          search ||
                          statusFilter !== "all" ||
                          profileFilter !== "all"
                            ? undefined
                            : "Tambah Pelanggan Baru"
                        }
                        actionHref="/customers/new"
                      />
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const isOnline = Boolean(customer.isOnline);
                    const profile = profileMap.get(customer.profileId);

                    return (
                      <tr
                        key={customer.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {customer.username}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          <div className="font-medium">
                            {customer.fullName || "-"}
                          </div>
                          {customer.phone && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {customer.phone}
                            </div>
                          )}
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
                              Dynamic Pool
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
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Menu Aksi</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel className="text-xs">
                                Aksi Pelanggan
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer text-xs"
                              >
                                <Link href={`/customers/${customer.id}`}>
                                  <Eye className="mr-2 h-4 w-4 text-slate-500" />
                                  Lihat Detail
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer text-xs"
                              >
                                <Link
                                  href={`/billing?search=${encodeURIComponent(customer.username)}`}
                                >
                                  <Receipt className="mr-2 h-4 w-4 text-slate-500" />
                                  Lihat Tagihan
                                </Link>
                              </DropdownMenuItem>
                              {hasPermission(
                                currentUser,
                                "customer.update",
                              ) && (
                                <>
                                  <DropdownMenuItem
                                    asChild
                                    className="cursor-pointer text-xs"
                                  >
                                    <Link
                                      href={`/customers/${customer.id}/edit`}
                                    >
                                      <Edit className="mr-2 h-4 w-4 text-slate-500" />
                                      Edit Akun
                                    </Link>
                                  </DropdownMenuItem>

                                  {/* Opsi status: Aktifkan, Suspend, Disable */}
                                  {customer.status !== "active" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(customer, "active")
                                      }
                                      className="cursor-pointer text-xs text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                                      Aktifkan Kembali
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
                                      className="cursor-pointer text-xs text-amber-600 focus:text-amber-600 dark:text-amber-400"
                                    >
                                      <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                                      Suspend (Isolir)
                                    </DropdownMenuItem>
                                  )}

                                  {customer.status !== "disabled" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(customer, "disabled")
                                      }
                                      className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 dark:text-rose-400"
                                    >
                                      <Ban className="mr-2 h-4 w-4 text-rose-500" />
                                      Nonaktifkan (Disable)
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {isOnline &&
                                hasPermission(
                                  currentUser,
                                  "session.update",
                                ) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setDisconnectTarget(customer)
                                    }
                                    className="cursor-pointer text-xs text-amber-600 focus:text-amber-600"
                                  >
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Putuskan Koneksi
                                  </DropdownMenuItem>
                                )}
                              {hasPermission(
                                currentUser,
                                "customer.delete",
                              ) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteTarget(customer)}
                                    className="cursor-pointer text-xs text-rose-600 focus:text-rose-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus Pelanggan
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

          {/* Pagination Footer */}
          {!loading && totalCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min((safePage - 1) * safeLimit + 1, totalCount)}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, totalCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {totalCount}
                  </span>{" "}
                  pelanggan
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
        title="Hapus Akun Pelanggan?"
        description={`Apakah Anda yakin ingin menghapus pelanggan '${deleteTarget?.username}'? Data autentikasi RADIUS dan histori sesi terkait akan dihapus permanen.`}
        confirmLabel="Hapus Pelanggan"
        onConfirm={handleDelete}
      />

      {/* Disconnect Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        title="Putuskan Sesi PPPoE?"
        description={`Apakah Anda yakin ingin memutuskan koneksi aktif untuk '${disconnectTarget?.username}'? Perintah disconnect CoA akan dikirimkan ke router MikroTik.`}
        confirmLabel="Putuskan Sekarang"
        variant="destructive"
        onConfirm={handleDisconnect}
      />
    </div>
  );
}
