// STARWROUGHT app runtime smoke test: boots the real built app script in a DOM shim,
// then drives every tab, every wizard step, and every Observatory view.
// Catches runtime errors (undefined vars, bad refs) that node --check cannot.
const fs=require("fs");
const src=fs.readFileSync(process.argv[2]||"/tmp/t.js","utf8");
const els={};
function el(id){ if(els[id]) return els[id];
  const e={ id, innerHTML:"", textContent:"", value:"", checked:false, style:{}, dataset:{}, offsetWidth:100, scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){}, remove(){}, focus(){}, blur(){}, click(){},
    querySelector(){return null}, querySelectorAll(){return []},
    getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100,width:100,height:100}},
    setAttribute(){}, getAttribute(){return null}, closest(){return null} };
  els[id]=e; return e; }
global.document={ getElementById:id=>el(id), querySelector:()=>null, querySelectorAll:()=>[],
  createElement:()=>el("tmp"+Math.random()), body:el("body"), documentElement:el("html"),
  addEventListener(){}, removeEventListener(){} };
global.window={ scrollY:0, scrollX:0, innerWidth:1600, innerHeight:900, scrollTo(){}, addEventListener(){}, removeEventListener(){},
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}), location:{hash:"",href:""} };
global.localStorage={_d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=String(v)}, removeItem(k){delete this._d[k]}};
global.window.localStorage=global.localStorage;
global.requestAnimationFrame=cb=>{try{cb()}catch(e){throw e}};
global.alert=()=>{}; global.prompt=()=>null; global.confirm=()=>true;
global.navigator={userAgent:"smoke", clipboard:{writeText:async()=>{}}};
global.fetch=async()=>({ok:false});
let fails=0;
const step=(name,fn)=>{ try{ fn(); console.log("PASS —",name); }catch(e){ fails++; console.log("FAIL —",name,"::",e.message); } };
const driver=`
;globalThis.__drive=function(step){
  step("boot render", ()=>render());
  step("wizard: all 9 steps", ()=>{ tab="wizard"; render();
    if(!wiz) throw new Error("wiz not initialized");
    for(let i=0;i<=8;i++){ wiz.step=i; render(); } wiz.step=0; });
  step("observatory: Firmament", ()=>{ tab="explorer"; eview={mode:0,cat:null}; render(); drawSky(); });
  step("observatory: every category sky", ()=>{ const cats=[...new Set(allTreeNames().map(t=>treeOf(t).category))];
    for(const c of cats){ eview={mode:1,cat:c}; render(); drawSky(); } });
  step("observatory: EVERY constellation", ()=>{ for(const tn of allTreeNames()){
    etree=tn; eview={mode:2,cat:treeOf(tn).category}; esel=null; render(); drawSky();
    const withSel=treeOf(tn).nodes[0]; if(withSel){ esel=withSel.name; drawSky(); } } });
  step("characters + sheet + wiki tabs", ()=>{ for(const tb of ["chars","characters","sheet","vsheet","wiki"]){
    try{ tab=tb; render(); }catch(e){ if(!/Unknown tab/.test(e.message)) throw new Error(tb+": "+e.message); } } });
  // Every wiki section, not just the bookmarked one: each is its own template string, and a
  // broken one (a bad reference inside the Actions tables, say) only throws when it renders.
  step("wiki: every section", ()=>{ tab="wiki"; render();
    const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    if(secs.length<5) throw new Error("wiki nav lists only "+secs.length+" sections");
    for(const s of secs){ wikiSec=s; try{ render(); }catch(e){ throw new Error("wiki '"+s+"': "+e.message); } }
    const actions=document.getElementById("main").innerHTML; wikiSec=secs[0];
    if(typeof A!=="undefined"&&A&&A.actions&&A.actions.length){ wikiSec="Actions"; render();
      const h=document.getElementById("main").innerHTML; wikiSec=secs[0];
      for(const a of A.actions){ if(!h.includes("<b>"+a.name+"</b>")) throw new Error("Actions wiki lacks sheet action "+a.name); } } });
  step("with Mira loaded: every view again", ()=>{
    if(typeof TORVA!=="undefined"&&typeof chars!=="undefined"){ if(!chars.some(c=>c.id===TORVA.id)) chars.push(JSON.parse(JSON.stringify(TORVA)));
      if(typeof cur!=="undefined") cur=chars.length-1; }
    for(const tb of ["chars","sheet","wiki"]){ try{ tab=tb; render(); }catch(e){ throw new Error(tb+": "+e.message); } }
    tab="explorer";
    for(const tn of allTreeNames()){ etree=tn; eview={mode:2,cat:treeOf(tn).category}; esel=null; render(); drawSky(); }
    tab="wizard"; for(let i=0;i<=8;i++){ wiz.step=i; render(); } });
};`;
try{ (0,eval)(src+driver); }catch(e){ console.log("FAIL — script boot ::", e.message); process.exit(1); }
(0,eval)("__drive")(step);
console.log(fails?("SMOKE FAILED: "+fails):"SMOKE CLEAN");
process.exit(fails?1:0);
