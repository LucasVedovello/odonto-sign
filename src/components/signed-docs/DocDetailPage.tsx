import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Download, Loader2, MapPin, PenLine } from "lucide-react";
import { PdfSignDocument, type SigOverlay } from "@/components/PdfSignDocument";
import { SignDialog } from "@/components/SignDialog";
import {
  DEFAULT_SIG_SIZE,
  STATUS_META,
  docConfig,
  publicSignUrl,
  type DocKind,
  type SignaturePos,
  type SignedDoc,
} from "@/lib/signed-docs";

export function DocDetailPage({ kind, id }: { kind: DocKind; id: string }) {
  const cfg = docConfig(kind);
  const [doc, setDoc] = useState<SignedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado da assinatura da clínica (fase aguardando_clinica)
  const [placing, setPlacing] = useState<"clinic" | "patient" | null>(null);
  const [clinicPos, setClinicPos] = useState<SignaturePos | null>(null);
  const [patientPos, setPatientPos] = useState<SignaturePos | null>(null);
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
    setClinicPos(d.clinic_signature_pos);
    setPatientPos(d.patient_signature_pos);
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

  const onPlace = (page: number, x: number, y: number) => {
    if (!placing) return;
    const pos: SignaturePos = { page, x, y, ...DEFAULT_SIG_SIZE };
    if (placing === "clinic") setClinicPos(pos);
    else setPatientPos(pos);
    setPlacing(null);
  };

  // Confirma a assinatura da clínica e libera o link para o paciente.
  const confirmClinic = async () => {
    if (!doc) return;
    if (!clinicSig) {
      toast.error("Assine pela clínica antes de continuar");
      return;
    }
    if (!clinicPos) {
      toast.error("Posicione o campo de assinatura da clínica");
      return;
    }
    if (!patientPos) {
      toast.error("Posicione o campo onde o paciente vai assinar");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from(cfg.table as "contracts")
        .update({
          clinic_signature: clinicSig,
          clinic_signature_pos: clinicPos,
          patient_signature_pos: patientPos,
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
      // Fallback: regenera a partir do original + assinaturas.
      const { generateSignedPdf } = await import("@/lib/signed-pdf");
      const sigs = [];
      if (doc.clinic_signature && doc.clinic_signature_pos)
        sigs.push({ dataUrl: doc.clinic_signature, pos: doc.clinic_signature_pos });
      if (doc.patient_signature && doc.patient_signature_pos)
        sigs.push({ dataUrl: doc.patient_signature, pos: doc.patient_signature_pos });
      const pdf = await generateSignedPdf(originalUrl, sigs);
      pdf.save(`${cfg.label}-${doc.patient_name}.pdf`);
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

  // Overlays exibidos conforme a fase.
  const overlays: SigOverlay[] = [];
  if (clinicPos)
    overlays.push({
      pos: clinicPos,
      imageUrl: clinicSig,
      label: "Clínica assina aqui",
      variant: "clinic",
    });
  if (patientPos)
    overlays.push({
      pos: patientPos,
      imageUrl: doc.status === "assinado" ? doc.patient_signature : null,
      label: "Paciente assina aqui",
      variant: "patient",
    });

  const isClinicPhase = doc.status === "aguardando_clinica";

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
          <p className="mb-3 text-sm text-muted-foreground">
            Posicione o campo de assinatura da clínica e o campo onde o paciente vai assinar (clique
            sobre o documento). Depois, assine pela clínica e gere o link.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={placing === "clinic" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPlacing(placing === "clinic" ? null : "clinic")}
            >
              <MapPin className="h-4 w-4" />
              {clinicPos ? "Reposicionar campo da clínica" : "Posicionar campo da clínica"}
            </Button>
            <Button
              variant={placing === "patient" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPlacing(placing === "patient" ? null : "patient")}
            >
              <MapPin className="h-4 w-4" />
              {patientPos ? "Reposicionar campo do paciente" : "Posicionar campo do paciente"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSignOpen(true)}
            >
              <PenLine className="h-4 w-4" />
              {clinicSig ? "Refazer assinatura" : "Assinar como clínica"}
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
              Clique sobre o documento para posicionar o campo
              {placing === "clinic" ? " da clínica" : " do paciente"}.
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
          onPlace={onPlace}
          placing={!!placing}
          boxSize={DEFAULT_SIG_SIZE}
        />
      </Card>

      <SignDialog
        open={signOpen}
        title="Assinatura da clínica"
        description="Desenhe a assinatura da clínica. Ela será inserida no campo posicionado."
        onOpenChange={setSignOpen}
        onConfirm={(dataUrl) => {
          setClinicSig(dataUrl);
          setSignOpen(false);
          if (!clinicPos)
            toast.message("Agora posicione o campo de assinatura da clínica no documento.");
        }}
      />
    </main>
  );
}
