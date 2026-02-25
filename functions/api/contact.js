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
          from: "onboarding@resend.dev",
          to: "moritz@rendersnek.com",
          subject: `[expairiment] Message from ${email}`,
          text: `From: ${email}\n\n${message}`,
        }),
      });
    } catch (e) {
      // Email failure is non-fatal — message is already in D1
    }
  }

  return Response.json({ ok: true });
}
