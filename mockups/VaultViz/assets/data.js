/* ============================================================
   VaultViz — jeu de données (contrôle de gestion)
   Données simulées déterministes (seed par code dép.)
   ============================================================ */
(function(){
  // dept -> region
  const REGIONS = {
    "Auvergne-Rhône-Alpes":["01","03","07","15","26","38","42","43","63","69","73","74"],
    "Bourgogne-Franche-Comté":["21","25","39","58","70","71","89","90"],
    "Bretagne":["22","29","35","56"],
    "Centre-Val de Loire":["18","28","36","37","41","45"],
    "Corse":["2A","2B"],
    "Grand Est":["08","10","51","52","54","55","57","67","68","88"],
    "Hauts-de-France":["02","59","60","62","80"],
    "Île-de-France":["75","77","78","91","92","93","94","95"],
    "Normandie":["14","27","50","61","76"],
    "Nouvelle-Aquitaine":["16","17","19","23","24","33","40","47","64","79","86","87"],
    "Occitanie":["09","11","12","30","31","32","34","46","48","65","66","81","82"],
    "Pays de la Loire":["44","49","53","72","85"],
    "Provence-Alpes-Côte d'Azur":["04","05","06","13","83","84"]
  };
  const REGION_OF = {};
  Object.entries(REGIONS).forEach(([r,arr])=>arr.forEach(c=>REGION_OF[c]=r));

  // grands pôles économiques -> poids de CA plus élevé
  const WEIGHT = {"75":10,"92":6.4,"69":5.2,"13":4.6,"59":4.4,"33":3.6,"31":3.5,"44":3.1,"06":3.0,
    "78":2.9,"38":2.8,"67":2.6,"93":2.5,"94":2.4,"91":2.2,"77":2.1,"34":2.0,"35":1.9,"95":1.9,"76":1.8,
    "83":1.8,"62":1.7,"68":1.5,"74":1.6,"57":1.5,"60":1.4,"63":1.3,"21":1.3,"49":1.3,"30":1.2,"42":1.2};

  function mulberry(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

  const CATS = ["Logiciel","Services","Matériel","Formation","Support"];
  const CAT_BASE = [0.42,0.27,0.16,0.09,0.06];

  const M = window.FRANCE_MAP;
  const departements = M.departements.map(d=>{
    const num = parseInt(d.code.replace(/\D/g,''),10) + (d.code.includes('A')?100:d.code.includes('B')?200:0);
    const rnd = mulberry(num*97+13);
    const w = WEIGHT[d.code] || (0.25 + rnd()*1.05);
    const ca = Math.round((w * 1_180_000) * (0.82 + rnd()*0.4));
    const margePct = +(9 + rnd()*23).toFixed(1);
    // budget vs réalisé : réalisé = ca, budget proche
    const realise = ca;
    const budget = Math.round(ca / (0.90 + rnd()*0.22));
    const ecart = realise - budget;
    const ecartPct = +((ecart/budget)*100).toFixed(1);
    const statut = ecartPct >= 1.5 ? "Atteint" : ecartPct >= -4 ? "À risque" : "Sous-objectif";
    const yoyCa = +(((rnd()-0.32)*26)).toFixed(1);
    const yoyMarge = +(((rnd()-0.45)*7)).toFixed(1);
    // répartition catégories
    let raw = CAT_BASE.map(b=>b*(0.7+rnd()*0.6));
    const s = raw.reduce((a,b)=>a+b,0); raw = raw.map(x=>x/s);
    const cats = {}; CATS.forEach((c,i)=>cats[c]=Math.round(ca*raw[i]));
    // trimestres
    const qpat=[0.22,0.25,0.24,0.29];
    const quarters = qpat.map((p,i)=>{
      const rr=Math.round(realise*p*(0.92+rnd()*0.16));
      const bb=Math.round(budget*p*(0.95+rnd()*0.1));
      return {t:"T"+(i+1),realise:rr,budget:bb};
    });
    return {code:d.code,nom:d.nom,region:REGION_OF[d.code]||"—",
      ca,margePct,budget,realise,ecart,ecartPct,statut,yoyCa,yoyMarge,cats,quarters,
      cx:d.cx,cy:d.cy,d:d.d};
  });

  // ordre des régions (pour palette catégorielle)
  const regionList = Object.keys(REGIONS);

  window.VVIZ = {
    meta:{
      title:"Performance réseau France — Exercice 2025",
      description:"Chiffre d'affaires, marge et suivi budgétaire par département · 96 entités · clôture provisoire au 31/12",
      path:["C:","Users","m.faure","Documents","Reporting","perf-reseau-2025.vviz"],
      pathStr:"C:\\Users\\m.faure\\Documents\\Reporting\\perf-reseau-2025.vviz",
      name:"perf-reseau-2025.vviz",
      schema:"vviz/1.2",
      size:"284 Ko",
      rows:96
    },
    categories:CATS,
    regionList,
    departements
  };

  // fichiers récents (écran d'accueil)
  window.RECENTS = [
    {name:"perf-reseau-2025.vviz",path:"C:\\Users\\m.faure\\Documents\\Reporting",time:"il y a 2 min",size:"284 Ko",ok:true,primary:true},
    {name:"marge-par-canal-T4.vviz",path:"C:\\Users\\m.faure\\Documents\\Reporting",time:"hier, 17:42",size:"156 Ko",ok:true},
    {name:"budget-2026-previsionnel.vviz",path:"C:\\Users\\m.faure\\Documents\\Budget",time:"lun. 12 mai",size:"203 Ko",ok:true},
    {name:"effectifs-regions.vviz",path:"D:\\Partage\\Contrôle de gestion",time:"6 mai",size:"98 Ko",ok:true},
    {name:"clients-grands-comptes.vviz",path:"C:\\Users\\m.faure\\Downloads",time:"2 mai",size:"—",ok:false,broken:true}
  ];
})();
