import { Card, CardContent } from "@/components/ui/card";

interface Resumo {
  total: number;
  pendentes: number;
  aprovados: number;
  contactados: number;
  comCarta: number;
  comDigital: number;
  comAtendimento: number;
  comExperiencia: number;
  /** Quantos moram num dos bairros onde o trabalho decorre. */
  naZona: number;
}

/** Fila de indicadores no topo do painel. */
export function CartoesResumo({ resumo }: { resumo: Resumo }) {
  const cartoes = [
    { rotulo: "Candidaturas", valor: resumo.total, cor: "text-consulvolt-preto" },
    { rotulo: "Pendentes", valor: resumo.pendentes, cor: "text-amber-600" },
    { rotulo: "Aprovados", valor: resumo.aprovados, cor: "text-emerald-600" },
    { rotulo: "Contactados", valor: resumo.contactados, cor: "text-sky-600" },
    { rotulo: "Moram nos bairros do projecto", valor: resumo.naZona, cor: "text-emerald-600" },
    { rotulo: "Usam ferramentas digitais", valor: resumo.comDigital, cor: "text-consulvolt-vermelho" },
    { rotulo: "Atendimento ao público", valor: resumo.comAtendimento, cor: "text-amber-600" },
    { rotulo: "Com experiência", valor: resumo.comExperiencia, cor: "text-violet-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cartoes.map((c) => (
        <Card key={c.rotulo}>
          <CardContent className="p-4">
            <p className={`text-2xl font-bold ${c.cor}`}>{c.valor}</p>
            <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{c.rotulo}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
