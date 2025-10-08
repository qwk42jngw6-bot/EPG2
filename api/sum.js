// Serverloser Endpunkt für GPT-Zusammenfassung (Vercel, Node 18)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const KEY = process.env.OPENAI_KEY;
  if (!KEY) return res.status(500).json({ error: "OPENAI_KEY fehlt" });

  try {
    const { text = "", title = "", original = "" } = await req.json();
    const src = String(text || "").slice(0, 2400); // Kosten klein halten
    if (!src) return res.status(200).json({ summary: "" });

    const prompt = [
      { role: "system", content:
        "Du bist ein präziser Medien-Redakteur. Schreibe eine knappe Inhaltsangabe in 2–3 Sätzen (max. 55 Wörter), auf Deutsch, neutral, spoilerfrei. Nennt keine Schauspieler/Staffeldetails, außer eindeutig im Text. Wenn der Text unklar ist, gib eine sehr allgemeine Kurzinfo." },
      { role: "user", content:
        `Titel: ${title || "-"}${original ? `\nOriginal: ${original}` : ""}\n\nQuelle:\n${src}` }
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 120,
        messages: prompt
      })
    });

    if (!r.ok) {
      const errTxt = await r.text().catch(()=>String(r.status));
      return res.status(502).json({ error: "OpenAI-Fehler", detail: errTxt });
    }
    const j = await r.json();
    const summary = j?.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
