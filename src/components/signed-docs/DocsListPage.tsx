import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileSignature, Loader2, Plus, Search, Upload } from "lucide-react";
import {
  STATUS_META,
  docConfig,
  type DocKind,
  type SignedDoc,
  type SignedDocStatus,
} from "@/lib/signed-docs";
import type { DetectResult } from "@/lib/pdf-detect";

type Row = Pick<SignedDoc, "id" | "patient_name" | "title" | "status" | "created_at">;

type PatientOpt = { id: string; nome: string | null; prontuario: string | null };

export function DocsListPage({ kind }: { kind: DocKind }) {
  const cfg = docConfig(kind);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // ── Diálogo de novo documento ─────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [patientName, setPatientName] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    // cfg.table é "contracts" | "terms" (schemas idênticos). O cast fixa o tipo
    // estático em uma das tabelas; o valor em runtime continua sendo o correto.
    const { data, error } = await supabase
      .from(cfg.table as "contracts")
      .select("id,patient_name,title,status,created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(`Erro ao carregar ${cfg.labelPlural.toLowerCase()}`);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [profile, cfg.table, cfg.labelPlural]);

  useEffect(() => {
    if (!profile) return;
    load();
    const ch = supabase
      .channel(`${cfg.table}-live`)
      .on("postgres_changes", { event: "*", schema: "public", table: cfg.table }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, profile, cfg.table]);

  // Carrega pacientes da clínica para associação (opcional).
  useEffect(() => {
    if (!open || !profile?.company_id) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,nome,prontuario")
        .eq("company_id", profile.company_id)
        .is("deleted_at", null)
        .order("nome", { ascending: true })
        .limit(1000);
      setPatients((data ?? []) as PatientOpt[]);
    })();
  }, [open, profile]);

  const resetForm = () => {
    setPatientId("");
    setPatientName("");
    setTitle("");
    setFile(null);
  };

  const onPickPatient = (id: string) => {
    setPatientId(id);
    const p = patients.find((x) => x.id === id);
    if (p?.nome && !patientName.trim()) setPatientName(p.nome);
  };

  const create = async () => {
    if (!profile?.company_id) return;
    if (!patientName.trim()) {
      toast.error("Informe o nome do paciente");
      return;
    }
    if (!file) {
      toast.error("Anexe o PDF do documento");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("O arquivo precisa ser um PDF");
      return;
    }
    setSaving(true);
    try {
      // Detecção automática dos campos de assinatura + data/local (genérica por layout).
      let det: DetectResult = { clinic: [], patient: [], texts: [] };
      try {
        const bytes = await file.arrayBuffer();
        const { detectSignatureFields } = await import("@/lib/pdf-detect");
        det = await detectSignatureFields(bytes, kind);
      } catch (e) {
        console.error("[detect] falha na detecção automática", e);
      }

      // Cidade da clínica (para os campos de "local").
      const { data: comp } = await supabase
        .from("companies")
        .select("cidade,uf")
        .eq("id", profile.company_id)
        .maybeSingle();
      const city = comp?.cidade ? (comp.uf ? `${comp.cidade} - ${comp.uf}` : comp.cidade) : null;

      const path = `${profile.company_id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(cfg.bucket)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from(cfg.table as "contracts")
        .insert({
          company_id: profile.company_id,
          patient_id: patientId || null,
          patient_name: patientName.trim(),
          title: title.trim() || null,
          original_pdf_path: path,
          status: "aguardando_clinica" as SignedDocStatus,
          created_by: profile.id,
          clinic_signature_pos: det.clinic,
          patient_signature_pos: det.patient,
          auto_text_fields: det.texts,
          clinic_city: city,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      toast.success(`${cfg.label} criado`);
      setOpen(false);
      resetForm();
      navigate({ to: `${cfg.listPath}/$id`, params: { id: (inserted as { id: string }).id } });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao criar. Verifique o bucket de Storage e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.patient_name || "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{cfg.labelPlural}</h1>
          <p className="text-sm text-muted-foreground">
            Anexe o PDF, assine pela clínica e gere o link para o paciente assinar.
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo {cfg.label.toLowerCase()}
        </Button>
      </div>

      <div className="relative mb-4 w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por paciente ou título..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileSignature className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {rows.length === 0 ? `Nenhum ${cfg.label.toLowerCase()} ainda` : "Nenhum resultado"}
          </p>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? `Clique em "Novo ${cfg.label.toLowerCase()}" para começar.`
              : "Tente outro termo de busca."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const st = STATUS_META[r.status] ?? STATUS_META.aguardando_clinica;
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate({ to: `${cfg.listPath}/$id`, params: { id: r.id } })}
                    >
                      <TableCell className="font-medium">{r.patient_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.title || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.cls}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({ to: `${cfg.listPath}/$id`, params: { id: r.id } })
                          }
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Diálogo de novo documento ── */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo {cfg.label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Anexe o PDF gerado no sistema da franquia e associe ao paciente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Paciente (opcional)</Label>
              <Select value={patientId} onValueChange={onPickPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar paciente cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || "Sem nome"}
                      {p.prontuario ? ` — ${p.prontuario}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Nome do paciente *</Label>
              <Input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome completo do paciente"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Título / identificação (opcional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Ex.: ${cfg.label} de tratamento ortodôntico`}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>PDF do {cfg.label.toLowerCase()} *</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4 text-primary" />
                <span className="truncate">
                  {file ? file.name : "Clique para selecionar o PDF"}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={create} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
