// Formulário da Ficha de Avaliação (MOD. IOP0037), baseado nas 2 páginas
// impressas. Componente CONTROLADO: o estado (FichaData) vive na página; aqui
// só renderizamos os campos e propagamos alterações via `onChange(patch)`.
//
// Suporta `readOnly` (usado na visualização e na página pública do paciente).

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Odontograma } from "@/components/ficha-avaliacao/Odontograma";
import {
  DENTES_ADULTO_INF_DIR,
  DENTES_ADULTO_INF_ESQ,
  DENTES_ADULTO_SUP_DIR,
  DENTES_ADULTO_SUP_ESQ,
  DENTES_DECIDUOS_INF_DIR,
  DENTES_DECIDUOS_INF_ESQ,
  DENTES_DECIDUOS_SUP_DIR,
  DENTES_DECIDUOS_SUP_ESQ,
  type DentesMap,
  type FichaData,
} from "@/lib/ficha-avaliacao";

type Props = {
  value: FichaData;
  onChange: (patch: Partial<FichaData>) => void;
  readOnly?: boolean;
};

// Chaves de texto e de booleano (para tipar os helpers).
type TextKey = {
  [K in keyof FichaData]: FichaData[K] extends string ? K : never;
}[keyof FichaData];
type BoolKey = {
  [K in keyof FichaData]: FichaData[K] extends boolean ? K : never;
}[keyof FichaData];
type DentesKey = {
  [K in keyof FichaData]: FichaData[K] extends DentesMap ? K : never;
}[keyof FichaData];

