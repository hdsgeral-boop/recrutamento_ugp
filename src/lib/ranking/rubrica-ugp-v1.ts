import { BAIRROS_UGP, MUNICIPIOS_DA_ZONA, MUNICIPIOS_VIZINHOS } from "@/lib/constantes";
import type {
  Alerta,
  Criterio,
  DadosFormulario,
  Extraccao,
  ResultadoPontuacao,
} from "@/lib/ranking/tipos";

/**
 * ===========================================================================
 * RUBRICA ugp-v1
 * ---------------------------------------------------------------------------
 * A IA extrai factos. Este ficheiro calcula a pontuação.
 *
 * Nada aqui chama rede nem base de dados: é uma função pura. O mesmo candidato
 * com os mesmos documentos dá sempre o mesmo número, e mudar um peso não
 * obriga a reprocessar documento nenhum.
 *
 * PORQUE É QUE OS PESOS SÃO ESTES
 * O piloto da UGP mediu 14.541 portas visitadas e só 8.399 deram inquérito.
 * Dos 6.141 insucessos, 74,7% foram casa fechada. A taxa variou de 83,6% no
 * Inorade a 43,2% no Morro Bento II. Ou seja: o que separa um bom técnico de
 * um mau não é a força física nem o conhecimento técnico, é conseguir que a
 * porta abra e que o morador mostre os documentos. Daí o peso do atendimento
 * ao público, e daí a residência valer tanto - quem mora no bairro é
 * reconhecido à porta e chega ao terreno sem duas horas de transporte.
 *
 * Precedência: quando o formulário e os documentos divergem, vale o
 * formulário para a pontuação, e gera-se um alerta. O candidato responde pelo
 * que declarou; o OCR pode ter lido mal.
 * ===========================================================================
 */

export const VERSAO_RUBRICA = "ugp-v1" as const;

/** Bairros onde o trabalho decorre. Reexportado para o painel. */
export const BAIRROS_PROJECTO = BAIRROS_UGP;

export const PESOS = Object.freeze({
  A: 20, // Residência
  B: 24, // Experiência em cadastro, censo, inquérito ou recolha de dados
  C: 20, // Literacia digital
  D: 17, // Atendimento ao público e comunicação
  E: 10, // Escolaridade e formação
  F: 5, //  Carta de condução e deslocação
  G: 2, //  Fotografia
  H: 2, //  Completude da candidatura
});

export const TOTAL_MAXIMO = Object.values(PESOS).reduce((s, n) => s + n, 0); // 100

const NOMES: Record<keyof typeof PESOS, string> = {
  A: "Residência na zona de trabalho",
  B: "Cadastro, censo, inquérito ou recolha de dados no terreno",
  C: "Literacia digital: tablet, GPS e formulários",
  D: "Atendimento ao público e comunicação",
  E: "Escolaridade e formação",
  F: "Carta de condução e deslocação",
  G: "Fotografia e registo de imagem",
  H: "Completude da candidatura",
};

/** Extracção vazia, para quando ainda não houve análise por IA. */
export function extraccaoVazia(): Extraccao {
  return {
    nome_nos_documentos: null,
    bi_numero: null,
    residencia_bi: { bairro: null, municipio: null, provincia: null },
    naturalidade: { municipio: null, provincia: null },
    escolaridade: {
      concluiu_12a: false,
      curso: null,
      media_final: null,
      nivel_superior: null,
      evidencia: null,
    },
    experiencias: [],
    carta_conducao: { tem: false, categoria: null, evidencia: null },
    informatica: { nivel: "nenhum", evidencia: null },
    fotografia: { nivel: "nenhum", evidencia: null },
    atendimento_publico: { tem: false, evidencia: null },
    documentos_ilegiveis: [],
    incoerencias: [],
  };
}

/** O nível académico declarado no formulário implica 12.ª classe? */
export function formularioDeclara12a(nivel: string): boolean {
  const n = nivel.toLowerCase();
  return (
    n.includes("12") ||
    n.includes("médio") ||
    n.includes("medio") ||
    n.includes("universit") ||
    n.includes("bacharel") ||
    n.includes("licenc") ||
    n.includes("pós") ||
    n.includes("pos-")
  );
}

// ---------------------------------------------------------------------------

interface Contexto {
  f: DadosFormulario;
  e: Extraccao;
  alertas: Alerta[];
}

