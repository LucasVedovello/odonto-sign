import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Eraser,
  ExternalLink,
  Loader2,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { cn } from "@/lib/utils";
import { dateBRtoISO, dateISOtoBR, maskDate } from "@/lib/masks";
import {
  formatBRL,
  STATUS_META,
  TREATMENT_LABEL,
  type Contract,
  type ContractStatus,
  type MaterialExtra,
  type Procedimento,
  type TreatmentType,
} from "@/lib/contracts";

export const Route = createFileRoute("/_authenticated/contratos/$id/editar")({
  component: EditContract,
  head: () => ({ meta: [{ title: "Completar contrato — OdontoSign" }] }),
});

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function EditContract() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const sigRef = useRef<SignaturePadHandle>(null);

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingLink, setSigningLink] = useState<string | null>(null);

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [materiais, setMateriais] = useState<MaterialExtra[]>([]);

  const [valorOrto, setValorOrto] = useState(0);
  const [valorNaoOrto, setValorNaoOrto] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [docOrto, setDocOrto] = useState(0);
  const [entradaTipo, setEntradaTipo] = useState("");
  const [entradaValor, setEntradaValor] = useState(0);
  const [sinalValor, setSinalValor] = useState(0);
  const [parcTipo, setParcTipo] = useState("");
  const [parcQtd, setParcQtd] = useState(0);
  const [parcValor, setParcValor] = useState(0);
  const [vencDia, setVencDia] = useState(0);
  const [vencPrimeira, setVencPrimeira] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      const c = data as unknown as Contract;
      setContract(c);
      setProcedimentos((c.procedimentos as Procedimento[]) ?? []);
      setMateriais((c.materiais_extras as MaterialExtra[]) ?? []);
      setValorOrto(c.valor_ortodontico ?? 0);
      setValorNaoOrto(c.valor_nao_ortodontico ?? 0);
      setDesconto(c.desconto ?? 0);
      setDocOrto(c.documentacao_ortodontica ?? 0);
      setEntradaTipo(c.entrada_tipo ?? "");
      setEntradaValor(c.entrada_valor ?? 0);
      setSinalValor(c.sinal_valor ?? 0);
      setParcTipo(c.parcelamento_tipo ?? "");
      setParcQtd(c.parcelamento_qtd ?? 0);
      setParcValor(c.parcelamento_valor ?? 0);
      setVencDia(c.vencimento_dia ?? 0);
      setVencPrimeira(dateISOtoBR(c.venc_primeira_parcela));
      setLoading(false);
    })();
  }, [id]);

  const procTotal = useMemo(
    () => procedimentos.reduce((s, p) => s + (Number(p.qtd) || 0) * (Number(p.valor) || 0), 0),
    [procedimentos],
  );
  const valorTotal = useMemo(() => valorOrto + valorNaoOrto, [valorOrto, valorNaoOrto]);
  const valorFinal = useMemo(() => valorTotal - desconto, [valorTotal, desconto]);

  const addProc = () =>
    setProcedimentos((p) => [...p, { tratamento: "", dentes: "", qtd: 1, valor: 0 }]);
  const updProc = (i: number, patch: Partial<Procedimento>) =>
    setProcedimentos((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const delProc = (i: number) => setProcedimentos((p) => p.filter((_, idx) => idx !== i));

  const addMat = () => setMateriais((m) => [...m, { tipo: "", valor: 0 }]);
  const updMat = (i: number, patch: Partial<MaterialExtra>) =>
    setMateriais((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const delMat = (i: number) => setMateriais((m) => m.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Assine como clínica antes de salvar");
      return;
    }
    setSaving(true);
    const payload = {
      procedimentos: procedimentos as unknown as Contract["procedimentos"],
      materiais_extras: materiais as unknown as Contract["materiais_extras"],
      valor_ortodontico: valorOrto,
      valor_nao_ortodontico: valorNaoOrto,
      valor_total: valorTotal,
      desconto,
      valor_final: valorFinal,
      documentacao_ortodontica: docOrto,
      entrada_tipo: entradaTipo || null,
      entrada_valor: entradaValor,
      sinal_valor: sinalValor,
      parcelamento_tipo: parcTipo || null,
      parcelamento_qtd: parcQtd || null,
      parcelamento_valor: parcValor,
      vencimento_dia: vencDia || null,
      venc_primeira_parcela: dateBRtoISO(vencPrimeira),
      clinic_signature: sigRef.current.toDataURL(),
      clinic_signed_at: new Date().toISOString(),
      status: "aguardando_assinatura_paciente" as const,
    };
    const { data, error } = await supabase
      .from("contracts")
      .update(payload)
      .eq("id", id)
      .select("signing_token")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Erro ao salvar contrato");
      return;
    }
    const url = `${window.location.origin}/p/${data.signing_token}/assinar`;
    setSigningLink(url);
    toast.success("Contrato salvo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!contract)
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="text-lg font-semibold">Contrato não encontrado</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/contratos">Voltar aos contratos</Link>
        </Button>
      </main>
    );

  const st = STATUS_META[contract.status as ContractStatus];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link to="/contratos">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          Contrato Nº {String(contract.contract_number).padStart(4, "0")}
        </h1>
        <span className="text-sm text-muted-foreground">
          {TREATMENT_LABEL[contract.treatment_type as TreatmentType]}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Paciente: {contract.paciente_nome || contract.contratante_nome || "—"} · Status: {st?.label}
      </p>

      {signingLink && (
        <Card className="mb-6 border-primary/30 p-6">
          <div className="mb-2 flex items-center gap-2 text-success">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
              <Check className="h-4 w-4" />
            </div>
            <p className="font-semibold">Contrato salvo — pronto para assinatura</p>
          </div>
          <p className="text-sm text-muted-foreground">Envie o link de assinatura ao paciente.</p>
          <p className="mt-3 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {signingLink}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(signingLink);
                toast.success("Link copiado");
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" /> Copiar link de assinatura
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(signingLink, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" /> Abrir
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/contratos" })}>
              Ir para a lista
            </Button>
          </div>
        </Card>
      )}

      {/* Procedimentos Contratados */}
      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Procedimentos Contratados</h2>
          <Button size="sm" variant="outline" onClick={addProc} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-12 py-2 pr-2">Nº</th>
                <th className="py-2 pr-2">Tratamento</th>
                <th className="py-2 pr-2">Dentes/Arcadas</th>
                <th className="w-20 py-2 pr-2">Qtd</th>
                <th className="w-32 py-2 pr-2">Valor (R$)</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {procedimentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum procedimento. Clique em "Adicionar".
                  </td>
                </tr>
              )}
              {procedimentos.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <Input
                      value={p.tratamento}
                      onChange={(e) => updProc(i, { tratamento: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      value={p.dentes}
                      onChange={(e) => updProc(i, { dentes: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={0}
                      value={p.qtd}
                      onChange={(e) => updProc(i, { qtd: num(e.target.value) })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={p.valor}
                      onChange={(e) => updProc(i, { valor: num(e.target.value) })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => delProc(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={4} className="py-2 pr-2 text-right text-sm font-medium">
                  Total dos procedimentos
                </td>
                <td className="py-2 pr-2 font-semibold">{formatBRL(procTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Materiais Extras */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Procedimentos / Materiais Extras</h2>
          <Button size="sm" variant="outline" onClick={addMat} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Tipo</th>
                <th className="w-32 py-2 pr-2">Valor (R$)</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {materiais.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum material extra.
                  </td>
                </tr>
              )}
              {materiais.map((m, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <Input
                      value={m.tipo}
                      onChange={(e) => updMat(i, { tipo: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={m.valor}
                      onChange={(e) => updMat(i, { valor: num(e.target.value) })}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => delMat(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Forma de Pagamento */}
      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Forma de Pagamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Valor tratamento ortodôntico"
            value={valorOrto}
            onChange={setValorOrto}
          />
          <MoneyField
            label="Valor tratamento não ortodôntico"
            value={valorNaoOrto}
            onChange={setValorNaoOrto}
          />
          <ReadOnlyMoney label="Valor total (automático)" value={valorTotal} />
          <MoneyField label="Desconto" value={desconto} onChange={setDesconto} />
          <ReadOnlyMoney label="Valor final (automático)" value={valorFinal} highlight />
          <MoneyField label="Documentação ortodôntica" value={docOrto} onChange={setDocOrto} />
        </div>

        <div className="mt-5 border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Entrada e sinal</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Entrada — tipo" value={entradaTipo} onChange={setEntradaTipo} />
            <MoneyField label="Entrada — valor" value={entradaValor} onChange={setEntradaValor} />
            <MoneyField label="Sinal — valor" value={sinalValor} onChange={setSinalValor} />
          </div>
        </div>

        <div className="mt-5 border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Parcelamento</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Tipo" value={parcTipo} onChange={setParcTipo} />
            <NumberField label="Qtd. parcelas" value={parcQtd} onChange={setParcQtd} />
            <MoneyField label="Valor por parcela" value={parcValor} onChange={setParcValor} />
            <NumberField label="Dia de vencimento" value={vencDia} onChange={setVencDia} />
            <div className="grid gap-1.5">
              <Label>Vencimento 1ª parcela</Label>
              <Input
                value={vencPrimeira}
                onChange={(e) => setVencPrimeira(maskDate(e.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Assinatura da clínica */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Assinatura da Clínica</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Assine abaixo com o mouse ou o dedo.</p>
        <div className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-white dark:bg-background">
          <SignaturePad ref={sigRef} className="block h-44 w-full" />
        </div>
        <div className="mt-1.5 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => sigRef.current?.clear()}
            className="h-7 gap-1.5 text-xs text-muted-foreground"
          >
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
      </Card>

      <Button onClick={save} disabled={saving} size="lg" className="mt-6 w-full">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Salvar e gerar link de assinatura"
        )}
      </Button>
    </main>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(num(e.target.value))}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.trunc(num(e.target.value)))}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReadOnlyMoney({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div
        className={cn(
          "flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold",
          highlight ? "border-primary/40 text-primary" : "border-input",
        )}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}
