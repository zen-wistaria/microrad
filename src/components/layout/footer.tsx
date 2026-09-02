import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

/**
 * Footer aplikasi dengan format:
 * "{nama aplikasi} @ {tahun dibuat} | {versi aplikasi}"
 * Mengambil data dari konfigurasi .ts (@/config/app) yang bersumber dari .env.
 */
export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "w-full border-t border-slate-200/80 bg-white/50 py-3.5 px-4 sm:px-6 text-center text-xs text-slate-500 backdrop-blur-xs transition-colors dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-400 print:hidden",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-center">
        <p className="font-medium tracking-tight">{appConfig.footerText}</p>
      </div>
    </footer>
  );
}

export default Footer;
