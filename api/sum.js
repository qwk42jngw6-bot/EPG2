// /api/sum.js – Vercel Serverless Function (Node 18+)
export default async function handler(req, res) {
  // === CORS-Einstellungen ===
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  // === Body einlesen (da req.json() hier nicht existiert) ===
  const raw = await new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", chunk => (buf += chunk));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });

  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const title = String(data.title || data.original || "").trim();
  if (!title) return res.status(400).json({ error: "title missing" });

  // === Anfrage an OpenAI ===
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `Schreibe eine kurze, spoilerarme Inhaltsangabe zu: "${title}".`
    })
  });

  // === Fehlerausgabe verbessern ===
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return res.status(resp.status).json({
      error: out.error || out || { message: "OpenAI call failed" }
    });
  }

  // === Erfolg ===
  return res.status(200).json({ summary: out.output_text ?? "" });
}
