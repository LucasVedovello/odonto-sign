import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight, FileText } from "lucide-react";

// ── Unidades federativas ──────────────────────────────────────────
const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

// ── Máscaras ──────────────────────────────────────────────────────
const onlyDigits = (v: string) => v.replace(/\D/g, "");

function maskCNPJ(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length > 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

function maskCEP(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Validação de CNPJ (dígitos verificadores) ─────────────────────
function isValidCNPJ(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(c.charAt(len - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const res = sum % 11;
    return res < 2 ? 0 : 11 - res;
  };
  return calc(12) === parseInt(c.charAt(12), 10) && calc(13) === parseInt(c.charAt(13), 10);
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ── Termos de Uso / Política de Privacidade (texto integral) ──────
const TERMS_TEXT = `TERMOS DE USO E POLÍTICA DE PRIVACIDADE
OdontoSign — Plataforma de Gestão para Clínicas Odontológicas
Versão 1.0 — Junho de 2025

1. DAS PARTES E ACEITAÇÃO
Estes Termos de Uso e Política de Privacidade regulam a relação entre a plataforma OdontoSign, de propriedade de Lucas Scarano Vedovello, e a pessoa jurídica ou física que realiza o cadastro e utiliza os serviços oferecidos.
Ao concluir o cadastro e marcar a opção de aceite, o Usuário declara ter lido, compreendido e concordado integralmente com estes Termos.

2. DESCRIÇÃO DO SERVIÇO
A OdontoSign é uma plataforma SaaS voltada à gestão de clínicas odontológicas, oferecendo: gestão de prontuários eletrônicos, geração e assinatura digital de contratos, controle de usuários e permissões, emissão de relatórios e registros de auditoria, e canal de suporte técnico.

3. CADASTRO E RESPONSABILIDADES DO USUÁRIO
O Usuário é responsável por manter a confidencialidade de suas credenciais, por todas as ações realizadas em sua conta, por garantir que os dados inseridos sejam verídicos e obtidos com consentimento dos titulares, e por utilizar a plataforma em conformidade com a legislação vigente.

4. APROVAÇÃO DE ACESSO E CONTROLE DE CONTA
O cadastro está sujeito a aprovação manual pelo administrador. O administrador pode alterar níveis de permissão, promover ou rebaixar perfis de acesso, e suspender contas em caso de violação destes Termos.

5. PROPRIEDADE INTELECTUAL
Todo o código-fonte, interface, design, marca e logotipo da OdontoSign são de propriedade exclusiva de Lucas Scarano Vedovello, protegidos pela Lei nº 9.610/1998 e Lei nº 9.609/1998.

6. LIMITAÇÃO DE RESPONSABILIDADE
A Plataforma não se responsabiliza por decisões clínicas, indisponibilidade por manutenção ou falhas de terceiros, perda de dados por ação do Usuário, ou uso indevido de credenciais. A responsabilidade máxima limita-se ao valor pago nos últimos 3 meses.

7. VIGÊNCIA E RESCISÃO
Vigência por prazo indeterminado. Rescisão mediante aviso de 30 dias. Após encerramento, o Usuário tem 30 dias para exportar seus dados, após o qual serão eliminados conforme art. 16 da LGPD.

POLÍTICA DE PRIVACIDADE — LGPD (Lei nº 13.709/2018)

8. CONTROLADOR DE DADOS
Controlador: Lucas Scarano Vedovello — OdontoSign. Contato: odonto.sign@gmail.com.

9. DADOS COLETADOS
Dados cadastrais da clínica (razão social, CNPJ, endereço, CRO), dados de acesso (e-mail, senha com hash, logs), dados de pacientes inseridos pelo Usuário (tratados pela OdontoSign na qualidade de operadora), e mensagens de suporte.

10. FINALIDADE E BASE LEGAL
Prestação dos serviços — execução de contrato (art. 7º, V). Obrigações legais — cumprimento de obrigação legal (art. 7º, II). Segurança — legítimo interesse (art. 7º, IX). Dados de saúde — tutela da saúde por profissionais habilitados (art. 11, II, f).

11. COMPARTILHAMENTO
Não vendemos dados. Compartilhamento apenas com fornecedores de infraestrutura (como operadores) e autoridades públicas mediante ordem judicial.

12. SEGURANÇA
Criptografia TLS/HTTPS, controle de acesso RBAC, logs de auditoria e Row Level Security no banco de dados.

13. DIREITOS DOS TITULARES (art. 18 LGPD)
Confirmação, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e revogação do consentimento. Solicitações via odonto.sign@gmail.com, respondidas em até 15 dias úteis.

14. RETENÇÃO
Prontuários: mínimo 5 anos conforme Resolução CFO-118/2012. Após encerramento do contrato e prazos legais, dados eliminados de forma segura.

15. COOKIES
Apenas cookies estritamente necessários para autenticação. Sem rastreamento comportamental ou publicitário.

16. ALTERAÇÕES
Notificação por e-mail com 15 dias de antecedência em caso de alterações relevantes.

17. FORO
Comarca de Piracicaba/SP, legislação brasileira.

DECLARAÇÃO DE ACEITE: Ao marcar a caixa de aceite, o Usuário declara que leu, compreendeu e concorda integralmente com estes Termos de Uso e Política de Privacidade, incluindo o tratamento de dados pessoais conforme a LGPD.`;

// ── Etapas (a etapa "account" só existe no modo signup) ───────────
type StepKey = "company" | "address" | "responsible" | "contact" | "account" | "terms";
const STEP_LABEL: Record<StepKey, string> = {
  company: "Dados da empresa",
  address: "Endereço",
  responsible: "Responsável técnico",
  contact: "Contato",
  account: "Conta de acesso",
  terms: "Termos",
};

const initialForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  responsavel_nome: "",
  responsavel_cro: "",
  responsavel_cro_uf: "",
  phone: "",
  contact_email: "",
  site: "",
  email: "",
  password: "",
  confirm: "",
};

export type CompanyWizardMode = "signup" | "add";

/**
 * Wizard multi-etapa de cadastro de clínica.
 *  • mode="signup": cria login (auth.signUp) + clínica via trigger handle_new_user.
 *  • mode="add"   : usuário já logado; cria nova clínica pendente e vincula via
 *                   RPC create_company_for_current_user (sem novo login).
 */
export function CompanyWizard({ mode }: { mode: CompanyWizardMode }) {
  const navigate = useNavigate();
  const isAdd = mode === "add";

  const STEPS: StepKey[] = isAdd
    ? ["company", "address", "responsible", "contact", "terms"]
    : ["company", "address", "responsible", "contact", "account", "terms"];

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const stepKey = STEPS[step];

  // ── ViaCEP ──────────────────────────────────────────────────────
  const handleCepChange = (raw: string) => {
    const masked = maskCEP(raw);
    set({ cep: masked });
    const digits = onlyDigits(masked);
    if (digits.length === 8) void fetchCep(digits);
  };

  const fetchCep = async (digits: string) => {
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      set({
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      });
    } catch {
      toast.error("Não foi possível buscar o CEP");
    } finally {
      setCepLoading(false);
    }
  };

  // ── Validação por etapa ─────────────────────────────────────────
  const validateStep = (key: StepKey): string | null => {
    if (key === "company") {
      if (!form.razao_social.trim()) return "Informe a Razão Social";
      if (!form.nome_fantasia.trim()) return "Informe o Nome Fantasia";
      if (!form.cnpj.trim()) return "Informe o CNPJ";
      if (!isValidCNPJ(form.cnpj)) return "CNPJ inválido";
    }
    if (key === "address") {
      if (onlyDigits(form.cep).length !== 8) return "Informe um CEP válido";
      if (!form.logradouro.trim()) return "Informe o logradouro";
      if (!form.numero.trim()) return "Informe o número";
      if (!form.bairro.trim()) return "Informe o bairro";
      if (!form.cidade.trim()) return "Informe a cidade";
      if (!form.uf) return "Selecione o estado (UF)";
    }
    if (key === "responsible") {
      if (!form.responsavel_nome.trim()) return "Informe o nome do responsável técnico";
      if (!form.responsavel_cro.trim()) return "Informe o número do CRO";
      if (!form.responsavel_cro_uf) return "Selecione a UF do CRO";
    }
    if (key === "contact") {
      if (onlyDigits(form.phone).length < 10) return "Informe um telefone válido";
      if (form.contact_email.trim() && !isEmail(form.contact_email))
        return "E-mail da clínica inválido";
    }
    if (key === "account") {
      if (!isEmail(form.email)) return "Informe um e-mail válido";
      if (form.password.length < 8) return "A senha deve ter pelo menos 8 caracteres";
      if (form.password !== form.confirm) return "As senhas não coincidem";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(stepKey);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Campos comuns enviados tanto no signup quanto na criação via RPC.
  const buildCompanyMeta = () => ({
    company_name: form.nome_fantasia.trim() || form.razao_social.trim(),
    razao_social: form.razao_social.trim(),
    nome_fantasia: form.nome_fantasia.trim(),
    cnpj: form.cnpj.trim(),
    inscricao_estadual: form.inscricao_estadual.trim(),
    cep: form.cep.trim(),
    logradouro: form.logradouro.trim(),
    numero: form.numero.trim(),
    complemento: form.complemento.trim(),
    bairro: form.bairro.trim(),
    cidade: form.cidade.trim(),
    uf: form.uf,
    responsavel_nome: form.responsavel_nome.trim(),
    responsavel_cro: form.responsavel_cro.trim(),
    responsavel_cro_uf: form.responsavel_cro_uf,
    phone: form.phone.trim(),
    contact_email: form.contact_email.trim(),
    site: form.site.trim(),
    accepted_terms_at: new Date().toISOString(),
  });

  // ── Submit ──────────────────────────────────────────────────────
  const submit = async () => {
    for (const key of STEPS) {
      if (key === "terms") continue;
      const err = validateStep(key);
      if (err) {
        toast.error(err);
        setStep(STEPS.indexOf(key));
        return;
      }
    }
    if (!acceptedTerms) {
      toast.error("É necessário aceitar os Termos de Uso e a Política de Privacidade");
      return;
    }

    setLoading(true);
    try {
      if (isAdd) {
        await submitAdd();
      } else {
        await submitSignup();
      }
    } finally {
      setLoading(false);
    }
  };

  // Modo "add": usuário logado cria nova clínica vinculada (pendente).
  const submitAdd = async () => {
    const meta = buildCompanyMeta();
    const { data: companyId, error } = await supabase.rpc("create_company_for_current_user", {
      p: meta,
    });
    if (error) {
      toast.error(error.message || "Erro ao cadastrar clínica");
      return;
    }

    // Notifica o admin (passamos o companyId já conhecido).
    try {
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.functions.invoke("notify-new-company", {
        body: {
          companyName: meta.company_name,
          ownerName: meta.responsavel_nome,
          ownerEmail: userRes.user?.email ?? meta.contact_email,
          createdAt: new Date().toISOString(),
          companyId,
        },
      });
    } catch (e) {
      if (import.meta.env.DEV) console.error("[company-wizard] notify-new-company:", e);
    }

    setSuccess(true);
  };

  // Modo "signup": cria login; o trigger handle_new_user cria a clínica.
  const submitSignup = async () => {
    const nameParts = form.responsavel_nome.trim().split(/\s+/);
    const first_name = nameParts[0] ?? "";
    const last_name = nameParts.slice(1).join(" ");
    const meta = buildCompanyMeta();

    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { ...meta, first_name, last_name },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }

    try {
      const { error: fnError } = await supabase.functions.invoke("notify-new-company", {
        body: {
          companyName: meta.company_name,
          ownerName: meta.responsavel_nome,
          ownerEmail: form.email.trim(),
          createdAt: new Date().toISOString(),
        },
      });
      if (import.meta.env.DEV && fnError)
        console.error("[company-wizard] notify-new-company error:", fnError);
    } catch (e) {
      if (import.meta.env.DEV) console.error("[company-wizard] Erro ao notificar admin:", e);
    }

    setSuccess(true);
  };

  // ── Tela de sucesso ─────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">
            {isAdd ? "Clínica enviada para análise!" : "Cadastro realizado!"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aguarde a aprovação do administrador para acessar a clínica.
            {isAdd && " Assim que aprovada, ela aparecerá na seleção de clínicas."}
          </p>
          {!isAdd && (
            <p className="mt-3 text-xs text-muted-foreground">
              Enviamos um e-mail de confirmação para <strong>{form.email}</strong>.
            </p>
          )}
          <Button
            onClick={() => navigate({ to: isAdd ? "/select-company" : "/login" })}
            className="mt-6 w-full"
          >
            {isAdd ? "Voltar para minhas clínicas" : "Voltar para o login"}
          </Button>
        </Card>
      </div>
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
      {/* Stepper */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Etapa {step + 1} de {STEPS.length}
          </span>
          <span>{STEP_LABEL[stepKey]}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>

      <div className="grid gap-4">
        {/* ── Dados da empresa ── */}
        {stepKey === "company" && (
          <>
            <Field label="Razão Social *">
              <Input
                value={form.razao_social}
                onChange={(e) => set({ razao_social: e.target.value })}
                placeholder="Clínica Exemplo Odontologia LTDA"
              />
            </Field>
            <Field label="Nome Fantasia *">
              <Input
                value={form.nome_fantasia}
                onChange={(e) => set({ nome_fantasia: e.target.value })}
                placeholder="OdontoExemplo"
              />
            </Field>
            <Field label="CNPJ *">
              <Input
                value={form.cnpj}
                inputMode="numeric"
                onChange={(e) => set({ cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="Inscrição Estadual">
              <Input
                value={form.inscricao_estadual}
                onChange={(e) => set({ inscricao_estadual: e.target.value })}
                placeholder="Opcional"
              />
            </Field>
          </>
        )}

        {/* ── Endereço ── */}
        {stepKey === "address" && (
          <>
            <Field label="CEP *">
              <div className="relative">
                <Input
                  value={form.cep}
                  inputMode="numeric"
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Preenchemos o endereço automaticamente.
              </p>
            </Field>
            <Field label="Rua / Logradouro *">
              <Input
                value={form.logradouro}
                onChange={(e) => set({ logradouro: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Número *">
                <Input
                  value={form.numero}
                  onChange={(e) => set({ numero: e.target.value })}
                  placeholder="123"
                />
              </Field>
              <Field label="Complemento">
                <Input
                  value={form.complemento}
                  onChange={(e) => set({ complemento: e.target.value })}
                  placeholder="Sala 2"
                />
              </Field>
            </div>
            <Field label="Bairro *">
              <Input value={form.bairro} onChange={(e) => set({ bairro: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Cidade *">
                <Input value={form.cidade} onChange={(e) => set({ cidade: e.target.value })} />
              </Field>
              <Field label="UF *">
                <Select value={form.uf} onValueChange={(v) => set({ uf: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </>
        )}

        {/* ── Responsável técnico ── */}
        {stepKey === "responsible" && (
          <>
            <Field label="Nome completo do dentista responsável *">
              <Input
                value={form.responsavel_nome}
                onChange={(e) => set({ responsavel_nome: e.target.value })}
                placeholder="Dr. João da Silva"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="CRO (número) *">
                <Input
                  value={form.responsavel_cro}
                  inputMode="numeric"
                  onChange={(e) => set({ responsavel_cro: onlyDigits(e.target.value) })}
                  placeholder="12345"
                />
              </Field>
              <Field label="UF do CRO *">
                <Select
                  value={form.responsavel_cro_uf}
                  onValueChange={(v) => set({ responsavel_cro_uf: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </>
        )}

        {/* ── Contato ── */}
        {stepKey === "contact" && (
          <>
            <Field label="Telefone / WhatsApp da clínica *">
              <Input
                value={form.phone}
                inputMode="numeric"
                onChange={(e) => set({ phone: maskPhone(e.target.value) })}
                placeholder="(19) 99999-9999"
              />
            </Field>
            <Field label="E-mail da clínica">
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => set({ contact_email: e.target.value })}
                placeholder="contato@clinica.com (opcional)"
              />
            </Field>
            <Field label="Site">
              <Input
                value={form.site}
                onChange={(e) => set({ site: e.target.value })}
                placeholder="https://www.clinica.com (opcional)"
              />
            </Field>
          </>
        )}

        {/* ── Conta de acesso (somente signup) ── */}
        {stepKey === "account" && (
          <>
            <Field label="E-mail (login) *">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </Field>
            <Field label="Senha *">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </Field>
            <Field label="Confirmar senha *">
              <Input
                type="password"
                value={form.confirm}
                onChange={(e) => set({ confirm: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* ── Termos ── */}
        {stepKey === "terms" && (
          <>
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Termos de Uso e Política de Privacidade
              </div>
              <p className="text-sm text-muted-foreground">
                A OdontoSign é uma plataforma SaaS de gestão para clínicas odontológicas. Ao
                cadastrar a clínica, você concorda com as regras de uso, o fluxo de aprovação manual
                e o tratamento de dados pessoais conforme a{" "}
                <strong>LGPD (Lei nº 13.709/2018)</strong>. O cadastro fica sujeito à aprovação do
                administrador antes da liberação do acesso.
              </p>
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto p-0 text-sm"
                onClick={() => setTermsOpen(true)}
              >
                Ler o documento completo
              </Button>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                className="mt-0.5"
              />
              <span>
                Li e aceito os Termos de Uso e a Política de Privacidade, incluindo o tratamento de
                dados pessoais conforme a LGPD
              </span>
            </label>
          </>
        )}
      </div>

      {/* Navegação */}
      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={back}
            disabled={loading}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
        <div className="flex-1" />
        {!isLastStep ? (
          <Button type="button" onClick={next} className="gap-1.5">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={loading || !acceptedTerms}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAdd ? (
              "Cadastrar clínica"
            ) : (
              "Criar conta"
            )}
          </Button>
        )}
      </div>

      {/* Modal — Termos completos */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Termos de Uso e Política de Privacidade</DialogTitle>
            <DialogDescription>OdontoSign — Versão 1.0 (Junho de 2025)</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-2">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {TERMS_TEXT}
            </p>
          </div>
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => {
                setAcceptedTerms(true);
                setTermsOpen(false);
              }}
            >
              Li e aceito
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
