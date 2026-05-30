import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Meu perfil — OdontoClinic" }] }),
});

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pwd, setPwd] = useState({ password: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ first_name: profile.first_name ?? "", last_name: profile.last_name ?? "" });
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name, last_name: form.last_name,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Perfil atualizado"); refreshProfile(); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB).");
      return;
    }

    // Show instant preview via object URL
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ profile_image_url: url })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;

      await refreshProfile();
      toast.success("Foto atualizada");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar a foto");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const removeAvatar = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ profile_image_url: null }).eq("id", profile.id);
    setPreviewUrl(null);
    toast.success("Foto removida");
    refreshProfile();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.password.length < 8) { toast.error("Senha deve ter pelo menos 8 caracteres"); return; }
    if (pwd.password !== pwd.confirm) { toast.error("As senhas não coincidem"); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.password });
    setPwdSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha alterada"); setPwd({ password: "", confirm: "" }); }
  };

  if (!profile) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "U";
  const displayUrl = previewUrl ?? profile.profile_image_url ?? undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Atualize suas informações pessoais.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 ring-2 ring-border">
            <AvatarImage src={displayUrl} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Trocar foto"}
            </Button>
            {(profile.profile_image_url || previewUrl) && !uploading && (
              <Button variant="ghost" onClick={removeAvatar} className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">JPG, PNG ou WEBP — máx 5MB.</p>

        <form onSubmit={saveProfile} className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Sobrenome</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={profile.email} disabled />
          </div>
          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Alterar senha</h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={pwd.password}
              onChange={(e) => setPwd({ ...pwd, password: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </div>
          <Button type="submit" disabled={pwdSaving} className="justify-self-start">
            {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar senha"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
