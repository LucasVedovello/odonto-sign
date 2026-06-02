import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://odonto-sign.lucasscaranovedovello.workers.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { ownerEmail, ownerName, companyName, approved, rejectionReason } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const subject = approved
      ? "Sua clínica foi aprovada no OdontoClinic! 🎉"
      : "Atualização sobre seu cadastro no OdontoClinic";

    const html = approved
      ? `
<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#16a34a">Boas-vindas ao OdontoClinic, ${ownerName}! 🎉</h2>
<p>Sua clínica <strong>${companyName}</strong> foi <strong>aprovada</strong> e já está ativa na plataforma.</p>
<p>Acesse agora e comece a usar:</p>
<a href="${APP_URL}" style="display:inline-block;background:#3b5bdb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
  Acessar OdontoClinic
</a>
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p style="color:#9ca3af;font-size:12px">OdontoClinic — Sistema de Gestão Odontológica</p>
</body></html>`
      : `
<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="color:#dc2626">Atualização do seu cadastro</h2>
<p>Olá, <strong>${ownerName}</strong>. Infelizmente o cadastro da clínica <strong>${companyName}</strong> não foi aprovado.</p>
${rejectionReason ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0"><strong>Motivo:</strong> ${rejectionReason}</div>` : ""}
<p>Se tiver dúvidas ou quiser recorrer, entre em contato com nosso suporte acessando o painel e abrindo um ticket.</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p style="color:#9ca3af;font-size:12px">OdontoClinic — Sistema de Gestão Odontológica</p>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["lucas.vedovelloo09@gmail.com"],
        subject,
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
