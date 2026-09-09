import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPontuacao,
  extraccaoVazia,
  PESOS,
  TOTAL_MAXIMO,
} from "../rubrica-ugp-v1.ts";
import type { DadosFormulario, Extraccao } from "../tipos.ts";

/**
 * ===========================================================================
 * TESTES DA RUBRICA ugp-v1
 * ---------------------------------------------------------------------------
 * A rubrica é a única parte do sistema que decide ordem de leitura de pessoas.
 * Um peso trocado por engano não rebenta nada, não aparece no ecrã e ordena
 * mal oitenta candidaturas em silêncio - por isso cada banda de cada critério
 * tem aqui o seu número escrito à mão.
 * ===========================================================================
 */

/** Formulário mínimo, completo e válido, fora da zona do projecto. */
function form(over: Partial<DadosFormulario> = {}): DadosFormulario {
  return {
    provincia: "Luanda",
    municipio: "Viana",
    bairro: "Outro bairro de Luanda",
    tem_carta: false,
    usa_ferramentas_digitais: false,
    atendimento_publico: false,
    experiencia_similar: false,
    nivel_academico: "Ensino Médio Técnico (12.ª classe)",
    curso: null,
    temCv: true,
    temBi: true,
    temCertificado: true,
    temComprovativoExperiencia: false,
    ...over,
  };
}

function extra(over: Partial<Extraccao> = {}): Extraccao {
  const vazia = extraccaoVazia();
  return {
    ...vazia,
    escolaridade: { ...vazia.escolaridade, concluiu_12a: true },
    ...over,
  };
}

/** Uma experiência, com os campos todos, para não repetir o objecto inteiro. */
function experiencia(over: Partial<Extraccao["experiencias"][number]> = {}) {
  return {
    empresa: "Empresa",
    funcao: "Técnico",
    anos: 2,
    trabalho_de_campo: true,
    regista_dados: false,
    tipo_campo: null,
    evidencia: null,
    ...over,
  } as Extraccao["experiencias"][number];
}

const pontos = (f: DadosFormulario, e: Extraccao, codigo: string) =>
  calcularPontuacao(f, e).criterios.find((c) => c.codigo === codigo)!.pontos;

// ------------------------------------------------------------ ELIMINATÓRIO

test("elimina quem não tem 12.ª classe em lado nenhum", () => {
  const r = calcularPontuacao(
    form({ nivel_academico: "9.ª classe" }),
    extra({ escolaridade: { ...extraccaoVazia().escolaridade, concluiu_12a: false } })
  );
  assert.equal(r.eliminado, true);
  assert.equal(r.total, 0);
});

test("não elimina quando o formulário declara a 12.ª e o certificado está ilegível", () => {
  const r = calcularPontuacao(
    form(),
    extra({
      escolaridade: { ...extraccaoVazia().escolaridade, concluiu_12a: false },
      documentos_ilegiveis: ["certificado"],
    })
  );
  assert.equal(r.eliminado, false);

  // Fica uma nota a dizer que se confirma na entrevista, mas nunca um aviso:
  // o OCR não ter lido o certificado não é falta do candidato.
  const nota = r.alertas.find((a) => a.tipo === "requisito_em_falta");
  assert.ok(nota, "devia haver a nota do requisito por confirmar");
  assert.equal(nota!.gravidade, "info");
  assert.ok(nota!.mensagem.toLowerCase().includes("entrevista"));
});

test("documento ilegível não gera alerta nenhum", () => {
  const r = calcularPontuacao(
    form(),
    extra({ documentos_ilegiveis: ["cv_teste.pdf", "bi_teste.jpg"] })
  );

  assert.equal(
    r.alertas.filter((a) => a.tipo === "documento_ilegivel").length,
    0,
    "uma falha do OCR não pode encher a ficha de avisos"
  );
});

// ------------------------------------------------------- A. RESIDÊNCIA (20)

