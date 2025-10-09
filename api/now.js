// /api/now.js — robustes XMLTV mit Mirrors + 2 Next + OMDb-Bewertungen
// ======= HIER DEIN OMDb-KEY =======
const OMDB_KEY = "a9a9973d"; // <— NUR der Key (z.B. a9a9973d), nicht der ganze Link
// ==================================

const SOURCES = [
  "https://raw.githubusercontent.com/iptv-org/epg/master/guides/de/germany2.epg.xml",
  "https://cdn.jsdelivr.net/gh/iptv-org/epg/guides/de/germany2.epg.xml",
  u => "https://r.jina.ai/http/" + u.replace(/^https?:\/\//, ""),
  u => "https://r.jina.ai/https/" + u.replace(/^https?:\/\//, "")
];

// deine Senderliste (sortiert); bei Bedarf Aliase ergänzen
const CHANNELS = [
  { no:1,  name:"ARD (Das Erste)", aliases:["Das Erste","ARD"] },
  { no:2,  name:"ZDF" },
  { no:3,  name:"RTL", aliases:["RTL Television"] },
  { no:4,  name:"ProSieben", aliases:["Pro 7","Prosieben","ProSieben HD"] },
  { no:5,  name:"Sat.1", aliases:["SAT.1","Sat1"] },
  { no:6,  name:"SWR", aliases:["SWR Fernsehen"] },
  { no:7,  name:"Sky Sport F1 (Formel 1)", aliases:["Sky Sport F1","Sky Sport Formel 1"] },
  { no:8,  name:"Motorvision TV" },
  { no:9,  name:"Sky Cinema Highlights" },
  { no:10, name:"Sky Cinema Action" },
  { no:11, name:"Sky Cinema Primera", aliases:["Sky Cinema Premiere","Sky Cinema"] }, // ggf. anpassen
  { no:12, name:"Sky Cinema Classic" },
  { no:13, name:"Sky Cinema Family" },
  { no:14, name:"Warner Bros. (Film & Serie)", aliases:["Warner TV","Warner TV Serie","Warner TV Film"] },
  { no:15, name:"VOX" },
  { no:16, name:"RTL Zwei", aliases:["RTL2","RTL II"] },
  { no:17, name:"Kabel Eins", aliases:["Kabel 1","kabel eins"] },
  { no:18, name:"Kabel Eins Doku" },
  { no:19, name:"BBC Food" },
  { no:20, name:"DMAX" },
  { no:21, name:"BBC Top Gear", aliases:["Top Gear"] },
  { no:22, name:"N24 Doku", aliases:["Welt der Wunder","N24 DOKU"] },
  { no:23, name:"Discovery Channel" },
  { no:24, name:"Sky Documentaries" },
  { no:25, name:"History Channel", aliases:["History"] },
  { no:26, name:"Sky Nature" },
  { no:27, name:"Terra Mater" },
  { no:28, name:"National Geographic", aliases:["Nat Geo","National Geographic Channel"] },
  { no:29, name:"National Geo Wild", aliases:["Nat Geo Wild"] },
  { no:30, name:"Animal Planet" },
  { no:31, name:"Welt", aliases:["WELT","N24"] },
  { no:32, name:"N-TV", aliases:["ntv","N-TV HD"] },
  { no:33, name:"Tagesschau24" },
  { no:34, name:"Nick (Nickelodeon)", aliases:["Nick","Nickelodeon"] },
  { no:35, name:"MTV" }
];

const cors = res=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
};

const clean=t=>t.replace(/^\uFEFF/,"").replace(/\u00A0/g," ");

function parseDate(s){
  // XMLTV: YYYYMMDDHHMMSS [±ZZZZ]  / auch ohne TZ
  const m=s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+\-]\d{4}))?$/);
  if(!m) return null;
  const [ ,Y,Mo,D,H,Mi,S,off ]=m;
  const tz = off ? (off.slice(0,3)+":"+off.slice(3)) : "Z";
  return new Date(`${Y}-${Mo}-${D}T${H}:${Mi}:${S}${tz}`);
}

