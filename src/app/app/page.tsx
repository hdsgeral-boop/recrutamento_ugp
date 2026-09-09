import type { Metadata } from "next";
import { CabecalhoPublico } from "@/components/cabecalho-publico";
import { FormularioCandidatura } from "@/components/formulario-candidatura";
import { Card, CardContent } from "@/components/ui/card";
import { EMPRESA } from "@/lib/constantes";
import { aceitaCandidaturas, lerDefinicoes, motivoDoFecho } from "@/lib/definicoes";
import { dataHora } from "@/lib/datas";
import { CalendarClock } from "lucide-react";

export const metadata: Metadata = {
  title: `Candidatura - ${EMPRESA.vaga}`,
  description: `Formulário de candidatura à vaga de ${EMPRESA.vaga} - ${EMPRESA.projecto}.`,
};

/** Renderização dinâmica: a página lê variáveis de ambiente no cliente. */
export const dynamic = "force-dynamic";

export default async function PaginaCandidatura() {
  const definicoes = await lerDefinicoes();
  const aberto = aceitaCandidaturas(definicoes);
  const motivo = motivoDoFecho(definicoes);

  return (
    <>
      <CabecalhoPublico prazo={definicoes.prazo} />

      <main className="container max-w-3xl py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-consulvolt-vermelho">
            {aberto ? "Recrutamento aberto" : "Candidaturas encerradas"}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{EMPRESA.vaga}</h1>
        </div>

        {aberto ? (
          <Card>
            <CardContent className="p-5 sm:p-7">
              <FormularioCandidatura />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-consulvolt-vermelho" />
                <div className="min-w-0">
                  <h2 className="font-semibold">Já não estamos a receber candidaturas</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {definicoes.mensagemEncerrado?.trim() ||
                      (motivo === "prazo"
                        ? `O prazo terminou a ${dataHora(definicoes.prazo)}. Estamos a analisar as candidaturas recebidas e vamos contactar quem avançar.`
                        : "As candidaturas estão fechadas de momento. Se voltarmos a abrir, anunciamos pelos mesmos canais onde viste este anúncio.")}
                  </p>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
                Se já te candidataste, não precisas de fazer nada: guardámos a tua candidatura e
                respondemos a toda a gente, mesmo a quem não avançar.
              </p>
            </CardContent>
          </Card>
        )}

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          {EMPRESA.nomeCompleto} - {EMPRESA.morada}
        </footer>
      </main>
    </>
  );
}
