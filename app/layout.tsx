import type { Metadata } from "next";
import Link from "next/link";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Family Ledger",
  description: "Funeral contribution ledger with WhatsApp-ready updates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gradient-to-b from-stone-100 via-white to-emerald-50/50">
          <header className="border-b bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-8xl items-start justify-between gap-3 px-3 py-4 sm:items-center sm:px-4">
              <div className="min-w-0">
                <Link href="/" className="block text-base font-semibold tracking-tight sm:text-lg">
                  Family Contributions Ledger
                </Link>
                <p className="text-xs text-muted-foreground">
                  Manual M-Pesa contribution tracking for family updates
                </p>
              </div>
              <nav className="flex shrink-0 items-center gap-3 text-sm">
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-8xl px-3 py-5 sm:px-4 sm:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
