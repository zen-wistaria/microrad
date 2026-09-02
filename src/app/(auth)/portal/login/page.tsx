import { Globe } from "lucide-react";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Footer } from "@/components/layout/footer";

/**
 * Server Component untuk Halaman Login Portal Pelanggan.
 * Menampilkan Server Component Footer secara dinamis dari process.env.
 */
export default function PortalLoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
      {/* Tombol switch tema (pojok kanan atas) */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/20 mb-2">
            <Globe className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Customer Self-Care
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Portal Layanan Mandiri Pelanggan Internet
          </p>
        </div>

        {/* Login Card Form */}
        <PortalLoginForm />

        {/* Server Component Footer */}
        <Footer className="border-t-0 bg-transparent py-0" />
      </div>
    </div>
  );
}
