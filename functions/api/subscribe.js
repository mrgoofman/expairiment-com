export async function onRequestPost(context) {
  const { request, env } = context;

  const contentType = request.headers.get("content-type") || "";
  let email;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    email = body.email;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    email = form.get("email");
  } else {
    return Response.json({ error: "Unsupported content type" }, { status: 415 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  email = email.toLowerCase().trim();

  try {
    await env.DB.prepare("INSERT INTO leads (email) VALUES (?)")
      .bind(email)
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "Already subscribed" }, { status: 409 });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
