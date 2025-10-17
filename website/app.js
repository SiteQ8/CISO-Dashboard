// Persist data source mode; update labels
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

// Toast
let toastTimer=null;
function toast(msg){
  const t = toastEl(); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), 2500);
}

// Fetch helpers + fallback
async function fetchJSONLive(path){
  try{ const r=await fetch(API_BASE+path,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }catch{ return null; }
}
async function fetchJSONDemo(name){
  try{ const r=await fetch(`${DEMO_BASE}/${name}.json`,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }catch{ return null; }
}
async function getData(path,demoName){
  if(MODE==='live'){
    const live=await fetchJSONLive(path); if(live) return live;
    toast('Live API unavailable — using demo data.'); if(modeStatus()) modeStatus().textContent='Demo (fallback)';
    return await fetchJSONDemo(demoName);
  } else {
    const demo=await fetchJSONDemo(demoName); if(demo) return demo;
    toast('Demo data missing — trying Live API.'); if(modeStatus()) modeStatus().textContent='Live (fallback)';
    return await fetchJSONLive(path);
  }
}

// Drawing: incident line is white
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
  ctx.strokeStyle = '#ffffff';
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
  labels.forEach((_,i)=>{
    const x = 10 + i*(bw+8);
    const y = h - (values[i]/maxV)*(h-30) - 10;
    const barH = h - y - 20;
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .85; ctx.fillRect(x,y,bw,barH); ctx.globalAlpha = 1;
  });
}

// Sortable tables
function makeSortable(sel){
  const t = document.querySelector(sel); if(!t) return;
  t.querySelectorAll('thead th').forEach((th,idx)=>{
    th.style.cursor='pointer'; th.title='Click to sort';
    th.addEventListener('click', ()=>{
      const tb=t.querySelector('tbody');
      const rows=[...tb.querySelectorAll('tr')];
      const dir=th.dataset.dir = (th.dataset.dir==='asc')?'desc':'asc';
      rows.sort((a,b)=>{
        const av=a.children[idx].textContent.trim(), bv=b.children[idx].textContent.trim();
        const na=parseFloat(av.replace(/[^0-9.\-]/g,'')), nb=parseFloat(bv.replace(/[^0-9.\-]/g,''));
        const num=(!isNaN(na)&&!isNaN(nb)); const cmp=num?(na-nb):av.localeCompare(bv);
        return dir==='asc'?cmp:-cmp;
      });
      tb.innerHTML=''; rows.forEach(r=>tb.appendChild(r));
    });
  });
}

// Render
let _incData=null;
async function render(){
  const k=await getData('/kpis','kpis');
  if(k){
    risk.textContent=(k.overall_risk*100).toFixed(0)+'%';
    findings.textContent=k.open_findings;
    sla.textContent=(k.patch_sla_compliance*100).toFixed(0)+'%';
    mttd.textContent=k.mean_time_to_detect_hours.toFixed(1)+'h';
    mttr.textContent=k.mean_time_to_respond_hours.toFixed(1)+'h';
    updated.textContent=new Date(k.last_updated).toLocaleString();
  }
  const inc=await getData('/incidents','incidents');
  if(inc){
    _incData=inc;
    drawLine(document.getElementById('incChart'), inc.map(d=>({x:d.date,y:+d.incidents})));
    incLegend.textContent=`Last 30 days total: ${inc.slice(-30).reduce((a,b)=>a+Number(b.incidents||0),0)} • Critical last 30d: ${inc.slice(-30).reduce((a,b)=>a+Number(b.critical||0),0)}`;
  }
  const vulns=await getData('/vulns/top?limit=12','vulns_top');
  if(vulns){
    fillTable('#vulnTable', vulns.map(v=>({Asset:v.asset_id||v.Asset,CVE:v.cve||v.CVE,CVSS:v.cvss||v.CVSS,Exploit:String(v.exploitable),Age:v.age_days||v.Age,Owner:v.owner||v.Owner,Status:v.status||v.Status,Risk:v.risk||v.Risk||''})));
    makeSortable('#vulnTable');
  }
  const comp=await getData('/compliance','compliance');
  if(comp){
    const by={}; comp.forEach(r=>{(by[r.framework] ||= []).push(+r.score)});
    const labs=Object.keys(by), vals=labs.map(f=>Math.round((by[f].reduce((a,b)=>a+b,0)/by[f].length)*100));
    drawBars(document.getElementById('compChart'), labs, vals);
  }
  const patch=await getData('/patch/coverage','patch_coverage');
  if(patch){
    const labs=patch.map(r=>r.month), vals=patch.map(r=>Math.round(+r.coverage*100));
    drawBars(document.getElementById('patchChart'), labs.slice(-6), vals.slice(-6));
  }
  const tp=await getData('/thirdparty','thirdparty');
  if(tp){ fillTable('#tpTable', tp.map(r=>({Vendor:r.vendor,Tier:r.tier,Risk:r.risk_score,Open:r.issues_open,SLA:r.sla_breaches,Assessed:r.last_assessed}))); makeSortable('#tpTable'); }
  const siem=await getData('/alerts/top','alerts_top');
  if(siem){ fillTable('#siemTable', siem.map(r=>({Rule:r.rule,"24h":r.last_24h,"7d":r.last_7d,Criticality:r.criticality}))); makeSortable('#siemTable'); }
  const risks=await getData('/risk/register','risk_register');
  if(risks){ fillTable('#riskTable', risks.slice(0,10).map(r=>({ID:r.risk_id,Title:r.title,Owner:r.owner,Likelihood:r.likelihood,Impact:r.impact,Score:r.score,Status:r.status,"Target":r.target_date}))); makeSortable('#riskTable'); }
}
function fillTable(sel, rows){
  const tb=document.querySelector(sel+' tbody'); tb.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    Object.values(r).forEach(v=>{const td=document.createElement('td'); td.textContent=v; tr.appendChild(td)});
    tb.appendChild(tr);
  });
}

