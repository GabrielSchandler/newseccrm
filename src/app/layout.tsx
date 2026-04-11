import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM SaaS",
  description: "CRM SaaS multiempresa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