test("A: cada banda da residência", () => {
  // Bairro da UGP: o máximo. É o critério que mais mexe na taxa de sucesso.
  assert.equal(pontos(form({ bairro: "Morro Bento I", municipio: "Belas" }), extra(), "A"), 20);

  // Fora dos bairros, conta o município.
  const fora = "Outro bairro de Luanda";
  assert.equal(pontos(form({ bairro: fora, municipio: "Talatona" }), extra(), "A"), 14);
  assert.equal(pontos(form({ bairro: fora, municipio: "Luanda" }), extra(), "A"), 14);
  assert.equal(pontos(form({ bairro: fora, municipio: "Belas" }), extra(), "A"), 9);
  assert.equal(pontos(form({ bairro: fora, municipio: "Kilamba Kiaxi" }), extra(), "A"), 9);
  assert.equal(pontos(form({ bairro: fora, municipio: "Cacuaco" }), extra(), "A"), 4);
});

test("A: o bairro do projecto ganha ao município, mesmo num município longe", () => {
  // Quem mora no Inorade tem 20 pontos, esteja o bairro no município que
  // estiver: o que interessa é chegar ao terreno a pé e ser conhecido lá.
  assert.equal(pontos(form({ bairro: "Inorade", municipio: "Cacuaco" }), extra(), "A"), 20);
});

test("A: o BI que diz outra coisa gera alerta mas não muda a pontuação", () => {
  const r = calcularPontuacao(
    form({ bairro: "Corimba", municipio: "Luanda" }),
    extra({ residencia_bi: { bairro: "Cazenga", municipio: null, provincia: "Luanda" } })
  );
  assert.equal(r.criterios.find((c) => c.codigo === "A")!.pontos, 20);
  assert.ok(r.alertas.some((a) => a.tipo === "divergencia_formulario"));
});

test("A: o BI que confirma o bairro entra como evidência", () => {
  const r = calcularPontuacao(
    form({ bairro: "Corimba", municipio: "Luanda" }),
    extra({ residencia_bi: { bairro: "Corimba", municipio: null, provincia: "Luanda" } })
  );
  const a = r.criterios.find((c) => c.codigo === "A")!;
  assert.equal(a.origem, "ambos");
  assert.ok(a.evidencia?.includes("Corimba"));
  assert.equal(r.alertas.filter((x) => x.tipo === "divergencia_formulario").length, 0);
});

// ---------------------------------- B. CADASTRO E RECOLHA NO TERRENO (24)

test("B: cada banda do trabalho de terreno", () => {
  const com = (tipo: string) =>
    extra({ experiencias: [experiencia({ tipo_campo: tipo as never, evidencia: "prova" })] });

  assert.equal(pontos(form(), com("cadastro_censo_inquerito"), "B"), 24);
  assert.equal(pontos(form(), com("leitura_contadores_fiscalizacao"), "B"), 21);
  assert.equal(pontos(form(), com("topografia_gis"), "B"), 18);
  assert.equal(pontos(form(), com("inventario_conferencia"), "B"), 11);
  assert.equal(pontos(form(), com("operacional_terreno"), "B"), 7);
  assert.equal(pontos(form(), com("escritorio"), "B"), 0);
  assert.equal(pontos(form(), extra(), "B"), 0);
});

test("B: com várias experiências vale a melhor, não a mais recente", () => {
  const e = extra({
    experiencias: [
      experiencia({ tipo_campo: "escritorio" }),
      experiencia({ tipo_campo: "cadastro_censo_inquerito", evidencia: "recenseamento" }),
      experiencia({ tipo_campo: "inventario_conferencia" }),
    ],
  });
  assert.equal(pontos(form(), e, "B"), 24);
});

test("B: experiência declarada sem detalhe nos documentos vale 10", () => {
  assert.equal(pontos(form({ experiencia_similar: true }), extra(), "B"), 10);
});

// -------------------------------------------------- C. LITERACIA DIGITAL (20)

test("C: ferramenta de recolha digital referida no documento vale o máximo", () => {
  const e = extra({
    experiencias: [experiencia({ funcao: "Inquiridor com tablet e KoBoToolbox" })],
  });
  assert.equal(pontos(form(), e, "C"), 20);
});

test("C: a ferramenta também conta quando aparece só na evidência", () => {
  const e = extra({
    experiencias: [experiencia({ funcao: "Assistente", evidencia: "recolha por GPS e QGIS" })],
  });
  assert.equal(pontos(form(), e, "C"), 20);
});

