import type { Metadata } from "next";
import "./globals.css";
import { initCron } from "@/lib/cron";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Adagio Replenishment",
  description: "Multi-location inventory replenishment for Shopify POS",
};

// Initialize cron jobs on server start
if (typeof window === "undefined") {
  initCron();
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          {children}
          <Toaster position="top-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
