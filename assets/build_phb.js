// STARWROUGHT Constellation Compendium — docx builder
//
// The Player's Handbook itself is hand-authored in Word and is the authoritative rules text.
// This script deliberately does NOT regenerate it: two sources of truth would drift apart.
// What it builds instead is the part that must track the data exactly, and that is painful to
// keep in sync by hand: every Constellation, every Talent, and the reference tables, all read
// straight from assets/trees.json and assets/roster.json.
//   run:  node assets/build_phb.js   ->  Starwrought_Constellation_Compendium.docx
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ImageRun, PageBreak, TableOfContents, Footer, Header,
  PageNumber, LevelFormat, VerticalAlign, PageOrientation,
} = require("docx");

// ---------- palette ----------
const INK = "1D2A32", TEAL = "0E5F6B", EMBER = "E2703A", GOLD = "B8860B", PAPER = "F4EFE6",
  LTROW = "F2F0EA", HDR = "0E5F6B", TIER = { T: "4A7C59", E: "0E5F6B", M: "C05621", L: "B8860B" };
const BODY = "Calibri", HEAD = "Georgia";

// ---------- helpers ----------
const run = (t, o = {}) => new TextRun({ text: t, font: BODY, size: 21, color: INK, ...o });
const para = (t, o = {}) => new Paragraph({ children: Array.isArray(t) ? t : [run(t, o.runOpts || {})], spacing: { after: 120, ...(o.spacing || {}) }, ...o.p || {} });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 160 }, children: [new TextRun({ text: t, font: HEAD, size: 40, bold: true, color: TEAL })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, font: HEAD, size: 28, bold: true, color: EMBER })] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 180, after: 100 }, children: [new TextRun({ text: t, font: HEAD, size: 23, bold: true, color: INK })] });
const bullet = (t, opts = {}) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: Array.isArray(t) ? t : [run(t, opts)] });
const pb = () => new Paragraph({ children: [new PageBreak()] });
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const thinB = { style: BorderStyle.SINGLE, size: 4, color: "CBD5DB" };

function cell(children, { w, fill, bold, color, size, align, vAlign, borders } = {}) {
  const kids = (Array.isArray(children) ? children : [children]).map((c) =>
    typeof c === "string"
      ? new Paragraph({ alignment: align, spacing: { after: 20, before: 20 }, children: [run(c, { bold, color: color || INK, size: size || 19 })] })
      : c);
  return new TableCell({
    children: kids, width: { size: w, type: WidthType.DXA }, verticalAlign: vAlign || VerticalAlign.CENTER,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    borders: borders || { top: thinB, bottom: thinB, left: thinB, right: thinB },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

// generic striped table: header row + rows
function stripedTable(headers, rows, widths, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const hdr = new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, { w: widths[i], fill: HDR, bold: true, color: "FFFFFF", size: 19 })) });
  const body = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((c, i) => {
      const o = { w: widths[i], fill: ri % 2 ? LTROW : "FFFFFF", size: 19 };
      if (opts.cellStyler) Object.assign(o, opts.cellStyler(c, i, r) || {});
      return cell(typeof c === "object" && c.text !== undefined ? c.text : c, { ...o, ...(typeof c === "object" ? c : {}) });
    }),
  }));
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [hdr, ...body] });
}

// callout box: shaded single-cell table
function callout(title, lines, fill = PAPER, accent = EMBER) {
  const kids = [];
  if (title) kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, font: HEAD, bold: true, size: 21, color: accent })] }));
  for (const l of lines) kids.push(typeof l === "string" ? new Paragraph({ spacing: { after: 40 }, children: [run(l, { size: 20 })] }) : l);
  return new Table({
    columnWidths: [9360], width: { size: 9360, type: WidthType.DXA },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      children: kids, width: { size: 9360, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill },
      borders: { top: { style: BorderStyle.SINGLE, size: 6, color: accent }, bottom: { style: BorderStyle.SINGLE, size: 6, color: accent }, left: { style: BorderStyle.SINGLE, size: 24, color: accent }, right: { style: BorderStyle.SINGLE, size: 6, color: accent } },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
    })] })],
  });
}

