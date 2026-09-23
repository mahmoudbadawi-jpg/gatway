import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "GATway — GAT / Qudurat Exam Prep",
  description: "Bilingual GAT (Qudurat) exam prep platform for Grades 4–12.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-canvas font-sans text-navy">
        <LanguageProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="no-print border-t border-border py-6 text-center text-sm text-navy/60">
      All Rights Reserved © 2026 LingoBite Academy
    </footer>
  );
}
