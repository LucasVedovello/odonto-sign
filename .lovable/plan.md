
# Plano: Sistema Multiempresas (SaaS Multi-Tenant)

Transformar o sistema atual (single-tenant, sem login) em uma plataforma SaaS profissional onde múltiplas clínicas podem se cadastrar, gerenciar suas próprias equipes (até 10 usuários) e ter isolamento total de dados.

---

## 1. Banco de Dados (migração)

### Tabela `companies`
- `id` (uuid, PK)
- `company_name` (text)
- `company_email` (text, unique)
- `created_at`

### Tabela `profiles` (vinculada a `auth.users`)
- `id` (uuid, PK = auth.users.id)
- `company_id` (uuid, FK → companies)
- `first_name`, `last_name`
- `email`
- `profile_image_url` (text, nullable)
- `status` (text: 'active' | 'inactive' | 'pending')
- `created_at`

### Tabela `company_invites`
- `id`, `company_id`, `email`, `invited_by`, `token`, `expires_at`, `accepted_at`, `created_at`

### Alterar `patients` (preservando dados existentes)
- Adicionar `company_id` (uuid, FK → companies, nullable inicialmente para migração; depois NOT NULL)
- Adicionar `created_by_user` (uuid, FK → profiles)

### Funções SECURITY DEFINER
- `get_user_company_id(user_id)` → retorna company_id do perfil
- Trigger `handle_new_user()` em `auth.users` → cria profile automaticamente
  - Se metadata tem `company_name` → cria nova `companies` + profile como admin
  - Se metadata tem `invite_token` → vincula profile à `company_id` do convite

### RLS (isolamento total)
- `companies`: SELECT/UPDATE apenas se `id = get_user_company_id(auth.uid())`
- `profiles`: SELECT/UPDATE/DELETE apenas mesma empresa
- `patients` e `contracts`: SELECT/INSERT/UPDATE/DELETE apenas `company_id = get_user_company_id(auth.uid())`
- `company_invites`: apenas mesma empresa (exceto leitura pública por token para aceitar)

### Limite de 10 contas
- Trigger BEFORE INSERT em `profiles`: bloqueia se a empresa já tem 10 perfis ativos

### Storage
- Bucket `avatars` (público) para fotos de perfil

---

## 2. Autenticação

- Habilitar Supabase Auth com email/senha
- **Confirmação de email obrigatória** (não auto-confirm)
- Login via `supabase.auth.signInWithPassword`
- Recuperação de senha via `resetPasswordForEmail` + rota `/reset-password`
- Sem login social (apenas email/senha conforme pedido)

---

## 3. Rotas (TanStack Start)

### Públicas
- `/login` — login da empresa
- `/criar-empresa` — cadastro de nova empresa (cria company + admin user)
- `/aceitar-convite/$token` — usuário convidado define senha e entra
- `/reset-password` — redefinir senha
- `/cadastro/$token` — **mantida pública sem login** (formulário do paciente)

### Protegidas (layout `_authenticated.tsx`)
- `/` — dashboard de contratos (filtrado por company_id automaticamente via RLS)
- `/usuarios` — gestão de equipe (listar, convidar, remover, desativar, reenviar convite, editar)
- `/perfil` — editar perfil próprio (foto, nome, sobrenome, senha)

### Layout autenticado
- Header com logo OdontoClinic
- Menu de perfil no canto superior direito (dropdown com avatar):
  - Editar perfil
  - Tema escuro (toggle)
  - Sair

---

## 4. Fluxos principais

### Criar empresa
1. Usuário acessa `/criar-empresa`
2. Preenche: nome da empresa, email, senha, confirmar senha
3. `signUp` com metadata `{ company_name, first_name, last_name }`
4. Trigger cria `companies` + `profiles` (como primeiro admin)
5. Email de confirmação enviado → usuário confirma → pode logar

### Convidar usuário
1. Botão "Adicionar conta" em `/usuarios`
2. Modal pede email
3. Server function valida limite (<10), cria registro em `company_invites` com token
4. Envia email via Lovable Emails (transactional) com link `/aceitar-convite/{token}`
5. Convidado abre link → define nome, sobrenome, senha → `signUp` com metadata `{ invite_token }`
6. Trigger vincula profile à empresa do convite, marca invite como aceito

### Identificação do responsável
- Ao criar paciente/contrato: salvar `created_by_user = auth.uid()`
- Na listagem e PDF: mostrar "Criado por: {nome} {sobrenome}" + data/hora

---

## 5. Tema claro/escuro

- Adicionar variáveis `--background`, `--foreground` etc. no `.dark` em `src/styles.css`
- Provider de tema simples (localStorage + classe `dark` no `<html>`)
- Toggle no menu de perfil

---

## 6. Emails

- Setup de email infrastructure + scaffold de auth email templates (confirmação, reset)
- Scaffold transactional email para convites de usuário com branding OdontoClinic
- Será necessário configurar domínio de email (dialog será apresentado)

---

## 7. Tela de Usuários

Tabela com:
- Avatar (foto), Nome completo, Email, Data de criação, Status (badge)
- Ações por linha: Editar, Desativar/Ativar, Reenviar convite (se pendente), Remover

Botão topo: "Adicionar conta" (mostra contagem X/10)

---

## 8. Menu de Perfil

Dropdown no header (avatar + chevron):
- Editar perfil → `/perfil`
- Toggle tema escuro
- Sair (signOut + redirect /login)

Tela `/perfil`:
- Upload/remover foto (Storage `avatars`)
- Editar nome, sobrenome
- Alterar senha (campo atual + nova)

---

## Detalhes técnicos

- `_authenticated.tsx` com `beforeLoad` checando `supabase.auth.getUser()` → redirect `/login`
- `onAuthStateChange` no root para invalidar queries
- Server functions com `requireSupabaseAuth` para mutações sensíveis (convites, remoção de usuário)
- RLS faz o filtro por `company_id` — frontend não precisa passar manualmente
- Manter `cadastro.$token` totalmente público (RLS permite SELECT por token e UPDATE por token sem auth)
- Atualizar `pdf.ts` para incluir "Criado por" e dados da empresa no cabeçalho
- Migrar dados existentes: ou descartar registros antigos (recomendado, pois ainda não há produção) ou atribuir a uma empresa "Legacy"

---

## Ordem de execução

1. Migração de banco (companies, profiles, invites, alterações em patients, RLS, trigger handle_new_user, limite 10, bucket avatars)
2. Configurar Supabase Auth (signups habilitados, **sem** auto-confirm)
3. Setup de emails + scaffold templates (auth + transactional para convites)
4. Tema escuro nos tokens CSS
5. Rotas de auth (login, criar-empresa, aceitar-convite, reset-password)
6. Layout `_authenticated` + header com menu de perfil
7. Refatorar `/` para usar company_id (via RLS) + mostrar "criado por"
8. Tela `/usuarios` com convites e gestão
9. Tela `/perfil`
10. Atualizar PDF com criador + empresa

---

## Observações

- Esta é uma mudança grande: muitos arquivos novos e refatoração da home. Vou implementar tudo em uma sequência só após sua aprovação.
- Os dados atuais da tabela `patients` (se houver) precisarão de uma `company_id`. Posso deletar os registros existentes na migração (mais simples) ou criar uma empresa "Legacy" e atribuir tudo a ela. **Recomendo deletar**, já que ainda é um sistema em desenvolvimento — me avise se preferir preservar.
- Para os emails de convite funcionarem, será necessário configurar um domínio de email durante a implementação (vou abrir o dialog de setup no momento certo).
