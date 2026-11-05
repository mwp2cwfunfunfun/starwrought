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
  const must=(cond,msg)=>{ if(!cond) throw new Error(msg); };
  step("boot render", ()=>render());
  step("wizard: all 9 steps", ()=>{ tab="wizard"; render();
    if(!wiz) throw new Error("wiz not initialized");
    for(let i=0;i<=8;i++){ wiz.step=i; render(); } wiz.step=0; });
  // PHB v4.21 chargen: three Origin roots granted by the choices, the first Calling's combat training (Melee or
  // Ranged for a martial Calling, a discipline for a caster) picked on the Calling step, eleven placed points.
  step("wizard: v4.21 pools", ()=>{ tab="wizard"; render();
    must(!stepGate(0), "step 0 is an introduction and gates on nothing");
    must(combatOptions("Ambusher").join()==="Melee,Ranged", "a martial Calling opens Melee or Ranged, found "+combatOptions("Ambusher").join());
    const mg=combatOptions("Spellshaper"); must(mg.length===5&&mg.includes("Elementalism")&&!mg.includes("Melee"), "a caster opens one of the five disciplines, found "+mg.join());
    must(needsMartialToo("Spellblade")&&!needsMartialToo("Spellshaper"), "Spellblade's Special asks for Melee or Ranged as well");
    wiz.picks.calName="Ambusher"; render();
    const P=pools(), def=P.find(x=>x.step===6), com=P.find(x=>x.step===7), cb=P.find(x=>x.label==="Combat training");
    must(def&&def.need===2, "two Defense Talent Points, found "+(def&&def.need));
    must(com&&com.need===3, "three Comets");
    must(cb&&cb.step===5&&cb.need===1&&cb.spent===0, "the Calling step carries the combat training, unspent");
    must(saveBlockers().some(b=>/combat training/.test(b.msg)), "the save waits on the combat pick");
    wiz.picks.combat="Melee"; must(pools().find(x=>x.label==="Combat training").spent===1, "picking Melee spends it");
    const total=pools().filter(x=>!x.label.includes("grant")).reduce((a,x)=>a+x.need,0);
    must(total===11, "eleven placed points at creation (2 Skill, 1 Lore, 1 Calling, its Skill Training, the combat training, 2 Defense, 3 Comets), found "+total);
    const c=wizCh(null); must(ownsTalent(c,"Melee","Melee Training")&&!ownsTalent(c,"Ranged","Ranged Training"), "Melee Training granted by the first Calling");
    must(!ownsTalent(c,"Guard","Guard Training"), "Defenses are not granted free");
    wiz.picks.calName="Spellshaper"; wiz.picks.combat="Elementalism"; const c2=wizCh(null);
    must(ownsTalent(c2,"Elementalism","Elementalism Training")&&!ownsTalent(c2,"Melee","Melee Training"), "a caster's grant opens the discipline instead");
    must(saveBlockers().every(b=>!/combat training|not Elementalism/.test(b.msg)), "a legal discipline pick clears the blocker");
    wiz.picks.combat="Melee"; must(saveBlockers().some(b=>/not Melee/.test(b.msg)), "Melee is refused for a Spellshaper");
    wiz.picks.calName=null; wiz.picks.combat=null; wiz.picks.calling=[]; wiz.picks.calSkill=[]; });
  // PHB v4.21 (ch.2 Proficiency; ruling 127): a Combat Style or a magical specialty is a group within its parent,
  // wearing the parent's rank and waiting on the parent's Root; a discipline's root carries its spell block.
  step("groups share the parent's rank (v4.21)", ()=>{
    must(isGroup("Archery")&&isGroup("Flamecraft")&&!isGroup("Melee")&&!isGroup("Elementalism"), "Combat Styles and specialties are groups; their parents are not");
    must(parentOf("Flamecraft")==="Elementalism"&&magicParents().length===5, "a specialty names its discipline; five disciplines");
    const c=migrate({name:"g",level:5,milestones:0,ancestry:"Human",calling:"Hunter",talents:{Ranged:["Ranged Training","Aim ❶","Loose and Move"],Archery:["Archery Training"]},sparks:{},armor:null,shield:null,languages:[]});
    must(rankOf(c,"Ranged")==="E"&&rankOf(c,"Archery")==="E"&&poolPts(c,"Archery")===4, "Archery wears Ranged's rank: 3 + 1 = 4 points, Expert at L5; found "+rankOf(c,"Archery"));
    const d=derive(c); must(d.ranged.dice===2&&d.melee.dice===1, "an Expert in Ranged rolls two weapon dice, an Untrained Melee one");
    must(/a group within Ranged/.test(vSheet(c))&&vSheet(c).includes("(Ranged's)"), "the sheet's Archery row says it wears Ranged's rank");
    const n=migrate({name:"n",level:1,milestones:0,ancestry:"Human",calling:"Hunter",talents:{},sparks:{},armor:null,shield:null,languages:[]});
    const root=treeOf("Archery").nodes.find(x=>x.root), cb0=canBuy(n,"Archery",root);
    must(!cb0.ok&&/Ranged Training/.test(cb0.why), "a group's root waits on the parent's Root (ruling 127): "+cb0.why);
    buy(n,"Ranged","Ranged Training"); must(canBuy(n,"Archery",root).ok, "and is buyable once the parent's Root is owned");
    const fr=treeOf("Flamecraft").nodes.find(x=>x.root); must(!canBuy(n,"Flamecraft",fr).ok, "a specialty waits on its discipline's Training");
    const sp=treeOf("Elementalism").nodes.find(x=>x.root); must(sp.spell&&sp.spell.threat==="blow"&&sp.spell.die===6, "the discipline's root carries its spell block");
    must(/Spell/.test(spellHTML(sp.spell))&&/Quick Cast/.test(spellHTML(sp.spell)), "spellHTML prints the Threat and the Casts");
    tab="wiki"; wikiSec="Skills & Styles"; render(); const sk=document.getElementById("main").innerHTML;
    must(sk.includes("Magical Constellations")&&sk.includes("Elemental Dart")&&sk.includes("❷ Quick Cast"), "the Skills & Styles wiki prints the disciplines, the Casts and the root spells"); });
  step("observatory: Firmament", ()=>{ tab="explorer"; eview={mode:0,cat:null}; render(); drawSky(); });
  step("observatory: every category sky", ()=>{ const cats=[...new Set(allTreeNames().map(t=>treeOf(t).category))];
    for(const c of cats){ eview={mode:1,cat:c}; render(); drawSky(); } });
  step("observatory: EVERY constellation", ()=>{ for(const tn of allTreeNames()){
    etree=tn; eview={mode:2,cat:treeOf(tn).category}; esel=null; render(); drawSky();
    const withSel=treeOf(tn).nodes[0]; if(withSel){ esel=withSel.name; drawSky(); } } });
  step("observatory: Melee and Ranged are parents", ()=>{
    must(allTreeNames().includes("Melee")&&allTreeNames().includes("Ranged"), "Melee and Ranged must be trees");
    must(parentOf("Dueling")==="Melee", "Dueling is a child of Melee, found "+parentOf("Dueling"));
    must(parentOf("Archery")==="Ranged", "Archery is a child of Ranged, found "+parentOf("Archery"));
    must(parentOf("Melee")===null&&parentOf("Stealth")===null, "parents and skills have no parent"); });
  // v4.10 sync report, ruling 13: a Combat Style's points reach the parent's rank only once the parent's Root is owned.
  step("parent rank waits on the Root (ruling 13)", ()=>{
    const c=migrate({name:"p",level:5,milestones:0,ancestry:"Human",calling:"Bravo",talents:{Ranged:["Ranged Training"],Dueling:["Dueling Training"]},sparks:{},armor:null,shield:null,languages:[]});
    must(rankOf(c,"Melee")===null&&derive(c).melee.prof===0, "Dueling alone must not make Melee Trained");
    must(/Untrained \\+0/.test(attackRows(c)[0][1]), "the weapon-in-hand row reads Untrained +0");
    must(inheritedPts(c,"Melee")===1, "the sheet still shows the Dueling point as waiting");
    buy(c,"Melee","Melee Training");
    must(poolPts(c,"Melee")===2&&rankOf(c,"Melee")==="T", "with Melee Training the Dueling point counts"); });
  step("characters + sheet + wiki tabs", ()=>{ for(const tb of ["chars","characters","sheet","vsheet","wiki"]){
    try{ tab=tb; render(); }catch(e){ if(!/Unknown tab/.test(e.message)) throw new Error(tb+": "+e.message); } } });
  // Every wiki section, not just the bookmarked one: each is its own template string, and a
  // broken one (a bad reference inside the Maneuver tables, say) only throws when it renders.
  step("wiki: every section", ()=>{ tab="wiki"; render();
    const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    if(secs.length<5) throw new Error("wiki nav lists only "+secs.length+" sections");
    for(const s of secs){ wikiSec=s; try{ render(); }catch(e){ throw new Error("wiki '"+s+"': "+e.message); } }
    wikiSec=secs[0];
    if(typeof A!=="undefined"&&A&&A.actions&&A.actions.length){ wikiSec="Maneuvers"; render();
      const h=document.getElementById("main").innerHTML; wikiSec=secs[0];
      for(const a of A.actions){ if(!h.includes("<b>"+a.name+"</b>")) throw new Error("Maneuvers wiki lacks sheet action "+a.name); } } });
  step("wiki: an old 'Actions' bookmark lands on Maneuvers", ()=>{ tab="wiki"; wikiSec="Actions"; render();
    must(wikiSec==="Maneuvers", "bookmark should follow the rename, found "+wikiSec); });
  step("wiki: no v3 vocabulary survives", ()=>{ tab="wiki";
    const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    // the check-formula level term in its v3 shapes ("10 + level", "level + Wits + prof"); Rage's "level + Might" Temporary Vigor is a book formula
    const bad=/Hit Points|\\bHP\\b|Stride|multiple attack penalty|\\bMAP\\b|Weapons Proficiency|10 \\+ level|level \\+ (attribute|Wits|Agility|Presence|Might) \\+|\\+ level \\+|&#9670;|&#9671;|◆|◇/;
    for(const s of secs){ wikiSec=s; render(); const m=document.getElementById("main").innerHTML.match(bad);
      if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'"); } wikiSec=secs[0]; });
  step("with Mira loaded: every view again", ()=>{
    if(typeof TORVA!=="undefined"&&typeof chars!=="undefined"){ if(!chars.some(c=>c.id===TORVA.id)) chars.push(migrate(JSON.parse(JSON.stringify(TORVA))));
      if(typeof cur!=="undefined") cur=chars.length-1; activeId=TORVA.id; }
    for(const tb of ["chars","sheet","wiki"]){ try{ tab=tb; render(); }catch(e){ throw new Error(tb+": "+e.message); } }
    tab="explorer";
    for(const tn of allTreeNames()){ etree=tn; eview={mode:2,cat:treeOf(tn).category}; esel=null; render(); drawSky(); }
    tab="wizard"; for(let i=0;i<=8;i++){ wiz.step=i; render(); } });
  // The v4.10 math on the sample: ÷4 attributes, +3 Trained, no level term; v4.11 Vigor 10 + Ambusher Opening 8 + Human 8.
  step("rules math on Mira", ()=>{ const m=chars.find(c=>c.id===TORVA.id); must(m, "Mira loaded");
    const d=derive(m);
    must(attrBonus(3)===0&&attrBonus(4)===1&&attrBonus(8)===2&&attrBonus(40)===5, "attrBonus is points ÷ 4, capped at +5");
    must(RB.T===3&&RB.E===6&&RB.M===9&&RB.L===12, "ranks +3/+6/+9/+12");
    must(gatesFor("Skill").E===5&&gatesFor("Skill").M===10&&gatesFor("Skill").L===15, "gates L5/L10/L15");
    must(d.vigorMax===26&&d.vigorOpening===8&&d.vigorPerLvl===8, "Vigor 10 + Ambusher Opening 8 + (Human 8 + Endure Bonus 0) × 1 = 26, found "+d.vigorMax);
    must(d.DT.Evade===10+d.A.Agility+3, "Evade Threshold has no level term and no Load Strain: "+d.DT.Evade);
    must(d.DR.Endure===null&&d.DT.Endure===10+d.A.Might, "Untrained Endure is 10 + Might: "+d.DT.Endure);
    must(poolPts(m,"Melee")===2&&pointsIn(m,"Melee")===1, "Dueling's point counts toward Melee's rank pool");
    must(attrPoints(m,"Might")===Object.keys(m.talents).reduce((a,t)=>a+m.talents[t].filter(n=>((treeOf(t).nodes.find(x=>x.name===n)||{}).feeds||treeOf(t).feeds)==="Might").length,0), "Attribute Points are not double counted through a parent");
    must(d.recoveryTh===10+(m.dying||0)+d.woundCount, "Recovery Threshold is 10 + Dying + Wounds");
    must(d.melee.dice===1&&d.speed===6&&d.step===3&&d.rush===18-d.strain&&d.leap.quick===3&&d.leap.standing===6&&d.leap.running===9&&d.crawl===3, "one weapon die at Trained; Speed 6, Step 3, Rush ❷ 18, Leap 3/6/9, Crawl 3 (v4.21)");
    const w={...JSON.parse(JSON.stringify(m)), wounds:{Head:0,Torso:2,Arms:0,Legs:0}}; const dw=derive(w);
    must(dw.dyingNow&&dw.DT.Guard===d.DT.Guard-2, "a final Torso Wound is Dying, and a Torso Wound is Off-Guard (−2 Guard)");
    // ruling 35: tracked Wounds reach the derived numbers. Arms: Guard and attacks; Head: no Reactions; Legs: Speed, then Prone.
    const wa={...JSON.parse(JSON.stringify(m)), wounds:{Head:0,Torso:0,Arms:1,Legs:0}}; const dwa=derive(wa);
    must(dwa.atkPen===2&&dwa.DT.Guard===d.DT.Guard-2&&!dwa.noReactions, "an Arms Wound is −2 to Guard and to attacks");
    must(/−2 Wound/.test(attackRows(wa)[0][2])&&!/−2 Wound/.test(attackRows(m)[0][2]), "the Strikes table subtracts the Arms Wound and says so");
    const dwh=derive({...JSON.parse(JSON.stringify(m)), wounds:{Head:1,Torso:0,Arms:0,Legs:0}});
    must(dwh.noReactions&&dwh.atkPen===0, "a Head Wound blocks Reactions");
    const dwl=derive({...JSON.parse(JSON.stringify(m)), wounds:{Head:0,Torso:0,Arms:0,Legs:1}});
    must(dwl.speed===3&&dwl.step===1&&dwl.travel.mph===1, "one Legs Wound halves Speed 6 to 3; 3 ÷ 2 mph rounds down to 1");
    const dwl2=derive({...JSON.parse(JSON.stringify(m)), wounds:{Head:0,Torso:0,Arms:0,Legs:2}});
    must(dwl2.speed===0&&dwl2.rush===0&&dwl2.atkPen===2&&dwl2.sitPen.Evade===2&&dwl2.crawl===1, "the final Legs Wound is Prone: Speed 0, −2 to attacks, Off-Guard, Crawl half the Speed it had (ruling 138)"); });
  // PHB v4.21 (rulings 151, 152; v4.11's R1, R2, R5 as they stand): the first Calling's Opening Vigor once, the
  // Ancestry's Vigor every level and no Endure Bonus; Load Strain counts a shield, never comes off Evade, is cut by
  // Endure relief from Trained and by a Fitted harness of three Fitted pieces; Flexible, Noisy and Visored read.
  step("v4.21: Opening Vigor, no Endure Bonus, Load Strain off Evade, the Fitted harness, Visored", ()=>{
    must([["Ambusher",8],["Berserker",12],["Bravo",10],["Hunter",10],["Weaponmaster",10],["Spellshaper",6],["Blood Mage",8],["Necromancer",6],["Summoner",6],["Spellblade",8]].every(([n,v])=>callingOf(n)&&callingOf(n)[2]===v), "the roster's third Calling column is Opening Vigor: 8/12/10/10/10, and the casters' 6/8/6/6/8 (ruling 152)");
    must(R.conditions.some(c=>c[0]==="Fatigued N"&&/maximum of 3/.test(c[1])&&/all Defense/.test(c[1])), "the Conditions table's Fatigued N reaches all four Defenses");
    const mk=(level,endure,extra={})=>migrate({name:"v",level,milestones:0,ancestry:"Human",calling:"Berserker",sparks:{},armor:null,shield:null,languages:[],talents:endure?{Endure:endure}:{},...extra});
    const e0=derive(mk(1,null)); must(e0.vigorMax===30&&e0.vigorOpening===12&&e0.vigorPerLvl===8&&e0.endureBonus===0, "a L1 Human Berserker has 10 + Opening 12 + Human 8 = 30 Vigor, found "+e0.vigorMax);
    must(derive(mk(3,null)).vigorMax===10+12+8*3, "Opening Vigor is added once: at L3 it is 10 + 12 + 24 = 46, found "+derive(mk(3,null)).vigorMax);
    const t1=derive(mk(1,["Endure Training"])); must(t1.DR.Endure==="T"&&t1.endureBonus===0&&t1.endureRelief===1&&t1.vigorMax===30, "Trained Endure is relief 1 and no Vigor bonus");
    const FOUR=["Endure Training","Shrug It Off","Second Wind ❷","Braced Frame"];
    const x5=derive(mk(5,FOUR)); must(x5.DR.Endure==="E"&&x5.endureBonus===0&&x5.vigorPerLvl===8&&x5.vigorMax===10+12+8*5&&x5.endureRelief===2, "Expert Endure at L5: no Vigor bonus (ruling 151; 10 + 12 + 40 = 62) and relief 2; found "+x5.vigorMax+", relief "+x5.endureRelief);
    // Load Strain: a Mail Hood (Load 1, Flexible, Noisy) over leathers (Load 0) with a Shield (Load 1): Strain 2, no harness
    const h=mk(1,null,{armor:{Head:"Mail Hood",Torso:"Leather Cuirass",Arms:"Leather Armguards",Legs:"Leather Legguards"},shield:"Shield"}); const dh=derive(h);
    must(!dh.fitted&&dh.shield&&dh.strain===dh.loadArmor+dh.shield[3]&&dh.strain===2, "Load Strain is armor plus shield Load with no Fitted harness and no Endure: "+dh.strain);
    must(dh.DT.Evade===10+dh.A.Agility+(dh.DR.Evade?RB[dh.DR.Evade]:0)&&dh.D.Evade===dh.DT.Evade-10, "Load Strain never comes off Evade: Threshold "+dh.DT.Evade+" with Strain "+dh.strain);
    must(dh.rush===18-dh.strain&&dh.leap.quick===3-dh.strain&&dh.leap.standing===6-dh.strain&&dh.leap.running===9-dh.strain, "Rush and the three Leaps lose Load Strain in feet");
    must(dh.strainMotion===dh.strain-1, "the Mail Hood is Flexible: Climb and Swim count its Load 1 lower");
    must(dh.noisyCount===1&&dh.noisy, "one Noisy piece: −1 Gear to Stealth");
    must(dh.wind&&dh.wind.threshold===12&&dh.wind.due===true&&dh.wind.endureThreshold===dh.DT.Endure, "derive() carries the Wind numbers: due at Strain 1 or more, no exemption (ruling 150)");
    must(vSheet(h).includes("never off Evade")&&vSheet(h).includes("Wind each round: Endure vs 12"), "the sheet says Strain stays off Evade and names the Wind Threshold");
    const ht=derive(mk(1,["Endure Training"],{armor:h.armor,shield:h.shield})); must(ht.strain===dh.strain-1, "Trained Endure takes 1 off Load Strain: "+ht.strain);
    // the Fitted harness: Open Helm, Plate Cuirass, Plate Armguards (three Fitted pieces) over Leather Legguards: Load 4, less 1
    const f=derive(mk(1,null,{armor:{Head:"Open Helm",Torso:"Plate Cuirass",Arms:"Plate Armguards",Legs:"Leather Legguards"},shield:null}));
    must(f.fittedCount===3&&f.fitted&&f.loadArmor===4&&f.strain===3&&f.prot.Torso===4, "three Fitted pieces are a harness: Load 4, Strain 3, and no Torso bonus (the matched harness is gone); found Strain "+f.strain);
    const f2=derive(mk(1,null,{armor:{Head:"Open Helm",Torso:"Plate Cuirass",Arms:"Leather Armguards",Legs:"Leather Legguards"},shield:null}));
    must(f2.fittedCount===2&&!f2.fitted&&f2.strain===3, "two Fitted pieces are not: Load 3, Strain 3");
    // Visored: the Full Helm lowered is −1 Gear to Awareness and Initiative (ruling 140)
    const v=derive(mk(1,null,{armor:{Head:"Full Helm",Torso:null,Arms:null,Legs:null},shield:null})), v0=derive(mk(1,null));
    must(v.visored&&v.helmPen===1&&v.DT.Awareness===v0.DT.Awareness-1&&v.init===v0.init-1, "a Visored helm, lowered, is −1 to Awareness and Initiative");
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    must(secs.length>=5, "the wiki nav must be rendered before the stale sweep, found "+secs.length+" sections");
    const stale=/Calling's Vigor|Calling Vigor|Vigor per level<\\/b> \\(only|from your <b>Evade<\\/b>, and from any Might|Fatigued \\(−1|matched harness(?!es)|closed helm|Endure Threshold meets|never rolls for Wind|Deferred Talent Point|5 × Speed|Rush ❸|two at 4th|Void ❶|Counter ❶|Same-type bonuses never stack|do not stack; use the highest|14 Talent Points|begins <b>Trained in Melee or Ranged/;
    for(const s of secs){ wikiSec=s; render(); const m=document.getElementById("main").innerHTML.match(stale); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'"); } wikiSec=secs[0]; });
  // PHB v4.21 (ruling 150, superseding 74): the Wind check comes at the end of every round at Load Strain 1 or
  // more, with no exemption for a high Endure Threshold; the Fatigued row reaches all four Defenses; Rage's two
  // "Fatigued" sentences carry the book's text.
  step("v4.21: Wind with no exemption, the Fatigued row, and Rage's wording", ()=>{
    const mk=(endure,armor)=>migrate({name:"w",level:1,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},shield:null,languages:[],
      armor:{Head:null,Torso:null,Arms:null,Legs:null,...armor},talents:endure?{Endure:endure}:{}});
    const T=["Endure Training"];
    // Untrained Endure (Threshold 10) in a Mail Hood (Load 1): Wind Threshold 11, so she rolls
    const n=mk(null,{Head:"Mail Hood"}), dn=derive(n);
    must(dn.strain===1&&dn.DT.Endure===10&&dn.wind.threshold===11&&dn.wind.due===true, "Untrained Endure 10 under Wind 11 rolls; strain "+dn.strain+", Endure "+dn.DT.Endure);
    must(vSheet(n).includes("Wind each round: Endure vs 11")&&!vSheet(n).includes("no Wind check"), "the sheet names the Wind Threshold for a fighter who rolls");
    // Trained Endure in the same hood: relief 1 takes the Strain to 0, and at Strain 0 there is no Wind
    const x=mk(T,{Head:"Mail Hood"}), dx=derive(x);
    must(dx.strain===0&&dx.DT.Endure===13&&!dx.wind.due, "relief 1 takes a Load 1 hood to Strain 0: no Wind check; strain "+dx.strain);
    // an Endure Threshold that meets the Wind Threshold is no exemption any more
    const eq=mk(T,{Head:"Mail Hood",Torso:"Lamellar Armor"}), deq=derive(eq);
    must(deq.strain===2&&deq.wind.threshold===12&&deq.DT.Endure===13&&deq.wind.due, "Endure Threshold 13 against Wind 12 still rolls: the exemption is gone (ruling 150)");
    must(vSheet(eq).includes("Wind each round: Endure vs 12")&&!vSheet(eq).includes("no Wind check"), "and the sheet says so");
    // no Strain, no Wind line (the ladder's own text aside)
    const z=mk(null,{}), dz=derive(z); must(dz.strain===0&&!dz.wind.due&&!vSheet(z).includes("Wind each round: Endure vs")&&!vSheet(z).includes("no Wind check"), "at Strain 0 the sheet says nothing about Wind (the ladder's own text aside)");
    // the Conditions row: all four Defenses, maximum 3, ten minutes' rest
    const fat=R.conditions.find(c=>c[0]==="Fatigued N");
    must(fat&&/all Defense/.test(fat[1])&&/maximum of 3/.test(fat[1])&&/ten minutes of rest/.test(fat[1]), "the Fatigued N row reaches all four Defenses and ends with ten minutes' rest, found: "+(fat&&fat[1]));
    // Rage's two sentences live in the Berserker Calling root now; Deaf to Pain untouched
    const rage=treeOf("Berserker").nodes.find(nd=>nd.root); must(rage&&rage.name==="Berserker Calling", "the Berserker root is the Berserker Calling");
    must(rage.effect.includes("Afterward, increase your Fatigued by 1 until you spend three actions to catch your breath.")&&rage.effect.includes("You may end your Rage as a free action, increasing your Fatigued by 1 as though it had run its course."), "Rage's Effect carries the two Fatigued sentences: "+rage.effect);
    must(!/you're fatigued|becoming fatigued/.test(rage.effect)&&/Rage ❶<br>Duration 10 rounds/.test(rage.effect)&&rage.effect.includes("Temporary Vigor = level + Might")&&/Training in Melee or Ranged/.test(rage.effect), "the old sentences are gone, the Duration line is its own line, and the first-Calling clause is there");
    const deaf=treeOf("Berserker").nodes.find(nd=>nd.name==="Deaf to Pain");
    must(deaf&&deaf.effect==="You ignore the Fatigued condition while Raging, and when your Rage ends you need to spend only 1 action to catch your breath rather than 3.", "Deaf to Pain is unchanged");
    // the wiki: Wind is explained with the clause, every round, the critical failure, and no exemption
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    const gone=/once the fight is over|catch their breath after the fight|Fatigued \\(−1|never rolls for Wind|Endure Threshold meets/; let said=0;
    for(const s of secs){ wikiSec=s; render(); const html=document.getElementById("main").innerHTML;
      const m=html.match(gone); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'");
      if(/<b>Wind\\.<\\/b>/.test(html)){ said++; must(/Load Strain is at least 1/.test(html)&&/end of every round/.test(html)&&/critical failure/.test(html), "wiki '"+s+"' explains Wind without the v4.21 clause (Strain at least 1, every round, critical failure +2)"); } }
    must(said>=2, "the Equipment and Combat sections both explain Wind, found "+said); wikiSec=secs[0]; });
  // PHB v4.21 (ruling 149): the armor tables are the book's 27 pieces by Type with the twelve traits; the material
  // weakness table is gone; the Equipment wiki prints Type, the Fitted harness and the new donning paragraph.
  step("v4.21: the armor tables by Type, the twelve traits, the donning paragraph", ()=>{
    must((R.armorPieces||[]).length===27, "27 pieces in the roster's armor table, found "+(R.armorPieces||[]).length);
    const pc=(R.armorPieces||[]).find(r=>r[0]==="Plate Cuirass"); must(pc&&pc[5]==="Attended, Fitted"&&pc[6]==="Plate"&&pc[2]===4&&pc[3]===2, "the Plate Cuirass: Attended, Fitted; Plate; Protection 4; Load 2; found "+JSON.stringify(pc));
    must(!(R.armorPieces||[]).some(r=>r[0]==="Breastplate"||/scale/i.test(r[6]||"")), "no Breastplate and no Scale: the table is v4.21's");
    must(R.armorTraits.map(r=>r[0]).join(",")==="Articulated,Attended,Brimmed,Comfort,Concealable,Fitted,Flexible,Muffled,Noisy,Open,Repairable,Visored", "the twelve armor traits, alphabetical: "+R.armorTraits.map(r=>r[0]).join(","));
    const AT="Donning and doffing without help takes twice as long.";
    must(R.armorTraits.find(r=>r[0]==="Attended")[1]===AT, "the Attended row is the book's sentence");
    must((R.materials||[]).map(r=>r[0]).join(",")==="Padded,Leather,Mail,Lamellar,Brigandine,Splint,Plate"&&R.materials.every(r=>r[1]==="—"), "the materials block lists the seven Types with no weakness (ruling 149)");
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    const stale=/third round|round 3\\b|round three|turns poorly|Armor of proof|matched harness(?!es)/i; let traitRows=0; // Armored Fighting's own blurb says "matched harnesses", Mike's text
    for(const s of secs){ wikiSec=s; render(); const html=document.getElementById("main").innerHTML;
      const m=html.match(stale); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'");
      if(html.includes(AT)) traitRows++; }
    must(traitRows>=1, "the armor traits table prints the Attended row from the roster block");
    wikiSec="Equipment"; render(); const eq=document.getElementById("main").innerHTML;
    must(eq.includes("Attended, Fitted")&&eq.includes("<th>Type</th>")&&!eq.includes("<th>Material</th>"), "the Equipment section's armor table prints Traits and Type");
    must(eq.includes("An Attended piece takes twice as long without help.")&&eq.includes("Fitted harness"), "the donning paragraph and the Fitted harness are explained");
    wikiSec="Thresholds"; render(); must(/Wind against 10 \\+ Load Strain \\(at the end of every round, with Load Strain of at least 1; a critical failure is Fatigued \\+2\\)/.test(document.getElementById("main").innerHTML), "the Thresholds parenthetical says every round, names the Strain clause and the critical failure");
    wikiSec=secs[0];
    // the sheet: a fighter with Strain rolls every round; Mira's leathers are Load 0, so her sheet says nothing about Wind
    const mk=(endure,armor)=>migrate({name:"w13",level:1,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},shield:null,languages:[],
      armor:{Head:null,Torso:null,Arms:null,Legs:null,...armor},talents:endure?{Endure:endure}:{}});
    const b=mk(null,{Torso:"Plate Cuirass"}), db=derive(b);
    must(db.strain===2&&db.wind.threshold===12&&db.wind.due&&vSheet(b).includes("Wind each round: Endure vs 12"), "an Untrained fighter in a Plate Cuirass (Load 2) rolls Wind each round against 12; strain "+db.strain);
    const mira=chars.find(c=>c.id===TORVA.id); must(mira, "Mira loaded"); const dm=derive(mira), sm=vSheet(mira);
    must(dm.strain===0&&dm.prot.Torso===2&&!/Wind each round: Endure vs|Wind from round|no Wind check \\(|round 3\\b/.test(sm), "Mira's leathers are Load 0, Protection 2: her Strain line says nothing about Wind (the ladder's own text aside)");
    must(sm.includes("Wind, each round at Strain 1 or more: Endure vs 10 + Strain")&&!sm.includes("round 3 on"), "the ladder's static text says each round at Strain 1 or more"); });
  // PHB v4.21: the Comfort row carries the book's sentence; the How to Play results table has no Attacks column and
  // points at the Combat section, whose Attack results table prints the v4.21 rows; the deleted paragraphs leave no echo.
  step("v4.21: the Comfort row, the results table, and the Attack results", ()=>{
    const CF="May be slept in without armor-induced Fatigue.";
    const cf=(R.armorTraits||[]).find(r=>r[0]==="Comfort");
    must(cf&&cf[1]===CF, "the Comfort row carries the v4.21 sentence verbatim, found: "+(cf&&cf[1]));
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    must(secs.length>=5, "the wiki nav must be rendered before the sweep, found "+secs.length+" sections");
    wikiSec="How to Play"; render(); const htp=document.getElementById("main").innerHTML;
    must(!htp.includes("Meaning for Attacks"), "the Checks table has lost its Attacks column");
    must(/Degrees of success<\\/h3>[\\s\\S]{0,400}for Attacks, see the [\\s\\S]{0,80}Combat/.test(htp), "the results table's lead-in says where Attacks are read");
    must(htp.includes("Natural 20 / Natural 1"), "the Checks table's die row reads 'Natural 20 / Natural 1'");
    must(htp.includes("<b>The player always rolls.</b>")&&htp.includes("the player initiating the Maneuver rolls"), "the How to Play callout follows the book's streamlined paragraph");
    must(htp.includes("Independent bonuses and penalties stack, whatever their type")&&htp.includes("+3</td>"), "the stacking rule and the book's examples are printed");
    wikiSec="Combat"; render(); const cb=document.getElementById("main").innerHTML;
    must(cb.includes("<b>Graze.</b> Stopped, but partial damage: apply the reduced damage or lesser effects the Attack specifies")&&cb.includes("<b>Miss.</b> Stopped, no damage. For a Blow, the attacker is Exposed in a Zone of the defender's choice."), "the Attack results table prints the book's Graze and Miss");
    must(cb.includes("For a Blow, the attacker chooses the Zone that is struck.")&&cb.includes("For a Blow, it lands on the Torso, or on an Exposed Zone the attacker chooses."), "and the book's Critical Hit and Hit");
    must(cb.includes("Natural 20 / Natural 1")&&cb.includes("Natural 1 / Natural 20"), "the Attack results' die row reads Natural with a capital N on both sides");
    must(cb.includes("because a committed blade is there to be bound."), "the Weighted paragraph ends as the book's does");
    must(cb.includes("(see 5. Position)")&&cb.includes("<h3>5. Position</h3>"), "the Graze row's cross-reference resolves to the Position heading");
    must(cb.includes("<b>Miss</b></td><td>Stopped, no damage. The attacker is Exposed"), "the Blow reading's Miss row opens as the book's Miss does");
    must(cb.includes("Threat and Delivery")&&cb.includes("Pervasive Blast")&&cb.includes("maximum Support bonus of +4"), "the Combat section prints Delivery and the +4 Support cap");
    must(cb.includes("5. Settle Position")&&!cb.includes("6. Resolve Triggered Abilities"), "the Exchange is five steps");
    wikiSec="Traits"; render(); must(document.getElementById("main").innerHTML.includes(CF), "the armor traits table prints the Comfort sentence from the roster block");
    wikiSec="Equipment"; render(); must(document.getElementById("main").innerHTML.includes("You cannot sleep in armor without waking up with Fatigued equal to your Load Strain (maximum 3), <i>unless it has the Comfort trait</i>."), "the donning paragraph says what sleeping in armor costs in the book's terms");
    const gone=/it skates|Nothing lands|the die is in your hand|Meaning for Attacks|increasing your Fatigued value by 1 <i>|You roll\\. Always\\.|Natural 20 \\/ 1\\b|natural 20 \\/ natural 1|Natural 1 \\/ natural 20|weapon specialization<\\/b>|\\+2 at Expert, \\+3 at Master, \\+4 at Legendary\\)/;
    for(const s of secs){ wikiSec=s; render(); const m=document.getElementById("main").innerHTML.match(gone); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'"); } wikiSec=secs[0]; });
  // PHB v4.21: every Reaction lives in a Talent. The Training roots grant their own (Give Ground, Set Your Feet,
  // Intercept); Parry, Riposte, Sidestep and the rest are owned Talents; Void, Counter and Catch the Blade are gone.
  step("Reactions checklist: Talents grant them (v4.21)", ()=>{
    const m=chars.find(c=>c.id===TORVA.id); must(m, "Mira loaded");
    const g=(c,nm)=>reactionGrant(c,derive(c),nm);
    must(R.postures.length===11&&!R.postures.some(r=>/^(Void|Counter|Catch the Blade)/.test(r[0])), "the Reactions block is the eleven v4.21 entries; Void, Counter and Catch the Blade are gone");
    must(g(m,"Intercept ❶↺").granted&&g(m,"Intercept ❶↺").has, "Mira (Melee Training) ticks Intercept");
    must(g(m,"Give Ground ⓿↺").has&&g(m,"Set Your Feet ⓿↺").has, "Evade Training and Guard Training grant their Postures");
    must(!g(m,"Parry ❶↺").granted&&g(m,"Parry ❶↺").title==="needs Parry (Guard)", "Parry is a Talent now: Guard Training alone does not grant it; "+g(m,"Parry ❶↺").title);
    must(!g(m,"Sidestep ❶↺").granted&&!g(m,"Riposte").granted, "nor Sidestep or Riposte");
    must(vSheet(m).includes('title="needs Parry (Guard)"')&&vSheet(m).includes('title="granted by Melee Training"'), "the rendered sheet carries the hints");
    const mh=derive({...JSON.parse(JSON.stringify(m)), wounds:{Head:1,Torso:0,Arms:0,Legs:0}});
    const ih=reactionGrant(m,mh,"Intercept ❶↺"); must(ih.granted&&!ih.has&&ih.title==="blocked by your Head Wound", "a Head Wound blocks a granted Reaction and says so");
    const p=migrate({name:"x",level:1,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},armor:null,shield:null,languages:[],
      talents:{Guard:["Guard Training","Parry ❶↺","Riposte"],Evade:["Evade Training","Sidestep"]}});
    must(g(p,"Parry ❶↺").has&&g(p,"Riposte").has&&g(p,"Sidestep ❶↺").has, "owning the Talents ticks Parry, Riposte and Sidestep");
    must(g(p,"Parry ❶↺").title==="granted by Parry (Guard)", "and the box says so: "+g(p,"Parry ❶↺").title);
    must(!g(p,"Intercept ❶↺").granted&&g(p,"Intercept ❶↺").title==="needs Melee Training", "no Melee Training, no Intercept: "+g(p,"Intercept ❶↺").title);
    tab="wiki"; wikiSec="Combat"; render(); const cb=document.getElementById("main").innerHTML;
    must(cb.includes("<b>Riposte</b>")&&cb.includes("<b>Intercept ❶↺</b>")&&!/<b>Void ❶↺<\\/b>|<b>Counter ❶↺<\\/b>/.test(cb), "the Combat wiki's Reaction table is the roster block"); });
  // Ruling 61: Enabled? is Foundry's gate. The app is the authoring view of the whole book, so a tree or
  // talent the converter marks "enabled: false" is still listed and still drawn here.
  step("the Enabled? flag is carried, not acted on (ruling 61)", ()=>{
    const offTrees=Object.keys(TREES).filter(t=>TREES[t].enabled===false);
    const offNodes=Object.keys(TREES).flatMap(t=>(TREES[t].nodes||[]).filter(n=>n.enabled===false).map(n=>[t,n.name]));
    tab="explorer";
    for(const t of offTrees){ must(allTreeNames().includes(t), t+" is off for Foundry but must still be a tree here");
      etree=t; eview={mode:2,cat:treeOf(t).category}; esel=null; render(); drawSky(); }
    for(const [t,n] of offNodes.slice(0,5)){ must(treeOf(t).nodes.some(x=>x.name===n), n+" is off for Foundry but must still be in "+t);
      etree=t; eview={mode:2,cat:treeOf(t).category}; esel=n; render(); drawSky(); } });
  step("migration: v3 save keys", ()=>{ const old={id:"old",name:"Old",level:1,milestones:0,ancestry:"Human",bloodline:"Versatile Human",culture:"Kestrel Reach",
      background:"Acrobat",calling:"Ambusher",talents:{"Weapons":["Weapons Training","Read the Steel ◆"],"Berserker":["Rage ◆"],"Guard":["Guard Training"],
      "Archery":["Archery Training","Loose and Move"],"Chainmail":["Chain Discipline"]},sparks:{},
      hpCur:7,hpTmp:2,wounded:2,dying:0,
      armor:{Head:"Scale coif",Torso:"Leather cuirass",Arms:"Mail sleeves",Legs:"Something odd"}}; // no log array: a hand-edited or v1 file may lack one
    const c=migrate(old);
    // v4.21: the armor tables were rewritten by Type; old names land on their nearest piece, an unknown one leaves the Zone bare
    must(c.armor.Head==="Mail Hood"&&c.armor.Torso==="Leather Cuirass"&&c.armor.Arms==="Mail Sleeves"&&c.armor.Legs===null, "old armor names migrate to the v4.21 pieces: "+JSON.stringify(c.armor));
    must(c.log.some(l=>/Something odd is in the v4.21 armor tables; your Legs is left bare/.test(l))&&c.log.some(l=>/Scale coif is now the Mail Hood/.test(l)), "both moves are logged");
    must(Array.isArray(c.log), "migrate() gives a save its log array");
    must(derive(c).vigorCur===7, "an imported v3 save shows its carried Vigor, not full Vigor");
    must((c.talents["Ranged"]||[]).includes("Loose and Move")&&!(c.talents["Archery"]||[]).includes("Loose and Move"), "Loose and Move moves from Archery to Ranged");
    must(c.log.some(l=>/Loose and Move moved from Archery to Ranged/.test(l)), "the move is logged");
    must(!c.talents["Chainmail"]&&c.log.some(l=>/Chainmail constellation is retired/.test(l)), "a retired constellation's talents are dropped and logged");
    must(c.vigorCur===7&&c.vigorTmp===2&&c.hpCur===undefined&&c.hpTmp===undefined, "hpCur/hpTmp become vigorCur/vigorTmp");
    must(c.wounded===undefined&&c.wounds&&c.wounds.Torso===0, "the numeric Wounded is dropped; Wounds are per Zone");
    must(!c.talents["Weapons"]&&(c.talents["Melee"]||[]).includes("Melee Training"), "Weapons becomes Melee, Weapons Training becomes Melee Training");
    must((c.talents["Melee"]||[]).some(n=>nrmG(n)==="Read the Steel"), "an old-glyph talent name lands on the authored name");
    must((c.talents["Berserker"]||[]).includes("Berserker Calling"), "Rage ◆ lands on the Berserker Calling, the v4.21 root");
    must(c.log.some(l=>/Wounded 2/.test(l)), "a carried Wounded value is logged, not silently lost"); });
};`;
try{ (0,eval)(src+driver); }catch(e){ console.log("FAIL — script boot ::", e.message); process.exit(1); }
(0,eval)("__drive")(step);
console.log(fails?("SMOKE FAILED: "+fails):"SMOKE CLEAN");
process.exit(fails?1:0);
