// /api/sum.js — Vercel Serverless (Node 18)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const KEY = process.env.OPENAI_KEY;
  if (!KEY) return res.status(500).json({ error: "OPENAI_KEY fehlt" });

  try {
    const { title = "", original = "" } = await req.json();
    const query = original && original.toLowerCase() !== title.toLowerCase()
      ? `${title} (${original})` : title;

    const messages = [
      { role: "system",
        content: "Du bist ein professioneller Filmtexter. Schreibe eine kurze, trailerartige Inhaltsangabe (max. 3 Sätze, <= 55 Wörter), spannend, prägnant, ohne Spoiler. Deutsch." },
      { role: "user",
        content: `Titel: ${query}\n\nGib mir eine spoilerfreie, packende Kurzbeschreibung in 2–3 Sätzen.` }
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 120,
        messages
      })
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => r.status);
      return res.status(502).json({ error: "OpenAI-Fehler", detail: txt });
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content?.trim() || "";
    res.status(200).json({ summary: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
