// STARWROUGHT Constellation Compendium: docx builder
//
// The Player's Handbook itself is hand-authored in Word and is the authoritative rules text.
// This script deliberately does NOT regenerate it: two sources of truth would drift apart.
// What it builds instead is the part that must track the data exactly, and that is painful to
// keep in sync by hand: every Constellation, every Talent, and the reference tables, all read
// straight from assets/trees.json, assets/roster.json, assets/actions.json, assets/backgrounds.json
// and assets/languages.json. The short rules paragraphs between the tables restate PHB v4.10.
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
// The handbook's action glyphs (⓿ ❶ ❷ ❸ ❹ ❺ ❻), the Reaction trait ↺ and the capstone ★ are not in
// Calibri or Georgia. Every run that carries one is set in a font that has them, so Word never
// shows tofu; Segoe UI Symbol ships with Windows and covers all of them (DejaVu Sans lacks ⓿).
const GLYPH_FONT = "Segoe UI Symbol";
const GLYPH_CLASS = "⓿❶❷❸❹❺❻↺★";
const GLYPH_SPLIT = new RegExp("([" + GLYPH_CLASS + "]+)");
const GLYPH_TEST = new RegExp("[" + GLYPH_CLASS + "]");
// v3.x data wrote ◆ per action and ◇ for free; they still parse (design brief, Glyphs) and print
// as the v4.10 glyphs.
const normGlyphs = s => String(s ?? "").replace(/◆{1,6}/g, m => "❶❷❸❹❺❻"[m.length - 1]).replace(/◇/g, "⓿");
// Everything that strips a Maneuver's cost out of its name: "Strike ❶ to ❸", "Aid ❶ (⓿↺)", "Kip Up ◆".
const COST_TAIL = /\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, COST_CHARS = /[◆◇↺★⓿❶❷❸❹❺❻]/g;
const stripCost = n => String(n ?? "").replace(COST_TAIL, "").replace(COST_CHARS, "").replace(/\s+(to|or)\s*$/i, "").trim();

// ---------- helpers ----------
// A run is an ARRAY of TextRuns: ordinary text in the requested font, glyphs in GLYPH_FONT.
function glyphRuns(text, props) {
  const t = normGlyphs(text);
  if (!GLYPH_TEST.test(t)) return [new TextRun({ ...props, text: t })];
  return t.split(GLYPH_SPLIT).filter(p => p !== "").map(p =>
    new TextRun({ ...props, text: p, font: GLYPH_TEST.test(p) ? GLYPH_FONT : props.font }));
}
const run = (t, o = {}) => glyphRuns(t, { font: BODY, size: 21, color: INK, ...o });
const flat = kids => (Array.isArray(kids) ? kids : [kids]).flat(Infinity);
const para = (t, o = {}) => new Paragraph({ children: Array.isArray(t) ? flat(t) : run(t, o.runOpts || {}), spacing: { after: 120, ...(o.spacing || {}) }, ...o.p || {} });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 160 }, children: glyphRuns(t, { font: HEAD, size: 40, bold: true, color: TEAL }) });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120 }, children: glyphRuns(t, { font: HEAD, size: 28, bold: true, color: EMBER }) });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 180, after: 100 }, children: glyphRuns(t, { font: HEAD, size: 23, bold: true, color: INK }) });
const bullet = (t, opts = {}) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: Array.isArray(t) ? flat(t) : run(t, opts) });
const pb = () => new Paragraph({ children: [new PageBreak()] });
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const thinB = { style: BorderStyle.SINGLE, size: 4, color: "CBD5DB" };