const criterio = (
  codigo: keyof typeof PESOS,
  pontos: number,
  banda: string,
  evidencia: string | null,
  origem: Criterio["origem"]
): Criterio => ({
  codigo,
  nome: NOMES[codigo],
  pontos,
  maximo: PESOS[codigo],
  banda,
  evidencia,
  origem,
});

// ------------------------------------------------------- A. RESIDÊNCIA (20)

function pontuarResidencia({ f, e, alertas }: Contexto): Criterio {
  let pontos: number;
  let banda: string;

  if (BAIRROS_UGP.includes(f.bairro as never)) {
    pontos = 20;
    banda = `Reside em ${f.bairro}, dentro da zona de trabalho`;
  } else if (MUNICIPIOS_DA_ZONA.includes(f.municipio as never)) {
    pontos = 14;
    banda = `Reside em ${f.municipio}, o município que contém a zona`;
  } else if (MUNICIPIOS_VIZINHOS.includes(f.municipio as never)) {
    pontos = 9;
    banda = `Reside em ${f.municipio}, município vizinho`;
  } else {
    pontos = 4;
    banda = `Reside em ${f.municipio}, longe da zona de trabalho`;
  }

  // O BI diz uma coisa, o formulário diz outra. Vale o formulário.
  const noBi = e.residencia_bi.bairro ?? e.residencia_bi.municipio;
  let evidencia: string | null = null;

  if (noBi) {
    const igual =
      noBi.toLowerCase() === f.bairro.toLowerCase() ||
      noBi.toLowerCase() === f.municipio.toLowerCase();

    if (igual) {
      evidencia = `Documentos confirmam ${noBi}`;
    } else {
      alertas.push({
        tipo: "divergencia_formulario",
        mensagem: `O formulário diz ${f.bairro}, os documentos dizem ${noBi}. Valeu o formulário.`,
        gravidade: "aviso",
      });
    }
  }

  return criterio("A", pontos, banda, evidencia, evidencia ? "ambos" : "formulario");
}

// ------------------------------------ B. CADASTRO E RECOLHA NO TERRENO (24)

const PONTOS_TIPO_CAMPO: Record<string, { pontos: number; banda: string }> = {
  cadastro_censo_inquerito: { pontos: 24, banda: "Cadastro, recenseamento ou inquéritos porta a porta" },
  leitura_contadores_fiscalizacao: {
    pontos: 21,
    banda: "Leitura de contadores, fiscalização ou vistorias",
  },
  topografia_gis: { pontos: 18, banda: "Topografia, GIS ou georreferenciação" },
  inventario_conferencia: { pontos: 11, banda: "Inventário físico ou conferência de activos" },
  operacional_terreno: { pontos: 7, banda: "Trabalho operacional no terreno, sem recolha de dados" },
};

function pontuarCadastro({ f, e }: Contexto): Criterio {
  let melhor = { pontos: 0, banda: "Nenhuma", evidencia: null as string | null };

  for (const exp of e.experiencias) {
    const tabela = exp.tipo_campo ? PONTOS_TIPO_CAMPO[exp.tipo_campo] : undefined;
    if (tabela && tabela.pontos > melhor.pontos) {
      melhor = { ...tabela, evidencia: exp.evidencia ?? `${exp.funcao} - ${exp.empresa}` };
    }
  }

  // Declarou no formulário mas os documentos não mostram: fica o degrau mais
  // baixo, porque a declaração vale alguma coisa e o OCR pode ter falhado.
  if (melhor.pontos === 0 && f.experiencia_similar) {
    return criterio(
      "B",
      10,
      "Experiência declarada no formulário, sem detalhe nos documentos",
      null,
      "formulario"
    );
  }

  return criterio("B", melhor.pontos, melhor.banda, melhor.evidencia, "documentos");
}

// -------------------------------------------------- C. LITERACIA DIGITAL (20)

/** Ferramentas de recolha que este projecto usa mesmo. */
const FERRAMENTAS = /kobo|odk|survey|arcgis|qgis|gps|georref|geo-ref|formul[áa]rio digital|tablet/i;

