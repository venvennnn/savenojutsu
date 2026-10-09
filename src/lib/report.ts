import { buildAnalytics, formatDateRange, pct } from "./analytics";
import { escapeHtml, jsonForScript } from "./sanitize";
import { INSUFFICIENT_TEXT_LABEL, TOPICS, CONTENT_TYPES } from "./taxonomy";
import type { ClassifiedReel, ImportPreview, PlanId, PublicConfig } from "./types";
import { getPlan } from "./plans";

export interface ReportInput {
  generatedAt: string;
  planId: PlanId;
  preview: ImportPreview;
  reels: ClassifiedReel[];
  config: Pick<PublicConfig, "mode" | "testMode" | "jevModel" | "needsReviewThreshold">;
  modelVersionObserved: string | null;
}

function barRows(
  items: { label: string; count: number; pct: number }[],
  color: string,
): string {
  const max = Math.max(1, ...items.map((i) => i.count));
  return items
    .map((item) => {
      const width = Math.max(2, Math.round((item.count / max) * 100));
      return `<div class="bar-row"><span class="bar-label">${escapeHtml(item.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div><span class="bar-n">${item.count} · ${item.pct.toFixed(1)}%</span></div>`;
    })
    .join("");
}

export function buildReportHtml(input: ReportInput): string {
  const analytics = buildAnalytics(input.reels);
  const plan = getPlan(input.planId);
  const payload = {
    reels: input.reels.map((r) => ({
      shortcode: r.shortcode,
      url: r.url,
      creator: r.creator,
      caption: r.caption,
      hashtags: r.hashtags,
      savedAt: r.savedAt,
      collection: r.collection,
      status: r.status,
      topic: r.labels?.topic.label ?? null,
      topicConfidence: r.labels?.topic.confidence ?? null,
      contentType: r.labels?.contentType.label ?? null,
      apparentUse: r.labels?.apparentUse.label ?? null,
      promotional: r.labels?.promotional.label ?? null,
      hook: r.labels?.captionHook.label ?? null,
      cta: r.labels?.captionCta.label ?? null,
      needsReview: r.needsReview,
      testMode: r.testMode,
      modelVersion: r.modelVersion,
    })),
    monthly: analytics.monthly,
    topics: analytics.topicCounts,
    creators: analytics.creatorCounts.slice(0, 40),
  };

  const topicLegend = analytics.topicCounts
    .slice(0, 8)
    .map((t) => escapeHtml(t.label))
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Save no Jutsu report</title>
<style>
:root{--paper:#FBF8F0;--forest:#234D3C;--leaf:#8BBF62;--chakra:#E78945;--ink:#202923;--muted:#5d675f;--line:#d9d2c3}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,Segoe UI,sans-serif}
header{background:var(--forest);color:#f4f0e4;padding:28px 24px}
header h1{margin:0 0 4px;font-family:Georgia,ui-serif,serif;font-weight:600}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0}
.card{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fffdf8}
.card b{display:block;font-size:22px;color:var(--forest)}
.muted{color:var(--muted);font-size:13px}
.bar-row{display:grid;grid-template-columns:180px 1fr 110px;gap:8px;align-items:center;margin:6px 0}
.bar-label{font-size:13px}
.bar-track{background:#eee8da;border-radius:99px;height:10px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px}
.bar-n{font-size:12px;color:var(--muted);text-align:right}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
input,select{padding:8px;border:1px solid var(--line);border-radius:8px;background:#fff;margin:0 6px 10px 0}
.banner{background:#f7e3d0;border:1px solid #e8b98c;padding:10px 12px;border-radius:10px;margin:12px 0}
h2{font-family:Georgia,ui-serif,serif;color:var(--forest)}
.tag{display:inline-block;background:#e7f3da;color:var(--forest);border-radius:99px;padding:2px 8px;font-size:12px;margin-right:4px}
a{color:var(--forest)}
svg.chart{width:100%;height:180px;background:#fffdf8;border:1px solid var(--line);border-radius:12px}
#map{width:100%;height:420px;border:1px solid var(--line);border-radius:12px;background:#fffdf8}
.note{background:#fff;border:1px dashed var(--line);padding:12px;border-radius:10px}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <p class="muted" style="color:#d7e3d4;margin:0 0 8px">Save no Jutsu · offline report</p>
    <h1>Your saved Reels have a story.</h1>
    <p style="margin:0;max-width:720px">Findings describe the saved items represented in the uploaded export, based on available caption and hashtag text. This file does not include watch time, views, or why something was saved.</p>
  </div>
</header>
<div class="wrap">
  ${input.config.testMode || input.reels.some((r) => r.testMode) ? `<div class="banner"><strong>TEST MODE.</strong> Some or all labels were produced by a local heuristic, not Jev. Do not treat them as production classification.</div>` : ""}
  <p class="muted">Generated ${escapeHtml(input.generatedAt)} · Plan ${escapeHtml(plan.name)} (latest ${plan.cap} unique Reels) · Mode ${escapeHtml(input.config.mode)} · Requested model ${escapeHtml(input.config.jevModel)} · Observed model ${escapeHtml(input.modelVersionObserved ?? "n/a")}</p>
  <div class="cards">
    <div class="card"><span class="muted">Reels analyzed</span><b>${analytics.coverage.analyzed}</b></div>
    <div class="card"><span class="muted">Classified</span><b>${analytics.coverage.classified}</b></div>
    <div class="card"><span class="muted">Not enough text</span><b>${analytics.coverage.insufficientText}</b></div>
    <div class="card"><span class="muted">Failed</span><b>${analytics.coverage.failed}</b></div>
  </div>
  <p><strong>${escapeHtml(analytics.headlineFact)}</strong></p>
  <p class="muted">Unique Reels in export: ${input.preview.reelsFound}. Included in this tier: ${Math.min(input.preview.reelsFound, plan.cap)}. Outside the cap: ${Math.max(0, input.preview.reelsFound - plan.cap)}. Save-date coverage: ${pct(input.preview.datedCount, input.preview.reelsFound)} (${escapeHtml(formatDateRange(analytics.dateRange))}).</p>

  <h2>Topics</h2>
  ${analytics.topicCounts.length ? barRows(analytics.topicCounts, "#234D3C") : `<p class="muted">No classified topics — ${INSUFFICIENT_TEXT_LABEL}</p>`}

  <h2>Save activity by month</h2>
  ${analytics.monthly.length ? `<svg class="chart" id="monthChart" viewBox="0 0 1000 180" role="img" aria-label="Saves by month"></svg>` : `<p class="muted">No known save dates in the analyzed set.</p>`}

  <h2>Creators</h2>
  ${analytics.creatorCounts.length ? `<ol>${analytics.creatorCounts.slice(0, 20).map((c) => `<li>${escapeHtml(c.creator)} — ${c.count}</li>`).join("")}</ol>` : `<p class="muted">No creator fields were present in the export.</p>`}

  <h2>Interest map</h2>
  <p class="muted">Nodes are topics, creators, and content types among classified saves. Size is save count. This is an accessible table plus a lightweight graph of the top connections — not a hairball of every edge. Leading topics: ${topicLegend || "none"}.</p>
  <svg id="map" viewBox="0 0 1000 420" role="img" aria-label="Interest map"></svg>
  <table id="mapTable"><thead><tr><th>From</th><th>To</th><th>Shared saves</th></tr></thead><tbody></tbody></table>

  <h2>Reel library</h2>
  <input id="q" placeholder="Search caption text" aria-label="Search captions"/>
  <select id="topic"><option value="">All topics</option></select>
  <select id="status"><option value="">All statuses</option><option value="classified">Classified</option><option value="insufficient_text">Not enough text</option><option value="failed">Failed</option></select>
  <table><thead><tr><th>Creator</th><th>Saved</th><th>Caption</th><th>Topic</th><th>Type</th><th>Status</th><th>Link</th></tr></thead><tbody id="rows"></tbody></table>

  <h2>Methods and limits</h2>
  <div class="note">
    <p>JSON fields observed: ${escapeHtml(analytics.fieldsUsed.join(", ") || "none")}.</p>
    <p>Text coverage: ${analytics.coverage.withCaption} of ${analytics.coverage.analyzed} analyzed Reels had caption or hashtag text. Insufficient-text rate: ${pct(analytics.coverage.insufficientText, analytics.coverage.analyzed)}. Unknown topic: ${analytics.coverage.unknownTopic}. Failed requests: ${analytics.coverage.failed}.</p>
    <p>Model confidence is the value returned by Jev (or the test heuristic). It is not a measured accuracy rate. “Needs review” uses product setting ${input.config.needsReviewThreshold} until validated against manually labeled examples.</p>
    <p>Classification used only caption and hashtag text. URLs, creators, timestamps, and collection names were not sent to Jev. Items without usable text are labeled “${escapeHtml(INSUFFICIENT_TEXT_LABEL)}” and were not guessed from URL, creator, or date.</p>
    <p>This report was generated in the browser and is not stored by Save no Jutsu. Keep this file if you want the results later.</p>
  </div>
</div>
<script>
const DATA = ${jsonForScript(payload)};
const TOPIC_LABELS = ${jsonForScript(Object.fromEntries(TOPICS.map((t) => [t.id, t.label])))};
const TYPE_LABELS = ${jsonForScript(Object.fromEntries(CONTENT_TYPES.map((t) => [t.id, t.label])))};
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fmt(ms){if(!ms)return"Unknown date";return new Date(ms).toLocaleDateString();}
const topicSel=document.getElementById("topic");
Object.entries(TOPIC_LABELS).forEach(([id,label])=>{const o=document.createElement("option");o.value=id;o.textContent=label;topicSel.appendChild(o);});
function renderRows(){
  const q=document.getElementById("q").value.toLowerCase();
  const topic=document.getElementById("topic").value;
  const status=document.getElementById("status").value;
  const tb=document.getElementById("rows");
  tb.replaceChildren();
  DATA.reels.filter(r=>{
    if(topic && r.topic!==topic)return false;
    if(status && r.status!==status)return false;
    if(q && !(r.caption||"").toLowerCase().includes(q) && !(r.creator||"").toLowerCase().includes(q))return false;
    return true;
  }).slice(0,500).forEach(r=>{
    const tr=document.createElement("tr");
    const cells=[r.creator||"—", fmt(r.savedAt), (r.caption||"Not enough text to classify.").slice(0,160), r.topic?TOPIC_LABELS[r.topic]||r.topic:"—", r.contentType?TYPE_LABELS[r.contentType]||r.contentType:"—", r.status];
    cells.forEach(c=>{const td=document.createElement("td");td.textContent=c;tr.appendChild(td);});
    const td=document.createElement("td");
    const a=document.createElement("a");
    a.href=r.url; a.target="_blank"; a.rel="noopener noreferrer"; a.textContent="Open";
    td.appendChild(a); tr.appendChild(td);
    tb.appendChild(tr);
  });
}
["q","topic","status"].forEach(id=>document.getElementById(id).addEventListener("input",renderRows));
renderRows();
(function monthChart(){
  const svg=document.getElementById("monthChart");
  if(!svg || !DATA.monthly.length)return;
  const max=Math.max(1,...DATA.monthly.map(m=>m.total));
  const w=1000,h=180,pad=30;
  const bw=(w-pad*2)/DATA.monthly.length;
  DATA.monthly.forEach((m,i)=>{
    const bh=((m.total/max)*(h-pad*2));
    const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
    rect.setAttribute("x", String(pad+i*bw+4));
    rect.setAttribute("y", String(h-pad-bh));
    rect.setAttribute("width", String(Math.max(4,bw-8)));
    rect.setAttribute("height", String(bh));
    rect.setAttribute("fill","#8BBF62");
    svg.appendChild(rect);
  });
})();
(function map(){
  const svg=document.getElementById("map");
  const tb=document.querySelector("#mapTable tbody");
  const topicNodes=DATA.topics.slice(0,10);
  const creatorNodes=DATA.creators.slice(0,12).filter(c=>c.creator!=="(unknown creator)");
  const edges=[];
  DATA.reels.forEach(r=>{
    if(r.status!=="classified"||!r.topic||!r.creator)return;
    const key=r.topic+"||"+r.creator;
    const found=edges.find(e=>e.key===key);
    if(found)found.n++; else edges.push({key,from:r.topic,to:r.creator,n:1});
  });
  edges.sort((a,b)=>b.n-a.n);
  const top=edges.slice(0,40);
  top.forEach(e=>{
    const tr=document.createElement("tr");
    [TOPIC_LABELS[e.from]||e.from, e.to, e.n].forEach(v=>{const td=document.createElement("td");td.textContent=String(v);tr.appendChild(td);});
    tb.appendChild(tr);
  });
  const nodes=[];
  topicNodes.forEach((t,i)=>nodes.push({id:"t:"+t.id,label:t.label,x:180,y:40+i*36,r:8+Math.min(18,t.count),c:"#234D3C"}));
  creatorNodes.forEach((c,i)=>nodes.push({id:"c:"+c.creator,label:c.creator,x:820,y:40+i*30,r:7+Math.min(14,c.count),c:"#E78945"}));
  top.forEach(e=>{
    const a=nodes.find(n=>n.id==="t:"+e.from);
    const b=nodes.find(n=>n.id==="c:"+e.to);
    if(!a||!b)return;
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);
    line.setAttribute("stroke","#8BBF62");line.setAttribute("stroke-opacity","0.45");
    line.setAttribute("stroke-width", String(1+Math.min(6,e.n)));
    svg.appendChild(line);
  });
  nodes.forEach(n=>{
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",n.x);c.setAttribute("cy",n.y);c.setAttribute("r",n.r);c.setAttribute("fill",n.c);
    const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x", n.x<500?n.x+n.r+6:n.x-n.r-6);
    t.setAttribute("y", n.y+4);
    t.setAttribute("font-size","11");
    t.setAttribute("fill","#202923");
    t.setAttribute("text-anchor", n.x<500?"start":"end");
    t.textContent=n.label;
    g.appendChild(c);g.appendChild(t);svg.appendChild(g);
  });
})();
</script>
</body>
</html>`;
}

export function downloadReport(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "save-no-jutsu-report.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function reportHasExternalNetwork(html: string): boolean {
  return /(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /@import\s+url\(/i.test(html);
}
