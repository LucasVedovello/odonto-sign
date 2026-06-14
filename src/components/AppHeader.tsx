import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Moon,
  Sun,
  LogOut,
  UserCircle,
  Users,
  LayoutDashboard,
  MoreVertical,
  ShieldCheck,
  Headset,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { useUserRole, ROLE_LABEL, type AppRole } from "@/lib/rbac";
import { AlertsBell } from "@/components/AlertsBell";

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { role } = useUserRole();

  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() || "U";
  const isAdmin = !!profile?.is_admin || role === "platform_admin";
  const isOwner = role === "clinic_owner";

  const { quickNavTabs, quickNavRoutes } = useMemo(() => {
    const tabs: Parameters<typeof ExpandableTabs>[0]["tabs"] = [];
    const routes: (string | null)[] = [];
    const add = (title: string, icon: typeof LayoutDashboard, route: string) => {
      tabs.push({ title, icon });
      routes.push(route);
    };

    if (isAdmin) {
      // platform_admin: visão da plataforma + acesso operacional (contratos/prontuário)
      add("Contratos", LayoutDashboard, "/");
      add("Prontuário", ClipboardList, "/prontuario");
      add("Admin", ShieldCheck, "/admin");
      tabs.push({ type: "separator" as const });
      routes.push(null);
      add("Suporte", Headset, "/suporte");
    } else if (isOwner) {
      // clinic_owner: gestão completa da clínica
      add("Contratos", LayoutDashboard, "/");
      add("Prontuário", ClipboardList, "/prontuario");
      add("Usuários", Users, "/usuarios");
      tabs.push({ type: "separator" as const });
      routes.push(null);
      add("Suporte", Headset, "/suporte");
    } else {
      // dentist / staff: operação do dia a dia (sem administração)
      add("Contratos", LayoutDashboard, "/");
      add("Prontuário", ClipboardList, "/prontuario");
      tabs.push({ type: "separator" as const });
      routes.push(null);
      add("Suporte", Headset, "/suporte");
    }

    return { quickNavTabs: tabs, quickNavRoutes: routes };
  }, [isAdmin, isOwner]);

  const handleNavChange = (index: number | null) => {
    if (index === null) return;
    const route = quickNavRoutes[index];
    if (route) navigate({ to: route });
  };

  return (
    <>
      {/* ── Header (desktop sm+) ── */}
      <header className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 min-w-0 shrink-0">
            <img
              src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
              alt="OdontoSistema"
              className="h-10 w-10 shrink-0 rounded-lg object-contain shadow-[var(--shadow-card)]"
            />
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base font-semibold leading-tight truncate">OdontoClinic</h1>
              <p className="text-xs text-muted-foreground truncate">Cadastro Digital</p>
            </div>
          </Link>

          {/* ExpandableTabs — desktop only, centralizado */}
          <div className="hidden sm:flex flex-1 justify-center">
            <ExpandableTabs
              tabs={quickNavTabs}
              activeColor="text-primary"
              onChange={handleNavChange}
            />
          </div>

          {/* Spacer mobile */}
          <div className="flex-1 sm:hidden" />

          {/* Sino de alertas (apenas admin da plataforma) */}
          {isAdmin && <AlertsBell />}

          {/* Avatar / dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-10 shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.profile_image_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <MoreVertical className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                {role && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-primary font-semibold">
                    {ROLE_LABEL[role as AppRole]}
                  </p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                <UserCircle className="mr-2 h-4 w-4" /> Editar perfil
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onClick={() => navigate({ to: "/lixeira" })}>
                  <Trash2 className="mr-2 h-4 w-4" /> Lixeira
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate({ to: "/lixeira" })}>
                  <Trash2 className="mr-2 h-4 w-4" /> Lixeira
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate({ to: "/suporte" })}>
                <Headset className="mr-2 h-4 w-4" /> Contato com Suporte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {theme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Bottom navigation (mobile only) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-border bg-card/90 backdrop-blur-md px-4 py-2 pb-safe">
        <ExpandableTabs tabs={quickNavTabs} activeColor="text-primary" onChange={handleNavChange} />
      </nav>
    </>
  );
}