test("C: cada banda da informática", () => {
  const n = (nivel: "formacao" | "utilizador" | "nenhum") =>
    extra({ informatica: { nivel, evidencia: null } });
  assert.equal(pontos(form(), n("formacao"), "C"), 16);
  assert.equal(pontos(form(), n("utilizador"), "C"), 11);
  assert.equal(pontos(form(), n("nenhum"), "C"), 0);
});

test("C: declarado no formulário sem prova vale 9 e gera alerta", () => {
  const r = calcularPontuacao(form({ usa_ferramentas_digitais: true }), extra());
  assert.equal(r.criterios.find((c) => c.codigo === "C")!.pontos, 9);
  assert.ok(r.alertas.some((a) => a.tipo === "divergencia_formulario"));
});

// ------------------------------------- D. ATENDIMENTO E COMUNICAÇÃO (17)

test("D: cada banda do atendimento", () => {
  const inquerito = extra({
    experiencias: [
      experiencia({
        empresa: "INE",
        funcao: "Inquiridor",
        tipo_campo: "cadastro_censo_inquerito",
        evidencia: "censos",
      }),
    ],
  });
  assert.equal(pontos(form(), inquerito, "D"), 17);
  assert.equal(pontos(form(), extra({ atendimento_publico: { tem: true, evidencia: null } }), "D"), 12);
  assert.equal(pontos(form({ atendimento_publico: true }), extra(), "D"), 7);
  assert.equal(pontos(form(), extra(), "D"), 0);
});

test("D: trabalho com comunidades conta mesmo sem tipo_campo", () => {
  const e = extra({
    experiencias: [experiencia({ funcao: "Activista de sensibilização comunitária", tipo_campo: null })],
  });
  assert.equal(pontos(form(), e, "D"), 17);
});

// ------------------------------------------- E. ESCOLARIDADE E FORMAÇÃO (10)

test("E: cada banda da escolaridade", () => {
  const vazia = extraccaoVazia().escolaridade;
  const esc = (over: Partial<typeof vazia>) =>
    extra({ escolaridade: { ...vazia, concluiu_12a: true, ...over } });

  assert.equal(pontos(form(), esc({ nivel_superior: "Geografia" }), "E"), 10);
  assert.equal(pontos(form(), esc({ nivel_superior: "Filosofia" }), "E"), 8);
  assert.equal(pontos(form(), esc({ curso: "Informática" }), "E"), 7);
  assert.equal(pontos(form(), esc({ media_final: 15 }), "E"), 6);
  assert.equal(pontos(form(), esc({}), "E"), 4);
});

test("E: o curso declarado no formulário vale quando os documentos não o dizem", () => {
  assert.equal(pontos(form({ curso: "Hidráulica" }), extra(), "E"), 7);
});

// -------------------------------------------------------------- F. CARTA (5)

test("F: cada banda da carta", () => {
  const comCarta = extra({
    carta_conducao: { tem: true, categoria: "Profissional C", evidencia: "carta" },
  });
  assert.equal(pontos(form({ tem_carta: true }), comCarta, "F"), 5);
  assert.equal(pontos(form({ tem_carta: true }), extra(), "F"), 5);
  assert.equal(pontos(form({ tem_carta: false }), extra(), "F"), 0);
});

test("F: formulário manda sobre os documentos, mas fica o alerta", () => {
  const r = calcularPontuacao(
    form({ tem_carta: false }),
    extra({ carta_conducao: { tem: true, categoria: "B", evidencia: "carta" } })
  );
  assert.equal(r.criterios.find((c) => c.codigo === "F")!.pontos, 0);
  assert.ok(r.alertas.some((a) => a.tipo === "divergencia_formulario"));
});

// --------------------------------------------------------- G. FOTOGRAFIA (2)

test("G: cada banda da fotografia", () => {
  const nivel = (n: "formacao" | "pratica" | "nenhum") =>
    extra({ fotografia: { nivel: n, evidencia: null } });
  assert.equal(pontos(form(), nivel("formacao"), "G"), 2);
  assert.equal(pontos(form(), nivel("pratica"), "G"), 1);
  assert.equal(pontos(form(), nivel("nenhum"), "G"), 0);
});

