// Persist mode and update UI
let MODE = localStorage.getItem('mode') || 'live';
const API_BASE = 'http://localhost:8000';
const DEMO_BASE = 'data';

const navEl = () => document.getElementById('nav');
const modeBtn = () => document.getElementById('modeBtn');
const menuBtn = () => document.getElementById('menuBtn');
const modeStatus = () => document.getElementById('modeStatus');
const toastEl = () => document.getElementById('toast');

function setMode(m){
  MODE = m;
  localStorage.setItem('mode', MODE);
  if(modeBtn()) modeBtn().textContent = (MODE === 'live') ? 'Live API' : 'Offline Demo';
  if(modeStatus()) modeStatus().textContent = (MODE === 'live') ? 'Live' : 'Demo';
}

let toastTimer = null;
function toast(msg){
  const t = toastEl(); if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2500);
}

// Fetch helpers with graceful fallback between Live/Demo
async function fetchJSONLive(path){
  try{
    const res = await fetch(API_BASE + path, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){ return null; }
}
async function fetchJSONDemo(name){
  try{
    const res = await fetch(`${DEMO_BASE}/${name}.json`, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){ return null; }
}
async function getData(path, demoName){
  if(MODE === 'live'){
    const live = await fetchJSONLive(path);
    if(live) return live;
    toast('Live API unavailable — using demo data.');
    if(modeStatus()) modeStatus().textContent = 'Demo (fallback)';
    return await fetchJSONDemo(demoName);
  }else{
    const demo = await fetchJSONDemo(demoName);
    if(demo) return demo;
    toast('Demo data missing — trying Live API.');
    if(modeStatus()) modeStatus().textContent = 'Live (fallback)';
    return await fetchJSONLive(path);
  }
}

// Drawing helpers (incident line now white)
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
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';   // << white line
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
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, bw, barH);
    ctx.globalAlpha = 1.0;
  });
}

// Simple table sorting on header click
function makeSortable(sel){
  const table = document.querySelector(sel);
  if(!table) return;
  table.querySelectorAll('thead th').forEach((th, idx)=>{
    th.style.cursor = 'pointer';
    th.title = 'Click to sort';
    th.addEventListener('click', ()=>{
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const dir = th.dataset.dir = (th.dataset.dir === 'asc') ? 'desc' : 'asc';
      rows.sort((a,b)=>{
        const av = a.children[idx].textContent.trim();
        const bv = b.children[idx].textContent.trim();
        const na = parseFloat(av.replace(/[^0-9.\-]/g,''));
        const nb = parseFloat(bv.replace(/[^0-9.\-]/g,''));
        const num = !isNaN(na) && !isNaN(nb);
        const cmp = num ? (na - nb) : av.localeCompare(bv);
        return dir === 'asc' ? cmp : -cmp;
      });
      tbody.innerHTML = '';
      rows.forEach(r=>tbody.appendChild(r));
    });
  });
}

// Render pipeline
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
    const sum = inc.slice(-30).reduce((a,b)=>a+Number(b.incidents||0),0);
    const crit = inc.slice(-30).reduce((a,b)=>a+Number(b.critical||0),0);
    document.getElementById('incLegend').textContent = `Last 30 days total: ${sum} • Critical last 30d: ${crit}`;
  }

  const vulns = await getData('/vulns/top?limit=12', 'vulns_top');
  if(vulns){
    const rows = vulns.map(v=>({Asset:v.asset_id||v.Asset, CVE:v.cve||v.CVE, CVSS:v.cvss||v.CVSS, Exploit:String(v.exploitable), Age:v.age_days||v.Age, Owner:v.owner||v.Owner, Status:v.status||v.Status, Risk:v.risk||v.Risk||''}));
    fillTable('#vulnTable', rows); makeSortable('#vulnTable');
  }

  const comp = await getData('/compliance', 'compliance');
  if(comp){
    const byFw={}; comp.forEach(r=>{(byFw[r.framework] ||= []).push(+r.score)});
    const labs = Object.keys(byFw);
    const vals = labs.map(f=>Math.round((byFw[f].reduce((a,b)=>a+b,0)/byFw[f].length)*100));
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
    fillTable('#tpTable', rows); makeSortable('#tpTable');
  }

  const siem = await getData('/alerts/top', 'alerts_top');
  if(siem){
    const rows = siem.map(r=>({Rule:r.rule,"24h":r.last_24h,"7d":r.last_7d,Criticality:r.criticality}));
    fillTable('#siemTable', rows); makeSortable('#siemTable');
  }

  const risks = await getData('/risk/register', 'risk_register');
  if(risks){
    const rows = risks.slice(0,10).map(r=>({ID:r.risk_id, Title:r.title, Owner:r.owner, Likelihood:r.likelihood, Impact:r.impact, Score:r.score, Status:r.status, "Target":r.target_date}));
    fillTable('#riskTable', rows); makeSortable('#riskTable');
  }
}

function fillTable(sel, rows){
  const tb = document.querySelector(sel + ' tbody');
  tb.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    Object.values(r).forEach(v=>{
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// Resize redraw for charts
function throttle(fn, wait){
  let last=0; return (...args)=>{const n=Date.now(); if(n-last>wait){last=n; fn(...args);} };
}
function redraw(){
  if(!_incData) return;
  const pts = _incData.map(d=>({x:d.date, y:+d.incidents}));
  drawLine(document.getElementById('incChart'), pts);
}

document.addEventListener('DOMContentLoaded', ()=>{
  // init mode
  setMode(MODE);

  // mode toggle
  if(modeBtn()){
    modeBtn().addEventListener('click', ()=>{
      setMode(MODE === 'live' ? 'demo' : 'live');
      render();
    });
  }

  // burger toggle (works on desktop + mobile)
  if(menuBtn()){
    menuBtn().addEventListener('click', ()=>{
      const n = navEl();
      const isMobile = window.matchMedia('(max-width: 820px)').matches;
      if(isMobile){
        const open = n.classList.toggle('open');
        n.classList.remove('collapsed');
        menuBtn().setAttribute('aria-expanded', String(open));
      }else{
        const collapsed = n.classList.toggle('collapsed');
        n.classList.remove('open');
        menuBtn().setAttribute('aria-expanded', String(!collapsed));
      }
    });
  }

  // close mobile menu after link click
  document.querySelectorAll('#nav .links a').forEach(a=>{
    a.addEventListener('click', ()=>{
      const n = navEl();
      if(n.classList.contains('open')){
        n.classList.remove('open');
        if(menuBtn()) menuBtn().setAttribute('aria-expanded','false');
      }
    });
  });

  window.addEventListener('resize', throttle(()=>{
    const n = navEl();
    const isMobile = window.matchMedia('(max-width: 820px)').matches;
    if(!isMobile){ n.classList.remove('open'); } else { n.classList.remove('collapsed'); }
    redraw();
  }, 200));

  render();
});
