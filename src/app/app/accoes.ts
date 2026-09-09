"use server";

import { waitUntil } from "@vercel/functions";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { processarArquivamento } from "@/lib/arquivamento";
import { esquemaCandidatura, normalizarTelefone, paraBooleano } from "@/lib/validacoes";
import { BUCKET } from "@/lib/constantes";
import { aceitaCandidaturas, lerDefinicoes } from "@/lib/definicoes";

/**
 * ===========================================================================
 * SERVER ACTIONS DA CANDIDATURA PÚBLICA
 * ---------------------------------------------------------------------------
 * Os PDFs NÃO passam por aqui: o browser envia-os directamente para o
 * Supabase Storage (evita o limite de 4,5 MB do corpo dos pedidos na Vercel e
 * mantém a acção abaixo dos 10 segundos). Aqui só chegam os caminhos.
 * ===========================================================================
 */

export interface RespostaCandidatura {
  ok: boolean;
  id?: string;
  mensagem?: string;
  /** Campo do formulário a assinalar, quando o erro é de um campo específico. */
  campo?: "bi" | "email" | "telefone";
}

/** Verificação rápida de duplicados, chamada enquanto o candidato preenche. */
export async function verificarDuplicado(
  campo: "bi" | "email",
  valor: string
): Promise<{ existe: boolean }> {
  try {
    const limpo = campo === "bi" ? valor.trim().toUpperCase() : valor.trim().toLowerCase();
    if (limpo.length < 5) return { existe: false };

    const supabase = criarClienteServidor();
    const { data } = await supabase.from("candidatos").select("id").eq(campo, limpo).maybeSingle();

    return { existe: Boolean(data) };
  } catch {
    // Se a verificação falhar, deixamos passar - a base de dados tem o
    // constraint UNIQUE e apanha o duplicado na submissão.
    return { existe: false };
  }
}

/** Apaga do Storage ficheiros de uma candidatura que não chegou a ser gravada. */
async function limparFicheiros(caminhos: string[]) {
  try {
    if (caminhos.length === 0) return;
    await criarClienteServidor().storage.from(BUCKET).remove(caminhos);
  } catch (erro) {
    console.warn("[candidatura] não consegui limpar ficheiros órfãos:", erro);
  }
}

/**
 * Grava a candidatura e lança o arquivamento no Drive + emails em segundo
 * plano. Devolve resposta ao candidato em menos de 1 segundo.
 */
export async function submeterCandidatura(
  formulario: Record<string, string>,
  documentos: { cv: string; bi: string; certificado: string; experiencia?: string | null }
): Promise<RespostaCandidatura> {
  const caminhos = [
    documentos.cv,
    documentos.bi,
    documentos.certificado,
    documentos.experiencia,
  ].filter(Boolean) as string[];

  try {
    // ------------------------------------------------------ 0. PRAZO
    // Esconder o formulário não chega: quem tiver a página aberta desde antes
    // do fecho continua a conseguir submeter. O prazo decide-se aqui.
    const definicoes = await lerDefinicoes();
    if (!aceitaCandidaturas(definicoes)) {
      await limparFicheiros(caminhos);
      return {
        ok: false,
        mensagem:
          definicoes.mensagemEncerrado?.trim() ||
          "As candidaturas já estão encerradas. O prazo para submeter terminou.",
      };
    }

    // ------------------------------------------------------- 1. VALIDAÇÃO
    const validado = esquemaCandidatura.safeParse(formulario);

    if (!validado.success) {
      const primeiro = validado.error.errors[0];
      await limparFicheiros(caminhos);
      return { ok: false, mensagem: primeiro?.message ?? "Há campos por preencher correctamente." };
    }

    if (!documentos.cv || !documentos.bi || !documentos.certificado) {
      return { ok: false, mensagem: "Faltam documentos. Anexa o CV, o BI e o Certificado." };
    }

    const d = validado.data;

    // Quem diz que tem experiência tem de a comprovar.
    if (d.experiencia_similar === "sim" && !documentos.experiencia) {
      return {
        ok: false,
        mensagem: "Anexa o comprovativo da experiência em trabalhos similares.",
      };
    }
    const supabase = criarClienteServidor();

    // ------------------------------------------- 2. DUPLICADOS (BI / EMAIL)
    const { data: existentes } = await supabase
      .from("candidatos")
      .select("bi, email")
      .or(`bi.eq.${d.bi},email.eq.${d.email}`);

    if (existentes && existentes.length > 0) {
      await limparFicheiros(caminhos);

      const biRepetido = existentes.some((c) => c.bi === d.bi);
      return {
        ok: false,
        campo: biRepetido ? "bi" : "email",
        mensagem: biRepetido
          ? "Já existe uma candidatura com este número de BI."
          : "Já existe uma candidatura com este email.",
      };
    }

    // ------------------------------------------------------- 3. GRAVAÇÃO
    const { data: criado, error } = await supabase
      .from("candidatos")
      .insert({
        nome: d.nome,
        bi: d.bi,
        provincia: d.provincia,
        municipio: d.municipio,
        bairro: d.bairro,
        bairro_outro: d.bairro_outro?.trim() || null,
        telefone: normalizarTelefone(d.telefone),
        email: d.email,
        nivel_academico: d.nivel_academico,
        curso: d.curso?.trim() || null,
        usa_ferramentas_digitais: paraBooleano(d.usa_ferramentas_digitais),
        atendimento_publico: paraBooleano(d.atendimento_publico),
        tem_carta: paraBooleano(d.tem_carta),
        experiencia_similar: paraBooleano(d.experiencia_similar),
        experiencia_url: documentos.experiencia ?? null,
        condicoes_aceites: true,
        status: "Pendente",
        cv_url: documentos.cv,
        bi_url: documentos.bi,
        certificado_url: documentos.certificado,
        arquivamento_estado: "pendente",
      })
      .select("id")
      .single();

    if (error || !criado) {
      // 23505 = violação de UNIQUE (corrida entre duas submissões simultâneas)
      if (error?.code === "23505") {
        await limparFicheiros(caminhos);
        const duplicadoBi = error.message.includes("bi");
        return {
          ok: false,
          campo: duplicadoBi ? "bi" : "email",
          mensagem: duplicadoBi
            ? "Já existe uma candidatura com este número de BI."
            : "Já existe uma candidatura com este email.",
        };
      }

      console.error("[candidatura] erro ao gravar:", error);
      return {
        ok: false,
        mensagem: "Não foi possível gravar a candidatura. Tenta outra vez dentro de instantes.",
      };
    }

    // ------------------------------- 4. DRIVE + EMAILS (fora do caminho crítico)
    // waitUntil mantém a função viva depois da resposta, sem o candidato esperar.
    waitUntil(
      processarArquivamento(criado.id).catch((erro) =>
        console.error("[candidatura] arquivamento falhou:", erro)
      )
    );

    return { ok: true, id: criado.id };
  } catch (erro) {
    console.error("[candidatura] erro inesperado:", erro);
    await limparFicheiros(caminhos);
    return {
      ok: false,
      mensagem: "Ocorreu um erro inesperado. Verifica a ligação e tenta novamente.",
    };
  }
}
