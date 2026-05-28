/* ============================================================
   VaultViz — application logic
   ============================================================ */
(function(){
  const VV = window.VVIZ, MAP = window.FRANCE_MAP;
  const $ = s=>document.querySelector(s);
  const $$ = s=>[...document.querySelectorAll(s)];
  const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};

  /* ---------- state ---------- */
  const S = {
    view:'home',           // home | dashboard | error
    selected:null,         // dept code
    sortKey:'ca', sortDir:-1,
    search:'',
    metric:'ca'            // ca | marge | ecart
  };

  /* ---------- formatters ---------- */
  const nf = new Intl.NumberFormat('fr-FR');
  function eurC(n){const a=Math.abs(n);
    if(a>=1e6){const dd=a>=1e7?0:1;return (n/1e6).toLocaleString('fr-FR',{minimumFractionDigits:dd,maximumFractionDigits:dd})+' M€';}
    if(a>=1e3) return Math.round(n/1e3).toLocaleString('fr-FR')+' k€';
    return nf.format(Math.round(n))+' €';}
  function eurFull(n){return nf.format(Math.round(n))+' €';}
  const pct=(n,d=1)=>n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+' %';
  const signed=n=>(n>=0?'+':'')+n.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});

  /* ---------- color utils ---------- */
  function hex2rgb(h){h=h.trim().replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function mix(a,b,w){return a.map((v,i)=>Math.round(v+(b[i]-v)*w));}
  const rgb=a=>`rgb(${a[0]},${a[1]},${a[2]})`;
  function accentRGB(){return hex2rgb(getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#0066FF');}
  function isDark(){return document.documentElement.getAttribute('data-theme')!=='light';}
  function rampStops(){
    const A=accentRGB();
    if(isDark()){const bg=[10,13,18],wt=[255,255,255];return [mix(A,bg,.86),mix(A,bg,.52),A,mix(A,wt,.22)];}
    const wt=[255,255,255];return [mix(A,wt,.88),mix(A,wt,.52),A,mix(A,[0,0,0],.14)];
  }
  function ramp(t,stops){t=Math.max(0,Math.min(1,t));const seg=(stops.length-1)*t;const i=Math.min(stops.length-2,Math.floor(seg));return rgb(mix(stops[i],stops[i+1],seg-i));}
  const REGION_HUES=['#0066FF','#13a98f','#e0903a','#9061f0','#e5556b','#27a8d4','#7cae3a','#d56fa3','#5a78d6','#c0813a','#3ab27f','#b25bd6','#6a7787'];
  function regionColor(region){const i=VV.regionList.indexOf(region);return REGION_HUES[(i+13)%13];}

  /* ---------- aggregation (cross-filter) ---------- */
  function agg(){
    const sel = S.selected ? VV.departements.find(d=>d.code===S.selected) : null;
    if(sel){
      return {ca:sel.ca,marge:sel.margePct,budget:sel.budget,realise:sel.realise,ecart:sel.ecart,
        ecartPct:sel.ecartPct,yoyCa:sel.yoyCa,yoyMarge:sel.yoyMarge,cats:sel.cats,
        quarters:sel.quarters,count:1,sel};
    }
    const D=VV.departements;
    const ca=D.reduce((s,d)=>s+d.ca,0), budget=D.reduce((s,d)=>s+d.budget,0), realise=D.reduce((s,d)=>s+d.realise,0);
    const marge=+(D.reduce((s,d)=>s+d.margePct*d.ca,0)/ca).toFixed(1);
    const yoyCa=+(D.reduce((s,d)=>s+d.yoyCa*d.ca,0)/ca).toFixed(1);
    const yoyMarge=+(D.reduce((s,d)=>s+d.yoyMarge*d.ca,0)/ca).toFixed(1);
    const cats={}; VV.categories.forEach(c=>cats[c]=D.reduce((s,d)=>s+d.cats[c],0));
    const quarters=['T1','T2','T3','T4'].map((t,i)=>({t,
      realise:D.reduce((s,d)=>s+d.quarters[i].realise,0),
      budget:D.reduce((s,d)=>s+d.quarters[i].budget,0)}));
    return {ca,budget,realise,ecart:realise-budget,ecartPct:+(((realise-budget)/budget)*100).toFixed(1),
      marge,yoyCa,yoyMarge,cats,quarters,count:D.length,sel:null};
  }

  /* ============================================================ DASHBOARD RENDER ============================================================ */
  function deltaEl(v,suffix='%'){
    const cls=v>0.05?'up':v<-0.05?'down':'flat';
    const ico=cls==='up'?'M3 9l4-4 4 4':cls==='down'?'M3 5l4 4 4-4':'M3 7h8';
    return `<span class="delta ${cls}"><svg viewBox="0 0 14 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ico}"/></svg>${signed(v)}${suffix}</span>`;
  }
  function renderKPIs(a){
    const okCount=VV.departements.filter(d=>d.statut==='Atteint').length;
    const couv=+((a.realise/a.budget)*100).toFixed(1);
    const cards=[
      {label:S.selected?'CA réalisé':'CA réalisé · total',val:eurC(a.ca),ico:icon('euro'),delta:deltaEl(a.yoyCa),foot:'vs 2024'},
      {label:'Marge brute',val:pct(a.marge),ico:icon('margin'),delta:deltaEl(a.yoyMarge,' pt'),foot:'moy. pondérée'},
      {label:'Écart au budget',val:eurC(a.ecart),unit:'',ico:icon('target'),
        foot:`${signed(a.ecartPct)} % vs budget`,deltaSign:a.ecart},
      S.selected
        ? {label:'Couverture budget',val:pct(couv,1),ico:icon('gauge'),foot:a.sel.region}
        : {label:'Départements à l’objectif',val:okCount,unit:`/ ${VV.departements.length}`,ico:icon('check'),foot:'à l’objectif'}
    ];
    $('#kpis').innerHTML = cards.map(c=>`
      <div class="card kpi">
        <div class="k-top"><div class="k-label">${c.label}</div><div class="k-ico">${c.ico}</div></div>
        <div class="k-val">${c.val}${c.unit?`<span class="u">${c.unit}</span>`:''}</div>
        <div class="k-foot">${c.delta?c.delta:(c.deltaSign!=null?`<span class="delta ${c.deltaSign>=0?'up':'down'}">${c.deltaSign>=0?'▲':'▼'}</span>`:'')}<span>${c.foot}</span></div>
      </div>`).join('');
  }

  /* ----- map ----- */
  let mapPaths={};
  function metricVal(d){return S.metric==='ca'?d.ca:S.metric==='marge'?d.margePct:d.ecartPct;}
  function buildMap(){
    const svg=$('#map-svg'); svg.setAttribute('viewBox',`0 0 ${MAP.w} ${MAP.h}`);
    let h=''; VV.departements.forEach(d=>{h+=`<path class="dept" data-code="${d.code}" d="${d.d}"></path>`;});
    svg.innerHTML=h; mapPaths={};
    $$('#map-svg .dept').forEach(p=>{
      const code=p.getAttribute('data-code'); mapPaths[code]=p;
      p.addEventListener('click',e=>{e.stopPropagation();toggleSelect(code);});
      p.addEventListener('mousemove',e=>showTip(e,code));
      p.addEventListener('mouseleave',hideTip);
    });
    svg.addEventListener('click',()=>{if(S.selected)setSelect(null);});
    paintMap();
  }
  function paintMap(){
    const palette=document.documentElement.getAttribute('data-viz')||'sequential';
    const wrap=$('#map-wrap'); wrap.classList.toggle('has-sel',!!S.selected);
    if(palette==='categorical'){
      VV.departements.forEach(d=>{mapPaths[d.code].setAttribute('fill',regionColor(d.region));});
    }else{
      const stops=rampStops();
      const vals=VV.departements.map(metricVal);
      let lo=Math.min(...vals),hi=Math.max(...vals);
      const tr = S.metric==='ca' ? (v=>Math.sqrt(v)) : (v=>v);
      const tl=tr(lo<0?0:lo), th=tr(hi);
      VV.departements.forEach(d=>{
        const v=metricVal(d); const t=(tr(Math.max(v,lo))-tl)/((th-tl)||1);
        mapPaths[d.code].setAttribute('fill',ramp(t,stops));
      });
    }
    $$('#map-svg .dept').forEach(p=>p.classList.toggle('sel',p.getAttribute('data-code')===S.selected));
    renderMapLegend();
  }
  function renderMapLegend(){
    const palette=document.documentElement.getAttribute('data-viz')||'sequential';
    const box=$('#map-legend');
    if(palette==='categorical'){
      box.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:5px 12px">`+
        VV.regionList.map(r=>`<span style="display:inline-flex;align-items:center;gap:5px" class="scale-lab"><span style="width:9px;height:9px;border-radius:3px;background:${regionColor(r)}"></span>${r}</span>`).join('')+`</div>`;
      return;
    }
    const stops=rampStops();
    const vals=VV.departements.map(metricVal);
    const lo=Math.min(...vals),hi=Math.max(...vals);
    const grad=`linear-gradient(90deg, ${ramp(0,stops)}, ${ramp(.5,stops)}, ${ramp(1,stops)})`;
    const fmt=S.metric==='ca'?eurC:(v=>pct(v));
    box.innerHTML=`<span class="scale-lab">${fmt(lo)}</span><span class="scale-bar" style="background:${grad}"></span><span class="scale-lab">${fmt(hi)}</span>`;
  }
  let tip;
  function showTip(e,code){
    const d=VV.departements.find(x=>x.code===code); if(!tip)tip=$('#maptip');
    tip.innerHTML=`<div class="mt-name">${d.nom}<span class="mt-code">${d.code}</span></div>
      <div class="mt-row"><span>CA</span><b>${eurC(d.ca)}</b></div>
      <div class="mt-row"><span>Marge</span><b>${pct(d.margePct)}</b></div>
      <div class="mt-row"><span>Écart budget</span><b class="${d.ecart>=0?'ecart-pos':'ecart-neg'}">${signed(d.ecartPct)} %</b></div>`;
    const wrap=$('#map-wrap').getBoundingClientRect();
    let x=e.clientX-wrap.left+14, y=e.clientY-wrap.top+14;
    if(x+170>wrap.width)x=e.clientX-wrap.left-170; 
    tip.style.left=x+'px'; tip.style.top=y+'px'; tip.classList.add('on');
  }
  function hideTip(){if(tip)tip.classList.remove('on');}

  /* ----- category bars ----- */
  function renderCats(a){
    const max=Math.max(...Object.values(a.cats));
    const palette=document.documentElement.getAttribute('data-viz')||'sequential';
    const stops=rampStops();
    const entries=VV.categories.map(c=>[c,a.cats[c]]).sort((x,y)=>y[1]-x[1]);
    $('#cat-bars').innerHTML=entries.map(([c,v],i)=>{
      const w=(v/max*100).toFixed(1);
      const col = palette==='categorical'?REGION_HUES[i]:ramp(1-i*0.16,stops);
      return `<div class="bar-row"><div class="b-lab"><span class="sw" style="background:${col}"></span>${c}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${col}"></div></div>
        <div class="b-val">${eurC(v)}</div></div>`;
    }).join('');
  }

  /* ----- budget vs réalisé (trimestres) ----- */
  function renderQuarters(a){
    const max=Math.max(...a.quarters.flatMap(q=>[q.budget,q.realise]));
    $('#qbars').innerHTML=a.quarters.map(q=>`
      <div class="qgroup">
        <div class="qpair">
          <div class="qbar budget" style="height:${(q.budget/max*100).toFixed(1)}%" title="Budget ${eurC(q.budget)}"></div>
          <div class="qbar realise" style="height:${(q.realise/max*100).toFixed(1)}%" title="Réalisé ${eurC(q.realise)}"></div>
        </div>
        <div class="qlab">${q.t}</div>
      </div>`).join('');
  }

  /* ----- virtualized table ----- */
  const COLS = '208px repeat(5, minmax(0,1fr)) 132px';
  function rowsData(){
    let r=VV.departements.slice();
    if(S.search){const q=S.search.toLowerCase();r=r.filter(d=>d.nom.toLowerCase().includes(q)||d.code.toLowerCase().includes(q)||d.region.toLowerCase().includes(q));}
    const k=S.sortKey;
    r.sort((a,b)=>{let x=a[k],y=b[k];if(k==='nom'||k==='code'){return String(x).localeCompare(String(y))*S.sortDir;}return (x-y)*S.sortDir;});
    return r;
  }
  let vtRows=[];
  function rowHpx(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-h'))||36;}
  function buildTableHead(){
    const cols=[['code','Département',''],['ca','CA','num'],['margePct','Marge','num'],['realise','Réalisé','num'],['budget','Budget','num'],['ecartPct','Écart','num'],['statut','Statut','']];
    const head=$('#vt-head'); head.style.gridTemplateColumns=COLS;
    head.innerHTML=cols.map(([k,lab,cls])=>`<div class="th ${cls} ${S.sortKey===k?'active':''}" data-k="${k}">${lab}
      <span class="sort">${S.sortKey===k?(S.sortDir<0?'↓':'↑'):'↕'}</span></div>`).join('');
    $$('#vt-head .th').forEach(th=>th.addEventListener('click',()=>{
      const k=th.getAttribute('data-k');
      if(S.sortKey===k)S.sortDir*=-1;else{S.sortKey=k;S.sortDir=(k==='nom'||k==='code')?1:-1;}
      buildTableHead();renderTableWindow();
    }));
  }
  function statutCls(s){return s==='Atteint'?'ok':s==='À risque'?'warn':'err';}
  function renderTable(){
    vtRows=rowsData();
    $('#tbl-count').innerHTML=`<b>${vtRows.length}</b> ${vtRows.length>1?'départements':'département'}${S.search?' · filtré':''}`;
    const sizer=$('#vt-sizer'); sizer.style.height=(vtRows.length*rowHpx())+'px';
    renderTableWindow();
  }
  function renderTableWindow(){
    const sc=$('#vt-scroll'), rh=rowHpx(), over=6;
    const start=Math.max(0,Math.floor(sc.scrollTop/rh)-over);
    const end=Math.min(vtRows.length,Math.ceil((sc.scrollTop+sc.clientHeight)/rh)+over);
    const cont=$('#vt-rows'); cont.style.transform=`translateY(${start*rh}px)`;
    let h='';
    for(let i=start;i<end;i++){const d=vtRows[i];
      h+=`<div class="vt-row ${d.code===S.selected?'sel':''}" data-code="${d.code}" style="grid-template-columns:${COLS}">
        <div class="td"><span class="dcode">${d.code}</span>${d.nom}</div>
        <div class="td num">${eurC(d.ca)}</div>
        <div class="td num">${pct(d.margePct)}</div>
        <div class="td num">${eurC(d.realise)}</div>
        <div class="td num" style="color:var(--text-3)">${eurC(d.budget)}</div>
        <div class="td num ${d.ecart>=0?'ecart-pos':'ecart-neg'}">${signed(d.ecartPct)} %</div>
        <div class="td"><span class="badge ${statutCls(d.statut)}"><span class="bd"></span>${d.statut}</span></div>
      </div>`;
    }
    cont.innerHTML=h;
    cont.querySelectorAll('.vt-row').forEach(r=>r.addEventListener('click',()=>toggleSelect(r.getAttribute('data-code'))));
  }
  function scrollTableTo(code){
    const idx=vtRows.findIndex(d=>d.code===code); if(idx<0)return;
    const sc=$('#vt-scroll'),rh=rowHpx(),y=idx*rh;
    if(y<sc.scrollTop||y>sc.scrollTop+sc.clientHeight-rh){sc.scrollTop=Math.max(0,y-sc.clientHeight/2+rh);}
  }

  /* ---------- selection / cross-filter ---------- */
  function toggleSelect(code){setSelect(S.selected===code?null:code);}
  function setSelect(code){
    S.selected=code;
    renderDashboard();
    if(code)scrollTableTo(code);
    $('#filter-chip').classList.toggle('on',!!code);
    if(code){const d=VV.departements.find(x=>x.code===code);
      $('#filter-chip-txt').innerHTML=`${d.nom} <span class="mono">${d.code}</span>`;}
  }

  function renderDashboard(){
    const a=agg();
    renderKPIs(a); renderCats(a); renderQuarters(a); paintMap(); renderTable();
  }

  /* ============================================================ VIEW ROUTER + FLOWS ============================================================ */
  function setStatus(s){
    const map={ready:['Prêt','ready'],loading:['Chargement','loading'],error:['Erreur de validation','error']};
    const [txt,st]=map[s];const e=$('#status');e.dataset.s=st;e.querySelector('.s-txt').textContent=txt;
  }
  function showHome(){
    S.view='home';S.selected=null;
    $('#home').style.display='flex';$('#dashboard').style.display='none';$('#errbar').classList.remove('on');
    $('#tabs').innerHTML='<div class="tab"><span style="color:var(--text-3)">Accueil</span></div>';
    $('#path-wrap').style.display='none';
    setStatus('ready');$('#status').style.visibility='hidden';
    $('#filter-chip').classList.remove('on');
  }
  function openDialog(){$('#overlay').classList.add('on');$('#dialog').style.display='block';$('#loader').style.display='none';}
  function closeOverlay(){$('#overlay').classList.remove('on');}
  function runLoading(name,size,then){
    $('#dialog').style.display='none';$('#loader').style.display='flex';$('#overlay').classList.add('on');
    $('#l-name').textContent=name;$('#l-sz').textContent=size||'';
    setStatus('loading');$('#status').style.visibility='visible';
    const steps=['Lecture du fichier…','Parsing JSON…','Validation du schéma vviz/1.2…','Indexation des 96 entités…','Rendu des vues…'];
    let p=0,si=0;$('#l-bar').style.width='0%';
    const tick=setInterval(()=>{
      p+=8+Math.random()*14; if(p>100)p=100;
      $('#l-bar').style.width=p+'%';
      const ns=Math.min(steps.length-1,Math.floor(p/100*steps.length));
      if(ns!==si){si=ns;$('#l-steps').innerHTML=steps[si];}
      if(p>=100){clearInterval(tick);$('#l-steps').innerHTML='<b>✓ Dashboard prêt</b>';
        setTimeout(()=>{closeOverlay();then();},340);}
    },110);
  }
  function showDashboard(){
    S.view='dashboard';
    $('#home').style.display='none';$('#dashboard').style.display='flex';$('#errbar').classList.remove('on');
    $('#dashboard').querySelectorAll('.card,.dash-head').forEach(n=>n.style.display='');
    setStatus('ready');$('#status').style.visibility='visible';
    // tab + path
    $('#tabs').innerHTML=`<div class="tab active"><span class="dot"></span><span class="t-name">${VV.meta.name}</span><span class="t-close" title="Fermer">${x()}</span></div><button class="tab-add" title="Nouvel onglet (V2)">${plus()}</button>`;
    $('#tabs .t-close').addEventListener('click',e=>{e.stopPropagation();showHome();});
    $('#path-wrap').style.display='flex';
    $('#path').innerHTML=VV.meta.path.map((seg,i)=>i===VV.meta.path.length-1
      ?`<span class="seg file">${seg}</span>`:`<span class="seg">${seg}</span><span class="sep">›</span>`).join('');
    $('#dash-title').textContent=VV.meta.title;
    $('#dash-desc').textContent=VV.meta.description;
    $('#dash-schema').textContent=VV.meta.schema;
    $('#dash-rows').textContent=VV.meta.rows+' entités';
    renderDashboard();
  }
  function showError(){
    S.view='error';
    $('#home').style.display='none';$('#dashboard').style.display='flex';
    // hide dashboard content, show only header skeleton + banner
    $('#dashboard').querySelectorAll('.kpis,.grid-2,.table-card,.dash-head').forEach(n=>n.style.display='none');
    $('#errbar').classList.add('on');
    setStatus('error');$('#status').style.visibility='visible';
    $('#tabs').innerHTML=`<div class="tab active"><span class="dot" style="background:var(--err)"></span><span class="t-name">clients-grands-comptes.vviz</span><span class="t-close">${x()}</span></div>`;
    $('#tabs .t-close').addEventListener('click',e=>{e.stopPropagation();showHome();});
    $('#path-wrap').style.display='flex';
    $('#path').innerHTML=['C:','Users','m.faure','Downloads','clients-grands-comptes.vviz']
      .map((seg,i,arr)=>i===arr.length-1?`<span class="seg file" style="color:var(--err)">${seg}</span>`:`<span class="seg">${seg}</span><span class="sep">›</span>`).join('');
  }

  /* ---------- icons ---------- */
  function icon(n){const p={
    euro:'<path d="M14 5.5A4.5 4.5 0 0 0 6.2 9M14 12.5A4.5 4.5 0 0 1 6.2 9M4 8h7M4 10.5h6"/>',
    margin:'<path d="M3 13l4-5 3 3 4-6"/><path d="M3 3v11h12"/>',
    target:'<circle cx="9" cy="9" r="6"/><circle cx="9" cy="9" r="2.5"/>',
    gauge:'<path d="M3.5 13a6 6 0 1 1 11 0"/><path d="M9 9l3-2"/>',
    check:'<path d="M3 9.5l3.5 3.5L15 5"/>'
  }[n];return `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;}
  function x(){return '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>';}
  function plus(){return '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3v8M3 7h8"/></svg>';}

  /* ============================================================ WIRING ============================================================ */
  function buildRecents(){
    const list=$('#recent-list');
    list.innerHTML=window.RECENTS.map((r,i)=>`
      <button class="recent ${r.broken?'broken':''}" data-i="${i}">
        <span class="ricon">${r.broken?icon('target').replace('1.5','1.6'):fileIcon()}</span>
        <span class="rmeta"><span class="rname">${r.name}</span><span class="rpath">${r.path}</span></span>
        <span class="rright">${r.broken?'<span class="rbadge">⚠ Schéma invalide</span>':`<span class="rtime">${r.time}</span>`}<span class="rsize">${r.size}</span></span>
      </button>`).join('');
    $$('#recent-list .recent').forEach(b=>b.addEventListener('click',()=>{
      const r=window.RECENTS[+b.getAttribute('data-i')];
      if(r.broken){runLoading(r.name,'—',showError);}else{runLoading(r.name,r.size,showDashboard);}
    }));
  }
  function fileIcon(){return '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h5l3 3v11H5z"/><path d="M10 2v3h3"/><path d="M7 9h4M7 11.5h4"/></svg>';}

  function wire(){
    // home CTA + dropzone
    $('#btn-open-home').addEventListener('click',openDialog);
    $('#btn-open-tb').addEventListener('click',openDialog);
    const dz=$('#dropzone');
    dz.addEventListener('click',openDialog);
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('hot');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('hot');}));
    dz.addEventListener('drop',()=>runLoading(VV.meta.name,VV.meta.size,showDashboard));
    $('#clear-recents').addEventListener('click',()=>{$('#recent-list').style.display='none';$('#empty-recents').style.display='block';});
    // dialog
    $('#dlg-cancel').addEventListener('click',closeOverlay);
    $('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay')&&$('#dialog').style.display!=='none')closeOverlay();});
    $$('#dlg-files .dfile').forEach(f=>f.addEventListener('click',()=>{
      $$('#dlg-files .dfile').forEach(x=>x.classList.remove('sel'));f.classList.add('sel');
      $('#dlg-fname').value=f.dataset.name||'';
    }));
    $('#dlg-open').addEventListener('click',()=>{
      const sel=$('#dlg-files .dfile.sel'); const nm=sel?.dataset.name||VV.meta.name;
      const broken=sel?.dataset.broken==='1';
      runLoading(nm,sel?.dataset.size||VV.meta.size,broken?showError:showDashboard);
    });
    // table search
    $('#tbl-search').addEventListener('input',e=>{S.search=e.target.value;renderTable();});
    $('#vt-scroll').addEventListener('scroll',renderTableWindow);
    // filter chip clear
    $('#filter-chip .x').addEventListener('click',()=>setSelect(null));
    // metric segmented
    $$('#metric-seg button').forEach(b=>b.addEventListener('click',()=>{
      $$('#metric-seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
      S.metric=b.dataset.m;
      if((document.documentElement.getAttribute('data-viz')||'sequential')==='sequential'){paintMap();}
      else renderMapLegend();
    }));
    // toolbar actions
    $('#btn-theme').addEventListener('click',toggleTheme);
    $('#btn-retry').addEventListener('click',()=>runLoading(VV.meta.name,VV.meta.size,showDashboard));
    $('#btn-err-home').addEventListener('click',showHome);
    // prototype state switcher
    $('#proto-toggle').addEventListener('click',()=>$('#proto-menu').classList.toggle('on'));
    $$('#proto-menu button').forEach(b=>b.addEventListener('click',()=>{
      $('#proto-menu').classList.remove('on');
      const st=b.dataset.st; closeOverlay();
      if(st==='home')showHome();else if(st==='dialog'){showHome();openDialog();}
      else if(st==='loading'){showHome();runLoading(VV.meta.name,VV.meta.size,showDashboard);}
      else if(st==='dashboard')showDashboard();else if(st==='error')showError();
    }));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeOverlay();$('#proto-menu').classList.remove('on');}});
  }

  function toggleTheme(){
    const cur=document.documentElement.getAttribute('data-theme');
    const nt=cur==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',nt);
    $('#btn-theme').innerHTML=themeIcon(nt);
    if(S.view==='dashboard')paintMap();
    if(window.__setTweak)window.__setTweak({theme:nt});
  }
  function themeIcon(t){return t==='light'
    ? '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="9" r="3.4"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4"/></svg>'
    : '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10.5A6.2 6.2 0 0 1 7.5 3a6.2 6.2 0 1 0 7.5 7.5z"/></svg>';}

  /* ---------- boot ---------- */
  window.VVApp = {
    boot(){
      buildMap();buildTableHead();buildRecents();wire();
      $('#btn-theme').innerHTML=themeIcon(document.documentElement.getAttribute('data-theme'));
      showHome();
    },
    repaint(){ if(S.view==='dashboard'){buildTableHead();renderDashboard();} },
    repaintMap(){ if(S.view==='dashboard')paintMap(); }
  };
})();
