import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairPorHeuristica } from "../extractor-heuristico.ts";
import { citar, dobrar } from "../dobrar.ts";
import { fundir } from "../fusao.ts";
import { extraccaoVazia } from "../../ranking/rubrica-ugp-v1.ts";
import { calcularPontuacao } from "../../ranking/rubrica-ugp-v1.ts";
import type { DadosFormulario } from "../../ranking/tipos.ts";

/** Fabrica um documento como o OCR do Drive o devolve. */
function doc(tipo: string, texto: string) {
  return {
    driveFileId: `id-${tipo}`,
    tipo: tipo as "cv" | "bi" | "certificado" | "experiencia" | "outro",
    nomeFicheiro: `${tipo}_teste.pdf`,
    texto,
    legivel: texto.length >= 120,
    erro: null,
  };
}

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

// --------------------------------------------------------------- DOBRAGEM

test("dobrar tira acentos sem mudar o comprimento", () => {
  const original = "Formação em Cadastro e Georreferenciação";
  const dobrado = dobrar(original);

  assert.equal(dobrado.length, original.length, "o comprimento tem de bater certo");
  assert.equal(dobrado, "formacao em cadastro e georreferenciacao");

  // O índice tem de apontar para o mesmo sítio nos dois textos.
  const i = dobrado.indexOf("cadastro");
  assert.equal(original.slice(i, i + 8), "Cadastro");
});

test("citar devolve no máximo 20 palavras e não corta a meio de uma palavra", () => {
  const texto = "palavra ".repeat(80).trim();
  const c = citar(texto, 200);
  assert.ok(c.split(" ").length <= 20);
  assert.ok(!c.startsWith("avra"));
});

// ----------------------------------------------------------- ESCOLARIDADE

test("reconhece a 12.a classe escrita de várias maneiras", () => {
  for (const frase of [
    "Concluiu a 12ª classe no Instituto Médio Industrial",
    "Certificado de Habilitações Literárias - ensino médio",
    "Licenciatura em Geografia pela Universidade Agostinho Neto",
  ]) {
    const { extraccao } = extrairPorHeuristica([doc("certificado", frase.padEnd(140, " ."))]);
    assert.equal(extraccao.escolaridade.concluiu_12a, true, frase);
  }
});

test("a média final só entra se for um valor plausível", () => {
  const bom = extrairPorHeuristica([
    doc("certificado", "Concluiu a 12ª classe com a média final de 14 valores.".padEnd(140, " .")),
  ]);
  assert.equal(bom.extraccao.escolaridade.media_final, 14);

  const mau = extrairPorHeuristica([
    doc("certificado", "Trabalhou 98 valores de coisa nenhuma nesta frase.".padEnd(140, " .")),
  ]);
  assert.equal(mau.extraccao.escolaridade.media_final, null);
});

// ------------------------------------------------------------ EXPERIÊNCIA

test("apanha trabalho de cadastro e marca-o como registo de dados", () => {
  const r = extrairPorHeuristica([
    doc(
      "cv",
      "2019 a 2023 - Agente de cadastro de clientes na EPAL, com recolha de dados no terreno.".padEnd(
        140,
        " ."
      )
    ),
  ]);

  const cadastro = r.extraccao.experiencias.find((e) => e.tipo_campo === "cadastro_censo_inquerito");
  assert.ok(cadastro, "devia ter apanhado o cadastro");
  assert.equal(cadastro!.trabalho_de_campo, true);
  assert.equal(cadastro!.regista_dados, true);
  assert.equal(cadastro!.anos, 4, "2019 a 2023 são 4 anos");
});

test("anos declarados directamente ganham ao intervalo de datas", () => {
  const r = extrairPorHeuristica([
    doc("cv", "Tem 7 anos de experiência em cadastro. Trabalhou de 2021 a 2022.".padEnd(140, " .")),
  ]);
  assert.equal(r.extraccao.experiencias[0].anos, 7);
});

test("trabalho só de escritório não conta como trabalho de campo", () => {
  const r = extrairPorHeuristica([
    doc("cv", "Assistente administrativo de escritório, apoio ao secretariado.".padEnd(140, " .")),
  ]);
  const esc = r.extraccao.experiencias.find((e) => e.tipo_campo === "escritorio");
  assert.ok(esc);
  assert.equal(esc!.trabalho_de_campo, false);
});

// ---------------------------------------------------------------- OUTROS

test("lê a carta de condução e a categoria", () => {
  const r = extrairPorHeuristica([
    doc("cv", "Possui carta de condução, categoria B, emitida em Luanda.".padEnd(140, " .")),
  ]);
  assert.equal(r.extraccao.carta_conducao.tem, true);
  assert.equal(r.extraccao.carta_conducao.categoria, "B");
});

test("lê o número do BI no formato angolano", () => {
  const r = extrairPorHeuristica([
    doc("bi", "República de Angola. Número 003456789LA042 emitido em Luanda.".padEnd(140, " .")),
  ]);
  assert.equal(r.extraccao.bi_numero, "003456789LA042");
});

test("distingue formação em informática de simples uso", () => {
  const formacao = extrairPorHeuristica([
    doc("cv", "Frequentou o curso de informática na óptica do utilizador.".padEnd(140, " .")),
  ]);
  assert.equal(formacao.extraccao.informatica.nivel, "formacao");

  const uso = extrairPorHeuristica([
    doc("cv", "Conhecimentos de Microsoft Office, Word e Excel.".padEnd(140, " .")),
  ]);
  assert.equal(uso.extraccao.informatica.nivel, "utilizador");
});

