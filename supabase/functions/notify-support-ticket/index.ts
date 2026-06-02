import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { ticketId, userId, userName, userEmail, companyName, title, message, createdAt } =
      await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(createdAt));

    const html = `
<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#3b5bdb">Novo ticket de suporte</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <tr><td style="padding:8px 0;color:#666;width:130px">Usuário</td><td style="padding:8px 0"><strong>${userName}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0">${userEmail}</td></tr>
  <tr><td style="padding:8px 0;color:#666">Clínica</td><td style="padding:8px 0">${companyName}</td></tr>
  <tr><td style="padding:8px 0;color:#666">Título</td><td style="padding:8px 0"><strong>${title}</strong></td></tr>
  <tr><td style="padding:8px 0;color:#666">Data/hora</td><td style="padding:8px 0">${formattedDate}</td></tr>
</table>
<div style="background:#f4f4f5;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.6">${message}</div>
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p style="color:#9ca3af;font-size:12px">OdontoClinic — Sistema de Gestão Odontológica</p>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "OdontoClinic <onboarding@resend.dev>",
        to: ["odonto.sign@gmail.com"],
        subject: `[OdontoClinic Suporte] Novo ticket: ${title}`,
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
