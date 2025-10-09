if (url.pathname === "/api/now") {
  const set = pickSet(url.searchParams.get("set"), SOURCES);
  const attempts = [];
  const aggregated = [];
  let sourceUsed = null;

  for (let i = 0; i < set.length; i++) {
    const src = set[i];

    // 1) Fetch mit Size-Guard
    const res = await safeFetchBody(src, { MAX_BYTES, FETCH_TIMEOUT_MS });
    if (!res.ok) {
      attempts.push({ src, ok: false, reason: res.error || "fetch-failed" });
      continue; // nächste Quelle
    }

    // 2) Parsen
    let parsed;
    try {
      parsed = await parseXMLTV(res.data, PARSE_LIMIT_PROGS);
    } catch (e) {
      attempts.push({ src, ok: false, reason: `parse-throw: ${String(e)}` });
      continue;
    }

    if (parsed && parsed.error) {
      // WICHTIG: hier KEIN programmeCount lesen -> nur im ok-Zweig!
      attempts.push({ src, ok: false, reason: `parse-error: ${parsed.error}` });
      continue; // nächste Quelle
    }

    // 3) Mapping
    const mapped = mapNowNext(parsed, CHANNELS);
    const gotAny = mapped.some(ch => ch.now);
    aggregated.push(...mapped);
    attempts.push({
      src,
      ok: true,
      programmes: parsed.programmeCount ?? (parsed.programmes?.length ?? 0)
    });

    if (gotAny) { // erste Quelle mit "now" gefunden -> wir nehmen diese und brechen ab
      sourceUsed = src;
      break;
    }
  }

  // Keine brauchbare Quelle -> Fallback
  if (!sourceUsed) {
    const fallback = CHANNELS.map(c => ({
      no: c.no, channel: c.name,
      now: { title: "(Fallback) Programm", start: iso(), stop: isoOffsetMin(45) },
      next: [
        { title:"(Fallback) Danach 1", start: isoOffsetMin(45),  stop: isoOffsetMin(90) },
        { title:"(Fallback) Danach 2", start: isoOffsetMin(90),  stop: isoOffsetMin(135) }
      ]
    }));
    return J({ ts: iso(), items: fallback, sourceUsed: "fallback:mini", attempts });
  }

  // Items stabil in deiner Reihenfolge zurückgeben
  const byNo = new Map();
  for (const c of aggregated) byNo.set(c.no, c);
  const items = CHANNELS.map(c => byNo.get(c.no) || ({ no:c.no, channel:c.name, now:null, next:[] }));

  return J({ ts: iso(), items, sourceUsed, attempts });
}