export function FichaForm({ value, onChange, readOnly }: Props) {
  // ── Helpers de render (FUNÇÕES, não componentes — evita remount/perda de foco) ──
  const field = (
    k: TextKey,
    label: string,
    opts: { type?: string; className?: string; placeholder?: string } = {},
  ): ReactNode => (
    <div className={cn("grid gap-1", opts.className)}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={opts.type ?? "text"}
        className="h-8 text-sm"
        value={value[k]}
        placeholder={opts.placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [k]: e.target.value } as Partial<FichaData>)}
      />
    </div>
  );

  const check = (k: BoolKey, label: string): ReactNode => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={value[k]}
        disabled={readOnly}
        onCheckedChange={(v) => onChange({ [k]: !!v } as Partial<FichaData>)}
      />
      <span>{label}</span>
    </label>
  );

  // Campo de texto curto "inline" (rótulo à esquerda, input estreito).
  const inlineField = (k: TextKey, label: string, width = "w-28"): ReactNode => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        className={cn("h-7 text-sm", width)}
        value={value[k]}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange({ [k]: e.target.value } as Partial<FichaData>)}
      />
    </div>
  );

  const toggleTooth = (group: DentesKey, dente: string) => {
    if (readOnly) return;
    const cur = (value[group] ?? {}) as DentesMap;
    onChange({ [group]: { ...cur, [dente]: !cur[dente] } } as Partial<FichaData>);
  };

  const odontograma = (group: DentesKey, implante?: boolean): ReactNode => (
    <Odontograma
      value={(value[group] ?? {}) as DentesMap}
      onToggle={(d) => toggleTooth(group, d)}
      supDir={DENTES_ADULTO_SUP_DIR}
      supEsq={DENTES_ADULTO_SUP_ESQ}
      infDir={DENTES_ADULTO_INF_DIR}
      infEsq={DENTES_ADULTO_INF_ESQ}
      readOnly={readOnly}
      implante={implante}
    />
  );

  const sectionTitle = (t: string) => (
    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">{t}</h3>
  );

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field("numero_contrato", "Nº do Contrato")}
          {field("numero_prontuario", "Nº do Prontuário")}
          {field("data_avaliacao", "Data da avaliação", { type: "date" })}
          {field("paciente_nome", "Nome do paciente", { className: "sm:col-span-2" })}
          {field("paciente_telefone", "Telefone")}
          {field("paciente_celular", "Celular")}
          {field("paciente_data_nascimento", "Data de Nascimento", { type: "date" })}
          {field("paciente_cpf", "CPF")}
          {field("origem", "Origem")}
          {field("avaliador", "Avaliador / Médico")}
          {field("paciente_email", "E-mail do Paciente", { className: "lg:col-span-2" })}
        </div>
      </Card>

      {/* ── Dentística ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Dentística")}
        <p className="mb-3 text-xs text-muted-foreground">
          Restaurações — preencher de acordo com a face comprometida.
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {odontograma("dentistica_dentes")}
          <div className="grid w-full max-w-xs gap-3">
            {field("dentistica_restauracao_dentes", "Restauração nos dentes")}
            {field("dentistica_total", "Total")}
          </div>
        </div>
      </Card>

      {/* ── Clareamento / Dessensibilização ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            {sectionTitle("Clareamento Externo")}
            <div className="space-y-2">
              {check("clareamento_externo_comum", "Comum (caseiro)")}
              {check("clareamento_externo_laser", "Laser")}
              {check("clareamento_externo_apos_ortod", "Após ortodontia")}
              {inlineField("clareamento_externo_apenas_arcada", "Apenas arcada", "w-32")}
            </div>
          </div>
          <div>
            {sectionTitle("Clareamento Interno")}
            {field("clareamento_interno", "(+ restauração)")}
          </div>
          <div>
            {sectionTitle("Dessensibilização")}
            <div className="space-y-2">
              {check("dessensibilizacao_comum", "Comum")}
              {check("dessensibilizacao_laser", "Laser")}
              {check("dessensibilizacao_arcada_sup", "Arcada sup.")}
              {check("dessensibilizacao_arcada_inf", "Arcada inf.")}
              {inlineField("dessensibilizacao_obs", "Obs.", "w-32")}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Dentes Decíduos ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Dentes Decíduos (Leite)")}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <Odontograma
            value={(value.deciduos_dentes ?? {}) as DentesMap}
            onToggle={(d) => toggleTooth("deciduos_dentes", d)}
            supDir={DENTES_DECIDUOS_SUP_DIR}
            supEsq={DENTES_DECIDUOS_SUP_ESQ}
            infDir={DENTES_DECIDUOS_INF_DIR}
            infEsq={DENTES_DECIDUOS_INF_ESQ}
            readOnly={readOnly}
          />
          <div className="grid w-full max-w-sm gap-2">
            {field("deciduos_oclusao_devida", "Oclusão devida")}
            {field("deciduos_cavidade_causal", "Cavidade causal")}
            {field("deciduos_cirurgia_agendada", "Cirurgia agendada")}
            {field("deciduos_replantacao", "Replantação dos dentes")}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-3">
          {check("deciduos_condicionamento", "Condicionamento (3cons)")}
          {check("deciduos_fluor", "Aplicação de flúor")}
          {check("deciduos_arcada_sup", "Arcada sup.")}
          {check("deciduos_arcada_inf", "Arcada inf.")}
        </div>
      </Card>

      {/* ── Endodontia ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Endodontia (Tratamento de Canal)")}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {odontograma("endodontia_dentes")}
            <div className="mt-3">
              {check(
                "endodontia_obs",
                "* Caso necessite de restauração ou prótese, anotar na respectiva especialidade.",
              )}
            </div>
          </div>
          <div className="w-full max-w-md">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Endodontia nos dentes
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-12 border border-border px-1 py-1 text-xs font-medium" />
                  <th className="border border-border px-2 py-1 text-xs font-medium">Tratamento</th>
                  <th className="border border-border px-2 py-1 text-xs font-medium">
                    Retratamento
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["UNI", "endodontia_uni_tratamento", "endodontia_uni_retratamento"],
                    ["BI", "endodontia_bi_tratamento", "endodontia_bi_retratamento"],
                    ["TRI", "endodontia_tri_tratamento", "endodontia_tri_retratamento"],
                  ] as [string, TextKey, TextKey][]
                ).map(([label, kt, kr]) => (
                  <tr key={label}>
                    <td className="border border-border px-2 py-1 text-xs font-semibold">
                      {label}
                    </td>
                    <td className="border border-border p-0">
                      <Input
                        className="h-8 rounded-none border-0 text-sm"
                        value={value[kt]}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) => onChange({ [kt]: e.target.value } as Partial<FichaData>)}
                      />
                    </td>
                    <td className="border border-border p-0">
                      <Input
                        className="h-8 rounded-none border-0 text-sm"
                        value={value[kr]}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) => onChange({ [kr]: e.target.value } as Partial<FichaData>)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ── Periodontia ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            {sectionTitle("Periodontia (Tratamento da Gengiva)")}
            <div className="space-y-2">
              {check("perio_fluor", "Aplicação de flúor")}
              {check("perio_profilaxia", "Profilaxia")}
              {check("perio_basica", "Perio básica (até 4 sessões)")}
              {check("perio_moderada", "Perio moderada (até 8 sessões)")}
              {check("perio_avancada", "Perio avançada (até 12 sessões)")}
            </div>
          </div>
          <div>
            {sectionTitle("Gengivectomia (Aumento de Coroa)")}
            {field("gengivectomia_dentes", "Dentes")}
            <div className="mt-2">{check("gengivectomia_obs", "Marcar")}</div>
          </div>
        </div>
      </Card>

      {/* ── Núcleo p/ Prótese Fixa ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Núcleo para Prótese Fixa")}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {odontograma("nucleo_dentes")}
          <div className="grid w-full max-w-xs gap-3">
            {field("nucleo_nos_dentes", "Núcleos nos dentes")}
            {field("nucleo_total", "Total")}
            {field("nucleo_material", "Material")}
          </div>
        </div>
      </Card>

      {/* ── Prótese Fixa Definitiva ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Prótese Fixa Definitiva (Pilares ou Pônticos)")}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {odontograma("protese_fixa_dentes")}
          <div className="grid w-full max-w-xs gap-3">
            {field("protese_elemento_definitivo", "Elemento definitivo nos dentes")}
            {field("protese_onlay_inlay", "Onlay / Inlay nos dentes")}
            {field("protese_faceta", "Faceta nos dentes")}
            {field("protese_lente_contato", "Lente de contato nos dentes")}
            {field("protese_fixa_material", "Material")}
          </div>
        </div>
      </Card>

      {/* ── Provisórios ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Provisórios - Elementos")}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {odontograma("provisorios_dentes")}
          <div className="grid w-full max-w-xs gap-3">
            {field("provisorios_nos_dentes", "Provisórios nos dentes")}
            {field("provisorios_total", "Total")}
            {field("provisorios_material", "Material")}
          </div>
        </div>
        <div className="mt-3 border-t border-border/60 pt-3">
          {check("provisorios_fixado_aparelho", "Provisório fixado no aparelho")}
        </div>
      </Card>

      {/* ════════ PÁGINA 2 ════════ */}

      {/* ── Prótese Total ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {sectionTitle("Prótese Total")}
            <div className="grid gap-2 sm:grid-cols-2">
              {check("pt_definitiva_superior", "Pt definitiva superior")}
              {check("pt_definitiva_inferior", "Pt definitiva inferior")}
              {check("pt_imediata_sup", "Pt imediata provisória sup")}
              {check("pt_imediata_inf", "Pt imediata provisória inferior")}
            </div>
          </div>
          <div>
            {sectionTitle("Definitiva com Dentes")}
            <div className="space-y-2">
              {check("pt_nacionais", "Nacionais")}
              {check("pt_importados", "Importados")}
            </div>
          </div>
        </div>
      </Card>

      {/* ── PPR ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {sectionTitle("PPR — Prótese Parcial Removível")}
            <div className="grid gap-2 sm:grid-cols-2">
              {check("ppr_definitiva_superior", "PPR definitiva superior")}
              {check("ppr_definitiva_inferior", "PPR definitiva inferior")}
              {check("ppr_provisoria_sup", "Provisória sup. Acrílica")}
              {check("ppr_provisoria_inf", "Provisória inf. Acrílica")}
              {check("ppr_flex_superior", "Flex definitiva superior")}
              {check("ppr_flex_inferior", "Flex definitiva inferior")}
            </div>
          </div>
          <div>
            {sectionTitle("Definitiva com Dentes")}
            <div className="space-y-2">
              {check("ppr_nacionais", "Nacionais")}
              {check("ppr_importados", "Importados")}
            </div>
          </div>
        </div>
      </Card>

      {/* ── ATM ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Tratamento de ATM (Placas Interoclusais)")}
        <div className="grid gap-2 sm:grid-cols-2">
          {check("atm_placa_mordida", "Placa de mordida – Bruxismo")}
          {check("atm_placa_disfuncao", "Placa mordida + acompanhamento p/ disfunção ATM")}
        </div>
      </Card>

      {/* ── Cirurgia ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Cirurgia")}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {odontograma("cirurgia_dentes")}
          <div className="grid w-full max-w-sm gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Exodontia Nº dentes</p>
            {field("exodontia_simples", "Simples")}
            {field("exodontia_raiz", "Raiz")}
            {field("exodontia_semi_incluso", "3º Semi incluso")}
            {field("exodontia_incluso", "3º Incluso")}
            {field("exodontia_erupcionado", "3º Erupcionado")}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3">
          {check("cirurgia_frenectomia", "Frenectomia")}
          {check("cirurgia_biopsia", "Biópsia")}
          {check("cirurgia_hiperplasia", "Hiperplasia")}
          {inlineField("cirurgia_regularizacao", "Regularização do rebordo", "w-32")}
        </div>
      </Card>

      {/* ── Implante e Prótese sobre Implante ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Implante e Prótese sobre Implante")}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {odontograma("implante_dentes", true)}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {check("implante_apos_ortodontia", "Após ortodontia")}
              {check("implante_pinos_importados", "Pinos e componentes importados")}
              {inlineField("implante_guia", "Guia cirúrgico", "w-28")}
            </div>
          </div>
          <div className="grid w-full max-w-sm gap-2">
            <div className="grid grid-cols-2 gap-2">
              {field("implante_total_superior", "Total pinos superior")}
              {field("implante_total_inferior", "Total pinos inferior")}
            </div>
            {field("implante_coroas_dentes", "Coroas sobre implantes nos dentes")}
            <div className="grid gap-1.5 pt-1">
              {check("implante_overdenture_sup", "Overdenture superior")}
              {check("implante_overdenture_inf", "Overdenture inferior")}
              {check("implante_protocolo_sup", "Protocolo superior")}
              {check("implante_protocolo_inf", "Protocolo inferior")}
              {check("implante_protocolo_carga_sup", "Protocolo carga imediata superior")}
              {check("implante_protocolo_carga_inf", "Protocolo carga imediata inferior")}
              {check("implante_zigomatico", "Implante zigomático com protocolo superior")}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-3">
          {field("implante_enxerto_bloco", "Enxerto ósseo bloco")}
          {field("implante_enxerto_liofilizado", "Enxerto ósseo liofilizado")}
          {field("implante_elevacao_seio", "Elevação do seio maxilar")}
        </div>
      </Card>

      {/* ── Opções de tratamento ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("A melhor opção de tratamento ou reabilitação oral seria")}
        <div className="grid gap-4 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => {
            const k = `opcao_tratamento_${n}` as TextKey;
            return (
              <div key={n} className="grid gap-1">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                    {n}
                  </span>
                </Label>
                <textarea
                  rows={4}
                  value={value[k]}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => onChange({ [k]: e.target.value } as Partial<FichaData>)}
                  className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-70"
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Observações ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Observações")}
        <textarea
          rows={3}
          value={value.observacoes}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange({ observacoes: e.target.value })}
          className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-70"
        />
      </Card>

      {/* ── Ortodontia ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {sectionTitle("Ortodontia")}
            <div className="grid gap-2 sm:grid-cols-2">
              {check("ortod_alinhador", "Alinhador invisível")}
              {check("ortod_auto_ligado", "Auto ligado")}
              {check("ortod_convencional", "Convencional")}
              {check("ortod_ortopedia", "Ortopedia")}
              {check("ortod_cir_ortognatica", "Cir. Ortognática")}
              {check("ortod_documentacao", "Documentação ortodôntica")}
              {check("ortod_panoramica", "Panorâmica (tem doc. Orto até 6 meses)")}
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {inlineField("ortod_mini_implante", "Mini implante", "w-28")}
              {inlineField("ortod_tracionamento", "Tracionamento", "w-28")}
            </div>
          </div>
          <div>
            {sectionTitle("Bráquetes")}
            <div className="space-y-2">
              {check("braquetes_porcelana", "Porcelana")}
              {check("braquetes_safira", "Safira")}
              {check("braquetes_policarbonato", "Policarbonato")}
              {check("braquetes_metalico", "Metálico")}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Radiografia ── */}
      <Card className="p-5 sm:p-6">
        {sectionTitle("Radiografia")}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {check("radio_panoramica", "Panorâmica")}
          {inlineField("radio_tomografia", "Tomografia", "w-36")}
          {inlineField("radio_periapical", "Periapical", "w-36")}
        </div>
      </Card>

      {/* ── E.S. / R.V. / R.P. ── */}
      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            {sectionTitle("E.S.")}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {check("es_am", "AM")}
              {check("es_an", "AN")}
              {check("es_ex", "EX")}
              {check("es_em", "EM")}
            </div>
          </div>
          <div>
            {sectionTitle("R.V.")}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {check("rv_min", "MIN")}
              {check("rv_med", "MÉD")}
              {check("rv_total", "TOTAL")}
            </div>
          </div>
          <div>
            {sectionTitle("R.P.")}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {check("rp_min", "MIN")}
              {check("rp_med", "MÉD")}
              {check("rp_total", "TOTAL")}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
