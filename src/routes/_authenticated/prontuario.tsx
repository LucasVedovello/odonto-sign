import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Search,
  Trash2,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Eraser,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { SignatureDialog, type DualSignature } from "@/components/SignatureDialog";

export const Route = createFileRoute("/_authenticated/prontuario")({
  component: ProntuarioPage,
  head: () => ({ meta: [{ title: "Prontuários — OdontoSign" }] }),
});

// ── Types ───────────────────────────────────────────────────────────────────
type Arcada = Record<string, Record<string, boolean>>;
type Evento = {
  id?: string;
  data: string;
  dente: string;
  procedimento: string;
  dentista: string;
  assinatura_paciente: string;
  assinatura_doutor: string;
  assinado_em?: string | null;
  assinado_por?: string | null;
  // dirty = novo ou editado nesta sessão e ainda não (re)assinado.
  // Eventos legados carregados sem alteração ficam dirty:false e não bloqueiam.
  dirty?: boolean;
};
type ProntuarioStatus = "draft" | "signed" | "procedures_pending" | "finalized";
type ProntuarioRow = {
  id: string;
  nome: string | null;
  data: string | null;
  num_prontuario: string | null;
  num_contrato: string | null;
  assinatura_doutor: string | null;
  status: ProntuarioStatus | null;
  created_at: string;
};

const STATUS_META: Record<ProntuarioStatus, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground border-border" },
  signed: { label: "Assinado", cls: "bg-primary/15 text-primary border-primary/30" },
  procedures_pending: {
    label: "Procedimentos pendentes",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  finalized: { label: "Finalizado", cls: "bg-success/15 text-success border-success/30" },
};
type FormData = {
  data: string;
  planejado_por: string;
  nome: string;
  data_nasc: string;
  rg: string;
  endereco: string;
  telefone: string;
  num_prontuario: string;
  num_contrato: string;
  alergico: string;
  hemorragia: string;
  diabetes: string;
  cardiopatia: string;
  esta_gravida: string;
  prob_respiratorio: string;
  dst_aids_sifilis: string;
  usa_drogas: string;
  fuma: string;
  bebe: string;
  gastrointestinal: string;
  cicatrizacao: string;
  hepatite: string;
  ts_tc: string;
  convulsivo: string;
  pressao_arterial: string;
  vigencia_de: string;
  vigencia_ate: string;
  medico: string;
  fone_medico: string;
  medicamentos: string;
  outro_problema: string;
  queixa_principal: string;
  planejamento_prognostico: string;
  cobertura: string;
  arcada_superior: Arcada;
  arcada_inferior: Arcada;
  odontograma: Record<string, string>;
};

// ── Constants ───────────────────────────────────────────────────────────────
const DENTES_SUPERIOR = [
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
];
const DENTES_INFERIOR = [
  "48",
  "47",
  "46",
  "45",
  "44",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
];
const PROCEDIMENTOS = [
  "Periodontia",
  "Endodontia",
  "Clareamento",
  "Dentística",
  "Núcleo",
  "Provisória",
  "Definitiva",
];

const EMPTY_ARCADA = (): Arcada =>
  Object.fromEntries(
    [...DENTES_SUPERIOR, ...DENTES_INFERIOR].map((d) => [
      d,
      Object.fromEntries(PROCEDIMENTOS.map((p) => [p, false])),
    ]),
  );

const EMPTY_FORM = (): FormData => ({
  data: new Date().toISOString().split("T")[0],
  planejado_por: "",
  nome: "",
  data_nasc: "",
  rg: "",
  endereco: "",
  telefone: "",
  num_prontuario: "",
  num_contrato: "",
  alergico: "",
  hemorragia: "",
  diabetes: "",
  cardiopatia: "",
  esta_gravida: "",
  prob_respiratorio: "",
  dst_aids_sifilis: "",
  usa_drogas: "",
  fuma: "",
  bebe: "",
  gastrointestinal: "",
  cicatrizacao: "",
  hepatite: "",
  ts_tc: "",
  convulsivo: "",
  pressao_arterial: "",
  vigencia_de: "",
  vigencia_ate: "",
  medico: "",
  fone_medico: "",
  medicamentos: "",
  outro_problema: "",
  queixa_principal: "",
  planejamento_prognostico: "",
  cobertura: "",
  arcada_superior: EMPTY_ARCADA(),
  arcada_inferior: EMPTY_ARCADA(),
  odontograma: {},
});