function pontuarDigital({ f, e, alertas }: Contexto): Criterio {
  const usouFerramenta = e.experiencias.some(
    (x) => FERRAMENTAS.test(x.funcao) || (x.evidencia ? FERRAMENTAS.test(x.evidencia) : false)
  );

  if (usouFerramenta) {
    const qual = e.experiencias.find(
      (x) => FERRAMENTAS.test(x.funcao) || (x.evidencia ? FERRAMENTAS.test(x.evidencia) : false)
    );
    return criterio(
      "C",
      20,
      "Já usou ferramentas de recolha digital no terreno",
      qual?.evidencia ?? qual?.funcao ?? null,
      "documentos"
    );
  }

  if (e.informatica.nivel === "formacao") {
    return criterio(
      "C",
      16,
      "Formação em informática ou curso superior na área",
      e.informatica.evidencia,
      "documentos"
    );
  }

  if (e.informatica.nivel === "utilizador") {
    return criterio(
      "C",
      11,
      "Uso corrente de computador, smartphone ou aplicações",
      e.informatica.evidencia,
      "documentos"
    );
  }

  // Nada nos documentos, mas declarou no formulário.
  if (f.usa_ferramentas_digitais) {
    alertas.push({
      tipo: "divergencia_formulario",
      mensagem:
        "Declarou que usa tablet e formulários digitais, mas os documentos não o mostram. Confirmar na entrevista com uma demonstração.",
      gravidade: "aviso",
    });
    return criterio("C", 9, "Declarado no formulário, sem confirmação nos documentos", null, "formulario");
  }

  return criterio("C", 0, "Nenhuma evidência", null, "ambos");
}

// ----------------------------------- D. ATENDIMENTO E COMUNICAÇÃO (17)

const TRABALHO_COMUNIDADE = /inquérit|inquerit|comunidad|social|sensibiliz|activist|ativist|censo|recensea/i;

function pontuarComunicacao({ f, e }: Contexto): Criterio {
  const comunidade = e.experiencias.find(
    (x) => x.tipo_campo === "cadastro_censo_inquerito" || TRABALHO_COMUNIDADE.test(x.funcao)
  );

  if (comunidade) {
    return criterio(
      "D",
      17,
      "Inquéritos, sensibilização ou trabalho directo com comunidades",
      comunidade.evidencia ?? comunidade.funcao,
      "documentos"
    );
  }

  if (e.atendimento_publico.tem) {
    return criterio(
      "D",
      12,
      "Atendimento ao público em contexto comercial ou administrativo",
      e.atendimento_publico.evidencia,
      "documentos"
    );
  }

  if (f.atendimento_publico) {
    return criterio(
      "D",
      7,
      "Atendimento declarado no formulário, sem confirmação nos documentos",
      null,
      "formulario"
    );
  }

  return criterio("D", 0, "Nenhuma evidência", null, "ambos");
}

// ------------------------------------------- E. ESCOLARIDADE E FORMAÇÃO (10)

/** Áreas de formação que ajudam neste trabalho concreto. */
const AREA_UTIL = /geograf|topograf|cartograf|inform[áa]tic|estat[íi]stic|gest[ãa]o|administra|contab|constru|hidr[áa]ulic|[áa]gua|sanit|electr|eletr|social/i;

function pontuarEscolaridade({ f, e }: Contexto): Criterio {
  const superior = e.escolaridade.nivel_superior;
  const curso = e.escolaridade.curso ?? f.curso ?? "";
  const util = AREA_UTIL.test(curso) || (superior ? AREA_UTIL.test(superior) : false);

  if (superior && util) {
    return criterio("E", 10, `Ensino superior em área útil (${superior})`, e.escolaridade.evidencia, "ambos");
  }
  if (superior) {
    return criterio("E", 8, `Ensino superior (${superior})`, e.escolaridade.evidencia, "ambos");
  }
  if (util && curso) {
    return criterio("E", 7, `12.ª classe em área útil (${curso})`, e.escolaridade.evidencia, "ambos");
  }

  // A média só entra quando existe mesmo, e nunca sozinha decide nada.
  const media = e.escolaridade.media_final;
  if (media !== null && media >= 14) {
    return criterio("E", 6, `12.ª classe com média de ${media} valores`, e.escolaridade.evidencia, "documentos");
  }

  return criterio("E", 4, "12.ª classe concluída", e.escolaridade.evidencia, "ambos");
}

// -------------------------------------------------------------- F. CARTA (5)

