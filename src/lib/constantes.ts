/**
 * Constantes do concurso "TÉCNICO DE CADASTRO - UGP / EPAL".
 * Um único sítio para mudar textos e listas usados em todo o sistema.
 *
 * O que aqui está são os valores de omissão. O prazo das candidaturas e o
 * número de vagas passaram a viver na tabela `definicoes` e mudam-se no
 * painel, sem tocar no código nem republicar - ver src/lib/definicoes.ts.
 */

/**
 * Prazo-limite das candidaturas, valor de omissão.
 * O painel sobrepõe-se a isto. Só é usado enquanto ninguém tiver gravado
 * um prazo nas definições.
 */
export const PRAZO_CANDIDATURA = new Date("2026-10-15T00:00:00+01:00");

/** Quantos técnicos se pretende contratar. NÃO aparece no formulário público. */
export const VAGAS_PREVISTAS_PADRAO = 12;

/** O que o Técnico de Cadastro vai fazer no terreno. */
export const ATRIBUICOES = [
  "Marcação física dos locais de consumo, com numeração das portas",
  "Aplicação de etiquetas de identificação",
  "Cadastro digital em tablet, com georreferenciação de cada local",
  "Inquérito ao morador sobre a situação contratual da ligação de água",
  "Registo fotográfico da fachada, da instalação e dos documentos",
] as const;

/** Condições reais do trabalho, mostradas antes de o candidato confirmar. */
export const CONDICOES_TRABALHO = [
  "Trabalho de campo ao ar livre, durante todo o dia, com exposição directa ao sol e à poeira.",
  "Deslocações a pé, porta a porta, por ruas e becos de terreno irregular.",
  "Contacto directo e constante com moradores, explicando o trabalho e pedindo documentos.",
  "Uso obrigatório do equipamento de protecção individual e do crachá fornecidos pela empresa.",
  "Horário sujeito às condições do terreno, podendo incluir início cedo e trabalho aos sábados.",
] as const;

/**
 * O recrutamento é para a Unidade de Gestão do Projecto (UGP), em Luanda.
 * As restantes zonas do âmbito alargado ficam para depois.
 */
export const PROVINCIAS = ["Luanda"] as const;

export type Provincia = (typeof PROVINCIAS)[number];

/** Municípios da província de Luanda. */
export const MUNICIPIOS_POR_PROVINCIA: Record<Provincia, readonly string[]> = {
  Luanda: [
    "Belas",
    "Cacuaco",
    "Cazenga",
    "Icolo e Bengo",
    "Kilamba Kiaxi",
    "Luanda",
    "Quiçama",
    "Talatona",
    "Viana",
  ],
} as const;

/** Descobre a que província pertence um município. */
export function provinciaDoMunicipio(municipio: string): Provincia | null {
  for (const p of PROVINCIAS) {
    if (MUNICIPIOS_POR_PROVINCIA[p].includes(municipio)) return p;
  }
  return null;
}

/**
 * Bairros da zona de influência da UGP, onde o trabalho decorre.
 *
 * É a lista que interessa de verdade para a pontuação: quem mora aqui chega
 * ao terreno a pé e não perde duas horas por dia em transporte. O piloto
 * mostrou que a produtividade cai muito quando a equipa chega tarde.
 */
export const BAIRROS_UGP = [
  "Cabolombo",
  "Casas Brancas",
  "Cawelele",
  "Corimba",
  "Costa do Sol",
  "Futungo de Belas",
  "Gamek",
  "Imbondeiro",
  "Inorade",
  "Morro Bento I",
  "Morro Bento II",
  "Morro da Luz",
] as const;

/** Opção para quem mora fora da zona. */
export const BAIRRO_FORA = "Outro bairro de Luanda";

/**
 * O bairro como se mostra a uma pessoa.
 *
 * Quem escolheu "Outro bairro de Luanda" escreveu o nome à mão, e é esse que
 * interessa ler no painel: doze linhas todas com "Outro bairro de Luanda" não
 * dizem nada a ninguém. Para a pontuação continua a valer o campo `bairro`,
 * que é o da lista fechada.
 */