function cell(children, { w, fill, bold, color, size, align, vAlign, borders } = {}) {
  const kids = (Array.isArray(children) ? children : [children]).map((c) =>
    typeof c === "string"
      ? new Paragraph({ alignment: align, spacing: { after: 20, before: 20 }, children: run(c, { bold, color: color || INK, size: size || 19 }) })
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
  if (title) kids.push(new Paragraph({ spacing: { after: 60 }, children: glyphRuns(title, { font: HEAD, bold: true, size: 21, color: accent }) }));
  for (const l of lines) kids.push(typeof l === "string" ? new Paragraph({ spacing: { after: 40 }, children: run(l, { size: 20 }) }) : l);
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
function treeHeader(name, meta, sparks, parent) {
  // A Combat Style names its parent: its Talents count toward that parent's rank (PHB v4.10).
  const metaLine = parent ? meta + " • child of " + parent : meta;
  const arr = [h3(name), para([run(metaLine, { italics: true, size: 20, color: TEAL })], { spacing: { after: 60 }, p: { keepNext: true } }),
    ...(sparks ? [para([run("Example flares: ", { bold: true, size: 19, color: GOLD }), run(sparks, { italics: true, size: 19 })], { spacing: { after: 100 }, p: { keepNext: true } })] : [])];
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cp = "assets/constellations/" + slug + ".png";
  if (fs.existsSync(cp)) arr.push(img(cp, 4.7, 2.62));
  return arr;
}

// ---------- content data ----------
const trees = {}; // canonical source: data/*.xlsx -> assets/trees.json
{
  const _t = JSON.parse(fs.readFileSync("assets/trees.json", "utf8"));
  for (const [k, v] of Object.entries(_t)) {
    const rootName = stripCost((v.nodes.find(n => n.root) || {}).name || "");
    trees[k] = { meta: v.meta, sparks: v.sparks, cat: v.category, feeds: v.feeds, parent: v.parent || "", nodes: v.nodes.map(n => {
      let eff = n.effect;
      // root-requires are implicit game-wide (and drawn on the star map): print only the interesting ones
      const rq = (n.requires || []).filter(q => stripCost(q) !== rootName);
      if (rq.length && !/Requires /.test(eff.replace(/<[^>]+>/g, "")))
        eff = eff.replace(/\s+$/, "").replace(/([^.])$/, "$1.") + " Requires " + rq.join(" or ") + ".";
      if (n.feeds) eff += " <i>(feeds " + n.feeds + ")</i>";
      return [n.name, n.tier, n.cost, eff, !!n.root, !!n.hroot];
    }) };
  }
}

// minimal rich-HTML (<b><i><u><s>, color spans, <br>, <p>) -> docx runs
function fmtPara(html, size) {
  const kids = []; const st = { b: 0, i: 0, u: 0, s: 0, color: [] };
  // A paragraph break in a cell is a blank line here; a <br> is a line break. Without this the
  // compendium printed the tag itself, 145 times.
  const src = String(html).replace(/<\/p>\s*<p>/g, "<br><br>").replace(/<\/?p>/g, "");
  const tokens = src.split(/(<\/?(?:b|i|u|s)>|<br\s*\/?>|<span style="color:#[0-9A-Fa-f]{6}">|<\/span>)/);
  for (const tk of tokens) {
    if (!tk) continue;
    if (/^<br/.test(tk)) { kids.push(new TextRun({ break: 1 })); continue; }
    if (tk === "<b>") st.b++; else if (tk === "</b>") st.b--;
    else if (tk === "<i>") st.i++; else if (tk === "</i>") st.i--;
    else if (tk === "<u>") st.u++; else if (tk === "</u>") st.u--;
    else if (tk === "<s>") st.s++; else if (tk === "</s>") st.s--;
    else if (tk.startsWith("<span")) st.color.push(tk.match(/#([0-9A-Fa-f]{6})/)[1]);
    else if (tk === "</span>") st.color.pop();
    else {
      const txt = tk.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      kids.push(...glyphRuns(txt, { font: BODY, size: size || 19, color: st.color.length ? st.color[st.color.length - 1] : INK,
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
// data/actions.xlsx, by way of actions.json: authoritative for any action it names, so a roster
// row of the same name is left out of the appendix rather than printed twice.
let ACTS = { actions: [] };
try { ACTS = JSON.parse(fs.readFileSync("assets/actions.json", "utf8")); } catch (e) {}
const actionsFromSheet = new Set((ACTS.actions || []).map(a => stripCost(a.name).toLowerCase()));
const bareAction = n => stripCost(n).toLowerCase();
// An actions.json cost is "0".."6" (or "passive") with `reaction` and `reactionCost` beside it;
// the v3.x keys "free" and "reaction" still print (design brief, Glyphs).
const COST_GLYPH = { 0: "⓿", 1: "❶", 2: "❷", 3: "❸", 4: "❹", 5: "❺", 6: "❻", passive: "", free: "⓿" };
function costText(a) {
  let cost = String(a.cost ?? ""), reaction = !!a.reaction;
  if (cost === "reaction") { cost = "0"; reaction = true; }
  const min = COST_GLYPH[cost] ?? "";
  const max = a.costMax !== undefined && a.costMax !== "" && String(a.costMax) !== cost ? (COST_GLYPH[String(a.costMax)] ?? "") : "";
  const range = max ? `${min} ${a.costMode === "or" ? "or" : "to"} ${max}` : min;
  if (!reaction) return range.trim();
  const rc = String(a.reactionCost ?? "");
  // A Maneuver whose Reaction half has a cost of its own prints both, as Aid ❶ (⓿↺) does.
  if (rc !== "" && rc !== cost) return `${range} (${COST_GLYPH[rc] ?? ""}↺)`.trim();
  return `${range}↺`.trim();
}
const notSheet = rows => (rows || []).filter(r => !actionsFromSheet.has(bareAction(r[0])));
// A sheet Type prints in the mode its name says (Exploration, Downtime), else with the encounter maneuvers.
const modeOf = t => /exploration/i.test(t) ? "Exploration" : /downtime/i.test(t) ? "Downtime" : "Encounter";
function sheetActionTables(kids, mode) {
  for (const type of [...new Set((ACTS.actions || []).filter(a => modeOf(a.type) === mode).map(a => a.type))]) {
    kids.push(h2(type));
    kids.push(stripedTable(["Maneuver", "Cost", "Traits", "Effect"],
      ACTS.actions.filter(a => a.type === type).map(a => [
        { text: a.name, bold: true }, costText(a), (a.traits || []).join(", "),
        fmtPara([
          a.requirements ? `<b>Requirements</b> ${a.requirements}<br>` : "",
          a.trigger ? `<b>Trigger</b> ${a.trigger}<br>` : "",
          a.description ? `<i>${a.description}</i><br>` : "",
          a.effect
        ].join(""), 19)
      ]), [1500, 900, 1200, 5760]));
  }
}

const stripT = (x) => String(x == null ? "" : x).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
const vigorOf = a => a.vigor ?? a.hp ?? "";
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
  "This book is generated from the game data, not written by hand. Every Constellation, Talent, Maneuver and reference table below is read straight out of assets/trees.json, assets/roster.json and assets/actions.json, so it is never out of step with the app, the Foundry system, or the character sheet.",
  "The rules themselves live in the Player's Handbook (v4.10), which is written by hand. The short paragraphs between the tables restate it; where the two ever disagree, the handbook wins and this file needs a rebuild.",
], PAPER, TEAL));
kids.push(para([run("Contents: ", { bold: true }), run("the character-creation menus (Ancestries and Bloodlines, Cultures, Backgrounds, Callings, Defenses), then every Constellation in the game with its full Talent list and star map, then the reference appendices: conditions and Zones, Vigor and Wounds, traits, Maneuvers and Activities, equipment, and the damage tables.")]));
kids.push(new Paragraph({ children: [new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" })] }));
kids.push(pb());

// ---------- the creation menus ----------
kids.push(h1("Character Creation at a Glance"));
kids.push(stripedTable(["Step", "You choose…", "You get…", "Talent Points"],
  (R.chargenSteps || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], { text: r[3], bold: true, color: TEAL }]),
  [1500, 3600, 2300, 1960]));
kids.push(para([run("A finished 1st-level character has at least 14 Talent Points spent: ", { bold: true }), run("one granted automatically (Melee Training or Ranged Training, your choice) and thirteen from creation: 3 Origin, 3 Skill (your Calling's free Training is one of them), 1 Lore, 1 Calling, 2 Defense, and 3 Comets. Some choices grant more, so your total may be higher. Points are never banked: each is spent the moment it arrives.")]));
kids.push(h2("Types of Talent Point"));
kids.push(stripedTable(["Type", "May be spent on", "Flare required?"],
  (R.talentPointTypes || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [2200, 5000, 2160]));
kids.push(h2("Rank Math, Attributes and Checks"));
kids.push(para([run("Ranks. ", { bold: true }), run("Every Talent costs exactly 1 Talent Point, and your running total in a Constellation sets your Proficiency Rank there, gated by level: Trained +3 (1 point, level 1), Expert +6 (4 points, level 5), Master +9 (9 points, level 10), Legendary +12 (16 points, level 15). Buying a Constellation's root is what makes you Trained in it; nothing else in it can be bought first. Capstones (★) need a Master Talent in the same Constellation.")]));
kids.push(para([run("Parents. ", { bold: true }), run("Melee and Ranged are parent Constellations. Every Combat Style is a child of one of them, and every Talent you buy in a child counts toward the parent's rank as well as the child's. Only rank is inherited: the parent's own Talents must still be bought for their effects, and a Talent's Attribute Point is counted once, at its own Constellation.")]));
kids.push(para([run("Attributes. ", { bold: true }), run("Every Talent feeds one Attribute (Might, Agility, Wits, or Presence), usually its Constellation's Key Attribute. Attribute Bonus = Attribute Points ÷ 4, rounded down, to a maximum of +5: 0 to 3 points is +0, 4 to 7 is +1, 8 to 11 is +2, and every 4 more adds +1. A single point in a Constellation buys proficiency, not an Attribute Bonus.")]));
kids.push(para([run("Checks. ", { bold: true }), run("One formula for everything: d20 + Attribute Bonus + Proficiency Bonus + Situation, Condition and Gear bonuses and penalties. Level never touches the die; it opens the door to higher ranks and pays out Talent Points. A Threshold is 10 + the same modifier, so a Guard of +7 is a Guard Threshold of 17, and an adversary's Thresholds are built the same way. Bonuses of the same type do not stack: take the highest bonus and the worst penalty of each type, and add across types.")]));

kids.push(h1("Ancestries & Bloodlines"));
kids.push(para("Your Ancestry is the body you were born in. It forms the trunk of your Origin Constellation and sets your Vigor per level, Size, Speed (in feet per Move ❶), and one special ability. Your Bloodline is the lineage inside it, and adds a branch. Both roots are Origin Talent Points granted by the choices themselves."));
kids.push(stripedTable(["Ancestry", "Vigor/lvl", "Size", "Speed", "Senses", "Key Attribute"],
  (R.ancestries || []).map(a => [{ text: a.name, bold: true }, String(vigorOf(a)), a.size || "Medium", a.speed,
    a.senses || "—", (trees[a.tree] || {}).feeds || "—"]), [2000, 1000, 1400, 1300, 2200, 1460]));
for (const a of (R.ancestries || [])) {
  const t = trees[a.tree]; if (!t) continue;
  kids.push(h3(a.name + ": Vigor " + vigorOf(a) + " • " + (a.size || "Medium") + " • " + a.speed));
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
kids.push(para("Callings are what other games call classes, except the signature feature sits at the root, so your very first point buys the fantasy. Each Calling grants Training in one Skill or other Constellation, gives you a special ability, and adds Vigor (if it is your first Calling). Only your first Calling adds its Opening Vigor, once, at 1st level, however many you open later."));
kids.push(stripedTable(["Calling", "Free Training", "Opening Vigor", "Key Attribute", "Special Ability"],
  (R.callings || []).map(c => [{ text: c[0], bold: true }, c[1], String(c[2]), c[3], c[4]]),
  [1500, 1500, 1100, 1400, 3860]));

kids.push(h1("Defenses"));
kids.push(para("Your four Defenses are Constellations like any other. You begin play Trained in two of them, your choice; the other two stay Untrained until you spend Defense Talent Points on them, and an Untrained Defense still adds its Attribute. Each works two ways: your check is what you roll, and your Threshold (10 + the same modifier) is what someone else has to beat."));
kids.push(para("Every threat is a Blow, a Blast, a Blight, or a Beguilement, and each kind is answered by two Defenses: Guard (Presence) meets Blows and holds its nerve against Beguilement; Evade (Agility) slips Blows and Blasts; Endure (Might) stands through Blasts and Blights; Awareness (Wits) catches Blights early and sees through Beguilement. Guard answers a ranged Blow only with a shield Raised, and is unavailable when you are unaware of the attack or have nothing to ward with; Evade is unavailable while you are Grabbed or Restrained; Endure and Awareness are never unavailable."));
kids.push(stripedTable(["Defense", "Key Attribute", "In a word", "Physical checks", "Mental checks"],
  (R.defenses || []).map(d => [{ text: d[0], bold: true }, d[1], d[2], d[3], d[4]]),
  [1400, 1400, 1900, 2400, 2260]));
if (R.postures) {
  // The roster's `postures` block holds the Reactions of the Exchange (PHB v4.10, Answering an Attack).
  kids.push(h2("Reactions"));
  kids.push(para("You may always roll one of the two Defenses that answer a threat, however many actions you have left: that is your basic defense. For the chance to do better you use a Reaction ↺: a Maneuver performed the moment the attack is declared, paid for from the same six actions you attack with, on anyone's Opportunity and as often in a round as you can afford. Each is granted by a Talent; without the Talent, the basic roll is all you have. A Reaction never triggers another Reaction. A Posture ⓿↺ costs no actions, but it always Exposes a Zone of your choice until the end of the round, and Recenter does not clear it."));
  kids.push(stripedTable(["Reaction", "Granted by • Defense", "Effect"],
    notSheet(R.postures).map(p => [{ text: p[0], bold: true }, p[1], fmtPara(p[2], 19)]), [1700, 2200, 5460]));
}
kids.push(h2("Size"));
kids.push(stripedTable(["Size", "Space / token", "Natural Reach", "Effect on Evade & Guard"],
  (R.sizes || []).map(z => [{ text: z[0], bold: true }, z[1], z[2], z[3]]), [1500, 2400, 2000, 3460]));

kids.push(h1("Skills, Melee, Ranged & Combat Styles"));
kids.push(stripedTable(["Skill Constellation", "Key Attribute", "Covers"],
  (R.skillRoster || []).map(s => [{ text: s[0], bold: true }, s[1], s[2]]), [2100, 1500, 5760]));
kids.push(para("The Lore Constellation is a template: every Lore you take, Lore (Circus) or Lore (Warfare) or any other, is its own copy of it, so a character can grow several Lores side by side."));
kids.push(h2("Melee, Ranged and the Combat Styles"));
kids.push(para("Melee and Ranged are the parent Constellations of every weapon. Melee Training adds its Proficiency Bonus to attacks with anything in your hand and grants the Intercept ❶↺ Reaction, and Counter ❶↺ once you are Expert in it; Ranged Training covers anything that leaves your hand, a thrown dagger included. You begin play Trained in one of the two, your choice. A Combat Style is a school of exploits, not your attack bonus: attacks always use your Melee or Ranged Proficiency, while the style sets the Attribute and opens that school's Talents. Every Combat Style is a child of Melee or Ranged, so every Talent you buy in it also counts toward the parent's rank."));
kids.push(stripedTable(["Style", "Feeds", "Fights with"],
  (R.weaponStyles || []).map(w => [{ text: w[0], bold: true }, w[1], w[2]]), [2600, 1400, 5360]));
kids.push(pb());

// ---------- every constellation, straight from the data ----------
kids.push(h1("The Constellations"));
kids.push(para("Every Constellation in the game, with its full Talent list and its star map. Tier is the Proficiency Rank a Talent needs: T Trained, E Expert, M Master, L Legendary. Every Talent costs exactly 1 Talent Point. A Combat Style's header names its parent; its Talents count toward that parent's rank as well as its own."));
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
  kids.push(h2(c === "Skill" ? "Skill Constellations" : c === "Combat Style" ? "Combat Styles" : c === "Weapon" ? "Melee and Ranged" : c + " Constellations"));
  for (const name of byCat[c].sort()) {
    const t = trees[name];
    kids.push(...treeHeader(name, t.meta, t.sparks, t.parent));
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
kids.push(para("There are four Zones: Arms, Legs, Torso, Head. Each can carry its own armor for Protection. Hits go to the Torso unless a Zone is Exposed or the Hit is Critical, when the attacker chooses. An Exposed Zone's Protection counts as 0 against a Deliberate ❷ or Committed ❸ Strike, an ordinary Hit from one may be placed there, and a Critical Hit on it with one Wounds it; a Quick Strike ❶ gains nothing from it. Recenter ❶ clears every Exposed Zone on you except one a Posture Exposed, which lasts until the end of the round."));
kids.push(stripedTable(["Zone", "Critical Hit", "Critical Hit on an Exposed Zone"],
  (R.zones || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1200, 4080, 4080]));
kids.push(h2("Vigor, Wounds and Dying"));
kids.push(para([run("Vigor. ", { bold: true }), run("Vigor is what you have left in you: wind, focus, and luck. At 1st level it is your Ancestry's Vigor + Endure Bonus + your first Calling's Opening Vigor + 10, and every level after adds your Ancestry's Vigor + Endure Bonus again. The Endure Bonus is Endure Training's conditioning clause, read from your rank as it stands: nothing at Trained, 1 at Expert rank in Endure, 2 at Master, 3 at Legendary. Only your first Calling adds its Opening Vigor, however many you open later. A night's rest restores your level × your Presence if that is positive, and otherwise your level. Temporary Vigor is one pool laid over it and spent first; a larger pool replaces a smaller one, and losing it does not make you Spent.")]));
kids.push(para([run("Spent. ", { bold: true }), run("At 0 Vigor you are Spent: still on your feet, but every Hit that lands Wounds the Zone it struck, and a Critical Hit inflicts two. A Graze never Wounds. Damage cannot take you below 0, and nonlethal damage that would Wound a Spent creature knocks it out instead.")]));
kids.push(para([run("Wounds. ", { bold: true }), run("A Wound is a real injury to a Zone, taken when a Critical Hit with a Deliberate or Committed Strike lands on an Exposed Zone (an attack with the Massive trait Wounds on any Critical Hit), or when any Hit lands while you are Spent. Its effect is the Zone's critical effect made lasting: Arms, −2 Situation to attacks and Guard, then a useless arm; Legs, Speed halved, then Prone and unable to Stand; Torso, Off-Guard and 1d4 persistent bleed, then Dying; Head, no Reactions, then Dying and unconscious. A Medium or smaller creature's Zone carries two Wounds (Large 3, Huge 4, Gargantuan 5), every Wound between the first and the last repeats the first effect, and a further Wound to a useless Arm or Leg goes to the Torso. Wounds do not clear with Recenter or rest: treating one takes ten minutes and an Endure check against 10 + the Wounds carried, and it heals after a week of Downtime.")]));
if (R.wounds) kids.push(stripedTable(["Zone", "First Wound", "Final Wound"],
  (R.wounds || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1200, 4080, 4080]));
kids.push(para([run("Dying. ", { bold: true }), run("Dying begins when your Torso or Head takes its final Wound: Dying 1, or 2 if the blow was a Critical Hit. You are unconscious and helpless; damage while Dying adds 1 (2 from a Critical Hit), and at Dying 5 you die. At the start of each round make a Recovery check: Endure against 10 + your Dying value + the Wounds you carry. An adjacent ally may spend ❶ for a +2 Situation bonus to it, and any Vigor restored ends Dying at once. When you would die you may spend all your Hero Points to refuse it: Dying 0, unconscious and stable at 0 Vigor, Wounds intact.")]));
if (R.recovery) kids.push(stripedTable(["Recovery check", "Effect"],
  (R.recovery || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2200, 7160]));

kids.push(h1("Appendix B. Traits"));
kids.push(para("A Trait is a word attached to a Maneuver, a Talent, an item, or another word that plugs it into a rule written somewhere else. A Trait is never flavor: if the word is in a Trait line, some rule cares about it."));
kids.push(h2("Maneuver Traits"));
kids.push(stripedTable(["Trait", "What it means"], (R.actionTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [1800, 7560]));
kids.push(h2("Weapon Traits"));
kids.push(stripedTable(["Trait", "Effect"], (R.weaponTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2200, 7160]));
kids.push(h2("Armor Traits"));
kids.push(stripedTable(["Trait", "Effect"], (R.armorTraits || []).map(r => [{ text: r[0], bold: true }, r[1]]), [1800, 7560]));

kids.push(h1("Appendix C. Maneuvers & Activities"));
kids.push(para("A Maneuver is anything you do at an Opportunity: a Step, a Strike, a Gain Control, a spell. Every combatant receives six actions at the start of each round, and each Maneuver costs some of them, marked ⓿ to ❻; unspent actions expire when the round ends. Initiative order is fixed and play cycles through it. Each time it reaches you is an Opportunity: perform one Maneuver you can afford, begin or finish a Prepared Maneuver, or Pass. A ⓿ Maneuver costs nothing and never uses up your Opportunity. A Maneuver of two or more actions is a single indivisible thing; one of three or more is Prepared: one action now, the rest reserved, resolved at your next Opportunity. A Reaction ↺ is a Maneuver performed outside your Opportunity, the moment its Trigger occurs, paid from the same six; a Reaction never triggers another Reaction. When a full circuit passes in which everyone Passes, the round ends."));
sheetActionTables(kids, "Encounter");
for (const [grp, rows] of Object.entries(R.actions || {})) {
  const kept = notSheet(rows);
  if (!kept.length) continue;
  kids.push(h2(/maneuver/i.test(grp) ? grp : grp + " Maneuvers"));
  kids.push(stripedTable(["Maneuver", "Traits", "Effect"],
    kept.map(r => [{ text: r[0], bold: true }, r[1], fmtPara(r[2], 19)]), [1700, 1500, 6160]));
}
if (R.explorationActions) {
  kids.push(h2("Exploration Mode"));
  sheetActionTables(kids, "Exploration");
  const kept = notSheet(R.explorationActions);
  if (kept.length) kids.push(stripedTable(["Activity", "Speed", "Effect"],
    kept.map(r => [{ text: r[0], bold: true }, r[1], fmtPara(r[2], 19)]), [1600, 1100, 6660]));
}
if (R.downtimeActions) {
  kids.push(h2("Downtime Mode"));
  sheetActionTables(kids, "Downtime");
  const kept = notSheet(R.downtimeActions);
  if (kept.length) kids.push(stripedTable(["Activity", "Duration", "Effect"],
    kept.map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1600, 1300, 6460]));
}

kids.push(h1("Appendix D. Equipment"));
kids.push(para("Your sword does not make you accurate and your armor does not make you hard to hit. Skill does that, and skill lives in your Constellations. Gear decides what happens when steel finally meets you: a weapon sets the size of the wound, armor sets how much of it your body actually feels. There are no magic plusses; quality and enchantment give a piece Traits, never numbers."));
kids.push(h2("Armor"));
kids.push(para("Armor is worn in four places, one piece per Zone. Each piece has Protection, Load, and Traits. Protection subtracts from every instance of damage that lands on its Zone, a Graze included, and on its own never reduces damage below 1. Load Strain is the Load of all the armor you are wearing and of a shield you carry, less 1 for a matched harness and less your Endure relief (1 at Trained, 2 at Expert, 3 at Master, 4 at Legendary), to a minimum of 0. It never comes off your Evade: it shortens your Rush and Leap by its value in feet, and Climb, Swim, and Stealth checks take it as a penalty. Wind: if your Load Strain is at least 1 and your Endure Threshold is less than 10 + your Load Strain, then at the end of every round while in an encounter you roll Endure against 10 + Load Strain, and on a failure your Fatigued rises by 1 (a −N Condition penalty to Evade, Guard, and attack rolls, to a maximum of 3; it ends after ten minutes of rest). A fighter whose Endure Threshold meets 10 + Load Strain never rolls for Wind. A closed helm gives a −2 Situation penalty to Awareness checks, your Awareness Threshold and Initiative; an open helm −1. Putting on or taking off a single piece takes 1 minute per point of Protection it has. An Attended piece takes that long only with a second pair of hands; alone, putting it on takes twice as long, though it comes off in the usual time."));
kids.push(stripedTable(["Piece", "Zone", "Prot", "Load", "Price", "Traits", "Material"],
  (R.armorPieces || []).map(r => [{ text: r[0], bold: true }, r[1], String(r[2]), String(r[3]), r[4], r[5], r[6] || ""]),
  [1900, 900, 700, 700, 900, 2600, 1660]));
kids.push(h2("Armor of proof"));
kids.push(para("Against the damage type its material turns poorly, a piece's Protection is reduced by 1. A Zone with no armor has no material, and so has no such weakness. A matched harness (four pieces of one material and one Protection value) adds +1 Protection to your Torso and takes 1 off your Load Strain."));
kids.push(stripedTable(["Material", "Turns poorly"], (R.materials || []).map(r => [{ text: r[0], bold: true }, r[1]]), [2000, 2400]));
kids.push(h2("Shields"));
kids.push(para("A shield is not armor: it grants no Protection, because it does not cover a Zone. It improves Guard, and only while Raised. Raise a Shield ❶ grants its Gear bonus to Guard until your next Opportunity. A Raised shield is a rigid implement: you may Parry, Bind and Gain Control with it, and a tower shield gives you Cover when Raised. Hardness matters only with the Shield Block Talent."));
kids.push(stripedTable(["Shield", "Gear bonus to Guard when Raised", "Hardness", "Load", "Price", "Note"],
  (R.shields || []).map(r => [{ text: r[0], bold: true }, r[1] ? "+" + r[1] : "—", String(r[2]), String(r[3]), r[4], r[5] || ""]),
  [1300, 2200, 1000, 800, 900, 3160]));
kids.push(h2("Weapons"));
kids.push(para("A weapon gives you a damage die and a handful of Traits. It never touches your attack roll: that comes from your Melee or Ranged Proficiency and your Strike Attribute, the higher of the weapon's natural Attribute (Might, or Agility for a Finesse weapon and for any ranged weapon other than a composite bow or a thrown weapon) and the Key Attribute of a Combat Style whose root you own and whose weapons you are wielding. A Deliberate ❷ or Committed ❸ Hit deals your weapon dice (one; two at 4th level, three at 8th, four at 12th, five at 16th), plus your weapon specialization (+2 at Expert, +3 at Master, +4 at Legendary), plus your Might unless the weapon is Mechanical. A Quick ❶ Hit deals one die plus precision damage; a Graze deals one die and nothing else, and Protection cannot take it below 1. There is no multiple attack penalty: the price of another Strike is the actions it costs. The Parry trait is a +1 Gear bonus to Guard against melee Attacks while you wield the weapon; a Flexible weapon cannot Parry, form a Bind, or be Bound."));
kids.push(h3("Weapon Handling"));
kids.push(stripedTable(["Handling", "Meaning", "If you lack Familiarity"],
  (R.handling || []).map(r => [{ text: r[0], bold: true }, r[1], r[2]]), [1400, 4000, 3960]));
kids.push(h3("Melee Weapons"));
kids.push(stripedTable(["Weapon", "Handling", "Group", "Damage", "Reach (ft)", "Traits", "Price"],
  (R.weaponsMelee || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], r[3], r[4], r[5], r[6] || ""]),
  [1700, 1100, 1200, 1000, 900, 2500, 960]));
kids.push(h3("Ranged Weapons"));
kids.push(stripedTable(["Weapon", "Handling", "Group", "Damage", "Range", "Traits"],
  (R.weaponsRanged || []).map(r => [{ text: r[0], bold: true }, r[1], r[2], r[3], r[4], r[5]]),
  [1900, 1200, 1300, 1100, 1000, 2860]));

kids.push(h1("Appendix E. Thresholds and Damage"));
kids.push(para("A Threshold is what a roll is measured against: 10 + Attribute Bonus + Proficiency Bonus, plus any bonuses and penalties that apply. It is the same sum as the check, with a flat 10 in place of the die, and there is no level term anywhere in it. Monsters carry Thresholds for their attacks and Defenses and the player rolls against them; a Threshold the GM sets for a task sits on the same scale."));
kids.push(para("Beat the Threshold by 10 or more and it is a critical success (a Critical Hit, for an Attack); meet or beat it, a success (a Hit); miss it by less than 10, a failure (a Graze: Stopped, but one die or one round lands, and position shifts the defender's way); miss by 10 or more, a critical failure (a Miss: nothing lands, and the attacker is Exposed). A natural 20 or 1 steps the result one degree. The player always rolls, so the defender reads the same bands from the other side."));
if ((R.thresholdTable || []).length) {
  kids.push(h2("Thresholds by task level"));
  kids.push(stripedTable(["Task level", "Threshold"], R.thresholdTable.map(r => [r[0], r[1]]), [2000, 2000]));
}
kids.push(h2("Damage: order of operations"));
kids.push(para("Work top to bottom after rolling the dice. Weakness is added before Resistance is subtracted; a Critical Hit doubles the total before Protection comes off; a Deadly die is a critical effect of the weapon and lands after the doubling, before Protection."));
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
