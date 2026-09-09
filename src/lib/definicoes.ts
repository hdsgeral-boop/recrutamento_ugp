import "server-only";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  PRAZO_CANDIDATURA,
  VAGAS_PREVISTAS_PADRAO,
} from "@/lib/constantes";

/**
 * ===========================================================================
 * DEFINIÇÕES DO RECRUTAMENTO
 * ---------------------------------------------------------------------------
 * O prazo, o número de vagas e o estado do formulário vivem na base de dados,
 * numa linha única, para poderem ser mudados no painel sem novo deploy.
 *
 * Os valores em `@/lib/constantes` passam a ser apenas o ponto de partida:
 * servem enquanto a linha não existir ou enquanto a base não responder. Assim
 * o formulário nunca fica em branco por causa de uma falha de leitura.
 * ===========================================================================
 */

export interface Definicoes {
  /** ISO 8601. Momento em que o formulário deixa de aceitar candidaturas. */
  prazo: string;
  /** Quantos técnicos se pretende contratar. NUNCA aparece no formulário. */
  vagasPrevistas: number;
  /** Um fecho manual, antes de o prazo chegar. */
  candidaturasAbertas: boolean;
  /** O que se mostra a quem chega depois do fecho. Vazio usa o texto padrão. */
  mensagemEncerrado: string | null;
  actualizadoEm: string | null;
  actualizadoPor: string | null;
}

export const DEFINICOES_PADRAO: Definicoes = {
  prazo: PRAZO_CANDIDATURA.toISOString(),
  vagasPrevistas: VAGAS_PREVISTAS_PADRAO,
  candidaturasAbertas: true,
  mensagemEncerrado: null,
  actualizadoEm: null,
  actualizadoPor: null,
};

/**
 * Lê a linha das definições. Nunca lança: se a tabela ainda não existir, ou
 * se o Supabase estiver fora do ar, devolve os valores de omissão para o
 * formulário continuar de pé.
 */
export async function lerDefinicoes(): Promise<Definicoes> {
  try {
    const supabase = criarClienteServidor();
    const { data, error } = await supabase
      .from("definicoes")
      .select(
        "prazo_candidaturas, vagas_previstas, candidaturas_abertas, mensagem_encerrado, actualizado_em, actualizado_por"
      )
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return DEFINICOES_PADRAO;

    return {
      prazo: data.prazo_candidaturas ?? DEFINICOES_PADRAO.prazo,
      vagasPrevistas: data.vagas_previstas ?? DEFINICOES_PADRAO.vagasPrevistas,
      candidaturasAbertas: data.candidaturas_abertas ?? true,
      mensagemEncerrado: data.mensagem_encerrado ?? null,
      actualizadoEm: data.actualizado_em ?? null,
      actualizadoPor: data.actualizado_por ?? null,
    };
  } catch {
    return DEFINICOES_PADRAO;
  }
}

/** O formulário aceita candidaturas neste momento? */
export function aceitaCandidaturas(d: Definicoes, agora: Date = new Date()): boolean {
  if (!d.candidaturasAbertas) return false;
  const prazo = new Date(d.prazo).getTime();
  if (Number.isNaN(prazo)) return true;
  return agora.getTime() < prazo;
}

/** A razão do fecho, para a mensagem ser honesta com o candidato. */
export function motivoDoFecho(
  d: Definicoes,
  agora: Date = new Date()
): "prazo" | "manual" | null {
  if (aceitaCandidaturas(d, agora)) return null;
  return d.candidaturasAbertas ? "prazo" : "manual";
}
