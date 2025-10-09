// /api/test-omdb.js
export default async function handler(req, res) {
  const key = "a9a9973d"; // <<— hier kannst du schnell testen
  const q = req.query.q || "Inception";
  try {
    const r = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(q)}&apikey=${key}`);
    const j = await r.json();
    res.status(200).json(j);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
