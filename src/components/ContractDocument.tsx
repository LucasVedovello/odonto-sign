import {
  formatBRL,
  TREATMENT_LABEL,
  type Contract,
  type MaterialExtra,
  type Procedimento,
  type TreatmentType,
} from "@/lib/contracts";
import { dateISOtoBR } from "@/lib/masks";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-2">
      <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** Renderiza o contrato com todos os dados preenchidos, em HTML formatado. */
export function ContractDocument({ c }: { c: Contract }) {
  const procedimentos = (c.procedimentos as Procedimento[]) ?? [];
  const materiais = (c.materiais_extras as MaterialExtra[]) ?? [];

  return (
    <article className="space-y-5">
      <header>
        <h2 className="text-lg font-bold">Contrato de Prestação de Serviços Odontológicos</h2>
        <p className="text-sm text-muted-foreground">
          Nº {String(c.contract_number).padStart(4, "0")} ·{" "}
          {TREATMENT_LABEL[c.treatment_type as TreatmentType] ?? c.treatment_type}
        </p>
      </header>

      <Block title="Dados do Contratante">
        <Row label="Nome" value={c.contratante_nome} />
        <Row label="Nascimento" value={dateISOtoBR(c.contratante_nascimento)} />
        <Row label="CPF" value={c.contratante_cpf} />
        <Row label="RG" value={c.contratante_rg} />
        <Row label="Profissão" value={c.contratante_profissao} />
        <Row label="Sexo" value={c.contratante_sexo} />
        <Row label="Endereço" value={c.contratante_endereco} />
        <Row label="Telefone" value={c.contratante_telefone} />
        <Row label="Celular" value={c.contratante_celular} />
        <Row label="Email" value={c.contratante_email} />
      </Block>

      <Block title="Dados do Paciente">
        <Row label="Nome" value={c.paciente_nome} />
        <Row label="Nascimento" value={dateISOtoBR(c.paciente_nascimento)} />
        <Row label="CPF" value={c.paciente_cpf} />
        <Row label="RG" value={c.paciente_rg} />
        <Row label="Profissão" value={c.paciente_profissao} />
        <Row label="Sexo" value={c.paciente_sexo} />
        <Row label="Endereço" value={c.paciente_endereco} />
        <Row label="Telefone" value={c.paciente_telefone} />
        <Row label="Celular" value={c.paciente_celular} />
        <Row label="Email" value={c.paciente_email} />
      </Block>

      {(c.referencia_1_nome || c.referencia_2_nome) && (
        <Block title="Referências Pessoais">
          <Row
            label="Referência 1"
            value={
              c.referencia_1_nome
                ? `${c.referencia_1_nome}${c.referencia_1_telefone ? ` — ${c.referencia_1_telefone}` : ""}`
                : "—"
            }
          />
          <Row
            label="Referência 2"
            value={
              c.referencia_2_nome
                ? `${c.referencia_2_nome}${c.referencia_2_telefone ? ` — ${c.referencia_2_telefone}` : ""}`
                : "—"
            }
          />
        </Block>
      )}

      {procedimentos.length > 0 && (
        <Block title="Procedimentos Contratados">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2">Nº</th>
                  <th className="py-1.5 pr-2">Tratamento</th>
                  <th className="py-1.5 pr-2">Dentes/Arcadas</th>
                  <th className="py-1.5 pr-2">Qtd</th>
                  <th className="py-1.5 pr-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {procedimentos.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 pr-2">{p.tratamento || "—"}</td>
                    <td className="py-1.5 pr-2">{p.dentes || "—"}</td>
                    <td className="py-1.5 pr-2">{p.qtd}</td>
                    <td className="py-1.5 pr-2 text-right">{formatBRL(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      {materiais.length > 0 && (
        <Block title="Procedimentos / Materiais Extras">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2">Tipo</th>
                  <th className="py-1.5 pr-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{m.tipo || "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{formatBRL(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      <Block title="Forma de Pagamento">
        <Row label="Valor ortodôntico" value={formatBRL(c.valor_ortodontico)} />
        <Row label="Valor não ortodôntico" value={formatBRL(c.valor_nao_ortodontico)} />
        <Row label="Valor total" value={formatBRL(c.valor_total)} />
        <Row label="Desconto" value={formatBRL(c.desconto)} />
        <Row label="Valor final" value={<strong>{formatBRL(c.valor_final)}</strong>} />
        {!!c.documentacao_ortodontica && (
          <Row label="Documentação ortodôntica" value={formatBRL(c.documentacao_ortodontica)} />
        )}
        {(c.entrada_tipo || !!c.entrada_valor) && (
          <Row
            label="Entrada"
            value={`${c.entrada_tipo ? `${c.entrada_tipo} — ` : ""}${formatBRL(c.entrada_valor)}`}
          />
        )}
        {!!c.sinal_valor && <Row label="Sinal" value={formatBRL(c.sinal_valor)} />}
        {(c.parcelamento_qtd || c.parcelamento_tipo) && (
          <Row
            label="Parcelamento"
            value={`${c.parcelamento_tipo ? `${c.parcelamento_tipo} — ` : ""}${
              c.parcelamento_qtd ?? 0
            }x de ${formatBRL(c.parcelamento_valor)}`}
          />
        )}
        {!!c.vencimento_dia && <Row label="Dia de vencimento" value={`Dia ${c.vencimento_dia}`} />}
        {c.venc_primeira_parcela && (
          <Row label="1ª parcela em" value={dateISOtoBR(c.venc_primeira_parcela)} />
        )}
      </Block>

      <Block title="Assinaturas">
        <div className="grid gap-6 pt-2 sm:grid-cols-2">
          <SignatureSlot
            title="Clínica (OdontoClinic)"
            img={c.clinic_signature}
            date={c.clinic_signed_at}
          />
          <SignatureSlot
            title="Paciente / Contratante"
            img={c.patient_signature}
            date={c.signed_at}
          />
        </div>
      </Block>
    </article>
  );
}

function SignatureSlot({
  title,
  img,
  date,
}: {
  title: string;
  img: string | null;
  date: string | null;
}) {
  return (
    <div>
      <div className="flex h-24 items-end justify-center border-b border-foreground/40 pb-1">
        {img ? (
          <img src={img} alt={`Assinatura ${title}`} className="max-h-20 object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Aguardando assinatura</span>
        )}
      </div>
      <p className="mt-1 text-center text-xs font-medium">{title}</p>
      {date && (
        <p className="text-center text-[11px] text-muted-foreground">
          {new Date(date).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
