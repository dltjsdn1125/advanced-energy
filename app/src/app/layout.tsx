import type { Metadata } from "next";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "AE Catalogue Search · 2026",
  description:
    "Searchable index of the Advanced Energy Embedded Power Catalogue 2026 — AC-DC / DC-DC power conversion solutions.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="flex min-h-[100dvh] flex-col bg-white text-black antialiased">
        <AuthProvider>
          <GlobalNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
