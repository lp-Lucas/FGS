import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avaliador FGS",
  description: "Sistema para pontuar ideias, ganchos e scripts curtos pela metodologia FGS."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
