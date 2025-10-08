export default async function handler(req, res) {
  const KEY = process.env.OMDB_KEY || "";
  if (!KEY) return res.status(500).json({ ok:false, error:"OMDB_KEY fehlt" });

  const q = (req.query.q || "The Matrix").toString();
  const url = "https://www.omdbapi.com/?t=" + encodeURIComponent(q) + "&apikey=" + KEY;

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j?.Response === "False") return res.status(400).json({ ok:false, query:q, api_error:j?.Error });
    // nur das Wichtigste zurückgeben
    return res.status(200).json({
      ok:true, query:q,
      title:j.Title, year:j.Year,
      imdb:j.imdbRating || null,
      ratings:j.Ratings || []
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
