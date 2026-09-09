"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigir } from "@/lib/utilizadores";
import { doInputParaIso } from "@/lib/datas";
import { lerDefinicoes, type Definicoes } from "@/lib/definicoes";

/**
 * ===========================================================================
 * DEFINIÇÕES DO RECRUTAMENTO
 * ---------------------------------------------------------------------------
 * Prazo, vagas previstas e abertura do formulário. Uma linha só na base de
 * dados, mudada aqui, lida em todo o lado.
 *
 * O número de vagas fica guardado mas NÃO é publicado: saber que há doze
 * lugares muda a forma como as pessoas se candidatam, e o valor ainda pode
 * mudar consoante a área que a EPAL confirmar.
 * ===========================================================================
 */

export interface PedidoDefinicoes {
  /** Valor de um <input type="datetime-local">, hora de Angola. */
  prazoLocal: string;
  vagasPrevistas: number;
  candidaturasAbertas: boolean;
  mensagemEncerrado: string;
}

export interface ResultadoDefinicoes {
  ok: boolean;
  mensagem: string;
  definicoes: Definicoes | null;
}

export async function guardarDefinicoes(
  pedido: PedidoDefinicoes
): Promise<ResultadoDefinicoes> {
  let sessao;
  try {
    sessao = await exigir("configurar");
  } catch (erro) {
    return { ok: false, mensagem: (erro as Error).message, definicoes: null };
  }

  const prazo = doInputParaIso(pedido.prazoLocal);
  if (!prazo) {
    return {
      ok: false,
      mensagem: "A data do prazo não é válida. Escolhe o dia e a hora.",
      definicoes: null,
    };
  }

  // O prazo no passado é legítimo (fecha já), mas um prazo absurdo é engano.
  const anos = (new Date(prazo).getTime() - Date.now()) / (365 * 86400000);
  if (anos > 5) {
    return {
      ok: false,
      mensagem: "O prazo está a mais de cinco anos de distância. Confirma a data.",
      definicoes: null,
    };
  }

  const vagas = Math.trunc(pedido.vagasPrevistas);
  if (!Number.isFinite(vagas) || vagas < 1 || vagas > 500) {
    return {
      ok: false,
      mensagem: "As vagas previstas têm de estar entre 1 e 500.",
      definicoes: null,
    };
  }

  const mensagem = pedido.mensagemEncerrado.trim().slice(0, 500);

  const { error } = await criarClienteServidor()
    .from("definicoes")
    .upsert(
      {
        id: true,
        prazo_candidaturas: prazo,
        vagas_previstas: vagas,
        candidaturas_abertas: pedido.candidaturasAbertas,
        mensagem_encerrado: mensagem || null,
        actualizado_em: new Date().toISOString(),
        actualizado_por: sessao.nome || sessao.utilizador,
      },
      { onConflict: "id" }
    );

  if (error) {
    return {
      ok: false,
      mensagem: `Não foi possível guardar: ${error.message}`,
      definicoes: null,
    };
  }

  // O formulário público e o painel leem o prazo, por isso ambos recarregam.
  revalidatePath("/", "layout");

  return {
    ok: true,
    mensagem: "Definições guardadas.",
    definicoes: await lerDefinicoes(),
  };
}
