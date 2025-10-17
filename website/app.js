
let MODE = typeof MODE !== 'undefined' ? MODE : 'live';
const API_BASE = 'http://localhost:8000';
const DEMO_BASE = 'data';

const modeBtn = () => document.getElementById('modeBtn');
const menuBtn = () => document.getElementById('menuBtn');
const navEl = () => document.querySelector('nav');

function setMode(m){
  MODE = m;
  if(modeBtn()){ modeBtn().textContent = (MODE === 'live') ? 'Live API' : 'Offline Demo'; }
}

async function fetchJSONLive(path){
  const url = API_BASE + path;
  try {
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  } catch(e){
    return null;
  }
}

async function fetchJSONDemo(name){
  try{
    const res = await fetch(`${DEMO_BASE}/${name}.json`, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){
    return null;
  }
}

async function getData(path, demoName){
  if(MODE === 'live'){
    const live = await fetchJSONLive(path);
    if(live) return live;
    return await fetchJSONDemo(demoName);
  }else{
    const demo = await fetchJSONDemo(demoName);
    if(demo) return demo;
    return await fetchJSONLive(path);
  }
}

function drawLine(canvas, points){
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  ctx.beginPath();
  const maxY = Math.max(...points.map(p=>p.y), 10);
  const stepX = w / Math.max(points.length-1, 1);
  points.forEach((p,i)=>{
    const x = i*stepX;
    const y = h - (p.y / maxY) * (h-28) - 10;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function drawBars(canvas, labels, values){
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  const n = values.length;
  const bw = Math.max(10, (w-20)/Math.max(n,1) - 8);
  const maxV = Math.max(...values, 1);
  labels.forEach((lab,i)=>{
    const x = 10 + i*(bw+8);
    const y = h - (values[i]/maxV)*(h-30) - 10;
    const barH = h - y - 20;
    ctx.fillRect(x, y, bw, barH);
  });
}

function fillTable(id, rows){
  const tb = document.querySelector(id+" tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    Object.values(r).forEach(v=>{
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

let _incData = null;

async function render(){
  const k = await getData('/kpis', 'kpis');
  if(k){
    document.getElementById('risk').textContent = (k.overall_risk*100).toFixed(0)+'%';
    document.getElementById('findings').textContent = k.open_findings;
    document.getElementById('sla').textContent = (k.patch_sla_compliance*100).toFixed(0)+'%';
    document.getElementById('mttd').textContent = k.mean_time_to_detect_hours.toFixed(1)+'h';
    document.getElementById('mttr').textContent = k.mean_time_to_respond_hours.toFixed(1)+'h';
    document.getElementById('updated').textContent = new Date(k.last_updated).toLocaleString();
  }

  const inc = await getData('/incidents', 'incidents');
  if(inc){
    _incData = inc;
    const pts = inc.map(d=>({x:d.date, y:+d.incidents}));
    drawLine(document.getElementById('incChart'), pts);
    const legend = document.getElementById('incLegend');
    const sum = inc.slice(-30).reduce((a,b)=>a+Number(b.incidents||0),0);
    const crit = inc.slice(-30).reduce((a,b)=>a+Number(b.critical||0),0);
    legend.textContent = `Last 30 days total: ${sum} • Critical last 30d: ${crit}`;
  }

  const vulns = await getData('/vulns/top?limit=12', 'vulns_top');
  if(vulns){
    const rows = vulns.map(v=>({Asset:v.asset_id || v.Asset, CVE:v.cve || v.CVE, CVSS:v.cvss || v.CVSS, Exploit:String(v.exploitable), Age:v.age_days || v.Age, Owner:v.owner || v.Owner, Status:v.status || v.Status, Risk:v.risk || v.Risk || ''}));
    fillTable('#vulnTable', rows);
  }

  const comp = await getData('/compliance', 'compliance');
  if(comp){
    const byFw = {};
    comp.forEach(r=>{ (byFw[r.framework] ||= []).push(+r.score) });
    const labs = Object.keys(byFw);
    const vals = labs.map(fw => Math.round((byFw[fw].reduce((a,b)=>a+b,0)/byFw[fw].length)*100));
    drawBars(document.getElementById('compChart'), labs, vals);
  }

  const patch = await getData('/patch/coverage', 'patch_coverage');
  if(patch){
    const labs = patch.map(r=>r.month);
    const vals = patch.map(r=>Math.round(+r.coverage*100));
    drawBars(document.getElementById('patchChart'), labs.slice(-6), vals.slice(-6));
  }

  const tp = await getData('/thirdparty', 'thirdparty');
  if(tp){
    const rows = tp.map(r=>({Vendor:r.vendor,Tier:r.tier,Risk:r.risk_score,Open:r.issues_open,SLA:r.sla_breaches,Assessed:r.last_assessed}));
    fillTable('#tpTable', rows);
  }

  const siem = await getData('/alerts/top', 'alerts_top');
  if(siem){
    const rows = siem.map(r=>({Rule:r.rule,"24h":r.last_24h,"7d":r.last_7d,Criticality:r.criticality}));
    fillTable('#siemTable', rows);
  }

  const risks = await getData('/risk/register', 'risk_register');
  if(risks){
    const rows = risks.slice(0,10).map(r=>({ID:r.risk_id, Title:r.title, Owner:r.owner, Likelihood:r.likelihood, Impact:r.impact, Score:r.score, Status:r.status, "Target":r.target_date}));
    fillTable('#riskTable', rows);
  }
}

function throttle(fn, wait){
  let last = 0;
  return (...args)=>{
    const now = Date.now();
    if(now - last > wait){ last = now; fn(...args); }
  };
}

function redraw(){
  const inc = _incData;
  if(inc){
    const pts = inc.map(d=>({x:d.date, y:+d.incidents}));
    drawLine(document.getElementById('incChart'), pts);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  setMode('live');
  if(modeBtn()){
    modeBtn().addEventListener('click', ()=>{
      setMode(MODE === 'live' ? 'demo' : 'live');
      render();
    });
  }
  if(menuBtn()){
    menuBtn().addEventListener('click', ()=>{
      const n = navEl();
      const open = n.classList.toggle('open');
      menuBtn().setAttribute('aria-expanded', String(open));
    });
  }
  window.addEventListener('resize', throttle(redraw, 200));
  render();
});
