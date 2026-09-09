import { test } from "node:test";
import assert from "node:assert/strict";

import { esquemaCandidatura } from "../validacoes.ts";
import { bairroVisivel, foraDaZona, BAIRRO_FORA, BAIRROS_UGP } from "../constantes.ts";

/**
 * ===========================================================================
 * O BAIRRO ESCRITO À MÃO
 * ---------------------------------------------------------------------------
 * Quem mora fora da zona escolhe "Outro bairro de Luanda" e escreve o nome do
 * seu bairro. A regra tem de apertar dos dois lados: exigir o texto a quem
 * está fora, e não o aceitar de quem escolheu um bairro da lista - senão
 * fica-se com um campo meio preenchido que ninguém sabe ler daqui a meio ano.
 * ===========================================================================
 */

/** Candidatura mínima e válida, para variar só o que interessa em cada teste. */
function candidatura(over: Record<string, unknown> = {}) {
  return {
    nome: "Ana Domingos Kiala",
    bi: "003456789LA042",
    provincia: "Luanda",
    municipio: "Belas",
    bairro: "Morro Bento I",
    telefone: "923111222",
    email: "ana@exemplo.ao",
    nivel_academico: "Ensino Médio Técnico (12.ª classe)",
    tem_carta: "nao",
    usa_ferramentas_digitais: "sim",
    atendimento_publico: "sim",
    experiencia_similar: "nao",
    condicoes_aceites: true,
    ...over,
  };
}

const erroEm = (dados: Record<string, unknown>, campo: string) => {
  const r = esquemaCandidatura.safeParse(dados);
  if (r.success) return null;
  return r.error.errors.find((e) => e.path[0] === campo)?.message ?? null;
};

test("um bairro do projecto passa sem escrever nada à mão", () => {
  assert.equal(esquemaCandidatura.safeParse(candidatura()).success, true);
});

test("fora da zona sem escrever o bairro é recusado", () => {
  const erro = erroEm(candidatura({ bairro: BAIRRO_FORA }), "bairro_outro");
  assert.ok(erro, "devia queixar-se do bairro por escrever");
  assert.match(erro!, /escreve o nome do bairro/i);
});

test("fora da zona com o bairro escrito passa", () => {
  const r = esquemaCandidatura.safeParse(
    candidatura({ bairro: BAIRRO_FORA, bairro_outro: "Rocha Pinto" })
  );
  assert.equal(r.success, true);
});

test("uma letra só não chega para nome de bairro", () => {
  assert.ok(erroEm(candidatura({ bairro: BAIRRO_FORA, bairro_outro: "R" }), "bairro_outro"));
});

test("espaços em branco não valem como bairro escrito", () => {
  assert.ok(erroEm(candidatura({ bairro: BAIRRO_FORA, bairro_outro: "    " }), "bairro_outro"));
});

test("um bairro inventado na lista fechada é recusado", () => {
  assert.ok(erroEm(candidatura({ bairro: "Bairro Que Não Existe" }), "bairro"));
});

// ------------------------------------------------------------- APRESENTAÇÃO

test("mostra-se o bairro escrito à mão, não o rótulo genérico", () => {
  assert.equal(
    bairroVisivel({ bairro: BAIRRO_FORA, bairro_outro: "Rocha Pinto" }),
    "Rocha Pinto"
  );
});

test("sem texto à mão fica o que está no campo fechado", () => {
  assert.equal(bairroVisivel({ bairro: "Corimba", bairro_outro: null }), "Corimba");
  assert.equal(bairroVisivel({ bairro: BAIRRO_FORA, bairro_outro: "   " }), BAIRRO_FORA);
  assert.equal(bairroVisivel({ bairro: "Inorade" }), "Inorade");
});

test("a zona de trabalho são os doze bairros da lista, e mais nenhum", () => {
  for (const b of BAIRROS_UGP) assert.equal(foraDaZona(b), false, b);
  assert.equal(foraDaZona(BAIRRO_FORA), true);
  assert.equal(BAIRROS_UGP.length, 12);
});