// --------------------------------------------------------- H. COMPLETUDE (2)

test("H: completude", () => {
  assert.equal(pontos(form(), extra(), "H"), 2);
  assert.equal(pontos(form(), extra({ incoerencias: ["nomes diferentes"] }), "H"), 1);
  assert.equal(pontos(form({ temCv: false }), extra(), "H"), 1);
  assert.equal(
    pontos(form({ temCv: false }), extra({ incoerencias: ["BI diferente"] }), "H"),
    0
  );
});

test("H: documento ilegível conta como documento em falta na completude", () => {
  assert.equal(pontos(form(), extra({ documentos_ilegiveis: ["cv"] }), "H"), 1);
});

// ------------------------------------------------------------- INTEGRAÇÃO

test("os pesos somam exactamente 100", () => {
  assert.equal(TOTAL_MAXIMO, 100);
  assert.equal(Object.values(PESOS).reduce((s, n) => s + n, 0), 100);
});

test("candidato perfeito chega ao máximo da rubrica", () => {
  const f = form({
    bairro: "Corimba",
    municipio: "Luanda",
    tem_carta: true,
    usa_ferramentas_digitais: true,
    atendimento_publico: true,
    experiencia_similar: true,
    temComprovativoExperiencia: true,
  });
  const e = extra({
    escolaridade: {
      ...extraccaoVazia().escolaridade,
      concluiu_12a: true,
      nivel_superior: "Geografia",
      evidencia: "licenciatura",
    },
    informatica: { nivel: "formacao", evidencia: "curso" },
    fotografia: { nivel: "formacao", evidencia: "curso" },
    carta_conducao: { tem: true, categoria: "Profissional D", evidencia: "carta" },
    atendimento_publico: { tem: true, evidencia: "balcão" },
    experiencias: [
      experiencia({
        empresa: "INE",
        funcao: "Inquiridor de cadastro com tablet",
        anos: 5,
        regista_dados: true,
        tipo_campo: "cadastro_censo_inquerito",
        evidencia: "recenseamento porta a porta com GPS",
      }),
    ],
  });

  const r = calcularPontuacao(f, e);
  assert.equal(r.eliminado, false);
  assert.equal(r.total, TOTAL_MAXIMO);
  assert.equal(r.criterios.length, 8);
});

test("candidato mínimo válido não rebenta e fica com poucos pontos", () => {
  const r = calcularPontuacao(
    form({
      municipio: "Cacuaco",
      temCv: false,
      temBi: false,
      temCertificado: false,
    }),
    extra()
  );
  assert.equal(r.eliminado, false);
  assert.ok(r.total <= 10, `esperava poucos pontos, deu ${r.total}`);
});

test("toda a pontuação cabe no máximo de cada critério", () => {
  const r = calcularPontuacao(form(), extra());
  for (const c of r.criterios) {
    assert.ok(c.pontos <= c.maximo, `${c.codigo} passou o máximo`);
    assert.ok(c.pontos >= 0, `${c.codigo} ficou negativo`);
  }
});

test("um candidato do bairro bate um candidato de fora com melhor currículo", () => {
  // É a aposta que a rubrica faz: no piloto, 74,7% dos insucessos foram porta
  // fechada. Um técnico conhecido no bairro rende mais do que um currículo
  // brilhante que chega às onze da manhã e a quem ninguém abre a porta.
  const doBairro = calcularPontuacao(
    form({ bairro: "Cabolombo", municipio: "Belas", atendimento_publico: true }),
    extra({ informatica: { nivel: "utilizador", evidencia: null } })
  );
  const deFora = calcularPontuacao(
    form({ bairro: "Outro bairro de Luanda", municipio: "Cacuaco" }),
    extra({ informatica: { nivel: "formacao", evidencia: "curso" } })
  );

  assert.ok(
    doBairro.total > deFora.total,
    `bairro ${doBairro.total} devia bater fora ${deFora.total}`
  );
});