// ── db alias for tables not in generated types ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Main Component ───────────────────────────────────────────────────────────
function ProntuarioPage() {
  const { profile } = useAuth();
  const [prontuarios, setProntuarios] = useState<ProntuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [saving, setSaving] = useState(false);
  const sigDoutorRef = useRef<SignaturePadHandle>(null);
  const sigPacienteRef = useRef<SignaturePadHandle>(null);
  // Índice do evento sendo assinado (abre o SignatureDialog), ou null.
  const [signingIdx, setSigningIdx] = useState<number | null>(null);

  // Patient autocomplete
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [patientSearchFocused, setPatientSearchFocused] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await db
      .from("prontuarios")
      .select("id,nome,data,num_prontuario,num_contrato,assinatura_doutor,status,created_at")
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setProntuarios((data ?? []) as ProntuarioRow[]);
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Patient search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,nome,data_nascimento,rg,endereco,telefone")
        .eq("company_id", profile?.company_id ?? "")
        .is("deleted_at", null)
        .ilike("nome", `%${patientSearch}%`)
        .limit(6);
      setPatientResults(data ?? []);
    }, 280);
    return () => clearTimeout(t);
  }, [patientSearch, profile?.company_id]);

  const selectPatient = (p: any) => {
    setSelectedPatientId(p.id ?? null);
    setForm((f) => ({
      ...f,
      nome: p.nome ?? "",
      data_nasc: p.data_nascimento ?? "",
      rg: p.rg ?? "",
      endereco: p.endereco ?? "",
      telefone: p.telefone ?? "",
    }));
    setPatientSearch(p.nome ?? "");
    setPatientResults([]);
  };

  // ── Open for edit ───────────────────────────────────────────────────────
  const openEdit = async (id: string) => {
    const { data: row } = await db.from("prontuarios").select("*").eq("id", id).single();
    if (!row) return;
    setSelectedPatientId(row.patient_id ?? null);
    setForm({
      ...EMPTY_FORM(),
      ...row,
      data: row.data ?? "",
      data_nasc: row.data_nasc ?? "",
      arcada_superior: row.arcada_superior ?? EMPTY_ARCADA(),
      arcada_inferior: row.arcada_inferior ?? EMPTY_ARCADA(),
    });
    setPatientSearch(row.nome ?? "");
    const { data: evs } = await db
      .from("prontuario_eventos")
      .select("*")
      .eq("prontuario_id", id)
      .order("created_at", { ascending: true });
    setEventos(
      (evs ?? []).map((e: any) => ({
        id: e.id,
        data: e.data ?? "",
        dente: e.dente ?? "",
        procedimento: e.procedimento ?? "",
        dentista: e.dentista ?? "",
        assinatura_paciente: e.assinatura_paciente ?? "",
        assinatura_doutor: e.assinatura_doutor ?? "",
        assinado_em: e.assinado_em ?? null,
        assinado_por: e.assinado_por ?? null,
        dirty: false, // carregado do banco; só vira dirty se editado nesta sessão
      })),
    );
    setEditingId(id);
    setStep(1);
  };

  // Editar qualquer campo de um evento INVALIDA sua assinatura (regra: alterar
  // procedimento exige nova assinatura). Marca dirty e limpa as assinaturas.
  const editEvento = (i: number, patch: Partial<Evento>) =>
    setEventos((prev) =>
      prev.map((x, j) =>
        j === i
          ? {
              ...x,
              ...patch,
              assinatura_doutor: "",
              assinatura_paciente: "",
              assinado_em: null,
              assinado_por: null,
              dirty: true,
            }
          : x,
      ),
    );

  const signEvento = (i: number, sig: DualSignature) =>
    setEventos((prev) =>
      prev.map((x, j) =>
        j === i
          ? {
              ...x,
              assinatura_doutor: sig.doctor,
              assinatura_paciente: sig.patient,
              assinado_em: new Date().toISOString(),
              assinado_por: profile?.id ?? null,
              dirty: false,
            }
          : x,
      ),
    );

  const eventoAssinado = (e: Evento) =>
    !e.dirty && !!e.assinatura_doutor && !!e.assinatura_paciente;

  const openNew = () => {
    setForm(EMPTY_FORM());
    setPatientSearch("");
    setSelectedPatientId(null);
    setEventos([]);
    setEditingId("new");
    setStep(1);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!profile?.company_id) {
      toast.error("Perfil sem empresa vinculada");
      return;
    }

    // ── Assinatura inicial: usa o que foi desenhado agora; se vazio, preserva
    //    a assinatura já armazenada (editar anamnese/planejamento NÃO re-exige).
    const drawnPac = sigPacienteRef.current?.isEmpty()
      ? null
      : (sigPacienteRef.current?.toDataURL() ?? null);
    const drawnDoc = sigDoutorRef.current?.isEmpty()
      ? null
      : (sigDoutorRef.current?.toDataURL() ?? null);
    const storedPac = (form as any).assinatura_paciente_planejamento ?? null;
    const storedDoc = (form as any).assinatura_doutor ?? null;
    const initialPac = drawnPac ?? storedPac;
    const initialDoc = drawnDoc ?? storedDoc;
    const hasInitial = !!(initialDoc && initialPac);

    // ── Enforcement (bloqueia o save quando falta a assinatura devida) ──
    // 1. Na criação, as informações iniciais precisam de doutor + paciente.
    if (editingId === "new" && !hasInitial) {
      toast.error("Assine as informações iniciais (doutor e paciente) no Passo 3");
      setStep(3);
      return;
    }
    // 2. Procedimentos novos/editados precisam ser assinados antes de salvar.
    const pendentes = eventos.filter((e) => e.dirty);
    if (pendentes.length > 0) {
      toast.error(
        `${pendentes.length} procedimento(s) alterado(s) sem assinatura. Assine cada um no Passo 2.`,
      );
      setStep(2);
      return;
    }

    // ── Status derivado ──
    const allEventsSigned =
      eventos.length > 0 && eventos.every((e) => e.assinatura_doutor && e.assinatura_paciente);
    const status: ProntuarioStatus = !hasInitial
      ? "draft"
      : eventos.length === 0
        ? "signed"
        : allEventsSigned
          ? "finalized"
          : "procedures_pending";

    setSaving(true);
    try {
      // company_id and patient_id are outside FormData — set them explicitly
      // so they are never accidentally overwritten by the form spread.
      const payload: any = {
        ...form,
        // explicit overrides (always win over form spread)
        company_id: profile.company_id,
        patient_id: selectedPatientId ?? null, // null when no patient selected — never ""
        updated_at: new Date().toISOString(),
        assinatura_paciente_planejamento: initialPac,
        assinatura_doutor: initialDoc,
        status,
      };
      // Auditoria da assinatura inicial: registra quando assinada agora (criação
      // ou re-assinatura explícita das informações iniciais).
      if (hasInitial && (drawnDoc || drawnPac || editingId === "new")) {
        payload.initial_signed_at = new Date().toISOString();
        payload.initial_signed_by = profile.id;
      }
      if (editingId && editingId !== "new") payload.id = editingId;

      const { data: saved, error } = await db
        .from("prontuarios")
        .upsert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("[prontuario] upsert error:", JSON.stringify(error, null, 2));
        throw new Error(error.message ?? "Erro ao salvar prontuário");
      }
      if (!saved) throw new Error("Upsert não retornou dados");

      const evDelete = await db.from("prontuario_eventos").delete().eq("prontuario_id", saved.id);
      if (evDelete.error)
        console.error("[prontuario] eventos delete error:", evDelete.error.message);

      if (eventos.length > 0) {
        const evInsert = await db.from("prontuario_eventos").insert(
          eventos.map((e) => ({
            prontuario_id: saved.id,
            data: e.data || null,
            dente: e.dente || null,
            procedimento: e.procedimento || null,
            dentista: e.dentista || null,
            assinatura_paciente: e.assinatura_paciente || null,
            assinatura_doutor: e.assinatura_doutor || null,
            assinado_em: e.assinado_em || null,
            assinado_por: e.assinado_por || null,
          })),
        );
        if (evInsert.error)
          console.error("[prontuario] eventos insert error:", evInsert.error.message);
      }

      // Tempo de atendimento: assinar o prontuário finaliza a consulta em
      // andamento do paciente (finished_at dispara o cálculo de duração).
      if ((status === "signed" || status === "finalized") && selectedPatientId) {
        await db
          .from("appointments")
          .update({ finished_at: new Date().toISOString(), prontuario_id: saved.id })
          .eq("patient_id", selectedPatientId)
          .eq("status", "in_progress")
          .is("deleted_at", null);
      }

      toast.success("Prontuário salvo com sucesso!");
      setEditingId(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar prontuário";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete (soft) ───────────────────────────────────────────────────────
  // Move para a lixeira; restauração em /lixeira (owner/admin).
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await db
      .from("prontuarios")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteId);
    setDeleting(false);
    toast.success("Prontuário movido para a lixeira");
    setDeleteId(null);
    load();
  };

  // ── Calibration grid PDF ─────────────────────────────────────────────────
  const downloadCalibration = async () => {
    const { generateCalibrationPdf } = await import("@/lib/prontuario-pdf");
    const doc = await generateCalibrationPdf();
    doc.save("grid-calibracao.pdf");
  };

  // ── Download PDF ────────────────────────────────────────────────────────
  const downloadPdf = async (id: string) => {
    const { data: row } = await db.from("prontuarios").select("*").eq("id", id).single();
    const { data: evs } = await db
      .from("prontuario_eventos")
      .select("*")
      .eq("prontuario_id", id)
      .order("created_at");
    if (!row) return;

    // Tipo do contrato vem de patients.procedimentos (TEXT[]); a ficha de
    // Prótese (IOP054) só entra quando "protese" está entre os procedimentos.
    let isProtese = false;
    if (row.patient_id) {
      const { data: pat } = await db
        .from("patients")
        .select("procedimentos")
        .eq("id", row.patient_id)
        .single();
      isProtese = (pat?.procedimentos ?? []).some(
        (proc: string) => (proc ?? "").toLowerCase() === "protese",
      );
    }

    const { generateProntuarioPdf } = await import("@/lib/prontuario-pdf");
    const doc = await generateProntuarioPdf(row, evs ?? [], { isProtese });
    doc.save(
      `prontuario-${(row.nome ?? "paciente").replace(/\s+/g, "_")}-${row.data ?? "s-data"}.pdf`,
    );
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = prontuarios.filter((p) => {
    const ql = q.toLowerCase();
    return (
      !ql ||
      (p.nome ?? "").toLowerCase().includes(ql) ||
      (p.num_prontuario ?? "").toLowerCase().includes(ql) ||
      (p.num_contrato ?? "").toLowerCase().includes(ql)
    );
  });

  // ── Arcada toggle ────────────────────────────────────────────────────────
  const toggleArcada = (
    arcada: "arcada_superior" | "arcada_inferior",
    dente: string,
    proc: string,
  ) => {
    setForm((f) => ({
      ...f,
      [arcada]: {
        ...f[arcada],
        [dente]: { ...f[arcada][dente], [proc]: !f[arcada][dente]?.[proc] },
      },
    }));
  };

  const sf = (k: keyof FormData) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (editingId !== null) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingId(null)}
            className="gap-1.5 mr-2"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                      ? "bg-success text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > s ? "✓" : s}
              </button>
              <span
                className={cn(
                  "text-sm hidden sm:block",
                  step === s ? "font-medium" : "text-muted-foreground",
                )}
              >
                {["Planejamento", "Eventos", "Assinaturas"][s - 1]}
              </span>
              {s < 3 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1 — Ficha de Planejamento ── */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Ficha de Planejamento — IOP046
              </h2>

              {/* Header fields */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="grid gap-1">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => sf("data")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Planejado por</Label>
                  <Input
                    value={form.planejado_por}
                    onChange={(e) => sf("planejado_por")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Nº Prontuário</Label>
                  <Input
                    value={form.num_prontuario}
                    onChange={(e) => sf("num_prontuario")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Nº Contrato</Label>
                  <Input
                    value={form.num_contrato}
                    onChange={(e) => sf("num_contrato")(e.target.value)}
                  />
                </div>
              </div>

              {/* Patient autocomplete */}
              <div className="mt-3 relative">
                <Label>Nome do paciente</Label>
                <Input
                  className="mt-1"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    sf("nome")(e.target.value);
                  }}
                  onFocus={() => setPatientSearchFocused(true)}
                  onBlur={() => setTimeout(() => setPatientSearchFocused(false), 200)}
                  placeholder="Buscar paciente..."
                />
                {patientSearchFocused && patientResults.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-md border border-border bg-card shadow-lg">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={() => selectPatient(p)}
                      >
                        {p.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <Label>Data de Nasc.</Label>
                  <Input
                    type="date"
                    value={form.data_nasc}
                    onChange={(e) => sf("data_nasc")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={(e) => sf("rg")(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => sf("telefone")(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 grid gap-1">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => sf("endereco")(e.target.value)} />
              </div>
            </Card>

            {/* Anamnese */}
            <Card className="p-5 sm:p-6">
              <h3 className="mb-4 font-semibold">Anamnese</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["alergico", "Alérgico"],
                  ["hemorragia", "Hemorragia"],
                  ["diabetes", "Diabetes"],
                  ["cardiopatia", "Cardiopatia"],
                  ["esta_gravida", "Grávida?"],
                  ["prob_respiratorio", "Probl. Resp."],
                  ["dst_aids_sifilis", "DST/AIDS/Síf."],
                  ["usa_drogas", "Usa drogas?"],
                  ["fuma", "Fuma?"],
                  ["bebe", "Bebe?"],
                  ["gastrointestinal", "Gastrointestinal"],
                  ["cicatrizacao", "Cicatrização"],
                  ["hepatite", "Hepatite"],
                  ["ts_tc", "TS/TC"],
                  ["convulsivo", "Convulsivo"],
                  ["pressao_arterial", "Pressão Arterial"],
                ].map(([k, label]) => (
                  <div key={k} className="grid gap-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      className="h-8 text-sm"
                      value={(form as any)[k]}
                      onChange={(e) => sf(k as keyof FormData)(e.target.value)}
                      placeholder="Descreva..."
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="grid gap-1">
                  <Label className="text-xs">Vigência De</Label>
                  <Input
                    className="h-8 text-sm"
                    type="date"
                    value={form.vigencia_de}
                    onChange={(e) => sf("vigencia_de")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Vigência Até</Label>
                  <Input
                    className="h-8 text-sm"
                    type="date"
                    value={form.vigencia_ate}
                    onChange={(e) => sf("vigencia_ate")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Médico</Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.medico}
                    onChange={(e) => sf("medico")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fone Médico</Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.fone_medico}
                    onChange={(e) => sf("fone_medico")(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Medicamentos que toma</Label>
                  <Input
                    value={form.medicamentos}
                    onChange={(e) => sf("medicamentos")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Algum outro problema não mencionado?</Label>
                  <Input
                    value={form.outro_problema}
                    onChange={(e) => sf("outro_problema")(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Queixa principal</Label>
                  <Input
                    value={form.queixa_principal}
                    onChange={(e) => sf("queixa_principal")(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Planejamento */}
            <Card className="p-5 sm:p-6">
              <h3 className="mb-4 font-semibold">Planejamento e Prognóstico</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Planejamento e Prognóstico</Label>
                  <textarea
                    rows={4}
                    value={form.planejamento_prognostico}
                    onChange={(e) => sf("planejamento_prognostico")(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Cobertura</Label>
                  <textarea
                    rows={4}
                    value={form.cobertura}
                    onChange={(e) => sf("cobertura")(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  />
                </div>
              </div>
            </Card>

            {/* Arcadas */}
            {(["arcada_superior", "arcada_inferior"] as const).map((arcada) => {
              const dentes = arcada === "arcada_superior" ? DENTES_SUPERIOR : DENTES_INFERIOR;
              const label = arcada === "arcada_superior" ? "Arcada Superior" : "Arcada Inferior";
              return (
                <Card key={arcada} className="p-5 sm:p-6 overflow-x-auto">
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" /> {label}
                  </h3>
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-1 pr-3 text-muted-foreground font-normal min-w-[90px]">
                          Procedimento
                        </th>
                        {dentes.map((d) => (
                          <th
                            key={d}
                            className="text-center px-1.5 py-1 font-semibold text-foreground"
                          >
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PROCEDIMENTOS.map((proc) => (
                        <tr key={proc} className="border-t border-border/40">
                          <td className="py-1 pr-3 text-muted-foreground">{proc}</td>
                          {dentes.map((d) => (
                            <td key={d} className="text-center px-1">
                              <button
                                type="button"
                                onClick={() => toggleArcada(arcada, d, proc)}
                                className={cn(
                                  "h-5 w-5 rounded border text-xs font-bold transition",
                                  form[arcada][d]?.[proc]
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-input text-transparent hover:border-primary/60",
                                )}
                              >
                                ✓
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}

            {/* Odontograma Atual — Odontologia Legal */}
            <Card className="p-5 sm:p-6">
              <h3 className="mb-3 font-semibold">Odontograma Atual — Odontologia Legal</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Anotações por dente (observações, lesões, restaurações, etc.)
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Superior Direito", dentes: [18, 17, 16, 15, 14, 13, 12, 11] },
                  { label: "Superior Esquerdo", dentes: [21, 22, 23, 24, 25, 26, 27, 28] },
                  { label: "Inferior Esquerdo", dentes: [38, 37, 36, 35, 34, 33, 32, 31] },
                  { label: "Inferior Direito", dentes: [41, 42, 43, 44, 45, 46, 47, 48] },
                ].map(({ label, dentes }) => (
                  <div key={label}>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
                    <div className="space-y-1">
                      {dentes.map((d) => (
                        <div key={d} className="flex items-center gap-2">
                          <span className="w-8 text-right text-xs font-mono text-primary font-bold shrink-0">
                            {d}
                          </span>
                          <Input
                            className="h-6 text-xs py-0"
                            value={form.odontograma[d.toString()] ?? ""}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                odontograma: { ...f.odontograma, [d.toString()]: e.target.value },
                              }))
                            }
                            placeholder="observação..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2 — Eventos ── */}
        {step === 2 && (
          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 font-semibold text-lg">Eventos Efetivamente Realizados — IOP043</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {form.nome && <span className="font-medium text-foreground">{form.nome}</span>}
              {form.num_contrato && (
                <span className="text-muted-foreground"> · Contrato {form.num_contrato}</span>
              )}
              {form.num_prontuario && (
                <span className="text-muted-foreground"> · Prontuário {form.num_prontuario}</span>
              )}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Cada procedimento exige assinatura do doutor + paciente. Editar uma linha já assinada
              invalida a assinatura e exige assinar novamente.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Data", "Dente", "Procedimento", "Dentista", "Assinatura", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2 px-2 font-medium text-muted-foreground text-xs"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((ev, i) => {
                    const assinado = eventoAssinado(ev);
                    return (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-1.5 px-1">
                          <input
                            type="date"
                            value={ev.data ?? ""}
                            onChange={(e) => editEvento(i, { data: e.target.value })}
                            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            style={{ width: 140 }}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <Input
                            className="h-7 w-16 text-xs"
                            value={ev.dente}
                            onChange={(e) => editEvento(i, { dente: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <Input
                            className="h-7 w-48 text-xs"
                            value={ev.procedimento}
                            onChange={(e) => editEvento(i, { procedimento: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <Input
                            className="h-7 w-32 text-xs"
                            value={ev.dentista}
                            onChange={(e) => editEvento(i, { dentista: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 px-1 whitespace-nowrap">
                          {assinado ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <CheckSquare className="h-3.5 w-3.5" /> Assinado
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs text-warning border-warning/40 hover:bg-warning/10"
                              onClick={() => setSigningIdx(i)}
                            >
                              <PenLine className="h-3.5 w-3.5" /> Assinar
                            </Button>
                          )}
                        </td>
                        <td className="py-1.5 px-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setEventos((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() =>
                setEventos((prev) => [
                  ...prev,
                  {
                    data: "",
                    dente: "",
                    procedimento: "",
                    dentista: "",
                    assinatura_paciente: "",
                    assinatura_doutor: "",
                    dirty: true,
                  },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar linha
            </Button>

            <SignatureDialog
              open={signingIdx !== null}
              title="Assinar procedimento"
              description="Doutor e paciente devem assinar para validar este procedimento."
              onOpenChange={(o) => {
                if (!o) setSigningIdx(null);
              }}
              onConfirm={(sig) => {
                if (signingIdx !== null) signEvento(signingIdx, sig);
                setSigningIdx(null);
              }}
            />
          </Card>
        )}

        {/* ── STEP 3 — Assinaturas ── */}
        {step === 3 && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-1 font-semibold flex items-center gap-2">
                <PenLine className="h-4 w-4 text-primary" /> Assinatura do Doutor
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Assinatura do responsável pelo atendimento
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-white dark:bg-background overflow-hidden">
                <SignaturePad ref={sigDoutorRef} className="block h-36 w-full" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sigDoutorRef.current?.clear()}
                className="mt-1 gap-1.5 text-xs text-muted-foreground"
              >
                <Eraser className="h-3.5 w-3.5" /> Limpar
              </Button>
            </Card>

            <Card className="p-5">
              <h3 className="mb-1 font-semibold flex items-center gap-2">
                <PenLine className="h-4 w-4 text-primary" /> Assinatura do Paciente
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                "Atesto serem verdadeiras as informações que prestei quanto ao meu estado geral de
                saúde."
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-white dark:bg-background overflow-hidden">
                <SignaturePad ref={sigPacienteRef} className="block h-36 w-full" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sigPacienteRef.current?.clear()}
                className="mt-1 gap-1.5 text-xs text-muted-foreground"
              >
                <Eraser className="h-3.5 w-3.5" /> Limpar
              </Button>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : setEditingId(null))}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" /> {step > 1 ? "Voltar" : "Cancelar"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="gap-2">
              Avançar <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Prontuário"}
            </Button>
          )}
        </div>
      </main>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Prontuários</h1>
          <p className="text-sm text-muted-foreground">Fichas clínicas e planejamentos</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCalibration}
            className="gap-1.5 text-xs hidden sm:flex"
          >
            <Download className="h-3.5 w-3.5" /> Grid calibração
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Prontuário
          </Button>
        </div>
      </div>

      <div className="relative mb-4 w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, prontuário ou contrato..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {prontuarios.length === 0 ? "Nenhum prontuário ainda" : "Nenhum resultado"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {prontuarios.length === 0
              ? 'Clique em "Novo Prontuário" para começar.'
              : "Tente outro termo de busca."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 card-list">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openEdit(p.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">
                      {p.nome || <span className="italic text-muted-foreground">Sem nome</span>}
                    </p>
                    {(() => {
                      const meta =
                        STATUS_META[p.status ?? (p.assinatura_doutor ? "signed" : "draft")];
                      return (
                        <Badge variant="outline" className={meta.cls}>
                          {meta.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.data && new Date(p.data).toLocaleDateString("pt-BR")}
                    {p.num_prontuario && ` · Pront. ${p.num_prontuario}`}
                    {p.num_contrato && ` · Cont. ${p.num_contrato}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p.id)}>
                    Abrir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadPdf(p.id)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteId(p.id)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir prontuário?</DialogTitle>
            <DialogDescription>
              Esta ação remove o prontuário e todos os eventos registrados. Não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