function parseXml(xml){
  const chans=[...xml.matchAll(/<channel\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi)]
    .map(m=>({id:m[1],names:[m[1],...Array.from(m[2].matchAll(/<display-name[^>]*>([\s\S]*?)<\/display-name>/gi)).map(x=>x[1].trim())]}));

  const progs=[...xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)]
    .map(m=>{
      const a=m[1],b=m[2];
      const attr=k=>(a.match(new RegExp(`${k}="([^"]+)"`))||[])[1]||"";
      const tag =k=>(b.match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)</${k}>`,"i"))||[])[1]?.trim()||"";
      return {channel:attr("channel"),start:parseDate(attr("start")),stop:parseDate(attr("stop")),title:tag("title")||tag("sub-title")};
    });
  return {chans,progs};
}

const norm=s=>(s||"").toLowerCase().replace(/\s+/g," ").trim();
function matchChan(target,all){
  const search=[target.name,...(target.aliases||[])].map(norm);
  let best=null;
  for(const c of all){
    for(const n of c.names){
      const name=norm(n);
      let score = search.some(x=>name===x) ? 100 : search.some(x=>name.includes(x)) ? 80 : 0;
      // Verwechsle ProSieben nicht mit ProSieben FUN
      if(/prosieben/i.test(name) && /fun\b/i.test(name)) score = 0;
      if(!best || score>best.score) best={id:c.id,score};
    }
  }
  return best?.score>=70 ? best : null;
}

// EPG laden (mit Mirror-Fallbacks)
async function fetchEPG(){
  for(const s of SOURCES){
    const url = typeof s==="function" ? s(SOURCES[0]) : s;
    try{
      const r = await fetch(url,{cache:"no-store"});
      if(r.ok) return await r.text();
    }catch{}
  }
  throw new Error("EPG Quelle nicht erreichbar");
}

// OMDb: zuerst t=, wenn nicht gefunden → s= Suche → erster Treffer → i= Details
async function omdbRatings(title){
  if(!OMDB_KEY || !title) return null;
  try{
    let r = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`);
    let j = await r.json();
    if(j?.Response!=="True"){
      // Fallback: Suche
      const rS = await fetch(`http://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`);
      const jS = await rS.json();
      const id = jS?.Search?.[0]?.imdbID;
      if(id){
        const rI = await fetch(`http://www.omdbapi.com/?i=${encodeURIComponent(id)}&apikey=${OMDB_KEY}`);
        j = await rI.json();
      }
    }
    if(j?.Response!=="True") return null;

    const imdb = j.imdbRating && j.imdbRating !== "N/A" ? j.imdbRating : null;
    const rtCritVal = j.Ratings?.find(x=>x.Source==="Rotten Tomatoes")?.Value || null; // Tomatometer (Critics)
    const rtCritic = rtCritVal ? parseInt(rtCritVal.replace("%",""),10) : null;

    // RT-User gibt OMDb i.d.R. nicht her → leer lassen
    return { imdb, rtCritic, rtUser: null };
  }catch{ return null; }
}

export default async function handler(req,res){
  cors(res);
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="GET")     return res.status(405).json({error:"Use GET"});

  try{
    const xml = clean(await fetchEPG());
    const {chans,progs} = parseXml(xml);
    const now = new Date();

    const items = await Promise.all(CHANNELS.map(async c=>{
      const m = matchChan(c,chans);
      if(!m) return { no:c.no, channel:c.name, now:null, next:[] };

      const list = progs.filter(p=>p.channel===m.id && p.start && p.stop).sort((a,b)=>a.start-b.start);
      const cur  = list.find(p=>p.start<=now && now<p.stop) || null;
      const next = list.filter(p=>p.start>now).slice(0,2)
                       .map(n=>({ title:n.title, start:n.start, stop:n.stop }));

      let rating = null;
      if(cur?.title){
        rating = await omdbRatings(cur.title);
      }

      return {
        no: c.no,
        channel: c.name,
        now: cur ? { title:cur.title, start:cur.start, stop:cur.stop } : null,
        next,
        rating
      };
    }));

    res.status(200).json({ ts:new Date().toISOString(), items });
  }catch(e){
    res.status(500).json({ error: String(e?.message||e) });
  }
}
