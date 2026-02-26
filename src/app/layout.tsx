import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arwah - Tahlil Card Generator",
  description: "Generate Malaysian Tahlil/Al-Fatihah memorial cards",
  manifest: "/manifest.json",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms">
      <body>{children}</body>
    </html>
  );
}
