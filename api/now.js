// /api/now.js — Vercel Serverless (Node 18), kein API-Key nötig
const SOURCE = "https://raw.githubusercontent.com/globetvapp/epg/main/Germany/germany2.xml";
const MIRRORS = [
  u => "https://r.jina.ai/http/" + u.replace(/^https?:\/\//,""),
  u => "https://r.jina.ai/https/" + u.replace(/^https?:\/\//,""),
];

const CHANNELS = [
  {no:1, name:"ARD (Das Erste)", aliases:["Das Erste","ARD"]},
  {no:2, name:"ZDF", aliases:[]},
  {no:3, name:"RTL", aliases:["RTL Television"]},
  {no:4, name:"ProSieben", aliases:["Pro 7","Prosieben"]},
  {no:5, name:"Sat.1", aliases:["Sat1","SAT.1"]},
  {no:6, name:"SWR", aliases:["SWR BW","SWR RP","SWR Fernsehen"]},
  {no:7, name:"Sky Sport F1 (Formel 1)", aliases:["Sky Sport F1","Sky Sport Formel 1"]},
  {no:8, name:"Motorvision TV", aliases:["Motorvision"]},
  {no:9, name:"Sky Cinema Highlights", aliases:["Sky Cinema Hits","Sky Cinema Best Of"]},
  {no:10, name:"Sky Cinema Action", aliases:["Sky Cinema Action HD"]},
  {no:11, name:"Sky Cinema Primera", aliases:["Sky Cinema Premieren","Sky Cinema"]},
  {no:12, name:"Sky Cinema Classic", aliases:["Sky Cinema Classics"]},
  {no:13, name:"Sky Cinema Family", aliases:["Sky Cinema Family HD","Sky Cinema Fun"]},
  {no:14, name:"Warner Bros. (Film & Serie)", aliases:["Warner TV Serie","Warner TV Film","Warner TV"]},
  {no:15, name:"VOX", aliases:[]},
  {no:16, name:"RTL Zwei", aliases:["RTL2","RTL II"]},
  {no:17, name:"Kabel Eins", aliases:["kabel eins","Kabel 1"]},
  {no:18, name:"Kabel Eins Doku", aliases:["Kabel Eins Doku"]},
  {no:19, name:"BBC Food", aliases:["Food Network"]},
  {no:20, name:"DMAX", aliases:[]},
  {no:21, name:"BBC Top Gear", aliases:["Top Gear"]},
  {no:22, name:"N24 Doku", aliases:["WELT Doku","N24 DOKU"]},
  {no:23, name:"Discovery Channel", aliases:["Discovery"]},
  {no:24, name:"Sky Documentaries", aliases:["Sky Doku"]},
  {no:25, name:"History Channel", aliases:["History"]},
  {no:26, name:"Sky Nature", aliases:["Sky Nature HD"]},
  {no:27, name:"Terra Mater", aliases:["ServusTV Doku"]},
  {no:28, name:"National Geographic", aliases:["Nat Geo","National Geographic HD"]},
  {no:29, name:"National Geo Wild", aliases:["Nat Geo Wild"]},
  {no:30, name:"Animal Planet", aliases:["Animal Planet HD"]},
  {no:31, name:"Welt", aliases:["WELT","N24"]},
  {no:32, name:"N-TV", aliases:["ntv","N-TV HD"]},
  {no:33, name:"Tagesschau24", aliases:["tagesschau24"]},
  {no:34, name:"Nick (Nickelodeon)", aliases:["Nick","Nickelodeon"]},
  {no:35, name:"MTV", aliases:["MTV Germany","MTV HD"]},
];

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const clean = (t) => t.replace(/^\uFEFF/, "").replace(/\u00A0/g, " ").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
const parseXmltvDate = (s) => {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+\-]\d{4}))?/);
  if(!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]? (m[7].slice(0,3)+":"+m[7].slice(3)) : ""}`;
  return new Date(iso);
};

// schlanker XMLTV-Parser (regex-basiert)
const parseXmlLight = (xml) => {
  const body = (xml.match(/<tv[\s\S]*<\/tv>/i) || [xml])[0];

  const channels = [];
  for (const m of body.matchAll(/<channel\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi)) {
    const id = m[1];
    const names = [id, ...Array.from(m[2].matchAll(/<display-name[^>]*>([\s\S]*?)<\/display-name>/gi)).map(mm=>mm[1].trim())];
    channels.push({id, names});
  }

  const programmes = [];
  for (const m of body.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
    const attrs = m[1], inner = m[2];
    const channel = (attrs.match(/channel="([^"]+)"/)||[])[1] || "";
    const start = parseXmltvDate((attrs.match(/start="([^"]+)"/)||[])[1] || "");
    const stop  = parseXmltvDate((attrs.match(/stop="([^"]+)"/)||[])[1] || "");
    const text = tag => (inner.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))||[])[1]?.trim() || "";
    programmes.push({channel, start, stop, title: text("title"), sub: text("sub-title"), desc: text("desc")});
  }
  return {channels, programmes};
};

const norm = s => (s||"").toLowerCase().replace(/\s+/g," ").trim();
const bestMatchId = (wanted, idx) => {
  const targets = [wanted.name, ...(wanted.aliases||[])].map(norm);
  let best = {score:0, id:null, matched:null};
  for(const ch of idx){
    for(const cand of ch.names){
      const c = norm(cand);
      for(const t of targets){
        let sc=0; if(c===t) sc=100; else if(c.startsWith(t)||t.startsWith(c)) sc=85; else if(c.includes(t)||t.includes(c)) sc=65;
        if(sc>best.score) best = {score:sc, id:ch.id, matched:cand};
      }
    }
  }
  return best.id ? best : null;
};

async function fetchXml(){
  try{ const r = await fetch(SOURCE,{cache:"no-store"}); if(r.ok) return await r.text(); }catch{}
  for(const m of MIRRORS){
    try{ const r = await fetch(m(SOURCE),{cache:"no-store"}); if(r.ok) return await r.text(); }catch{}
  }
  throw new Error("EPG Quelle nicht erreichbar");
}

export default async function handler(req, res){
  cors(res);
  if(req.method === "OPTIONS") return res.status(204).end();
  try{
    const xmlText = clean(await fetchXml());
    const {channels:index, programmes} = parseXmlLight(xmlText);
    const now = new Date();

    const items = [];
    for(const w of CHANNELS){
      const match = bestMatchId(w, index);
      if(!match){ items.push({no:w.no, channel:w.name, now:null}); continue; }
      const list = programmes.filter(p => p.channel === match.id).sort((a,b)=>a.start-b.start);
      const cur = list.find(p => p.start && p.stop && p.start <= now && now < p.stop);
      items.push({
        no: w.no,
        channel: w.name,
        matched: match.matched,
        now: cur ? {
          title: cur.title || "",
          start: cur.start?.toISOString() || null,
          stop:  cur.stop?.toISOString()  || null
        } : null
      });
    }
    res.status(200).json({ts: new Date().toISOString(), items});
  }catch(e){
    res.status(500).json({error: String(e?.message || e)});
  }
}