function img(path, wIn, hIn, center = true) {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 120, after: 120 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(path), transformation: { width: Math.round(wIn * 96), height: Math.round(hIn * 96) } })],
  });
}

// tree table: [name, tier, cost, effect]
function treeTable(nodes) {
  return stripedTable(["Talent", "Tier", "Cost", "Effect"], nodes.map(n => [
    { text: n[0], bold: true, size: 19 }, { text: n[1], bold: true, color: TIER[n[1]] || INK, align: AlignmentType.CENTER }, { text: String(n[2]), align: AlignmentType.CENTER }, fmtPara(n[3], 19),
  ]), [2050, 640, 640, 6030]);
}
function treeHeader(name, meta, sparks) {
  const arr = [h3(name), para([run(meta, { italics: true, size: 20, color: TEAL })], { spacing: { after: 60 }, p: { keepNext: true } }),
    ...(sparks ? [para([run("Example flares: ", { bold: true, size: 19, color: GOLD }), run(sparks, { italics: true, size: 19 })], { spacing: { after: 100 }, p: { keepNext: true } })] : [])];
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cp = "assets/constellations/" + slug + ".png";
  if (fs.existsSync(cp)) arr.push(img(cp, 4.7, 2.62));
  return arr;
}

// ---------- content data ----------
const trees = {}; // canonical source: data/talent_trees.xlsx -> assets/trees.json
{
  const _t = JSON.parse(fs.readFileSync("assets/trees.json", "utf8"));
  for (const [k, v] of Object.entries(_t)) {
    const rootName = ((v.nodes.find(n => n.root) || {}).name || "").replace(/[◆↺★\s]+$/, "");
    trees[k] = { meta: v.meta, sparks: v.sparks, cat: v.category, feeds: v.feeds, nodes: v.nodes.map(n => {
      let eff = n.effect;
      // root-requires are implicit game-wide (and drawn on the star map) — print only the interesting ones
      const rq = (n.requires || []).filter(q => q.replace(/[◆↺★\s]+$/, "") !== rootName);
      if (rq.length && !/Requires /.test(eff.replace(/<[^>]+>/g, "")))
        eff = eff.replace(/\s+$/, "").replace(/([^.])$/, "$1.") + " Requires " + rq.join(" or ") + ".";
      if (n.feeds) eff += " <i>(feeds " + n.feeds + ")</i>";
      return [n.name, n.tier, n.cost, eff, !!n.root, !!n.hroot];
    }) };
  }
}

// minimal rich-HTML (<b><i><u><s>, color spans) -> docx runs
function fmtPara(html, size) {
  const kids = []; const st = { b: 0, i: 0, u: 0, s: 0, color: [] };
  const tokens = String(html).split(/(<\/?(?:b|i|u|s)>|<span style="color:#[0-9A-Fa-f]{6}">|<\/span>)/);
  for (const tk of tokens) {
    if (!tk) continue;
    if (tk === "<b>") st.b++; else if (tk === "</b>") st.b--;
    else if (tk === "<i>") st.i++; else if (tk === "</i>") st.i--;
    else if (tk === "<u>") st.u++; else if (tk === "</u>") st.u--;
    else if (tk === "<s>") st.s++; else if (tk === "</s>") st.s--;
    else if (tk.startsWith("<span")) st.color.push(tk.match(/#([0-9A-Fa-f]{6})/)[1]);
    else if (tk === "</span>") st.color.pop();
    else {
      const txt = tk.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      kids.push(new TextRun({ text: txt, font: BODY, size: size || 19, color: st.color.length ? st.color[st.color.length - 1] : INK,
        bold: st.b > 0, italics: st.i > 0, underline: st.u > 0 ? {} : undefined, strike: st.s > 0 }));
    }
  }
  return new Paragraph({ spacing: { after: 20, before: 20 }, children: kids.length ? kids : [new TextRun({ text: "", size: size || 19 })] });
}

let bgTable = null;
try { bgTable = JSON.parse(fs.readFileSync("assets/backgrounds.json", "utf8")); } catch (e) {}
const R = JSON.parse(fs.readFileSync("assets/roster.json", "utf8"));
let LANGS = [];
try { LANGS = JSON.parse(fs.readFileSync("assets/languages.json", "utf8")); } catch (e) {}

const stripT = (x) => String(x == null ? "" : x).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
const kids = [];

// ---------- title ----------
if (fs.existsSync("assets/cover_banner.png")) kids.push(img("assets/cover_banner.png", 6.4, 1.5));
kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
  children: [new TextRun({ text: "STARWROUGHT", font: HEAD, size: 64, bold: true, color: TEAL })] }));
kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
  children: [new TextRun({ text: "CONSTELLATION COMPENDIUM", font: HEAD, size: 30, bold: true, color: INK })] }));
kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [new TextRun({ text: "You are what you do.", font: HEAD, size: 22, italics: true, color: EMBER })] }));
kids.push(callout("HOW TO USE THIS", [
  "This book is generated from the game data, not written by hand. Every Constellation, Talent, and reference table below is read straight out of assets/trees.json and assets/roster.json, so it is never out of step with the app or the character sheet.",
  "The rules themselves live in the Player's Handbook, which is written by hand. Where the two ever disagree, the handbook wins and this file needs a rebuild.",
], PAPER, TEAL));
kids.push(para([run("Contents: ", { bold: true }), run("the character-creation menus (Ancestries and Bloodlines, Cultures, Backgrounds, Callings), then every Constellation in the game with its full Talent list and star map, then the reference appendices: conditions, traits, actions, and equipment.")]));
kids.push(new Paragraph({ children: [new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" })] }));
kids.push(pb());

// ---------- the creation menus ----------
kids.push(h1("Character Creation at a Glance"));
kids.push(stripedTable(["Step", "You choose…", "You get…", "Talent Points"],
  (R.chargenSteps || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], { text: r[3], bold: true, color: TEAL }]),
  [1500, 3600, 2300, 1960]));
kids.push(para([run("A finished 1st-level character has at least 17 Talent Points spent: ", { bold: true }), run("five granted automatically (Weapons Training, and Training in Awareness, Evade, Guard, and Endure), and twelve from creation.")]));
kids.push(h2("Types of Talent Point"));
kids.push(stripedTable(["Type", "May be spent on", "Flare required?"],
  (R.talentPointTypes || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [2200, 5000, 2160]));

kids.push(h1("Ancestries & Bloodlines"));
kids.push(para("Your Ancestry is the body you were born in. It forms the trunk of your Origin Constellation and sets your Hit Points per level, Size, Speed, and one special ability. Your Bloodline is the lineage inside it, and adds a branch. Both roots are Origin Talent Points granted by the choices themselves."));
kids.push(stripedTable(["Ancestry", "HP/lvl", "Size", "Speed", "Senses", "Key Attribute"],
  (R.ancestries || []).map(a => [{ text: a.name, bold: true }, String(a.hp), a.size || "Medium", a.speed,
    a.senses || "—", (trees[a.tree] || {}).feeds || "—"]), [2000, 1000, 1400, 1300, 2200, 1460]));
for (const a of (R.ancestries || [])) {
  const t = trees[a.tree]; if (!t) continue;
  kids.push(h3(a.name + ": HP " + a.hp + " • " + (a.size || "Medium") + " • " + a.speed));
  kids.push(para([run(a.blurb, { italics: true, color: TEAL })]));
  const bl = t.nodes.filter(n => n[5]);
  if (bl.length) kids.push(stripedTable(["Bloodline (choose one; root granted free)", "Grants"],
    bl.map(n => [{ text: n[0], bold: true }, fmtPara(n[3], 19)]), [2600, 6760]));
}

kids.push(h1("Cultures"));
kids.push(para("Culture is deliberately separate from Ancestry: an orc raised in the Kestrel Reach is simply both. Choosing a Culture grants its root free, and that root is always a language plus a scaled bonus to Diplomacy toward those who share it. The bonus rises with your rank in your Origin Constellation: +1 Trained, +2 Expert, +3 Master, +4 Legendary."));
kids.push(stripedTable(["Culture", "Language(s)", "Key Attribute", "About"],
  (R.cultures || []).map(c => [{ text: c[0], bold: true }, c[1], c[2], c[3] || ""]), [1600, 1700, 1300, 4760]));
if (LANGS.length) {
  kids.push(h2("Languages"));
  kids.push(stripedTable(["Language", "Rarity", "About"],
    LANGS.map(l => [{ text: l.name, bold: true }, l.rarity, stripT(l.desc) || "—"]), [1700, 1300, 6360]));
}

kids.push(h1("Backgrounds"));
kids.push(callout("KEYWORD: BECOME TRAINED IN", [
  "When an effect says you become Trained in a Constellation, you gain a Talent Point that must be spent in that Constellation. If it isn't open yet, the point buys the Training root, and that purchase IS becoming Trained. Already open? The point buys any Talent there you qualify for: training stacks into growth, never wasted.",
], PAPER, GOLD));
kids.push(para("Your life before the road. Each Background grants 2 Skill Talent Points and 1 Lore Talent Point."));
if (bgTable) kids.push(stripedTable(["Background", "Skills (1 point each)", "Lore (1 point)", "You were…"],
  bgTable.map(b => [{ text: b.name, bold: true }, (b.skills || []).join(" & "), b.lore || "—", stripT(b.desc)]),
  [1500, 2000, 1600, 4260]));

kids.push(h1("Callings"));
kids.push(para("Callings are what other games call classes, except the signature feature sits at the root, so your very first point buys the fantasy. Each Calling grants Training in one Skill or other Constellation, adds Hit Points per level, and gives you a special ability. Only your first Calling counts toward Hit Points, however many you open later."));
kids.push(stripedTable(["Calling", "Free Training", "HP/lvl", "Key Attribute", "Special Ability"],
  (R.callings || []).map(c => [{ text: c[0], bold: true }, c[1], String(c[2]), c[3], c[4]]),
  [1500, 1500, 900, 1400, 4060]));

kids.push(h1("Defenses"));
kids.push(para("Your four Defenses are Constellations like any other, and your character begins play Trained in all four. Each works two ways: your check is what you roll, and your Threshold is what someone else has to beat."));
kids.push(stripedTable(["Defense", "Key Attribute", "In a word", "Physical checks", "Mental checks"],
  (R.defenses || []).map(d => [{ text: d[0], bold: true }, d[1], d[2], d[3], d[4]]),
  [1400, 1400, 1900, 2400, 2260]));
if (R.postures) {
  kids.push(h2("Postures"));
  kids.push(para("When your character receives a blow, they may spend a reaction to take a Posture: a way of throwing themselves into it that buys a better result, but costs something whether or not it works. Postures may only be used before you know whether the attack succeeded. Training in Evade and Guard grants one each."));
  kids.push(stripedTable(["Posture", "Defense", "Effect"],
    R.postures.map(p => [{ text: p[0], bold: true }, p[1], p[2]]), [1900, 1200, 6260]));
}
kids.push(h2("Size"));
kids.push(stripedTable(["Size", "Space / token", "Natural Reach", "Effect on Evade & Guard"],
  (R.sizes || []).map(z => [{ text: z[0], bold: true }, z[1], z[2], z[3]]), [1500, 2400, 2000, 3460]));

kids.push(h1("Skills, Weapons & Combat Styles"));
kids.push(stripedTable(["Skill Constellation", "Key Attribute", "Covers"],
  (R.skillRoster || []).map(s => [{ text: s[0], bold: true }, s[1], s[2]]), [2100, 1500, 5760]));
kids.push(para("The Lore Constellation is a template: every Lore you take, Lore (Circus) or Lore (Warfare) or any other, is its own copy of it, so a character can grow several Lores side by side."));
kids.push(h2("Combat Styles"));
kids.push(para("A Combat Style is a school of exploits, not your attack bonus. Attacks always use your Weapons Proficiency, while the style you fight in sets the Attribute and opens that school's Talents."));
kids.push(stripedTable(["Style", "Feeds", "Fights with"],
  (R.weaponStyles || []).map(w => [{ text: w[0], bold: true }, w[1], w[2]]), [2600, 1400, 5360]));
kids.push(pb());

// ---------- every constellation, straight from the data ----------
kids.push(h1("The Constellations"));
kids.push(para("Every Constellation in the game, with its full Talent list and its star map. Tier is the Proficiency Rank a Talent needs: T Trained, E Expert, M Master, L Legendary. Every Talent costs exactly 1 Talent Point."));
const CATORDER = ["Ancestry", "Culture", "Bloodline", "Background", "Calling", "Defense", "Save", "Weapon", "Combat Style", "Skill", "Armor"];
const CATLABEL = { Save: "Defense", Heritage: "Bloodline" };
const byCat = {};
for (const [name, t] of Object.entries(trees)) {
  const c = CATLABEL[t.cat] || t.cat;
  (byCat[c] = byCat[c] || []).push(name);
}
const catOrder = [...CATORDER.filter(c => byCat[c]), ...Object.keys(byCat).filter(c => !CATORDER.includes(c)).sort()];
let treeCount = 0, talentCount = 0;
for (const c of catOrder) {
  kids.push(h2(c === "Skill" ? "Skill Constellations" : c === "Combat Style" ? "Combat Styles" : c + " Constellations"));
  for (const name of byCat[c].sort()) {
    const t = trees[name];
    kids.push(...treeHeader(name, t.meta, t.sparks));
    // bloodline roots are listed in the Ancestries chapter, never among buyable Talents
    const rows = t.nodes.filter(n => !n[5]);
    kids.push(treeTable(rows));
    treeCount++; talentCount += t.nodes.length;
  }
}
kids.push(pb());

// ---------- appendices ----------
kids.push(h1("Appendix A. Conditions"));
kids.push(stripedTable(["Condition", "In one line"],
  (R.conditions || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2200, 7160]));
kids.push(h2("Zones"));
kids.push(para("There are four Zones: Arms, Legs, Torso, Head. Each can carry its own armor for Protection. A Graze always Exposes a Zone, and an Exposed Zone's Protection counts as 0 until you Recenter."));
kids.push(stripedTable(["Zone", "Critical Hit", "Critical Hit on an Exposed Zone"],
  (R.zones || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1200, 4080, 4080]));

kids.push(h1("Appendix B. Traits"));
kids.push(para("A Trait is a word attached to an action, a Talent, an item, or another word that plugs it into a rule written somewhere else. A Trait is never flavor: if the word is in a Trait line, some rule cares about it."));
kids.push(h2("Action Traits"));
kids.push(stripedTable(["Trait", "What it means"], (R.actionTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [1800, 7560]));
kids.push(h2("Weapon Traits"));
kids.push(stripedTable(["Trait", "Effect"], (R.weaponTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2200, 7160]));
kids.push(h2("Armor Traits"));
kids.push(stripedTable(["Trait", "Effect"], (R.armorTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [1800, 7560]));

kids.push(h1("Appendix C. Actions & Activities"));
kids.push(para("An action takes one of the three you get each turn, marked ◆. An activity takes two or three and is a single indivisible thing. A free action ◇ costs nothing but can only be taken when its rule allows. A reaction ↺ happens on someone else's turn, and you get one per round."));
for (const [grp, rows] of Object.entries(R.actions || {})) {
  kids.push(h2(grp));
  kids.push(stripedTable(["Action / Activity", "Traits", "Effect"],
    rows.map(r => [{ text: r[0], bold: true }, r[1], fmtPara(r[2], 19)]), [1700, 1500, 6160]));
}
if (R.explorationActions) {
  kids.push(h2("Exploration Mode"));
  kids.push(stripedTable(["Activity", "Speed", "Effect"],
    R.explorationActions.map(r => [{ text: r[0], bold: true }, r[1], fmtPara(r[2], 19)]), [1600, 1100, 6660]));
}
if (R.downtimeActions) {
  kids.push(h2("Downtime Mode"));
  kids.push(stripedTable(["Activity", "Duration", "Effect"],
    R.downtimeActions.map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1600, 1300, 6460]));
}

kids.push(h1("Appendix D. Equipment"));
kids.push(h2("Armor"));
kids.push(para("Armor is worn in four places. Each piece has Protection, Load, and Traits. Load Strain is the total Load of your armor, less your Endure reduction, and it comes off your Evade and off any Might or Agility Skill check."));
kids.push(stripedTable(["Piece", "Zone", "Prot", "Load", "Price", "Traits", "Material"],
  (R.armorPieces || []).map(r => [{ text: r[0], bold: true }, r[1], String(r[2]), String(r[3]), r[4], r[5], r[6] || ""]),
  [1900, 900, 700, 700, 900, 2600, 1660]));
kids.push(h2("Armor of proof"));
kids.push(para("Against the damage type its material turns poorly, a piece's Protection is reduced by 1. A Zone with no armor has no material, and so has no such weakness."));
kids.push(stripedTable(["Material", "Turns poorly"], (R.materials || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2000, 2400]));
kids.push(h2("Shields"));
kids.push(stripedTable(["Shield", "Gear bonus to Guard when Raised", "Hardness", "Load", "Price", "Note"],
  (R.shields || []).map(r => [{ text: r[0], bold: true }, r[1] ? "+" + r[1] : "—", String(r[2]), String(r[3]), r[4], r[5] || ""]),
  [1300, 2200, 1000, 800, 900, 3160]));
kids.push(h2("Weapon Handling"));
kids.push(stripedTable(["Handling", "Meaning", "If you lack Familiarity"],
  (R.handling || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1400, 4000, 3960]));
kids.push(h2("Melee Weapons"));
kids.push(stripedTable(["Weapon", "Handling", "Group", "Damage", "Reach", "Traits", "Price"],
  (R.weaponsMelee || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], r[3], r[4], r[5], r[6] || ""]),
  [1700, 1100, 1200, 1000, 900, 2500, 960]));
kids.push(h2("Ranged Weapons"));
kids.push(stripedTable(["Weapon", "Handling", "Group", "Damage", "Range", "Traits"],
  (R.weaponsRanged || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], r[3], r[4], r[5]]),
  [1900, 1200, 1300, 1100, 1000, 2860]));

