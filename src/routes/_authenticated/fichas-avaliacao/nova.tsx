import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Save, Send } from "lucide-react";
import { FichaForm } from "@/components/ficha-avaliacao/FichaForm";
import { EnviarDentistaDialog } from "@/components/ficha-avaliacao/EnviarDentistaDialog";
import { EMPTY_FICHA, type FichaData } from "@/lib/ficha-avaliacao";

export const Route = createFileRoute("/_authenticated/fichas-avaliacao/nova")({
  component: NovaFichaPage,
  head: () => ({ meta: [{ title: "Nova Ficha de Avaliação — OdontoSign" }] }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function NovaFichaPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FichaData>(EMPTY_FICHA());
  const [saving, setSaving] = useState(false);
  const [dentistOpen, setDentistOpen] = useState(false);

  const patch = (p: Partial<FichaData>) => setForm((f) => ({ ...f, ...p }));

  const insert = async (extra: Record<string, unknown>): Promise<string | null> => {
    if (!profile?.company_id) {
      toast.error("Perfil sem clínica vinculada");
      return null;
    }
    if (!form.paciente_nome.trim()) {
      toast.error("Informe o nome do paciente");
      return null;
    }
    const payload = {
      ...form,
      // datas vazias → null (colunas date)
      data_avaliacao: form.data_avaliacao || null,
      paciente_data_nascimento: form.paciente_data_nascimento || null,
      company_id: profile.company_id,
      created_by: profile.id,
      ...extra,
    };
    const { data, error } = await db.from("avaliacoes").insert(payload).select("id").single();
    if (error) {
      console.error("[ficha] insert error:", error.message);
      toast.error("Falha ao salvar a ficha");
      return null;
    }
    return (data as { id: string }).id;
  };

  const salvarRascunho = async () => {
    setSaving(true);
    const id = await insert({ status: "rascunho" });
    setSaving(false);
    if (id) {
      toast.success("Rascunho salvo");
      navigate({ to: "/fichas-avaliacao/$id", params: { id } });
    }
  };

  // Atribui o dentista responsável; a ficha permanece em rascunho até a clínica
  // coletar a assinatura e gerar o link (status aguardando_assinatura).
  const enviarParaDentista = async (dentistaId: string) => {
    setSaving(true);
    const id = await insert({ status: "rascunho", dentista_id: dentistaId });
    setSaving(false);
    setDentistOpen(false);
    if (id) {
      toast.success("Ficha enviada ao dentista");
      navigate({ to: "/fichas-avaliacao/$id", params: { id } });
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5"
          onClick={() => navigate({ to: "/fichas-avaliacao" })}
        >
          <ChevronLeft className="h-4 w-4" /> Fichas de Avaliação
        </Button>
        <h1 className="text-lg font-bold">Nova Ficha de Avaliação</h1>
      </div>

      <FichaForm value={form} onChange={patch} />

      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" className="gap-2" onClick={salvarRascunho} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar rascunho
        </Button>
        <Button className="gap-2" onClick={() => setDentistOpen(true)} disabled={saving}>
          <Send className="h-4 w-4" /> Salvar e enviar
        </Button>
      </div>

      <EnviarDentistaDialog
        open={dentistOpen}
        onOpenChange={setDentistOpen}
        companyId={profile?.company_id}
        onConfirm={enviarParaDentista}
        saving={saving}
      />
    </main>
  );
}
