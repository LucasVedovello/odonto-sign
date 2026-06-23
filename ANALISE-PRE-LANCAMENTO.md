# Relatório de Análise Pré-Lançamento — OdontoSign

**Data:** 23/06/2026
**Escopo:** análise do código-fonte (`src/`), schema (`supabase/migrations/`) e
configuração (`package.json`, `wrangler.jsonc`, `vercel.json`, `.github/`).
**Objetivo:** identificar o que falta antes de fechar a primeira franquia
odontológica como cliente.

> Tudo abaixo é baseado no que existe (ou não) no código. Trechos citam o
> arquivo/migration onde a evidência foi encontrada.

---

## ✅ O que já está implementado

### Autenticação e onboarding de clínicas
- Login email/senha via Supabase (`src/routes/login.tsx`), com recuperação de
  senha (`resetPasswordForEmail` → `src/routes/reset-password.tsx`).
- Cadastro de empresa em wizard com aceite de **Termos de Uso + Política de
  Privacidade (LGPD)** integrais (`src/components/company-wizard.tsx`,
  `src/routes/criar-empresa.tsx`).
- Fluxo de **aprovação de clínica**: nova clínica entra como `pending`, e-mail
  para o dono da plataforma (`supabase/functions/notify-new-company`), aprovação
  no painel admin, e-mail de aprovação (`notify-company-approved`). Telas
  `aguardando-aprovacao`, `acesso-negado`. Guard em `_authenticated.tsx`.
- **Multi-clínica:** `company_users`, troca de clínica ativa
  (`set_active_company`), seleção em `select-company.tsx` / `adicionar-clinica.tsx`.

### RBAC e gestão de equipe
- Papéis: `platform_admin`, `clinic_owner`, `dentist`, `staff` (`src/lib/rbac.tsx`),
  com guards de rota (`roleGuard`) e RLS no banco.
- Gestão de usuários (`src/routes/_authenticated/usuarios.tsx`): convite por
  e-mail, reenvio, ativar/desativar, troca de papel, exclusão, limite de 20
  contas. Convite aceito em `aceitar-convite.tsx`.

### Contratos e Termos (assinatura digital) — módulo mais completo
- Upload do PDF original, **detecção automática** de campos de assinatura e de
  texto (data/local/CNPJ) (`src/lib/pdf-detect.ts`), assinatura da clínica,
  geração de **link público** para o paciente assinar (`PublicSignPage.tsx`),
  download do PDF final assinado (`signed-pdf.ts`).
- Múltiplos campos de assinatura por parte; compartilhamento via WhatsApp
  (`wa.me`) e cópia de link.
- Lixeira com soft-delete e expurgo automático em 30 dias
  (`20260616160000_trash_soft_delete_and_purge.sql`).
- Rodapé de auditoria "criado/editado por" (recém-adicionado).

### Prontuários digitais
- Ficha de Planejamento **IOP046**, Eventos **IOP043** e ficha de Prótese
  **IOP054**, com geração de PDF (`src/lib/prontuario-pdf.ts`).
- Anamnese, odontograma, arcadas, assinatura por procedimento (doutor +
  paciente), workflow de status `draft → signed → procedures_pending →
  finalized` (`20260610100000_prontuario_signatures.sql`).
- Aba **Prontuários Recentes** com filtros Hoje / Últimos 7 dias e rodapé de
  auditoria (recém-adicionados).

### Painel da plataforma (admin) e suporte
- `admin.tsx`: abas Clínicas, Usuários, Gestão de Usuários, Pacientes (somente
  leitura), Aprovações, Tickets.
- **Alertas administrativos** (`admin_alerts`): clínica inativa (30 dias),
  ≥5 logins falhos/hora, usuário bloqueado — com sino (`AlertsBell.tsx`).
- Suporte: tickets + mensagens + upload de imagens + e-mail
  (`suporte.tsx`, `notify-support-ticket`).

### Auditoria, backup e infraestrutura
- **Auditoria no banco** completa: `audit_logs` com triggers em patients,
  appointments, prontuarios, profiles, companies; `login_attempts`
  (`20260612000100_appointments_audit_alerts.sql`).
