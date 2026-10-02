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
  // PHB v4.10 chargen: one granted root (Melee or Ranged), three Origin roots, ten placed points.
  step("wizard: v4.10 pools", ()=>{ tab="wizard"; render();
    must(stepGate(0), "step 0 must gate on the Melee/Ranged choice");
    wiz.picks.weapon="Melee"; must(!stepGate(0), "Melee chosen should clear the gate");
    const P=pools(), def=P.find(x=>x.step===6), com=P.find(x=>x.step===7);
    must(def&&def.need===2, "two Defense Talent Points, found "+(def&&def.need));
    must(com&&com.need===3, "three Comets");
    const total=P.filter(x=>!x.label.includes("grant")).reduce((a,x)=>a+x.need,0);
    must(total===10, "ten placed points at creation (3 Skill, 1 Lore, 1 Calling, 2 Defense, 3 Comets), found "+total);
    const c=wizCh(null); must(ownsTalent(c,"Melee","Melee Training"), "Melee Training granted by step 0");
    must(!ownsTalent(c,"Guard","Guard Training"), "Defenses are no longer granted free");
    wiz.picks.weapon="Ranged"; const c2=wizCh(null);
    must(ownsTalent(c2,"Ranged","Ranged Training")&&!ownsTalent(c2,"Melee","Melee Training"), "Ranged Training granted instead when chosen");
    wiz.picks.weapon=null; });
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
    must(d.dice===1&&d.speed===6&&d.step===3&&d.rush===30-d.strain, "one die at L1; Speed 6, Step 3, Rush 30 less Load Strain");
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
    must(dwl2.speed===0&&dwl2.rush===0&&dwl2.atkPen===2&&dwl2.sitPen.Evade===2, "the final Legs Wound is Prone: Speed 0, −2 to attacks, Off-Guard"); });
  // PHB v4.11 (rulings R1, R2, R5): the first Calling's Opening Vigor once, the Ancestry's Vigor plus the Endure
  // Bonus every level; Load Strain counts a shield, never comes off Evade, and Endure relieves it from Trained.
  step("v4.11: Opening Vigor, the Endure Bonus, and Load Strain off Evade", ()=>{
    must([["Ambusher",8],["Berserker",12],["Bravo",10],["Hunter",10],["Weaponmaster",10]].every(([n,v])=>callingOf(n)&&callingOf(n)[2]===v), "the roster's third Calling column is Opening Vigor: 8/12/10/10/10");
    must(R.conditions.some(c=>c[0]==="Fatigued N"&&/maximum of 3/.test(c[1])), "the Conditions table carries Fatigued N");
    const mk=(level,endure,extra={})=>migrate({name:"v",level,milestones:0,ancestry:"Human",calling:"Berserker",sparks:{},armor:null,shield:null,languages:[],talents:endure?{Endure:endure}:{},...extra});
    const e0=derive(mk(1,null)); must(e0.vigorMax===30&&e0.vigorOpening===12&&e0.vigorPerLvl===8&&e0.endureBonus===0, "a L1 Human Berserker has 10 + Opening 12 + Human 8 = 30 Vigor, found "+e0.vigorMax);
    must(derive(mk(3,null)).vigorMax===10+12+8*3, "Opening Vigor is added once: at L3 it is 10 + 12 + 24 = 46, found "+derive(mk(3,null)).vigorMax);
    const t1=derive(mk(1,["Endure Training"])); must(t1.DR.Endure==="T"&&t1.endureBonus===0&&t1.endureRelief===1&&t1.vigorMax===30, "Trained Endure is relief 1 and no Vigor bonus (R5, R1)");
    const FOUR=["Endure Training","Shrug It Off","Second Wind ❷","Braced Frame"];
    const x5=derive(mk(5,FOUR)); must(x5.DR.Endure==="E"&&x5.endureBonus===1&&x5.vigorPerLvl===9&&x5.vigorMax===10+12+9*5&&x5.endureRelief===2, "Expert Endure at L5: +1 Vigor a level (10 + 12 + 45 = 67) and relief 2; found "+x5.vigorMax+", relief "+x5.endureRelief);
    const x1=derive(mk(1,FOUR)); must(x1.DR.Endure==="T"&&x1.endureBonus===0&&x1.vigorMax===30, "the same four points at L1 are Trained: the Endure Bonus waits on the Expert gate");
    // Load Strain: Mira's leathers with a scale coif are no matched harness, and the shield's Load counts (ch.5, v4.11).
    const h=mk(1,null,{armor:{Head:"Scale coif",Torso:"Leather cuirass",Arms:"Leather bracers",Legs:"Leather leggings"},shield:"Shield"}); const dh=derive(h);
    must(!dh.matched&&dh.shield&&dh.strain===dh.loadArmor+dh.shield[3]&&dh.strain>=3, "Load Strain is armor plus shield Load with no match and no Endure: "+dh.strain);
    must(dh.DT.Evade===10+dh.A.Agility+(dh.DR.Evade?RB[dh.DR.Evade]:0)&&dh.D.Evade===dh.DT.Evade-10, "Load Strain never comes off Evade (R2): Threshold "+dh.DT.Evade+" with Strain "+dh.strain);
    must(dh.rush===30-dh.strain&&dh.leap===Math.max(0,10-dh.strain), "Rush and Leap still lose Load Strain in feet");
    // v4.12 (ruling 74): the sheet's Strain line names the Wind Threshold, or says why there is no Wind check.
    // This fighter is Untrained in Endure (Threshold 10 + Might) under a Wind Threshold of 13 or more, so she rolls.
    const hx=dh.DT.Endure>=10+dh.strain;
    must(dh.wind&&dh.wind.threshold===10+dh.strain&&dh.wind.endureThreshold===dh.DT.Endure&&dh.wind.exempt===hx, "derive() carries the Wind numbers: threshold, Endure Threshold, exempt");
    must(!hx, "Mira's leathers with a scale coif and a shield put the Wind Threshold ("+(10+dh.strain)+") above Untrained Endure ("+dh.DT.Endure+")");
    must(vSheet(h).includes("never off Evade")&&vSheet(h).includes(hx?"no Wind check (Endure Threshold "+dh.DT.Endure+" meets "+(10+dh.strain)+")":"Wind each round: Endure vs "+(10+dh.strain)), "the sheet says Strain stays off Evade and names the Wind Threshold");
    const ht=derive(mk(1,["Endure Training"],{armor:h.armor,shield:h.shield})); must(ht.strain===dh.strain-1, "Trained Endure takes 1 off Load Strain (R5): "+ht.strain);
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    must(secs.length>=5, "the wiki nav must be rendered before the stale sweep, found "+secs.length+" sections");
    const stale=/Calling's Vigor|Calling Vigor|Vigor per level<\\/b> \\(only|from your <b>Evade<\\/b>, and from any Might|Fatigued \\(−1/;
    for(const s of secs){ wikiSec=s; render(); const m=document.getElementById("main").innerHTML.match(stale); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'"); } wikiSec=secs[0]; });
  // PHB v4.12 (rulings 74 to 76): no Wind check for a fighter whose Endure Threshold is at least 10 + Load Strain;
  // the Conditions table's Fatigued N row and Rage's two "Fatigued" sentences carry the book's text verbatim.
  step("v4.12: the Wind exemption, the Fatigued row, and Rage's wording (rulings 74 to 76)", ()=>{
    const mk=(endure,armor)=>migrate({name:"w",level:1,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},shield:null,languages:[],
      armor:{Head:null,Torso:null,Arms:null,Legs:null,...armor},talents:endure?{Endure:endure}:{}});
    const T=["Endure Training"];
    // Untrained Endure (Threshold 10) in a scale coif (Load 2): Wind Threshold 12, so she rolls
    const n=mk(null,{Head:"Scale coif"}), dn=derive(n);
    must(dn.strain===2&&dn.DT.Endure===10&&dn.wind.threshold===12&&dn.wind.exempt===false, "Untrained Endure 10 under Wind 12 rolls; strain "+dn.strain+", Endure "+dn.DT.Endure);
    must(vSheet(n).includes("Wind each round: Endure vs 12")&&!vSheet(n).includes("no Wind check"), "the sheet names the Wind Threshold for a fighter who rolls");
    // Trained Endure (Threshold 13) in the same coif, relief 1: Strain 1, Wind 11, exempt
    const x=mk(T,{Head:"Scale coif"}), dx=derive(x);
    must(dx.strain===1&&dx.DT.Endure===13&&dx.wind.threshold===11&&dx.wind.exempt===true, "Trained Endure 13 meets Wind 11: no roll; strain "+dx.strain+", Endure "+dx.DT.Endure);
    must(vSheet(x).includes("no Wind check (Endure Threshold 13 meets 11)")&&!vSheet(x).includes("Wind each round: Endure vs"), "the sheet says why no Wind check is rolled");
    // "at least": equal is exempt; one more point of Strain is not
    const eq=derive(mk(T,{Head:"Scale coif",Torso:"Scale hauberk"})); must(eq.strain===3&&eq.wind.threshold===13&&eq.wind.exempt, "Endure Threshold 13 against Wind 13 is exempt (at least, not more than)");
    const over=derive(mk(T,{Head:"Scale coif",Torso:"Scale hauberk",Arms:"Mail sleeves"})); must(over.strain===4&&over.wind.threshold===14&&!over.wind.exempt, "Wind 14 against Endure 13 rolls");
    // no Strain, no Wind line of either kind (the ladder's own text aside)
    const z=mk(null,{}), dz=derive(z); must(dz.strain===0&&dz.wind.exempt&&!vSheet(z).includes("Wind each round: Endure vs")&&!vSheet(z).includes("no Wind check"), "at Strain 0 the sheet says nothing about Wind (the ladder's own text aside)");
    // ruling 75: the Conditions row, verbatim
    const fat=R.conditions.find(c=>c[0]==="Fatigued N");
    must(fat&&fat[1]==="−N Condition (maximum of 3) penalty to Evade, Guard, and Attack rolls; can't use Exploration Mode Activities. Ends after ten minutes of rest.", "the Fatigued N row carries the v4.12 text, found: "+(fat&&fat[1]));
    // ruling 76: Rage's two sentences, inside the rich-text cell, with its bold run intact; Deaf to Pain untouched
    const rage=treeOf("Berserker").nodes.find(nd=>nrmG(nd.name)==="Rage"); must(rage, "Rage is in Berserker");
    must(rage.effect.includes("Afterward, increase your Fatigued by 1 until you spend three actions to catch your breath.")&&rage.effect.includes("You may end your Rage as a free action, increasing your Fatigued by 1 as though it had run its course."), "Rage's Effect carries the two v4.12 sentences: "+rage.effect);
    must(!/you're fatigued|becoming fatigued/.test(rage.effect)&&rage.effect.includes("<b>Rage ❶<br>Duration</b> 10 rounds")&&rage.effect.includes("Temporary Vigor = level + Might"), "the old sentences are gone and the bold run survived the round trip");
    const deaf=treeOf("Berserker").nodes.find(nd=>nd.name==="Deaf to Pain");
    must(deaf&&deaf.effect==="You ignore the Fatigued condition while Raging, and when your Rage ends you need to spend only 1 action to catch your breath rather than 3.", "Deaf to Pain is unchanged");
    // the wiki: the exemption is stated where Wind is explained, and nothing says "once the fight is over" (the
    // "Load Strain 1 or more" clause is the book's again since v4.13, ruling 80, so it is no longer swept for)
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    const gone=/once the fight is over|catch their breath after the fight|Fatigued \\(−1/; let said=0;
    for(const s of secs){ wikiSec=s; render(); const html=document.getElementById("main").innerHTML;
      const m=html.match(gone); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'");
      if(/<b>Wind\\.<\\/b>/.test(html)){ said++; must(/Endure Threshold/.test(html)&&/never rolls/.test(html), "wiki '"+s+"' explains Wind without the exemption"); } }
    must(said>=2, "the Equipment and Combat sections both explain Wind, found "+said); wikiSec=secs[0]; });
  // PHB v4.13 (rulings 79 to 82): the Wind check comes at the end of every round, from the first, for a fighter
  // with Load Strain 1 or more (the book's clause again); the Breastplate is Attended, a display-only trait that
  // lives in the roster's armorTraits block, first in the alphabet, and in the Equipment wiki's donning paragraph.
  step("v4.13: Wind every round, the Strain clause, and the Attended trait (rulings 79 to 82)", ()=>{
    const bp=(R.armorPieces||[]).find(r=>r[0]==="Breastplate"); must(bp, "the Breastplate is in the roster's armor table");
    must(bp[5]==="Plate, Noisy, Attended"&&bp[6]==="Plate", "the Breastplate's Traits read 'Plate, Noisy, Attended' with Plate as its Material, found: "+bp[5]+" / "+bp[6]);
    must((R.armorPieces||[]).filter(r=>/Attended/.test(r[5])).length===1, "Attended is on the Breastplate alone");
    const AT="It fastens behind the shoulder, beyond your own reach: alone, putting it on takes twice as long. Taking it off does not.";
    must(R.armorTraits&&R.armorTraits[0]&&R.armorTraits[0][0]==="Attended"&&R.armorTraits[0][1]===AT, "the armorTraits block has the Attended row first, verbatim; found: "+JSON.stringify(R.armorTraits&&R.armorTraits[0]));
    must(R.armorTraits.map(r=>r[0]).join(",")==="Attended,Comfort,Noisy,Quiet", "the armor traits stay alphabetical: "+R.armorTraits.map(r=>r[0]).join(","));
    tab="wiki"; render(); const secs=[...document.getElementById("main").innerHTML.matchAll(/data-w="([^"]+)"/g)].map(m=>m[1]);
    const stale=/third round|round 3\\b|round three/i; let said=0, traitRows=0;
    for(const s of secs){ wikiSec=s; render(); const html=document.getElementById("main").innerHTML;
      const m=html.match(stale); if(m) throw new Error("wiki '"+s+"' still says '"+m[0]+"'");
      if(/<b>Wind\\.<\\/b>/.test(html)){ said++; must(/Load Strain is at least 1/.test(html)&&/end of every round/.test(html), "wiki '"+s+"' explains Wind without the v4.13 clause (Strain at least 1, every round)"); }
      if(html.includes(AT)) traitRows++; }
    must(said>=2, "the Equipment and Combat sections both explain Wind, found "+said);
    must(traitRows>=1, "the armor traits table prints the Attended row from the roster block");
    wikiSec="Equipment"; render(); const eq=document.getElementById("main").innerHTML;
    must(eq.includes("Plate, Noisy, Attended"), "the Equipment section's armor table prints the Breastplate's Attended trait");
    must(eq.includes("Putting on or taking off a single piece takes 1 minute per point of Protection it has. An Attended piece takes that long only with a second pair of hands; alone, putting it on takes twice as long, though it comes off in the usual time."), "the donning paragraph carries the Attended sentence after the donning sentence");
    wikiSec="Thresholds"; render(); must(/Wind against 10 \\+ Load Strain \\(at the end of every round, with Load Strain of at least 1;/.test(document.getElementById("main").innerHTML), "the Thresholds parenthetical says every round and names the Strain clause");
    wikiSec=secs[0];
    // the sheet: a fighter with Strain rolls every round; Mira's leathers are Load 0, so her sheet says nothing about Wind
    const mk=(endure,armor)=>migrate({name:"w13",level:1,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},shield:null,languages:[],
      armor:{Head:null,Torso:null,Arms:null,Legs:null,...armor},talents:endure?{Endure:endure}:{}});
    const b=mk(null,{Torso:"Breastplate"}), db=derive(b);
    must(db.strain===2&&db.wind.threshold===12&&!db.wind.exempt&&vSheet(b).includes("Wind each round: Endure vs 12"), "an Untrained fighter in a Breastplate (Load 2) rolls Wind each round against 12; strain "+db.strain);
    const mira=chars.find(c=>c.id===TORVA.id); must(mira, "Mira loaded"); const dm=derive(mira), sm=vSheet(mira);
    must(dm.strain===0&&!/Wind each round: Endure vs|Wind from round|no Wind check \\(|round 3\\b/.test(sm), "Mira's leathers are Load 0: her Strain line says nothing about Wind (the ladder's own text aside)");
    must(sm.includes("Wind, each round: Endure vs 10 + Strain")&&!sm.includes("round 3 on"), "the ladder's static text says each round"); });
  // Ruling 63: Melee Training grants Intercept alone; Counter needs Expert rank in Melee, which counts a
  // Combat Style's points once the Root is owned (ruling 13) and is gated at level 5 like every Expert rank.
  step("Reactions checklist: Counter at Melee Expert (ruling 63)", ()=>{
    const m=chars.find(c=>c.id===TORVA.id); must(m, "Mira loaded");
    const g=(c,nm)=>reactionGrant(c,derive(c),nm);
    must(g(m,"Intercept ❶↺").granted&&g(m,"Intercept ❶↺").has, "Mira (Trained in Melee) ticks Intercept");
    must(!g(m,"Counter ❶↺").granted, "Mira does not tick Counter at Trained");
    must(g(m,"Counter ❶↺").title.includes("needs Expert rank in Melee")&&g(m,"Counter ❶↺").title.includes("Trained now"), "the Counter box says what it needs: "+g(m,"Counter ❶↺").title);
    must(g(m,"Parry ❶↺").granted&&g(m,"Void ❶↺").granted, "Guard Training and Evade Training still grant Parry and Void");
    must(vSheet(m).includes('title="needs Expert rank in Melee'), "the rendered sheet carries the Counter hint");
    const mh=derive({...JSON.parse(JSON.stringify(m)), wounds:{Head:1,Torso:0,Arms:0,Legs:0}});
    const ih=reactionGrant(m,mh,"Intercept ❶↺"); must(ih.granted&&!ih.has&&ih.title==="blocked by your Head Wound", "a Head Wound blocks a granted Reaction and says so");
    const mk=(level,melee)=>migrate({name:"x",level,milestones:0,ancestry:"Human",calling:"Bravo",sparks:{},armor:null,shield:null,languages:[],
      talents:{...(melee?{Melee:["Melee Training"]}:{}),Dueling:["Dueling Training","En Garde","Feinting Lunge ❷"]}});
    const e5=mk(5,true), d5=derive(e5);
    must(poolPts(e5,"Melee")===4&&d5.melee.rank==="E", "Melee Training plus three Dueling talents is 4 Melee points, Expert at L5; found "+d5.melee.rank);
    must(g(e5,"Counter ❶↺").has&&g(e5,"Intercept ❶↺").has, "the L5 Expert ticks both Counter and Intercept");
    must(g(e5,"Counter ❶↺").title==="granted by your Expert rank in Melee", "and the box says so: "+g(e5,"Counter ❶↺").title);
    must(vSheet(e5).includes('title="granted by your Expert rank in Melee"'), "the rendered sheet ticks Counter for the Expert");
    const e1=mk(1,true), d1=derive(e1);
    must(poolPts(e1,"Melee")===4&&d1.melee.rank==="T", "the same talents at L1 are Trained: the Expert gate is level 5");
    must(g(e1,"Intercept ❶↺").has&&!g(e1,"Counter ❶↺").granted, "so the L1 twin ticks Intercept and not Counter");
    must(g(e1,"Counter ❶↺").title.includes("from level 5"), "and the box names the level gate: "+g(e1,"Counter ❶↺").title);
    const n5=mk(5,false);
    must(!g(n5,"Intercept ❶↺").granted&&!g(n5,"Counter ❶↺").granted, "Dueling alone grants neither: the Root is the grant");
    must(g(n5,"Counter ❶↺").title==="needs Melee Training, then Expert rank in Melee", "the box asks for the Root first: "+g(n5,"Counter ❶↺").title); });
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
      hpCur:7,hpTmp:2,wounded:2,dying:0}; // no log array: a hand-edited or v1 file may lack one
    const c=migrate(old);
    must(Array.isArray(c.log), "migrate() gives a save its log array");
    must(derive(c).vigorCur===7, "an imported v3 save shows its carried Vigor, not full Vigor");
    must((c.talents["Ranged"]||[]).includes("Loose and Move")&&!(c.talents["Archery"]||[]).includes("Loose and Move"), "Loose and Move moves from Archery to Ranged");
    must(c.log.some(l=>/Loose and Move moved from Archery to Ranged/.test(l)), "the move is logged");
    must(!c.talents["Chainmail"]&&c.log.some(l=>/Chainmail constellation is retired/.test(l)), "a retired constellation's talents are dropped and logged");
    must(c.vigorCur===7&&c.vigorTmp===2&&c.hpCur===undefined&&c.hpTmp===undefined, "hpCur/hpTmp become vigorCur/vigorTmp");
    must(c.wounded===undefined&&c.wounds&&c.wounds.Torso===0, "the numeric Wounded is dropped; Wounds are per Zone");
    must(!c.talents["Weapons"]&&(c.talents["Melee"]||[]).includes("Melee Training"), "Weapons becomes Melee, Weapons Training becomes Melee Training");
    must((c.talents["Melee"]||[]).some(n=>nrmG(n)==="Read the Steel"), "an old-glyph talent name lands on the authored name");
    must((c.talents["Berserker"]||[]).some(n=>nrmG(n)==="Rage"), "Rage ◆ lands on the authored Rage");
    must(c.log.some(l=>/Wounded 2/.test(l)), "a carried Wounded value is logged, not silently lost"); });
};`;
try{ (0,eval)(src+driver); }catch(e){ console.log("FAIL — script boot ::", e.message); process.exit(1); }
(0,eval)("__drive")(step);
console.log(fails?("SMOKE FAILED: "+fails):"SMOKE CLEAN");
process.exit(fails?1:0);
