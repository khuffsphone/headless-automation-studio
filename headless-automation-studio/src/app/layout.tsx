// src/app/layout.tsx
//
// Root layout. Imports globals.css so Tailwind utilities are available
// throughout the app. The metadata block is intentionally minimal for
// Phase One.

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Headless Automation Studio — Layer One",
  description:
    "Local-first discussion room for coordinating specialization-aware AI responses and capturing structured decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