kids.push(h1("Appendix E. Thresholds"));
kids.push(para("A Threshold is what a roll is measured against: 10 + level + attribute + proficiency, the same sum as a check with a flat 10 in place of the die."));
kids.push(stripedTable(["Task level", "Threshold"], (R.thresholdTable || []).map(r => [r[0], r[1]]), [2000, 2000]));
kids.push(para("Adjust ±2 (easy/hard), ±5 (very), ±10 (extreme). Simple Thresholds by rank: Untrained 10, Trained 15, Expert 20, Master 30, Legendary 40."));
kids.push(h2("Damage: order of operations"));
kids.push(stripedTable(["Step", "What you do"], (R.damageOrder || []).map(r => [{ text: r[0], bold: true }, r[1]]), [900, 8460]));
kids.push(h2("Finding a Zone's Protection"));
kids.push(stripedTable(["Step", "What you do"], (R.protectionSteps || []).map(r => [{ text: r[0], bold: true }, r[1]]), [900, 8460]));

// ---------- assemble ----------
const doc = new Document({
  features: { updateFields: true },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] }] },
  styles: { default: { document: { run: { font: BODY, size: 21, color: INK } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "STARWROUGHT · Constellation Compendium", font: HEAD, size: 16, color: "8AA0A8", italics: true })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "generated from the game data  •  page ", font: BODY, size: 16, color: "8AA0A8" }), new TextRun({ children: [PageNumber.CURRENT], font: BODY, size: 16, color: "8AA0A8" })] })] }) },
    children: kids,
  }],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync("Starwrought_Constellation_Compendium.docx", b);
  console.log("written Starwrought_Constellation_Compendium.docx:", b.length, "bytes,",
              treeCount, "constellations,", talentCount, "talents");
});
