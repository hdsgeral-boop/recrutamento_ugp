"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { enviarEmailFase } from "@/lib/email";
import { exigir } from "@/lib/utilizadores";
import { DEFINICOES_FASE, faseValida, type Fase } from "@/lib/constantes-fases";
import type { Candidato } from "@/types/database";

/**
 * ===========================================================================
 * MARCAÇÃO EM MASSA
 * ---------------------------------------------------------------------------
 * Marcar uma fase para cinquenta pessoas é a operação mais perigosa do painel:
 * um engano manda cinquenta emails errados e não há como os chamar de volta.
 * Por isso:
 *
 *  - o lote é pequeno (5 por pedido) e o ciclo vive no browser, com barra de
 *    progresso, para se poder fechar a página a meio sem estragar nada;
 *  - a marcação e o email são passos separados: pode-se marcar sem avisar
 *    ninguém e enviar os emails depois, quando a data estiver confirmada;
 *  - cada envio fica registado em emails_enviados, com sucesso ou erro.
 * ===========================================================================
 */

const MAXIMO_POR_LOTE = 5;

export interface ResultadoMassa {
  ok: boolean;
  marcados: number;
  emailsEnviados: number;
  falhados: number;
  mensagem: string;
  /** Nomes de quem falhou, para o painel poder dizer quem ficou de fora. */
  problemas: string[];
}

export interface PedidoMassa {
  ids: string[];
  fase: Fase;
  /** ISO local, vindo de um <input type="datetime-local"> convertido. */
  quando: string;
  local: string;
  notas: string;
  enviarEmail: boolean;
  /** Muda o estado do candidato para o que a fase sugere. */
  aplicarEstado: boolean;
}

export async function marcarLote(pedido: PedidoMassa): Promise<ResultadoMassa> {
  const vazio = (mensagem: string): ResultadoMassa => ({
    ok: false,
    marcados: 0,
    emailsEnviados: 0,
    falhados: 0,
    mensagem,
    problemas: [],
  });

  // ------------------------------------------------------------ PERMISSÕES
  let sessao;
  try {
    sessao = await exigir("marcar_evento");
    if (pedido.enviarEmail) await exigir("enviar_email");
  } catch (erro) {
    return vazio(erro instanceof Error ? erro.message : "Sem permissão.");
  }

  // -------------------------------------------------------------- VALIDAR
  if (!faseValida(pedido.fase)) return vazio("Fase desconhecida.");
  if (!pedido.local.trim()) return vazio("Falta indicar o local.");

  const quando = new Date(pedido.quando);
  if (Number.isNaN(quando.getTime())) return vazio("A data e a hora não são válidas.");

  const lote = pedido.ids.slice(0, MAXIMO_POR_LOTE);
  if (lote.length === 0) return vazio("Não seleccionaste ninguém.");

  const supabase = criarClienteServidor();
  const definicao = DEFINICOES_FASE[pedido.fase];

  const { data } = await supabase.from("candidatos").select("*").in("id", lote);
  const candidatos = (data ?? []) as Candidato[];

  let marcados = 0;
  let emailsEnviados = 0;
  const problemas: string[] = [];

  for (const c of candidatos) {
    try {
      // 1. A marcação em si.
      const { error } = await supabase.from("eventos_candidato").insert({
        candidato_id: c.id,
        fase: pedido.fase,
        quando: quando.toISOString(),
        local: pedido.local.trim(),
        observacoes: pedido.notas.trim() || null,
        criado_por: sessao.utilizador,
      });

      if (error) throw new Error(error.message);
      marcados++;

      // 2. A entrevista também vive em colunas de candidatos, desde a versão
      //    anterior. Mantemo-las certas para as vistas antigas não mentirem.
      const actualizacao: Record<string, unknown> = {};

      if (pedido.fase === "entrevista") {
        actualizacao.entrevista_em = quando.toISOString();
        actualizacao.entrevista_local = pedido.local.trim();
        actualizacao.entrevista_notas = pedido.notas.trim() || definicao.notas;
      }

      if (pedido.aplicarEstado && definicao.estadoSugerido) {
        actualizacao.status = definicao.estadoSugerido;
      }

      if (Object.keys(actualizacao).length > 0) {
        await supabase.from("candidatos").update(actualizacao).eq("id", c.id);
      }

      // 3. O email, se foi pedido.
      if (pedido.enviarEmail) {
        const r = await enviarEmailFase(
          c,
          pedido.fase,
          {
            quando: quando.toISOString(),
            local: pedido.local.trim(),
            notas: pedido.notas.trim() || definicao.notas,
          },
          sessao.utilizador
        );

        if (r.ok) {
          emailsEnviados++;
          await supabase
            .from("eventos_candidato")
            .update({ email_enviado: true })
            .eq("candidato_id", c.id)
            .eq("quando", quando.toISOString())
            .eq("fase", pedido.fase);
        } else {
          problemas.push(`${c.nome}: o email não saiu (${(r.erro ?? "").slice(0, 60)})`);
        }
      }
    } catch (erro) {
      problemas.push(`${c.nome}: ${erro instanceof Error ? erro.message.slice(0, 70) : "falhou"}`);
    }
  }

  // Candidatos pedidos que nem sequer existem na base de dados.
  const encontrados = new Set(candidatos.map((c) => c.id));
  for (const id of lote) {
    if (!encontrados.has(id)) problemas.push(`Candidatura ${id.slice(0, 8)} não encontrada.`);
  }

  revalidatePath("/admin/comunicacoes");
  revalidatePath("/admin");

  return {
    ok: problemas.length === 0,
    marcados,
    emailsEnviados,
    falhados: lote.length - marcados,
    problemas,
    mensagem: pedido.enviarEmail
      ? `${marcados} marcado(s), ${emailsEnviados} email(s) enviado(s).`
      : `${marcados} marcado(s), sem emails.`,
  };
}

/** Apaga uma marcação. Não mexe no histórico de emails já enviados. */
export async function apagarEvento(id: string): Promise<{ ok: boolean; mensagem: string }> {
  try {
    await exigir("marcar_evento");
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Sem permissão." };
  }

  const { error } = await criarClienteServidor().from("eventos_candidato").delete().eq("id", id);

  revalidatePath("/admin/comunicacoes");
  return error
    ? { ok: false, mensagem: error.message }
    : { ok: true, mensagem: "Marcação apagada. Os emails já enviados ficam no histórico." };
}
