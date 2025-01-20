import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kirbo Autolister",
  description: "Automate your product listings across multiple platforms",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider defaultTheme="system" storageKey="kirbo-theme">
            <div className="relative flex min-h-screen flex-col">{children}</div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
