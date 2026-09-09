import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { EMPRESA } from "@/lib/constantes";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `Recrutamento ${EMPRESA.vaga} | ${EMPRESA.nome}`,
    template: `%s | ${EMPRESA.nome}`,
  },
  description: `Candidaturas para ${EMPRESA.vaga} - ${EMPRESA.projecto}. Zona de influência da UGP, Luanda.`,
  robots: { index: true, follow: true },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: EMPRESA.cores.preto,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" suppressHydrationWarning>
      <body className="min-h-dvh bg-slate-50">
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
