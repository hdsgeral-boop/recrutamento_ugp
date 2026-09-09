import type { Alerta, ResultadoPontuacao, TipoAlerta } from "@/lib/ranking/tipos";

/**
 * ===========================================================================
 * A LINGUAGEM VISUAL DO RANKING
 * ---------------------------------------------------------------------------
 * Uma cor sem legenda é uma opinião escondida. Aqui fica escrito, num sítio
 * só, o que cada cor e cada alerta querem dizer - e é daqui que sai tanto a
 * legenda da página como o texto dos pop-ups.
 *
 * Nada disto altera a pontuação. São escalões de leitura, não decisões: a
 * aprovação continua a ser um acto explícito de uma pessoa na ficha do
 * candidato.
 * ===========================================================================
 */

export interface Escalao {
  /** Pontuação mínima, inclusive. */
  min: number;
  rotulo: string;
  /** Classes do crachá da pontuação. */
  cor: string;
  /** Bolinha da legenda. */
  ponto: string;
  descricao: string;
}

export const ESCALOES: Escalao[] = [
  {
    min: 75,
    rotulo: "Muito forte",
    cor: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
    ponto: "bg-emerald-500",
    descricao:
      "Reúne quase tudo o que o posto pede: mora num dos bairros do projecto, já fez cadastro ou inquérito no terreno, trabalha à vontade com tablet e tem experiência de lidar com o público à porta. Candidato a entrevistar primeiro.",
  },
  {
    min: 60,
    rotulo: "Forte",
    cor: "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
    ponto: "bg-sky-500",
    descricao:
      "Bom perfil com uma ou duas lacunas. Costuma faltar a experiência de recolha de dados documentada ou a prática com tablet e formulários digitais.",
  },
  {
    min: 45,
    rotulo: "Médio",
    cor: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    ponto: "bg-amber-500",
    descricao:
      "Cumpre o essencial mas fica atrás noutros pontos. Vale a leitura da ficha antes de decidir, sobretudo se morar num dos bairros do projecto: quem é conhecido no bairro abre portas que os outros não abrem.",
  },
  {
    min: 0,
    rotulo: "Fraco",
    cor: "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
    ponto: "bg-slate-400",
    descricao:
      "Poucos pontos de encontro com o perfil, ou documentos que não permitiram confirmar quase nada. Confirmar sempre na ficha antes de excluir.",
  },
];

export const ESCALAO_ELIMINADO: Escalao = {
  min: -1,
  rotulo: "Eliminado",
  cor: "bg-rose-100 text-rose-900 ring-1 ring-rose-300",
  ponto: "bg-rose-500",
  descricao:
    "Falha um requisito eliminatório da rubrica, normalmente a 12.ª classe. Continua a poder ser aprovado por decisão humana na ficha.",
};

export const ESCALAO_POR_ANALISAR: Escalao = {
  min: -2,
  rotulo: "Por analisar",
  cor: "bg-white text-slate-500 ring-1 ring-dashed ring-slate-300",
  ponto: "bg-slate-200",
  descricao:
    "Os documentos ainda não passaram pelo OCR. Sem pontuação, a candidatura vai para o fim da lista - não quer dizer que seja fraca.",
};

/** O escalão de uma linha do ranking. */
export function escalaoDe(total: number | null | undefined, eliminado?: boolean): Escalao {
  if (total == null) return ESCALAO_POR_ANALISAR;
  if (eliminado) return ESCALAO_ELIMINADO;
  return ESCALOES.find((e) => total >= e.min) ?? ESCALOES[ESCALOES.length - 1];
}

// --------------------------------------------------------------- AS BARRAS

export interface Barra {
  chave: "terreno" | "digital" | "atendimento" | "residencia";
  rotulo: string;
  maximo: number;
  cor: string;
  descricao: string;
  /** Critérios da rubrica que a barra soma. */
  criterios: string[];
}

export const BARRAS: Barra[] = [
  {
    chave: "terreno",
    rotulo: "Cadastro e recolha de dados no terreno",
    maximo: 24,
    cor: "bg-emerald-500",
    descricao:
      "Critério B. Cadastro, censo, inquérito porta a porta, leitura de contadores ou qualquer recolha de dados feita na rua. É o bloco que mais separa candidatos, porque é o trabalho que vão fazer todos os dias.",
    criterios: ["B"],
  },
  {
    chave: "residencia",
    rotulo: "Residência na zona de trabalho",
    maximo: 20,
    cor: "bg-sky-500",
    descricao:
      "Critério A. Morar num dos bairros da UGP vale o máximo: quem é conhecido no bairro consegue que a porta abra. Talatona e Luanda valem menos, Belas e Kilamba Kiaxi menos ainda, e o resto pouco, por causa da deslocação diária.",
    criterios: ["A"],
  },
  {
    chave: "digital",
    rotulo: "Literacia digital",
    maximo: 20,
    cor: "bg-violet-500",
    descricao:
      "Critério C. Tablet ou telemóvel com formulário digital, GPS e fotografia. Todo o cadastro é digital e georreferenciado, por isso quem nunca usou estas ferramentas atrasa a equipa nas primeiras semanas.",
    criterios: ["C"],
  },
  {
    chave: "atendimento",
    rotulo: "Atendimento ao público e comunicação",
    maximo: 17,
    cor: "bg-amber-500",
    descricao:
      "Critério D. Explicar o trabalho a um morador desconfiado e conseguir ver os documentos da ligação. No piloto, 74,7% dos insucessos foram porta fechada ou recusa, por isso este bloco pesa quase tanto como a residência.",
    criterios: ["D"],
  },
];