export function bairroVisivel(c: {
  bairro: string;
  bairro_outro?: string | null;
}): string {
  if (c.bairro === BAIRRO_FORA && c.bairro_outro?.trim()) return c.bairro_outro.trim();
  return c.bairro;
}

/** Verdadeiro quando o bairro fica fora da zona de trabalho do projecto. */
export function foraDaZona(bairro: string): boolean {
  return !(BAIRROS_UGP as readonly string[]).includes(bairro);
}

export const BAIRROS_OPCOES = [...BAIRROS_UGP, BAIRRO_FORA] as const;

/**
 * Municípios que contêm a zona de influência da UGP.
 * Quem mora aqui, mesmo fora dos bairros listados, está perto do trabalho.
 */
export const MUNICIPIOS_DA_ZONA = ["Talatona", "Luanda"] as const;

/** Municípios vizinhos, com acesso directo à zona. */
export const MUNICIPIOS_VIZINHOS = ["Belas", "Kilamba Kiaxi"] as const;

/** Níveis académicos aceites na candidatura. */
export const NIVEIS_ACADEMICOS = [
  "Ensino Médio Técnico (12.ª classe)",
  "Ensino Médio Geral (12.ª classe)",
  "Frequência Universitária",
  "Bacharelato",
  "Licenciatura",
  "Pós-graduação ou superior",
] as const;

export type NivelAcademico = (typeof NIVEIS_ACADEMICOS)[number];

/** Estados possíveis de uma candidatura (espelham o CHECK do PostgreSQL). */
export const STATUS = ["Pendente", "Aprovado", "Reprovado", "Contactado"] as const;

export type Status = (typeof STATUS)[number];

/** Cor do crachá de cada estado no painel. */
export const STATUS_VARIANTE: Record<Status, "pendente" | "aprovado" | "reprovado" | "contactado"> = {
  Pendente: "pendente",
  Aprovado: "aprovado",
  Reprovado: "reprovado",
  Contactado: "contactado",
};

/** Limites e tipos de ficheiro aceites no upload. */
export const TAMANHO_MAXIMO_FICHEIRO = 700 * 1024; // 700 KB por ficheiro
export const TAMANHO_MAXIMO_KB = 700;
export const TIPOS_ACEITES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const EXTENSOES_ACEITES = [".pdf", ".jpg", ".jpeg", ".png"] as const;

/** Documentos obrigatórios na candidatura. */
export const DOCUMENTOS = [
  { chave: "cv", etiqueta: "Curriculum Vitae", ficheiro: "CV" },
  { chave: "bi", etiqueta: "Bilhete de Identidade", ficheiro: "BI" },
  { chave: "certificado", etiqueta: "Certificado de Habilitações", ficheiro: "Certificado" },
] as const;

export type ChaveDocumento = (typeof DOCUMENTOS)[number]["chave"];

/** Nome da pasta-raiz criada no Google Drive. Nova, separada do Bengo. */
export const PASTA_RAIZ_DRIVE = "Recrutamento_UGP_EPAL_2026";

/** Nome do bucket de Storage no Supabase. */
export const BUCKET = "documentos-candidatos";

/** Dados institucionais usados nos emails e no cabeçalho do site. */
export const EMPRESA = {
  nome: "CONSULVOLT",
  nomeCompleto: "Consulvolt - Comércio e Prestação de Serviços, Lda.",
  site: "https://www.consulvolt.pt",
  morada: "Urbanização Lar do Patriota, Rua 6/8 - Luanda, Angola",
  vaga: "Técnico de Cadastro",
  projecto: "Cadastro de Locais de Consumo de Água - EPAL",
  cores: { vermelho: "#CE1B2E", amarelo: "#FCC719", preto: "#141414" },
} as const;