function pontuarCarta({ f, e, alertas }: Contexto): Criterio {
  if (!f.tem_carta) {
    if (e.carta_conducao.tem) {
      alertas.push({
        tipo: "divergencia_formulario",
        mensagem: "Os documentos mostram carta de condução, mas o formulário diz que não tem.",
        gravidade: "info",
      });
    }
    return criterio("F", 0, "Não tem carta", null, "formulario");
  }

  const categoria = e.carta_conducao.categoria;
  return criterio(
    "F",
    5,
    categoria ? `Tem carta (${categoria})` : "Tem carta de condução",
    e.carta_conducao.evidencia,
    e.carta_conducao.tem ? "ambos" : "formulario"
  );
}

// --------------------------------------------------------- G. FOTOGRAFIA (2)

function pontuarFotografia({ e }: Contexto): Criterio {
  if (e.fotografia.nivel === "formacao")
    return criterio("G", 2, "Formação ou experiência em fotografia", e.fotografia.evidencia, "documentos");
  if (e.fotografia.nivel === "pratica")
    return criterio("G", 1, "Uso de câmara para registo de trabalho", e.fotografia.evidencia, "documentos");
  return criterio("G", 0, "Nenhuma", null, "documentos");
}

// --------------------------------------------------------- H. COMPLETUDE (2)

function pontuarCompletude({ f, e }: Contexto): Criterio {
  const ilegiveis = new Set(e.documentos_ilegiveis.map((d) => d.toLowerCase()));
  const legivel = (tipo: string) => !ilegiveis.has(tipo);

  const temTudo =
    f.temCv && legivel("cv") && f.temBi && legivel("bi") && f.temCertificado && legivel("certificado");
  const semIncoerencias = e.incoerencias.length === 0;

  if (temTudo && semIncoerencias) {
    return criterio("H", 2, "Documentação completa e coerente", null, "ambos");
  }
  if (temTudo || semIncoerencias) {
    return criterio("H", 1, temTudo ? "Documentação completa" : "Sem incoerências", null, "ambos");
  }
  return criterio("H", 0, "Documentação incompleta", null, "ambos");
}

// ---------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// ---------------------------------------------------------------------------

export function calcularPontuacao(
  formulario: DadosFormulario,
  extraccao: Extraccao
): ResultadoPontuacao {
  const alertas: Alerta[] = [];
  const ctx: Contexto = { f: formulario, e: extraccao, alertas };

  // --------------------------------------------------- eliminatório: 12.ª
  const declara12a = formularioDeclara12a(formulario.nivel_academico);
  const certificadoIlegivel = extraccao.documentos_ilegiveis
    .map((d) => d.toLowerCase())
    .includes("certificado");

  if (!extraccao.escolaridade.concluiu_12a && !declara12a) {
    return {
      versao: VERSAO_RUBRICA,
      eliminado: true,
      motivoEliminacao: "Não concluiu a 12.ª classe.",
      total: 0,
      criterios: [],
      alertas: [
        {
          tipo: "requisito_em_falta",
          mensagem: "Nem o formulário nem os documentos mostram a 12.ª classe concluída.",
          gravidade: "grave",
        },
      ],
    };
  }

  // Certificado ilegível não elimina ninguém: a culpa pode ser da digitalização.
  if (!extraccao.escolaridade.concluiu_12a && declara12a) {
    alertas.push({
      tipo: certificadoIlegivel ? "requisito_em_falta" : "divergencia_formulario",
      mensagem: certificadoIlegivel
        ? "A 12.ª classe está declarada no formulário. O certificado não foi lido automaticamente, por isso confirma-se na entrevista."
        : "A 12.ª classe está declarada no formulário mas não foi confirmada nos documentos. Por confirmar na entrevista.",
      gravidade: certificadoIlegivel ? "info" : "aviso",
    });
  }

  // NÃO se gera alerta por documento ilegível. Quando o OCR falha, a falha é
  // da leitura automática e não da candidatura.

  for (const inc of extraccao.incoerencias) {
    alertas.push({ tipo: "incoerencia_documentos", mensagem: inc, gravidade: "grave" });
  }

  const criterios = [
    pontuarResidencia(ctx),
    pontuarCadastro(ctx),
    pontuarDigital(ctx),
    pontuarComunicacao(ctx),
    pontuarEscolaridade(ctx),
    pontuarCarta(ctx),
    pontuarFotografia(ctx),
    pontuarCompletude(ctx),
  ];

  const total = criterios.reduce((s, c) => s + c.pontos, 0);

  return {
    versao: VERSAO_RUBRICA,
    eliminado: false,
    motivoEliminacao: null,
    total,
    criterios,
    alertas,
  };
}