/** Quanto vale uma barra, para um resultado concreto. */
export function valorDaBarra(detalhe: ResultadoPontuacao | null, barra: Barra): number {
  if (!detalhe) return 0;
  return barra.criterios.reduce(
    (soma, codigo) => soma + (detalhe.criterios.find((c) => c.codigo === codigo)?.pontos ?? 0),
    0
  );
}

// -------------------------------------------------------------- OS ALERTAS

export const GRAVIDADES: Record<
  Alerta["gravidade"],
  { rotulo: string; cor: string; ponto: string; explicacao: string }
> = {
  grave: {
    rotulo: "Grave",
    cor: "bg-rose-100 text-rose-800 ring-1 ring-rose-300",
    ponto: "bg-rose-500",
    explicacao:
      "Alguma coisa não bate certo na candidatura e pode mudar a leitura do candidato. Ler antes de marcar entrevista.",
  },
  aviso: {
    rotulo: "Aviso",
    cor: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
    ponto: "bg-amber-500",
    explicacao:
      "Falta informação ou um documento saiu mal lido. A pontuação pode estar abaixo do que o candidato merece.",
  },
  info: {
    rotulo: "Nota",
    cor: "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
    ponto: "bg-slate-400",
    explicacao: "Registo de como a análise foi feita. Não afecta a pontuação.",
  },
};

export const DESCRICAO_ALERTA: Record<TipoAlerta, string> = {
  requisito_em_falta:
    "Um requisito da vaga não aparece confirmado. Quando é a 12.ª classe e o formulário a declara, o candidato não é eliminado: confirma-se na entrevista.",
  documento_ilegivel:
    "Um documento não foi lido ou não chegou ao Drive. Não conta contra o candidato; a pontuação é feita com o resto.",
  ficheiro_duplicado:
    "O candidato carregou o mesmo ficheiro em dois campos diferentes, ou seja, falta-lhe um documento verdadeiro.",
  divergencia_formulario:
    "O que o candidato declarou no formulário não corresponde ao que está nos documentos. Vale o formulário para a pontuação, e fica o registo.",
  incoerencia_documentos:
    "Os documentos entre si não batem certo: nomes diferentes, números de BI diferentes ou datas impossíveis.",
  pdf_truncado:
    "O OCR do Drive só lê as primeiras 10 páginas de um PDF. O resto do documento não entrou na análise.",
  sem_extraccao:
    "Registo do motor que fez a leitura, ou aviso de que a interpretação por modelo não correu e a pontuação usou só o que foi lido por dicionário e o formulário.",
};

/**
 * Os tipos de alerta, com o nome curto e a gravidade com que costumam sair.
 * A gravidade escolhe a cor do símbolo na legenda, para a lista de tipos ter
 * também cor ao lado de cada descrição e não só texto.
 */
export const TIPOS_DE_ALERTA: {
  tipo: TipoAlerta;
  nome: string;
  gravidade: Alerta["gravidade"];
}[] = [
  { tipo: "ficheiro_duplicado", nome: "Ficheiro repetido", gravidade: "grave" },
  { tipo: "incoerencia_documentos", nome: "Documentos incoerentes entre si", gravidade: "grave" },
  { tipo: "requisito_em_falta", nome: "Requisito por confirmar", gravidade: "grave" },
  { tipo: "divergencia_formulario", nome: "Formulário difere dos documentos", gravidade: "aviso" },
  { tipo: "pdf_truncado", nome: "PDF truncado", gravidade: "aviso" },
  { tipo: "documento_ilegivel", nome: "Documento não lido", gravidade: "info" },
  { tipo: "sem_extraccao", nome: "Motor da leitura", gravidade: "info" },
];

/** Conta os alertas por gravidade, para o crachá da tabela. */
export function contarAlertas(alertas: Alerta[] | null | undefined) {
  const lista = alertas ?? [];
  return {
    total: lista.length,
    graves: lista.filter((a) => a.gravidade === "grave").length,
    avisos: lista.filter((a) => a.gravidade === "aviso").length,
    notas: lista.filter((a) => a.gravidade === "info").length,
    /** A gravidade que manda na cor do crachá. */
    dominante: (lista.some((a) => a.gravidade === "grave")
      ? "grave"
      : lista.some((a) => a.gravidade === "aviso")
        ? "aviso"
        : "info") as Alerta["gravidade"],
  };
}
