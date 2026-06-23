import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, PenLine } from "lucide-react";
import { OdontoLogo } from "@/components/OdontoLogo";
import { PdfSignDocument, type SigOverlay, type TextOverlay } from "@/components/PdfSignDocument";
import { SignDialog } from "@/components/SignDialog";
import {
  asPosArray,
  defaultFieldValue,
  docConfig,
  type AutoTextField,
  type DocKind,
  type SignaturePos,
  type SignedDoc,
} from "@/lib/signed-docs";

function PublicHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
          <OdontoLogo size={40} />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">OdontoSign</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function PublicSignPage({ kind, token }: { kind: DocKind; token: string }) {
  const cfg = docConfig(kind);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<SignedDoc | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [patientSig, setPatientSig] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const publicUrl = useCallback(
    (path: string) => supabase.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl,
    [cfg.bucket],
  );

  useEffect(() => {
    (async () => {
      // Acesso público restrito ao token via RPC SECURITY DEFINER (a leitura
      // direta da tabela por anon foi removida — ver migration fix_rls_anon).
      const { data, error } = await supabase.rpc("public_get_signed_document", {
        p_kind: kind,
        p_token: token,
      });
      if (error || !data) {
        setLoading(false);
        return;
      }
      const d = data as unknown as SignedDoc;
      setDoc(d);
      if (d.status === "assinado") setDone(true);
      setLoading(false);
    })();
  }, [kind, token]);

  const originalUrl = useMemo(
    () => (doc ? publicUrl(doc.original_pdf_path) : ""),
    [doc, publicUrl],
  );

  const overlays: SigOverlay[] = useMemo(() => {
    if (!doc) return [];
    const list: SigOverlay[] = [];
    // Assinaturas da clínica (já feitas) em todos os campos dela.
    for (const pos of asPosArray(doc.clinic_signature_pos)) {
      list.push({ pos, imageUrl: doc.clinic_signature, label: "Clínica", variant: "clinic" });
    }
    // Campos do paciente — mostra a assinatura desenhada (preview) em todos.
    for (const pos of asPosArray(doc.patient_signature_pos)) {
      list.push({
        pos,
        imageUrl: patientSig ?? doc.patient_signature,
        label: "Assine aqui",
        variant: "patient",
      });
    }
    return list;
  }, [doc, patientSig]);

  const textOverlays: TextOverlay[] = useMemo(() => {
    if (!doc) return [];
    return ((doc.auto_text_fields as AutoTextField[]) ?? [])
      .map((f) => ({
        pos: f,
        text: (f.value ?? defaultFieldValue(f.kind, doc.clinic_city)).trim(),
      }))
      .filter((t) => t.text);
  }, [doc]);

  const finalize = async () => {
    if (!doc) return;
    if (!accepted) {
      toast.error("Confirme a leitura e o aceite do documento");
      return;
    }
    if (!patientSig) {
      toast.error("Assine no campo indicado antes de finalizar");
      return;
    }
    const patientFields = asPosArray(doc.patient_signature_pos);
    if (patientFields.length === 0) {
      toast.error("Campo de assinatura do paciente não definido. Contate a clínica.");
      return;
    }
    setSaving(true);
    try {
      // Gera o PDF final (original + assinaturas + data/local) e salva no Storage.
      const { generateSignedPdfBlob } = await import("@/lib/signed-pdf");
      const sigs: { dataUrl: string; pos: SignaturePos }[] = [];
      const cs = doc.clinic_signature;
      if (cs)
        asPosArray(doc.clinic_signature_pos).forEach((pos) => sigs.push({ dataUrl: cs, pos }));
      // Mesma assinatura do paciente em todos os campos dele.
      patientFields.forEach((pos) => sigs.push({ dataUrl: patientSig, pos }));

      const texts = ((doc.auto_text_fields as AutoTextField[]) ?? [])
        .map((f) => ({
          text: (f.value ?? defaultFieldValue(f.kind, doc.clinic_city)).trim(),
          pos: f,
        }))
        .filter((t) => t.text);

      const blob = await generateSignedPdfBlob(originalUrl, sigs, texts);
      const signedPath = `${doc.company_id ?? "public"}/${doc.id}-signed.pdf`;
      const { error: upErr } = await supabase.storage
        .from(cfg.bucket)
        .upload(signedPath, blob, { contentType: "application/pdf", upsert: true });
      // Mesmo que o upload falhe, persistimos a assinatura; a recepção regenera.
      if (upErr) console.error("[PublicSignPage] upload signed PDF falhou", upErr);

      const { data: signed, error } = await supabase.rpc("public_sign_document", {
        p_kind: kind,
        p_token: token,
        p_signature: patientSig,
        p_signed_pdf_path: upErr ? undefined : signedPath,
      });
      if (error) throw error;
      if (!signed) {
        toast.error("Este documento não está mais disponível para assinatura.");
        return;
      }

      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao finalizar a assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h2 className="text-xl font-semibold">Link inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não existe ou expirou. Solicite um novo à clínica.
          </p>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen">
        <PublicHeader subtitle={cfg.label} />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
          <h2 className="text-xl font-semibold">Assinatura concluída!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado, {doc.patient_name}. Seu {cfg.label.toLowerCase()} foi assinado com sucesso. A
            clínica já tem acesso ao documento final.
          </p>
        </main>
      </div>
    );
  }

  // A clínica ainda não assinou → documento não disponível para o paciente.
  if (doc.status === "aguardando_clinica") {
    return (
      <div className="min-h-screen">
        <PublicHeader subtitle={cfg.label} />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Documento em preparação</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A clínica ainda está finalizando o documento. Tente novamente em instantes.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <PublicHeader subtitle={`${cfg.label} — ${doc.patient_name}`} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Leia e assine seu {cfg.label.toLowerCase()}</h2>
          <p className="text-sm text-muted-foreground">
            Role e leia o documento completo. Depois, assine no campo destacado em laranja.
          </p>
        </div>

        <Card className="p-3 sm:p-4">
          <PdfSignDocument url={originalUrl} overlays={overlays} textOverlays={textOverlays} />
        </Card>

        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-start gap-2">
            <Checkbox
              id="accept"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="accept" className="text-sm leading-snug">
              Declaro que li e estou de acordo com todo o conteúdo deste {cfg.label.toLowerCase()}.
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-1.5" onClick={() => setSignOpen(true)}>
              <PenLine className="h-4 w-4" />
              {patientSig ? "Refazer assinatura" : "Assinar"}
            </Button>
            <Button className="flex-1 gap-1.5" onClick={finalize} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar e finalizar
            </Button>
          </div>
          {patientSig && (
            <p className="mt-2 text-xs text-success">
              Assinatura registrada. Confira no documento acima e finalize.
            </p>
          )}
        </Card>
      </main>

      <SignDialog
        open={signOpen}
        title="Sua assinatura"
        description="Desenhe sua assinatura. Ela será inserida no campo do paciente."
        onOpenChange={setSignOpen}
        onConfirm={(dataUrl) => {
          setPatientSig(dataUrl);
          setSignOpen(false);
        }}
      />
    </div>
  );
}
