// /api/sum.js – Vercel Serverless (Node 18)
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  // Body robust einlesen (kein req.json() in diesem Umfeld)
  const raw = await new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });

  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { return res.status(400).json({ error: "Invalid JSON body" }); }

  const title = String(data.title || data.original || "").trim();

  // → OpenAI call (nutzt ENV, nicht hardcoden!)
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

  const json = await resp.json();
  if (!resp.ok) return res.status(500).json({ error: json });

  return res.status(200).json({ summary: json.output_text ?? "" });
}
