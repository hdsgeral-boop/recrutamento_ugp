import type { TipoEmail } from "@/types/database";

/** Como cada tipo de email aparece no painel. */
export const ETIQUETAS_EMAIL: Record<TipoEmail, string> = {
  confirmacao: "Confirmação de candidatura",
  aprovacao: "Aprovação e entrevista",
  entrevista: "Entrevista (alteração ou lembrete)",
  reprovacao: "Não selecção",
  personalizado: "Mensagem personalizada",
  rh: "Aviso interno para o RH",
  formacao: "Convocatória para formação",
  teste_fluxo: "Convocatória para teste de fluxo",
  reuniao: "Convocatória para reunião",
};

export const CORES_EMAIL: Record<TipoEmail, string> = {
  confirmacao: "bg-slate-100 text-slate-700",
  aprovacao: "bg-emerald-100 text-emerald-800",
  entrevista: "bg-sky-100 text-sky-800",
  reprovacao: "bg-rose-100 text-rose-800",
  personalizado: "bg-violet-100 text-violet-800",
  rh: "bg-amber-100 text-amber-800",
  formacao: "bg-violet-100 text-violet-800",
  teste_fluxo: "bg-orange-100 text-orange-800",
  reuniao: "bg-sky-100 text-sky-800",
};

/** Locais habituais das entrevistas, para não se escrever tudo à mão. */
export const LOCAIS_ENTREVISTA = [
  "Escritório da Consulvolt - Urbanização Lar do Patriota, Rua 6/8, Luanda",
  "Escritório da UGP - Projecto EPAL, Luanda",
  "Entrevista por telefone",
  "Videochamada (o link segue por WhatsApp)",
] as const;

/** O que o candidato deve levar, por omissão. */
export const NOTAS_ENTREVISTA_PADRAO =
  "Traz o Bilhete de Identidade original e uma cópia do Certificado de Habilitações. " +
  "Chega 10 minutos antes da hora marcada.";
