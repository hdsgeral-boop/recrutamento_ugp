import Image from "next/image";
import Link from "next/link";

import { NavPainel, type OpcaoMenu } from "@/components/nav-painel";
import { sair } from "@/app/admin/accoes-login";
import { sessaoActual } from "@/lib/utilizadores";
import { pode } from "@/lib/permissoes";
import { EMPRESA } from "@/lib/constantes";

export const metadata = { robots: { index: false, follow: false } };

/** O painel mostra sempre quem está ligado, por isso nunca é estático. */
export const dynamic = "force-dynamic";

/** Cabeçalho comum a todas as páginas do painel. */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoActual();
  const papel = sessao?.papel ?? "visualizador";

  // O menu só mostra o que este papel pode abrir.
  const opcoes: OpcaoMenu[] = [
    { href: "/admin", rotulo: "Candidaturas", icone: "Users" },
    { href: "/admin/ranking", rotulo: "Ranking", icone: "Trophy" },
    { href: "/admin/comunicacoes", rotulo: "Comunicações", icone: "MessageSquare" },
    ...(pode(papel, "configurar")
      ? [{ href: "/admin/definicoes", rotulo: "Definições", icone: "SlidersHorizontal" as const }]
      : []),
    ...(pode(papel, "gerir_utilizadores")
      ? [{ href: "/admin/utilizadores", rotulo: "Utilizadores", icone: "ShieldCheck" as const }]
      : []),
    { href: "/admin/perfil", rotulo: "Os meus dados", icone: "UserCog" },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-consulvolt-preto text-white">
        <div className="container relative flex h-16 items-center gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1 ring-1 ring-white/20 sm:h-10 sm:w-10">
              <Image
                src="/logo-consulvolt.png"
                alt="Logótipo da Consulvolt"
                width={40}
                height={40}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-bold tracking-widest">
                CONSUL<span className="text-consulvolt-amarelo">VOLT</span>
              </span>
              <span className="hidden truncate text-[10px] text-slate-400 sm:block">
                Recrutamento - {EMPRESA.vaga}
              </span>
            </span>
          </Link>

          <NavPainel
            opcoes={opcoes}
            nome={sessao?.nome || sessao?.utilizador || "Sessão"}
            papel={papel}
            sair={sair}
          />
        </div>
      </header>

      <main className="container py-5 sm:py-6">{children}</main>
    </div>
  );
}