// Redraw charts on resize
function throttle(fn,wait){let last=0; return(...a)=>{const n=Date.now(); if(n-last>wait){last=n; fn(...a)}} }
function redraw(){ if(!_incData) return; drawLine(document.getElementById('incChart'), _incData.map(d=>({x:d.date,y:+d.incidents}))); }

document.addEventListener('DOMContentLoaded', ()=>{
  setMode(MODE);

  // Mode toggle
  modeBtn() && modeBtn().addEventListener('click', ()=>{ setMode(MODE==='live'?'demo':'live'); render(); });

  // Burger toggle: desktop collapse + mobile dropdown (<=900px)
  if(menuBtn()){
    menuBtn().addEventListener('click', ()=>{
      const n=navEl(); const isMobile=window.innerWidth<=900;
      if(isMobile){
        const open=n.classList.toggle('open');
        n.classList.remove('collapsed');
        menuBtn().setAttribute('aria-expanded', String(open));
      }else{
        const collapsed=n.classList.toggle('collapsed');
        n.classList.remove('open');
        menuBtn().setAttribute('aria-expanded', String(!collapsed));
      }
    });
  }

  // Close mobile menu after clicking a link
  document.querySelectorAll('#nav .links a').forEach(a=> a.addEventListener('click', ()=>{
    const n=navEl();
    if(n.classList.contains('open')){
      n.classList.remove('open');
      menuBtn() && menuBtn().setAttribute('aria-expanded','false');
    }
  }));

  // Reset incompatible states on resize
  window.addEventListener('resize', throttle(()=>{
    const n=navEl(); const isMobile=window.innerWidth<=900;
    if(isMobile){ n.classList.remove('collapsed'); } else { n.classList.remove('open'); }
    redraw();
  },200));

  render();
});