- **Backup diário** via GitHub Actions (`pg_dump` → artifact, retenção 30 dias)
  (`.github/workflows/backup.yml`).
- Deploy Cloudflare Workers (`wrangler.jsonc`) + Vercel (`vercel.json`); SSR com
  página de erro (`src/server.ts`, `lib/error-page.ts`); RLS endurecida
  (`20260616180000_rls_security_hardening.sql`).

---

## ⚠️ O que está incompleto ou com problemas

1. **Cadastro de paciente órfão.** `cadastro.$token.tsx` lê um paciente por
   `token` e o atualiza, mas **nenhum lugar do app cria a linha de paciente nem
   gera esse token** (não há `insert` em `patients` em todo o `src/`). O fluxo de
   auto-cadastro do paciente está desconectado.
2. **Tabela `appointments` sem UI.** O schema de agendamento existe e é completo
   (status, duração, auditoria), mas só é escrito em um ponto (prontuario marca
   `finished_at` ao assinar — `prontuario.tsx:523`). Não há agenda/calendário.
3. **Dashboard removido.** `_authenticated/index.tsx` apenas redireciona para
   `/contratos`; os RPCs de dashboard foram dropados
   (`20260614000000_drop_dashboard_rpcs.sql`). Sobrou um mock em
   `src/routes/test.tsx` (`DashboardMock`/`mockPatients`) que deveria ser removido.
4. **Relatórios/exportação não conectados.** `src/lib/export.ts` existe mas
   **não é importado em lugar nenhum**.
5. **E-mails frágeis.** As funções usam remetente sandbox `onboarding@resend.dev`
   e destinatário **hardcoded** (`lucas.vedovelloo09@gmail.com`) — só notificam o
   dono da plataforma e têm baixa entregabilidade. Não há e-mail para o cliente
   final.
6. **Exposição de RLS (anon).** Em `contracts`/`terms` as policies públicas são
   `FOR SELECT/UPDATE TO anon USING (true)` (`20260616120000` + `…180000`). Com a
   chave anon, um anônimo pode **ler/atualizar qualquer contrato/termo** (PII),
   não só o do seu token. As policies "public … by token" de `patients` precisam
   da mesma revisão.
7. **Assinatura da plataforma não é aplicada.** `companies.subscription_expires_at`
   existe, mas nada bloqueia o acesso quando expira (o guard só checa
   `approval_status`).
8. **Perfil sem direitos LGPD operacionais.** `perfil.tsx` permite editar nome,
   foto e senha, mas **não há exclusão de conta nem exportação de dados** — os
   direitos LGPD descritos nos Termos dependem de e-mail manual.
9. **Inconsistência de senha.** `perfil.tsx` valida 8 caracteres no cliente, mas
   a mensagem de erro fala em 6 (limite real do Supabase). Sem política de força,
   sem rate-limit/CAPTCHA/2FA no login.
10. **`audit_logs` sem visualização.** Os logs são gravados, mas não há tela para
    a clínica/owner consultá-los.
11. **Qualidade de código.** `prontuario.tsx` usa `any` extensivamente; o projeto
    não tem testes automatizados nem `lint` limpo (CRLF/`no-explicit-any`
    pré-existentes em vários arquivos).

---

## ❌ O que está faltando para o primeiro cliente (franquia odontológica)

- **Gestão de pacientes — CRÍTICO.** Não existe CRUD de pacientes para a clínica
  (criar, listar, buscar, editar, ficha). A tabela `patients` é rica, mas só é
  alimentada pelo fluxo órfão de auto-cadastro. Hoje prontuários/contratos
  funcionam com nome digitado livre (`patient_id` nulo).
- **Agendamento.** Backend pronto, **falta toda a UI** (agenda do dia, marcação,
  remarcação, cancelamento, visão por dentista).
- **Financeiro básico.** Inexistente. O contrato antigo tinha valores/parcelas
  (`20260615140000_contracts_system.sql`), mas foi **substituído** por um fluxo
  só de PDF (`DROP TABLE contracts CASCADE`). Não há fluxo de caixa, recebimentos,
  parcelas, inadimplência.
