"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dobrar } from "@/lib/analise/dobrar";

/**
 * ===========================================================================
 * ESCOLHA PESQUISÁVEL
 * ---------------------------------------------------------------------------
 * Uma lista fechada com caixa de pesquisa por cima. Feita à mão, sem
 * dependência nova.
 *
 * Porque não chega o <Select> normal: doze bairros num telemóvel são doze
 * linhas a rolar dentro de uma caixa pequena, e quem mora no Morro da Luz tem
 * de percorrer a lista toda. Escrever "morro" resolve isso em duas letras.
 *
 * A comparação passa por `dobrar`, o mesmo normalizador que o extractor usa
 * nos documentos: escrever "corimba" encontra "Corimba", e "cawelele" sem
 * acento encontra o mesmo que com acento. Um candidato a escrever à pressa no
 * telemóvel não devia ficar de fora por causa de um acento.
 * ===========================================================================
 */

export function EscolhaPesquisavel({
  id,
  opcoes,
  valor,
  aoMudar,
  espacoReservado = "Escolhe uma opção",
  procurar = "Procurar...",
  desactivado,
  /** Mostra uma entrada para limpar a escolha. Útil nos filtros do painel. */
  comLimpar,
  rotuloLimpar = "Todos",
  /** A partir de quantas opções aparece a caixa de pesquisa. */
  minimoParaPesquisa = 8,
  className,
}: {
  id?: string;
  opcoes: readonly string[];
  valor: string | null | undefined;
  aoMudar: (valor: string) => void;
  espacoReservado?: string;
  procurar?: string;
  desactivado?: boolean;
  comLimpar?: boolean;
  rotuloLimpar?: string;
  minimoParaPesquisa?: number;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [activo, setActivo] = useState(0);

  const raiz = useRef<HTMLDivElement>(null);
  const caixaProcura = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();

  const filtradas = useMemo(() => {
    const t = dobrar(termo.trim());
    if (!t) return opcoes;
    return opcoes.filter((o) => dobrar(o).includes(t));
  }, [opcoes, termo]);

  // Fechar ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Ao abrir, o cursor vai para a pesquisa e a lista recomeça do princípio.
  useEffect(() => {
    if (!aberto) {
      setTermo("");
      return;
    }
    setActivo(0);
    const t = setTimeout(() => caixaProcura.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [aberto]);

  // Manter a linha activa à vista quando se navega com as setas.
  useEffect(() => {
    if (!aberto || !lista.current) return;
    const linha = lista.current.children[activo] as HTMLElement | undefined;
    linha?.scrollIntoView({ block: "nearest" });
  }, [activo, aberto]);

  function escolher(v: string) {
    aoMudar(v);
    setAberto(false);
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, filtradas.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const escolhida = filtradas[activo];
      if (escolhida) escolher(escolhida);
    }
  }

  const mostrarPesquisa = opcoes.length >= minimoParaPesquisa;

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-haspopup="listbox"
        disabled={desactivado}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className={cn("truncate text-left", !valor && "text-muted-foreground")}>
          {valor || espacoReservado}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {mostrarPesquisa && (
            <div className="relative border-b">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={caixaProcura}
                type="text"
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setActivo(0);
                }}
                onKeyDown={teclas}
                placeholder={procurar}
                aria-label={procurar}
                className="h-9 w-full bg-transparent pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground"
              />
              {termo && (
                <button
                  type="button"
                  aria-label="Limpar a pesquisa"
                  onClick={() => {
                    setTermo("");
                    caixaProcura.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
            onKeyDown={teclas}
          >
            {comLimpar && (
              <li>
                <button
                  type="button"
                  onClick={() => escolher("")}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-muted-foreground hover:bg-slate-100"
                >
                  {rotuloLimpar}
                </button>
              </li>
            )}

            {filtradas.map((o, i) => (
              <li key={o} role="option" aria-selected={o === valor}>
                <button
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => escolher(o)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    i === activo && "bg-slate-100",
                    o === valor && "font-medium"
                  )}
                >
                  <Check className={cn("h-4 w-4 shrink-0", o === valor ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 truncate">{o}</span>
                </button>
              </li>
            ))}

            {filtradas.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado para &ldquo;{termo}&rdquo;.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
