import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, LogOut, UserCircle, Users, LayoutDashboard, MoreVertical, ShieldCheck, Headset, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() || "U";
  const isAdmin = !!profile?.is_admin;

  return (
    <header className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img
            src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
            alt="OdontoSistema"
            className="h-10 w-10 shrink-0 rounded-lg object-contain shadow-[var(--shadow-card)]"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight truncate">OdontoClinic</h1>
            <p className="text-xs text-muted-foreground truncate">Cadastro Digital</p>
          </div>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          <Link to="/" className="[&.active]:bg-secondary [&.active]:text-secondary-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60">
            <LayoutDashboard className="h-4 w-4" /> Contratos
          </Link>
          <Link to="/prontuario" className="[&.active]:bg-secondary [&.active]:text-secondary-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60">
            <ClipboardList className="h-4 w-4" /> Prontuário
          </Link>
          <Link to="/usuarios" className="[&.active]:bg-secondary [&.active]:text-secondary-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60">
            <Users className="h-4 w-4" /> Usuários
          </Link>
          {isAdmin && (
            <Link to="/admin" className="[&.active]:bg-primary/15 [&.active]:text-primary inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary/10">
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 h-10">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.profile_image_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
              <MoreVertical className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              {isAdmin && <p className="mt-1 text-[10px] uppercase tracking-wider text-primary font-semibold">Super Admin</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
              <UserCircle className="mr-2 h-4 w-4" /> Editar perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/prontuario" })} className="sm:hidden">
              <ClipboardList className="mr-2 h-4 w-4" /> Prontuário
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/usuarios" })} className="sm:hidden">
              <Users className="mr-2 h-4 w-4" /> Usuários
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate({ to: "/admin" })} className="sm:hidden">
                <ShieldCheck className="mr-2 h-4 w-4" /> Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate({ to: "/suporte" })}>
              <Headset className="mr-2 h-4 w-4" /> Contato com Suporte
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggle}>
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
