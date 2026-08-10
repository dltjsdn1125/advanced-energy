import type { Metadata, Viewport } from "next";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

export const metadata: Metadata = {
  title: "AE Catalogue · Semigate",
  description:
    "Advanced Energy Embedded Power Catalogue — AC-DC / DC-DC power conversion. Search the catalogue and find products by spec.",
};

export const viewport: Viewport = {
  themeColor: "#0f3460",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="flex min-h-[100dvh] flex-col bg-white text-black antialiased">
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