test("não inventa nada quando o texto não diz nada", () => {
  const r = extrairPorHeuristica([doc("cv", "a".repeat(200))]);
  const vazia = extraccaoVazia();

  assert.equal(r.extraccao.escolaridade.concluiu_12a, vazia.escolaridade.concluiu_12a);
  assert.equal(r.extraccao.carta_conducao.tem, false);
  assert.deepEqual(r.extraccao.experiencias, []);
  assert.equal(r.factos, 0);
});

test("documento vazio marca-se como ilegível e não rebenta", () => {
  const r = extrairPorHeuristica([doc("cv", "")]);
  assert.deepEqual(r.extraccao.documentos_ilegiveis, ["cv_teste.pdf"]);
  assert.equal(r.factos, 0);
});

// ------------------------------------------------------------------ FUSÃO

test("a fusão nunca perde um facto da heurística", () => {
  const heuristica = extraccaoVazia();
  heuristica.carta_conducao = { tem: true, categoria: "B", evidencia: "carta de condução categoria B" };
  heuristica.experiencias = [
    {
      empresa: "x",
      funcao: "cadastro",
      anos: 3,
      trabalho_de_campo: true,
      regista_dados: true,
      tipo_campo: "cadastro_censo_inquerito",
      evidencia: "cadastro",
    },
  ];

  // O modelo não viu nada disto.
  const doModelo = extraccaoVazia();

  const junto = fundir(heuristica, doModelo);
  assert.equal(junto.carta_conducao.tem, true);
  assert.equal(junto.experiencias.length, 1);
});

test("a fusão não duplica o mesmo tipo de experiência", () => {
  const heuristica = extraccaoVazia();
  heuristica.experiencias = [
    {
      empresa: "x", funcao: "cadastro", anos: 2, trabalho_de_campo: true,
      regista_dados: true, tipo_campo: "cadastro_censo_inquerito", evidencia: "a",
    },
  ];

  const doModelo = extraccaoVazia();
  doModelo.experiencias = [
    {
      empresa: "EPAL", funcao: "Agente de cadastro", anos: 4, trabalho_de_campo: true,
      regista_dados: true, tipo_campo: "cadastro_censo_inquerito", evidencia: "b",
    },
  ];

  const junto = fundir(heuristica, doModelo);
  assert.equal(junto.experiencias.length, 1);
  assert.equal(junto.experiencias[0].empresa, "EPAL", "o modelo ganha onde viu");
});

// ------------------------------------- O CAMINHO TODO, ATÉ À PONTUAÇÃO

test("um CV real sobe a pontuação acima do que o formulário sozinho dá", () => {
  const cv = `
    CURRICULUM VITAE
    Nome: Joao Domingos Manuel
    Formação: 12ª classe, Instituto Médio Industrial de Luanda,
    Curso de Informática, com a média final de 15 valores.
    Experiência profissional:
    2018 a 2024 - Técnico de cadastro de clientes na EPAL, com recolha de dados
    no terreno, leitura de contadores e registo fotográfico das ligações de água.
    Conhecimentos de Microsoft Office e utilização de GPS em tablet.
    Possui carta de condução, categoria B.
    Experiência de atendimento ao público em balcão.
  `;

  const semDocumentos = calcularPontuacao(form(), extraccaoVazia());
  const { extraccao } = extrairPorHeuristica([doc("cv", cv)]);
  const comDocumentos = calcularPontuacao(form(), extraccao);

  assert.ok(
    comDocumentos.total > semDocumentos.total + 25,
    `os documentos tinham de acrescentar muito: ${semDocumentos.total} -> ${comDocumentos.total}`
  );
  assert.equal(comDocumentos.eliminado, false);
});

// ------------------------------------------------- JSON DOS MODELOS

test("apanha o JSON mesmo com lixo à volta", async () => {
  const { extrairPrimeiroJson } = await import("../fusao.ts");

  assert.equal(extrairPrimeiroJson('{"a":1}'), '{"a":1}');
  assert.equal(extrairPrimeiroJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extrairPrimeiroJson('Aqui tens: {"a":1} espero que ajude'), '{"a":1}');

  // O caso que apareceu de verdade: dois objectos colados.
  assert.equal(extrairPrimeiroJson('{"a":1}\n{"b":2}'), '{"a":1}');

  // Chavetas dentro de texto não podem contar para a profundidade.
  assert.equal(
    extrairPrimeiroJson('{"nota":"ele disse } e depois {"}'),
    '{"nota":"ele disse } e depois {"}'
  );

  // Aspas escapadas dentro de uma citação.
  const comEscape = '{"evidencia":"disse \\\\"ok\\\\" e saiu"}';
  assert.equal(extrairPrimeiroJson(comEscape), comEscape);

  // Objectos encaixados.
  assert.equal(
    extrairPrimeiroJson('lixo {"a":{"b":{"c":1}}} mais lixo'),
    '{"a":{"b":{"c":1}}}'
  );

  assert.equal(extrairPrimeiroJson("nada de JSON aqui"), null);
  assert.equal(extrairPrimeiroJson('{"aberto":1'), null);
});
