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

function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true, cacheControl: "0",
    });
    if (upErr) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await supabase.from("profiles").update({ profile_image_url: url }).eq("id", profile.id);
    setUploading(false);
    toast.success("Foto atualizada");
    refreshProfile();
  };

  const removeAvatar = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ profile_image_url: null }).eq("id", profile.id);
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Atualize suas informações pessoais.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.profile_image_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Trocar foto
            </Button>
            {profile.profile_image_url && (
              <Button variant="ghost" onClick={removeAvatar} className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        </div>

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
