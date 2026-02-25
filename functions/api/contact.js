export async function onRequestPost(context) {
  const { request, env } = context;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return Response.json({ error: "Unsupported content type" }, { status: 415 });
  }

  const body = await request.json();
  const email = (body.email || "").toLowerCase().trim();
  const message = (body.message || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 5000) {
    return Response.json({ error: "Message too long" }, { status: 400 });
  }

  try {
    await env.DB.prepare("INSERT INTO contact_messages (email, message) VALUES (?, ?)")
      .bind(email, message)
      .run();
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  // Forward via Resend if API key is configured (non-fatal)
  if (env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "EXPAIRIMENT.COM <wanna@expairiment.com>",
          to: "wanna@expairiment.com",
          reply_to: email,
          subject: `[expairiment] Message from ${email}`,
          text: `From: ${email}\n\n${message}`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="padding:24px 28px 16px">
          <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:0.05em;color:#a0a0a0;text-transform:uppercase">expairiment</p>
          <p style="margin:0 0 4px;font-size:12px;color:#71717a">From</p>
          <p style="margin:0 0 20px;font-size:16px;color:#18181b"><a href="mailto:${email}" style="color:#18181b;text-decoration:none">${email}</a></p>
          <div style="padding:16px;background:#fafafa;border-radius:6px;border:1px solid #e4e4e7">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#27272a;white-space:pre-wrap">${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          <p style="margin:20px 0 0;font-size:11px;color:#a1a1aa">Received ${new Date().toISOString().replace("T", " at ").slice(0, 22)} UTC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        }),
      });
    } catch (e) {
      // Email failure is non-fatal — message is already in D1
    }
  }

  return Response.json({ ok: true });
}
