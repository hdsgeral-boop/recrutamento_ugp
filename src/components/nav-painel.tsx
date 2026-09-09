"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Menu,
  MessageSquare,
  SlidersHorizontal,
  ShieldCheck,
  Trophy,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { DEFINICOES, type Papel } from "@/lib/permissoes";

/**
 * ===========================================================================
 * NAVEGAÇÃO DO PAINEL
 * ---------------------------------------------------------------------------
 * Em ecrã largo, as opções ficam todas à vista. Em ecrã estreito - telemóvel,
 * tablet ao alto, janela encolhida - passam para um menu em hambúrguer, com o
 * nome de quem está ligado e o botão de sair lá dentro.
 *
 * O corte é aos 1280px (xl) e não a olho: com seis opções mais o nome do
 * utilizador, é abaixo disso que a barra começa a apertar - a sexta opção,
 * "Definições", empurrou o corte de 1024 para 1280.
 * ===========================================================================
 */

const ICONES = { Users, Trophy, MessageSquare, SlidersHorizontal, ShieldCheck, UserCog } as const;

export interface OpcaoMenu {
  href: string;
  rotulo: string;
  icone: keyof typeof ICONES;
}

export function NavPainel({
  opcoes,
  nome,
  papel,
  sair,
}: {
  opcoes: OpcaoMenu[];
  nome: string;
  papel: Papel;
  sair: () => Promise<void>;
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  // Fechar o menu ao mudar de página, senão fica aberto por cima do conteúdo.
  useEffect(() => setAberto(false), [caminho]);

  // Fechar com Escape, para quem navega por teclado.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  const activo = (href: string) =>
    href === "/admin" ? caminho === "/admin" : caminho.startsWith(href);

  const Opcao = ({ o, largo }: { o: OpcaoMenu; largo?: boolean }) => {
    const Icone = ICONES[o.icone];
    return (
      <Link
        href={o.href}
        className={cn(
          "flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
          largo ? "px-3 py-3" : "px-3 py-2",
          activo(o.href)
            ? "bg-white/15 text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icone className="h-4 w-4 shrink-0" />
        {o.rotulo}
      </Link>
    );
  };

  return (
    <>
      {/* ------------------------------------------------ ECRÃ LARGO ------ */}
      <nav className="ml-auto hidden items-center gap-1 xl:flex">
        {opcoes.map((o) => (
          <Opcao key={o.href} o={o} />
        ))}
      </nav>

      <div className="hidden items-center gap-3 border-l border-white/15 pl-3 xl:flex">
        <Link
          href="/admin/perfil"
          title="Os meus dados"
          className="rounded-md px-2 py-1 text-right leading-tight transition-colors hover:bg-white/10"
        >
          <p className="max-w-[150px] truncate text-sm font-medium text-white">{nome}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            {DEFINICOES[papel].rotulo}
          </p>
        </Link>

        <form action={sair}>
          <button
            type="submit"
            title="Sair"
            className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sair</span>
          </button>
        </form>
      </div>

      {/* ------------------------------------------------ HAMBÚRGUER ------ */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="menu-painel"
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="ml-auto flex items-center gap-2 rounded-md px-2.5 py-2 text-slate-200 transition-colors hover:bg-white/10 xl:hidden"
      >
        <span className="max-w-[110px] truncate text-sm font-medium sm:max-w-none">{nome}</span>
        {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {aberto && (
        <>
          {/* Fundo que fecha o menu ao toque, fora dele. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 top-16 z-30 cursor-default bg-black/40 xl:hidden"
          />

          <div
            id="menu-painel"
            className="absolute inset-x-0 top-16 z-40 border-b border-white/10 bg-consulvolt-preto shadow-xl xl:hidden"
          >
            <div className="container space-y-1 py-3">
              <Link
                href="/admin/perfil"
                className="mb-2 flex items-center gap-2 rounded-md bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
              >
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{nome}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {DEFINICOES[papel].rotulo}
                  </p>
                </div>
              </Link>

              {opcoes.map((o) => (
                <Opcao key={o.href} o={o} largo />
              ))}

              <form action={sair} className="pt-1">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