- **Contratos e documentos.** ✅ Atendido (único módulo realmente pronto).
- **Comunicação (WhatsApp/e-mail) com o paciente.** Só link `wa.me` manual em
  contratos/termos. Sem automação, sem lembrete de consulta, sem confirmação.
- **Relatórios.** Inexistentes (sem dashboard, `export.ts` desconectado).
- **Onboarding de novos usuários.** Convite por e-mail existe; falta tour/guia
  inicial e estado vazio orientado.
- **Cobrança/assinatura da plataforma.** Apenas um campo de data; **sem gateway**
  (Stripe/Mercado Pago/Pagar.me), sem trial, sem fatura, sem bloqueio por
  inadimplência. Cobrança seria 100% manual hoje.

---

## ❌ O que está faltando para um lançamento seguro

- **Autenticação e segurança:** corrigir a exposição anon de `contracts`/`terms`/
  `patients` (item ⚠️6) — é vazamento de dados de saúde. Adicionar rate-limit/
  lockout e, idealmente, 2FA para a equipe. Padronizar política de senha.
- **Backup:** existe, mas é só artifact do GitHub (30 dias, depende do secret
  `SUPABASE_DB_URL`). Falta **restore testado**, cópia off-site e checagem de que
  o secret está configurado. Confirmar PITR/backup do próprio Supabase.
- **LGPD/privacidade:** Termos/Política existem e são aceitos no cadastro, mas
  faltam **exportação e exclusão de dados** automatizadas (titular e clínica), e
  política de retenção operacional.
- **Tratamento de erros:** há página de erro SSR, mas **não há error boundary
  global no cliente** nem captura centralizada.
- **Monitoramento:** nenhum (sem Sentry/observabilidade, sem uptime, sem alerta
  de erro em produção).
- **Documentação para o cliente:** inexistente (sem guia de uso, FAQ, onboarding
  escrito).

---

## 🎯 Recomendação de prioridade

### 🔴 Bloqueadores (sem isso não dá para assinar)
1. **Corrigir RLS anon** de `contracts`, `terms` e `patients` para escopo por
   token/clínica — impedir leitura/edição de PII por qualquer anônimo.
2. **Módulo de gestão de pacientes** (criar/listar/buscar/editar) — uma clínica
   não opera sem cadastro central de pacientes.
3. **Definir a cobrança da plataforma:** integrar um gateway **ou** documentar e
   automatizar o processo manual + bloqueio por `subscription_expires_at`.
4. **Resolver o fluxo de paciente:** ou implementar a geração de link/token de
   auto-cadastro, ou remover `cadastro.$token` e o mock `test.tsx`.
5. **Validar backup com restore real** e secret configurado.

### 🟡 Importantes (afetam a experiência, não bloqueiam)
- **UI de agendamento** (backend já existe).
- **Lembretes/confirmações por WhatsApp/e-mail** ao paciente.
- **Domínio de e-mail verificado** no Resend + destinatários dinâmicos.
- **Relatórios e dashboard** mínimos (conectar `export.ts`).
- **Visualizador de `audit_logs`** para o owner.
- **Exclusão/exportação de conta (LGPD)** no perfil.
- **Monitoramento** (ex.: Sentry) e **error boundary** no cliente.
- **Rate-limit no login** e padronização de senha.
- **Documentação básica** de uso para a clínica.

### 🟢 Pode ficar para depois
- 2FA/MFA da equipe.
- Financeiro avançado (fluxo de caixa, conciliação, inadimplência).
- Portal do paciente / app.
- Landing page pública de marketing.
- Limpeza técnica: tipagem (`any`), testes automatizados, lint do repositório.

---

### Resumo executivo
O produto tem um **núcleo sólido de assinatura digital** (contratos, termos e
prontuários) com auditoria, multi-clínica, RBAC e backup. Porém, para uma
**franquia odontológica**, faltam pilares operacionais: **gestão de pacientes**,
**agenda** e **financeiro/cobrança**. E para colocar dados reais de saúde no ar
com segurança, o **vazamento de RLS anônimo** é o item mais urgente.
