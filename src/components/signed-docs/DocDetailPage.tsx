import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Download, Eraser, Loader2, MapPin, PenLine } from "lucide-react";
import { PdfSignDocument, type SigOverlay, type TextOverlay } from "@/components/PdfSignDocument";
import { SignDialog } from "@/components/SignDialog";
import {
  DEFAULT_SIG_SIZE,
  STATUS_META,
  asPosArray,
  autoFieldText,
  docConfig,
  publicSignUrl,
  type AutoTextField,
  type DocKind,
  type SignaturePos,
  type SignedDoc,
} from "@/lib/signed-docs";

export function DocDetailPage({ kind, id }: { kind: DocKind; id: string }) {
  const cfg = docConfig(kind);
  const [doc, setDoc] = useState<SignedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fase aguardando_clinica — campos (arrays) e assinatura única da clínica.
  const [placing, setPlacing] = useState<"clinic" | "patient" | null>(null);
  const [clinicFields, setClinicFields] = useState<SignaturePos[]>([]);
  const [patientFields, setPatientFields] = useState<SignaturePos[]>([]);
  const [textFields, setTextFields] = useState<AutoTextField[]>([]);
  const [clinicSig, setClinicSig] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const publicUrl = useCallback(
    (path: string) => supabase.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl,
    [cfg.bucket],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(cfg.table as "contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    const d = data as unknown as SignedDoc;
    setDoc(d);
    setClinicFields(asPosArray(d.clinic_signature_pos));
    setPatientFields(asPosArray(d.patient_signature_pos));
    setTextFields((d.auto_text_fields as AutoTextField[]) ?? []);
    setClinicSig(d.clinic_signature);
    setLoading(false);
  }, [cfg.table, id]);

  useEffect(() => {
    load();
  }, [load]);

  const originalUrl = useMemo(
    () => (doc ? publicUrl(doc.original_pdf_path) : ""),
    [doc, publicUrl],
  );

  // Clicar no documento ADICIONA um campo da parte ativa (permite vários).
  const onPlace = (page: number, x: number, y: number) => {
    if (!placing) return;
    const pos: SignaturePos = { page, x, y, ...DEFAULT_SIG_SIZE };
    if (placing === "clinic") setClinicFields((p) => [...p, pos]);
    else setPatientFields((p) => [...p, pos]);
  };

  // Confirma a assinatura da clínica (aplicada a TODOS os campos dela) e libera o link.
  const confirmClinic = async () => {
    if (!doc) return;
    if (!clinicSig) return toast.error("Assine pela clínica antes de continuar");
    if (clinicFields.length === 0)
      return toast.error("Nenhum campo de assinatura da clínica. Adicione ao menos um.");
    if (patientFields.length === 0)
      return toast.error("Nenhum campo do paciente. Adicione ao menos um.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from(cfg.table as "contracts")
        .update({
          clinic_signature: clinicSig,
          clinic_signature_pos: clinicFields,
          patient_signature_pos: patientFields,
          auto_text_fields: textFields,
          clinic_signed_at: new Date().toISOString(),
          status: "aguardando_paciente",
        })
        .eq("id", doc.id);
      if (error) throw error;
      toast.success("Assinatura da clínica salva. Link gerado para o paciente.");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar a assinatura da clínica");
    } finally {
      setSaving(false);
    }
  };

  const link = doc ? publicSignUrl(kind, doc.public_token) : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá! Segue o link para leitura e assinatura do seu ${cfg.label.toLowerCase()}: ${link}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  // Baixa o PDF final assinado (do Storage; se faltar, regenera no cliente).
  const downloadSigned = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      if (doc.signed_pdf_path) {
        window.open(publicUrl(doc.signed_pdf_path), "_blank");
        return;
      }
      const { generateSignedPdf } = await import("@/lib/signed-pdf");
      const sigs: { dataUrl: string; pos: SignaturePos }[] = [];
      const cs = doc.clinic_signature;
      if (cs)
        asPosArray(doc.clinic_signature_pos).forEach((pos) => sigs.push({ dataUrl: cs, pos }));
      const ps = doc.patient_signature;
      if (ps)
        asPosArray(doc.patient_signature_pos).forEach((pos) => sigs.push({ dataUrl: ps, pos }));
      const texts = ((doc.auto_text_fields as AutoTextField[]) ?? []).map((f) => ({
        text: autoFieldText(f.kind, doc.clinic_city),
        pos: f,
      }));
      const pdf = await generateSignedPdf(originalUrl, sigs, texts);
      pdf.save(`${cfg.label} ${doc.patient_name}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o PDF assinado");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!doc) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-medium">{cfg.label} não encontrado</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={cfg.listPath}>Voltar</Link>
        </Button>
      </main>
    );
  }

  const st = STATUS_META[doc.status];
  const isClinicPhase = doc.status === "aguardando_clinica";

  // Overlays de assinatura (clínica: preview da assinatura desenhada; paciente:
  // imagem só quando já assinado).
  const overlays: SigOverlay[] = [
    ...clinicFields.map((pos) => ({
      pos,
      imageUrl: clinicSig,
      label: "Clínica assina aqui",
      variant: "clinic" as const,
    })),
    ...patientFields.map((pos) => ({
      pos,
      imageUrl: doc.status === "assinado" ? doc.patient_signature : null,
      label: "Paciente assina aqui",
      variant: "patient" as const,
    })),
  ];
  const textOverlays: TextOverlay[] = textFields.map((f) => ({
    pos: f,
    text: autoFieldText(f.kind, doc.clinic_city),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 gap-1.5">
            <Link to={cfg.listPath}>
              <ArrowLeft className="h-4 w-4" /> {cfg.labelPlural}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{doc.patient_name}</h1>
          {doc.title && <p className="text-sm text-muted-foreground">{doc.title}</p>}
        </div>
        <Badge variant="outline" className={st.cls}>
          {st.label}
        </Badge>
      </div>

      {/* ── Painel de ações conforme a fase ── */}
      {isClinicPhase && (
        <Card className="mb-6 p-4">
          <h2 className="mb-1 font-semibold">Assinatura da clínica</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            {clinicFields.length} campo(s) da clínica e {patientFields.length} do paciente
            detectados automaticamente
            {textFields.length > 0 ? `, ${textFields.length} campo(s) de data/local` : ""}. Assine
            pela clínica — a mesma assinatura é aplicada em todos os campos da clínica.
          </p>
          {(clinicFields.length === 0 || patientFields.length === 0) && (
            <p className="mb-2 text-xs font-medium text-warning">
              Não detectei todos os campos automaticamente. Use os botões abaixo para posicionar
              manualmente clicando sobre o documento.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSignOpen(true)}
            >
              <PenLine className="h-4 w-4" />
              {clinicSig ? "Refazer assinatura" : "Assinar como clínica"}
            </Button>
            <Button
              variant={placing === "clinic" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPlacing(placing === "clinic" ? null : "clinic")}
            >
              <MapPin className="h-4 w-4" /> + Campo da clínica
            </Button>
            <Button
              variant={placing === "patient" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPlacing(placing === "patient" ? null : "patient")}
            >
              <MapPin className="h-4 w-4" /> + Campo do paciente
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => {
                setClinicFields([]);
                setPatientFields([]);
                setPlacing(null);
              }}
            >
              <Eraser className="h-4 w-4" /> Limpar campos
            </Button>
            <Button size="sm" className="gap-1.5" onClick={confirmClinic} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirmar e gerar link
            </Button>
          </div>
          {placing && (
            <p className="mt-2 text-xs font-medium text-primary">
              Clique sobre o documento para adicionar um campo
              {placing === "clinic" ? " da clínica" : " do paciente"} (pode adicionar vários).
            </p>
          )}
        </Card>
      )}

      {doc.status === "aguardando_paciente" && (
        <Card className="mb-6 p-4">
          <h2 className="mb-1 font-semibold">Link para o paciente assinar</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Envie este link ao paciente. Ele lê o documento completo e assina no campo dele.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={link}
              className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={copyLink}>
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button className="gap-1.5" onClick={shareWhatsApp}>
                WhatsApp
              </Button>
            </div>
          </div>
        </Card>
      )}

      {doc.status === "assinado" && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-semibold">Documento assinado</h2>
            <p className="text-sm text-muted-foreground">
              Assinado pelo paciente em{" "}
              {doc.patient_signed_at
                ? new Date(doc.patient_signed_at).toLocaleString("pt-BR")
                : "—"}
              . Baixe o PDF final e importe no sistema da franquia.
            </p>
          </div>
          <Button className="gap-1.5" onClick={downloadSigned} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar PDF assinado
          </Button>
        </Card>
      )}

      {/* ── Documento ── */}
      <Card className="p-3 sm:p-4">
        <PdfSignDocument
          url={originalUrl}
          overlays={overlays}
          textOverlays={textOverlays}
          onPlace={onPlace}
          placing={!!placing}
          boxSize={DEFAULT_SIG_SIZE}
        />
      </Card>

      <SignDialog
        open={signOpen}
        title="Assinatura da clínica"
        description="Desenhe a assinatura da clínica. Ela será inserida em todos os campos da clínica."
        onOpenChange={setSignOpen}
        onConfirm={(dataUrl) => {
          setClinicSig(dataUrl);
          setSignOpen(false);
        }}
      />
    </main>
  );
}
