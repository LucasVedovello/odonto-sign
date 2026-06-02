import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_URL = "https://odonto-sign.lucasscaranovedovello.workers.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { companyId, companyName, ownerName, ownerEmail, createdAt } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(createdAt));

    const approveUrl = `${ADMIN_URL}/admin?action=approve&companyId=${companyId}`;
    const rejectUrl  = `${ADMIN_URL}/admin?action=reject&companyId=${companyId}`;

    const html = `
<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#3b5bdb">Nova clínica aguardando aprovação</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
  <tr><td style="padding:8px 0;color:#666;width:130px">Clínica</td><td><strong>${companyName}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666">Responsável</td><td>${ownerName}</td></tr>
  <tr><td style="padding:8px 0;color:#666">Email</td><td>${ownerEmail}</td></tr>
  <tr><td style="padding:8px 0;color:#666">Cadastro em</td><td>${formattedDate}</td></tr>
</table>
<div style="display:flex;gap:12px">
  <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">✅ Aprovar</a>
  <a href="${rejectUrl}"  style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">❌ Rejeitar</a>
</div>
<p style="margin-top:16px;font-size:12px;color:#9ca3af">
  Os botões acima requerem login no painel admin. Acesse <a href="${ADMIN_URL}/admin">${ADMIN_URL}/admin</a> diretamente se preferir.
</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p style="color:#9ca3af;font-size:12px">OdontoClinic — Sistema de Gestão Odontológica</p>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["lucas.vedovelloo09@gmail.com"],
        subject: `[OdontoClinic] Nova clínica aguardando aprovação: ${companyName}`,
        html,
      }),
    });

    if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
