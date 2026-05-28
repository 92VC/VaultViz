/* ============================================================
   VaultViz — Tweaks panel (vanilla host protocol)
   ============================================================ */
(function(){
  const root=document.documentElement;
  const state=Object.assign({theme:'dark',accent:'blue',cards:'shadows',density:'default',viz:'sequential'},window.__TWEAKS||{});

  function apply(){
    root.setAttribute('data-theme',state.theme);
    if(state.accent&&state.accent!=='blue')root.setAttribute('data-accent',state.accent);else root.removeAttribute('data-accent');
    root.setAttribute('data-cards',state.cards);
    root.setAttribute('data-density',state.density);
    root.setAttribute('data-viz',state.viz);
  }
  apply();

  window.__setTweak=function(edits){
    Object.assign(state,edits);apply();
    if(window.VVApp){ if('density'in edits||'cards'in edits)window.VVApp.repaint(); else window.VVApp.repaintMap(); }
    try{window.parent.postMessage({type:'__edit_mode_set_keys',edits},'*');}catch(e){}
    syncUI();
  };

  /* ---------- panel ---------- */
  function seg(key,opts){
    return `<div class="seg" data-key="${key}">`+opts.map(([v,l])=>`<button data-v="${v}" class="${state[key]===v?'on':''}">${l}</button>`).join('')+`</div>`;
  }
  function buildPanel(){
    const p=document.getElementById('tweaks');
    p.innerHTML=`
      <div class="tw-head" id="tw-drag">
        <div class="tw-t"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h10M3 8h10M3 11h10" stroke-linecap="round"/></svg> Tweaks</div>
        <button class="tw-x" id="tw-close"><svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button>
      </div>
      <div class="tw-body">
        <div class="tw-sec"><div class="tw-lbl">Thème</div>${seg('theme',[['dark','Sombre'],['light','Clair']])}</div>
        <div class="tw-sec"><div class="tw-lbl">Couleur d’accent</div>
          <div class="swatches" data-key="accent">
            ${[['blue','#0066FF'],['indigo','#5b6bff'],['teal','#00a892'],['violet','#7c5cff']].map(([v,c])=>`<button class="swatch ${state.accent===v?'on':''}" data-v="${v}" style="background:${c}"></button>`).join('')}
          </div></div>
        <div class="tw-sec"><div class="tw-lbl">Style des cards</div>${seg('cards',[['borders','Bordures'],['shadows','Ombres'],['elevated','Élévation']])}</div>
        <div class="tw-sec"><div class="tw-lbl">Palette data-viz</div>${seg('viz',[['sequential','Séquentielle'],['categorical','Catégorielle']])}</div>
        <div class="tw-sec"><div class="tw-lbl">Densité</div>${seg('density',[['compact','Compacte'],['default','Standard'],['comfort','Confort']])}</div>
      </div>`;
    p.querySelectorAll('.seg').forEach(s=>{const key=s.dataset.key;
      s.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>window.__setTweak({[key]:b.dataset.v})));});
    p.querySelectorAll('.swatches button').forEach(b=>b.addEventListener('click',()=>window.__setTweak({accent:b.dataset.v})));
    document.getElementById('tw-close').addEventListener('click',()=>{hide();try{window.parent.postMessage({type:'__edit_mode_dismissed'},'*');}catch(e){}});
    dragify(document.getElementById('tw-drag'),p);
  }
  function syncUI(){
    const p=document.getElementById('tweaks');if(!p)return;
    p.querySelectorAll('.seg').forEach(s=>{const k=s.dataset.key;s.querySelectorAll('button').forEach(b=>b.classList.toggle('on',state[k]===b.dataset.v));});
    p.querySelectorAll('.swatches button').forEach(b=>b.classList.toggle('on',state.accent===b.dataset.v));
    const tb=document.getElementById('btn-theme');
  }
  function dragify(handle,panel){
    let sx,sy,ox,oy,drag=false;
    handle.addEventListener('mousedown',e=>{if(e.target.closest('.tw-x'))return;drag=true;sx=e.clientX;sy=e.clientY;
      const r=panel.getBoundingClientRect();ox=r.left;oy=r.top;panel.style.right='auto';document.body.style.userSelect='none';});
    window.addEventListener('mousemove',e=>{if(!drag)return;panel.style.left=(ox+e.clientX-sx)+'px';panel.style.top=(oy+e.clientY-sy)+'px';});
    window.addEventListener('mouseup',()=>{drag=false;document.body.style.userSelect='';});
  }
  function show(){document.getElementById('tweaks').classList.add('on');}
  function hide(){document.getElementById('tweaks').classList.remove('on');}

  // protocol: listener BEFORE announce
  window.addEventListener('message',e=>{const t=e.data&&e.data.type;
    if(t==='__activate_edit_mode')show();else if(t==='__deactivate_edit_mode')hide();});
  buildPanel();
  try{window.parent.postMessage({type:'__edit_mode_available'},'*');}catch(e){}
})();
