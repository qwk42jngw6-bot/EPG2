// /api/sum.js — Vercel Serverless (Node 18)
// TESTONLY: Key direkt eintragen (später via ENV: OPENAI_KEY)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const KEY = "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"; // ← DEIN OpenAI-Key hier einsetzen

  try {
    // Body robust lesen (Node/Vercel: kein req.json())
    let raw = "";
    await new Promise((ok, err) => {
      req.on("data", c => raw += c);
      req.on("end", ok);
      req.on("error", err);
    });
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { return res.status(400).json({ error: "Invalid JSON body" }); }

    const title = String(data.title || "").trim();
    const original = String(data.original || "").trim();
    if (!title && !original) return res.status(400).json({ error: "Missing title/original" });

    const query = original && original.toLowerCase() !== title.toLowerCase()
      ? `${title} (${original})` : (title || original);

    const messages = [
      { role: "system",
        content: "Du bist ein professioneller Filmtexter. Schreibe eine kurze, trailerartige Inhaltsangabe (max. 3 Sätze, <= 55 Wörter), spannend, prägnant, ohne Spoiler. Deutsch." },
      { role: "user",
        content: `Titel: ${query}\n\nGib mir eine spoilerfreie, packende Kurzbeschreibung in 2–3 Sätzen.` }
    ];

    const oa = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.7, max_tokens: 120, messages })
    });

    if (!oa.ok) {
      const detail = await oa.text().catch(()=> "");
      return res.status(502).json({ error: "OpenAI error", status: oa.status, detail });
    }
    const j = await oa.json();
    const text = j?.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ summary: text });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
