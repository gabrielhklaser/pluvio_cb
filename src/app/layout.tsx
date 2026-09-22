import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pluviometria Campo Bom e região | Dados ANA",
  description:
    "Consulta de dados pluviométricos das estações da ANA em Campo Bom (RS) e arredores, com exportação em CSV de dados recentes, séries históricas e temperatura.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
