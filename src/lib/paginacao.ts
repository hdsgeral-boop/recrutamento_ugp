/**
 * ===========================================================================
 * PAGINAÇÃO
 * ---------------------------------------------------------------------------
 * Regra do sistema: 10 linhas por página por omissão, e o utilizador escolhe
 * 25, 50 ou 100. A escolha vive no endereço (?pagina=2&porPagina=25), por três
 * razões: sobrevive ao recarregar, pode ser partilhada por link, e mantém-se
 * quando se muda de filtro.
 *
 * Puro TypeScript, sem rede nem estado. Serve tanto o painel de candidaturas
 * como o ranking e as comunicações.
 * ===========================================================================
 */

export const OPCOES_POR_PAGINA = [10, 25, 50, 100] as const;
export const POR_PAGINA_PADRAO = 10;

export interface Fatia {
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  inicio: number;
  fim: number;
  total: number;
}

/**
 * Interpreta os parâmetros do endereço e trava-os dentro do que faz sentido.
 * Um ?pagina=999 numa lista de 4 linhas passa a ser a página 1, e não uma
 * tabela vazia que parece uma avaria.
 */
export function lerPaginacao(
  parametros: { pagina?: string; porPagina?: string },
  total: number
): Fatia {
  const pedido = Number(parametros.porPagina);
  const porPagina = (OPCOES_POR_PAGINA as readonly number[]).includes(pedido)
    ? pedido
    : POR_PAGINA_PADRAO;

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const bruta = Number(parametros.pagina);
  const pagina = Number.isFinite(bruta) && bruta >= 1 ? Math.min(Math.floor(bruta), totalPaginas) : 1;

  const inicio = (pagina - 1) * porPagina;

  return {
    pagina,
    porPagina,
    totalPaginas,
    inicio,
    fim: Math.min(inicio + porPagina, total),
    total,
  };
}

/** Corta a lista já ordenada e filtrada para a página pedida. */
export function fatiar<T>(itens: T[], f: Fatia): T[] {
  return itens.slice(f.inicio, f.inicio + f.porPagina);
}

/**
 * Os números a mostrar nos botões: primeira, última, a actual e as vizinhas,
 * com reticências no meio. Com 40 páginas ninguém quer 40 botões.
 */
export function numerosVisiveis(pagina: number, totalPaginas: number): (number | "...")[] {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }

  const perto = new Set<number>([1, totalPaginas, pagina, pagina - 1, pagina + 1]);
  if (pagina <= 3) [2, 3, 4].forEach((n) => perto.add(n));
  if (pagina >= totalPaginas - 2) [totalPaginas - 3, totalPaginas - 2, totalPaginas - 1].forEach((n) => perto.add(n));

  const ordenados = Array.from(perto)
    .filter((n) => n >= 1 && n <= totalPaginas)
    .sort((a, b) => a - b);

  const saida: (number | "...")[] = [];
  let anterior = 0;

  for (const n of ordenados) {
    if (anterior && n - anterior > 1) saida.push("...");
    saida.push(n);
    anterior = n;
  }

  return saida;
}
