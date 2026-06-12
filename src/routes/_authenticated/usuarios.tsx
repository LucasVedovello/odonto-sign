import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  MoreVertical,
  Trash2,
  Send,
  UserX,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { inviteUser, deleteUser, resendInvite } from "@/lib/invites.functions";
import { roleGuard, ROLE_LABEL, type AppRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/usuarios")({
  // Gestão de equipe é restrita ao proprietário (e admin da plataforma)
  beforeLoad: roleGuard(["clinic_owner", "platform_admin"]),
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — OdontoClinic" }] }),
});

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  profile_image_url: string | null;
  status: string;
  created_at: string;
  role: AppRole;
};

function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [toDelete, setToDelete] = useState<Profile | null>(null);

  const invite = useServerFn(inviteUser);
  const del = useServerFn(deleteUser);
  const resend = useServerFn(resendInvite);

  const load = useCallback(async () => {
    if (!me?.company_id) return;
    const { data } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,email,profile_image_url,status,created_at,role")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: true });
    setUsers((data ?? []) as Profile[]);
    setLoading(false);
  }, [me?.company_id]);

  useEffect(() => {
    if (me?.company_id) load();
  }, [load, me?.company_id]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await invite({
        data: { email: inviteEmail, redirectTo: `${window.location.origin}/aceitar-convite` },
      });
      toast.success("Convite enviado!");
      setInviteEmail("");
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await del({ data: { userId: toDelete.id } });
      toast.success("Usuário removido");
      setToDelete(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  const handleResend = async (email: string) => {
    try {
      await resend({ data: { email, redirectTo: `${window.location.origin}/aceitar-convite` } });
      toast.success("Convite reenviado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const toggleStatus = async (u: Profile) => {
    const next = u.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("id", u.id);
    if (error) toast.error("Erro ao atualizar");
    else {
      toast.success("Status atualizado");
      load();
    }
  };

  const changeRole = async (u: Profile, role: AppRole) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", u.id);
    if (error)
      toast.error(error.message.includes("permissão") ? error.message : "Erro ao alterar função");
    else {
      toast.success(`Função alterada para ${ROLE_LABEL[role]}`);
      load();
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Equipe da clínica • {users.length}/20 contas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={users.length >= 20} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar conta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {users.map((u) => {
            const initials =
              `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() ||
              u.email[0].toUpperCase();
            const isMe = u.id === me?.id;
            const isPending = !u.first_name && !u.last_name;
            return (
              <div key={u.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.profile_image_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {isPending ? (
                        <span className="text-muted-foreground italic">Convite pendente</span>
                      ) : (
                        `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
                      )}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Criado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/30"
                  >
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      u.status === "active"
                        ? "bg-success/15 text-success border-success/30"
                        : u.status === "pending"
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-muted text-muted-foreground"
                    }
                  >
                    {u.status === "active"
                      ? "Ativo"
                      : u.status === "pending"
                        ? "Pendente"
                        : "Inativo"}
                  </Badge>
                  {!isMe && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isPending && (
                          <DropdownMenuItem onClick={() => handleResend(u.email)}>
                            <Send className="mr-2 h-4 w-4" /> Reenviar convite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => toggleStatus(u)}>
                          {u.status === "active" ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" /> Desativar
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" /> Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        {u.role !== "platform_admin" &&
                          (["clinic_owner", "dentist", "staff"] as const)
                            .filter((r) => r !== u.role)
                            .map((r) => (
                              <DropdownMenuItem key={r} onClick={() => changeRole(u, r)}>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Tornar {ROLE_LABEL[r]}
                              </DropdownMenuItem>
                            ))}
                        <DropdownMenuItem
                          onClick={() => setToDelete(u)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
            <DialogDescription>
              Enviaremos um email com um link para criar a conta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colega@clinica.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente {toDelete?.email} e revoga o acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
