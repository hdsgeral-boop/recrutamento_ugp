"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, MailCheck, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { marcarLote } from "@/app/admin/accoes-fases";
import { DEFINICOES_FASE, FASES, LOCAIS_SUGERIDOS, type Fase } from "@/lib/constantes-fases";
import { doInputParaIso, porExtensoComDia } from "@/lib/datas";

/**
 * ===========================================================================
 * MARCAÇÃO EM MASSA
 * ---------------------------------------------------------------------------
 * Escolher pessoas, escolher a fase, escolher quando e onde, e enviar.
 *
 * O ciclo de envio vive aqui, no browser, cinco de cada vez: cada pedido volta
 * depressa (o plano Hobby da Vercel corta aos 60 segundos) e a barra de
 * progresso mostra mesmo o que já foi feito. Se a página fechar a meio, o que
 * já foi marcado fica marcado.
 * ===========================================================================
 */

export interface CandidatoParaMarcar {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  municipio: string;
  status: string;
}

const TAMANHO_LOTE = 5;

export function MarcacaoMassa({
  candidatos,
  podeEnviarEmail,
}: {
  candidatos: CandidatoParaMarcar[];
  podeEnviarEmail: boolean;
}) {
  const router = useRouter();

  const [procura, setProcura] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());

  const [fase, setFase] = useState<Fase>("entrevista");
  const [quando, setQuando] = useState("");
  const [local, setLocal] = useState<string>(LOCAIS_SUGERIDOS[0]);
  const [notas, setNotas] = useState(DEFINICOES_FASE.entrevista.notas);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [aplicarEstado, setAplicarEstado] = useState(true);

  const [aCorrer, setACorrer] = useState(false);
  const [feitos, setFeitos] = useState(0);

  const estados = useMemo(
    () => Array.from(new Set(candidatos.map((c) => c.status))).sort(),
    [candidatos]
  );

  const visiveis = useMemo(() => {
    const termo = procura.trim().toLowerCase();
    return candidatos.filter((c) => {
      if (filtroEstado !== "todos" && c.status !== filtroEstado) return false;
      if (!termo) return true;
      return (
        c.nome.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo) ||
        c.municipio.toLowerCase().includes(termo)
      );
    });
  }, [candidatos, procura, filtroEstado]);

  const trocar = (id: string) =>
    setEscolhidos((antes) => {
      const novo = new Set(antes);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });

  const todosVisiveisEscolhidos =
    visiveis.length > 0 && visiveis.every((c) => escolhidos.has(c.id));

  const trocarTodos = () =>
    setEscolhidos((antes) => {
      const novo = new Set(antes);
      if (todosVisiveisEscolhidos) visiveis.forEach((c) => novo.delete(c.id));
      else visiveis.forEach((c) => novo.add(c.id));
      return novo;
    });

  /** Mudar de fase troca as notas, a não ser que já estejam escritas à mão. */
  const mudarFase = (nova: Fase) => {
    const eraPadrao = notas.trim() === DEFINICOES_FASE[fase].notas.trim() || !notas.trim();
    setFase(nova);
    if (eraPadrao) setNotas(DEFINICOES_FASE[nova].notas);
  };

  async function marcar() {
    const ids = Array.from(escolhidos);

    if (ids.length === 0) return toast.error("Escolhe pelo menos um candidato.");
    if (!quando) return toast.error("Indica a data e a hora.");
    if (!local.trim()) return toast.error("Indica o local.");

    // A hora escrita é sempre hora de Angola, esteja quem marca onde estiver.
    const iso = doInputParaIso(quando);
    if (!iso) return toast.error("A data e a hora não são válidas.");

    if (enviarEmail) {
      const confirmado = window.confirm(
        `Vais marcar ${DEFINICOES_FASE[fase].rotulo.toLowerCase()} para ${ids.length} candidato(s), ` +
          `${porExtensoComDia(iso)}, em ${local}, e enviar um email a cada um. ` +
          `Emails enviados não se apagam. Continuar?`
      );
      if (!confirmado) return;
    }

    setACorrer(true);
    setFeitos(0);

    let marcados = 0;
    let emails = 0;
    const problemas: string[] = [];

    try {
      for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
        const r = await marcarLote({
          ids: ids.slice(i, i + TAMANHO_LOTE),
          fase,
          quando: iso,
          local,
          notas,
          enviarEmail,
          aplicarEstado,
        });

        marcados += r.marcados;
        emails += r.emailsEnviados;
        problemas.push(...r.problemas);
        setFeitos(Math.min(i + TAMANHO_LOTE, ids.length));

        // Uma pausa curta entre lotes, para o Gmail não achar que é spam.
        if (i + TAMANHO_LOTE < ids.length) await new Promise((r) => setTimeout(r, 400));
      }

      problemas.length === 0
        ? toast.success(
            enviarEmail
              ? `${marcados} marcado(s) e ${emails} email(s) enviado(s).`
              : `${marcados} marcado(s), sem emails.`
          )
        : toast.warning(`${marcados} marcado(s), ${problemas.length} com problema.`);

      if (problemas.length > 0) console.warn("[marcação em massa]", problemas);

      setEscolhidos(new Set());
      router.refresh();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "A marcação foi interrompida.");
    } finally {
      setACorrer(false);
    }
  }

  const total = escolhidos.size;
  const percentagem = total > 0 ? Math.round((feitos / total) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-3 sm:px-4">
        <CalendarPlus className="h-4 w-4 shrink-0 text-consulvolt-vermelho" />
        <h2 className="text-sm font-semibold">Marcação em massa</h2>
        <span className="text-xs text-muted-foreground">
          Entrevistas, formações, testes de fluxo e reuniões
        </span>
        {total > 0 && (
          <span className="ml-auto rounded-full bg-consulvolt-vermelho px-2.5 py-0.5 text-xs font-semibold text-white">
            {total} escolhido{total > 1 ? "s" : ""}
          </span>
        )}
      </header>

      <div className="grid gap-5 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        {/* ------------------------------------------------ QUEM -------- */}
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 pl-8"
                placeholder="Procurar por nome, email ou município"
                value={procura}
                onChange={(e) => setProcura(e.target.value)}
              />
            </div>

            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estados</SelectItem>
                {estados.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={trocarTodos}
              disabled={visiveis.length === 0}
              className="font-medium text-consulvolt-vermelho hover:underline disabled:opacity-40"
            >
              {todosVisiveisEscolhidos
                ? `Desmarcar os ${visiveis.length} visíveis`
                : `Escolher os ${visiveis.length} visíveis`}
            </button>

            {total > 0 && (
              <button
                type="button"
                onClick={() => setEscolhidos(new Set())}
                className="hover:underline"
              >
                Limpar selecção
              </button>
            )}
          </div>

          <ul className="max-h-[340px] divide-y overflow-y-auto rounded-lg border">
            {visiveis.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum candidato corresponde a esta procura.
              </li>
            )}

            {visiveis.map((c) => {
              const activo = escolhidos.has(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                      activo ? "bg-red-50" : "hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => trocar(c.id)}
                      className="h-4 w-4 shrink-0 accent-[color:var(--consulvolt-vermelho,#c62828)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.municipio} · {c.email}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {c.status}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ------------------------------------------------ O QUÊ ------- */}
        <div className="min-w-0 space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Fase</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {FASES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => mudarFase(f)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    fase === f
                      ? "border-transparent " + DEFINICOES_FASE[f].crachá
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  {DEFINICOES_FASE[f].rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quando" className="text-xs">
              Data e hora
            </Label>
            <Input
              id="quando"
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="local" className="text-xs">
              Local
            </Label>
            <Input
              id="local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              list="locais-sugeridos"
              placeholder="Onde se realiza"
              className="h-9"
            />
            <datalist id="locais-sugeridos">
              {LOCAIS_SUGERIDOS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notas" className="text-xs">
              Indicações para o candidato
            </Label>
            <Textarea
              id="notas"
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2 border-t pt-2.5">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={enviarEmail && podeEnviarEmail}
                disabled={!podeEnviarEmail}
                onChange={(e) => setEnviarEmail(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <span className={cn(!podeEnviarEmail && "text-muted-foreground")}>
                Enviar email a cada candidato
                {!podeEnviarEmail && " (o teu papel não permite enviar emails)"}
              </span>
            </label>

            {DEFINICOES_FASE[fase].estadoSugerido && (
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={aplicarEstado}
                  onChange={(e) => setAplicarEstado(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <span>
                  Passar o estado para{" "}
                  <strong>{DEFINICOES_FASE[fase].estadoSugerido}</strong>
                </span>
              </label>
            )}
          </div>

          <Button
            className="w-full"
            disabled={aCorrer || total === 0}
            onClick={marcar}
          >
            {aCorrer ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : enviarEmail && podeEnviarEmail ? (
              <MailCheck className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {aCorrer
              ? `A tratar ${feitos} de ${total}…`
              : total === 0
                ? "Escolhe candidatos"
                : `Marcar ${total} candidato${total > 1 ? "s" : ""}`}
          </Button>

          {aCorrer && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-consulvolt-vermelho transition-all duration-300"
                style={{ width: `${percentagem}%` }}
              />
            </div>
          )}

          <p className="text-[11px] leading-snug text-muted-foreground">
            Os emails vão em lotes de {TAMANHO_LOTE}, com pausa entre eles. Podes marcar agora sem
            email e enviar depois, quando a data estiver confirmada.
          </p>
        </div>
      </div>
    </section>
  );
}
