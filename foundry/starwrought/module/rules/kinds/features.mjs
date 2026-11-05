/**
 * The feature kinds of 0.16.0: what owning a Talent does to the character, one small kind per
 * fact, each read from a `[KEYWORD data]` block of a feature line (../features.mjs; the shape of
 * Fantasy Grounds' PC feature automation, Mike's choice of 2026-11-05). None has an engine hook:
 * the build writes the chassis Items' fields from the Root's blocks (assets/parse_rules.mjs fills
 * the roster records first), the wizard consumes a choice and a free Talent, `SwItem` grants a
 * Maneuver when the Talent lands, and the character's data model reads the rest from any owned
 * Talent at prepare (a `[SPEED +1]` Talent, a `[TRAIT X]`, a `[LANGUAGE X]`).
 *
 *   [TRAIT Human]                   trait     { name }
 *   [SIZE Medium]                   size      { size }          a key of SW.SIZES
 *   [SPEED 6]  [SPEED +1]           speed     { feet, mode }    mode "set" | "add"
 *   [VIGOR 8]  [VIGOR opening 12]   vigor     { value, scope }  scope "level" | "opening"
 *   [SENSES Low-light vision]       sense     { name }
 *   [LANGUAGE Common, Serrovine]    language  { languages }
 *   [MANEUVER Steady the Line]      maneuver  { name, slug }    an action row, by the resolver
 *   [TALENT Weapon Familiarity]     talent    { name }          the Free Talent column's successor
 *   [CHOICE Weapon Group]           choice    { prompt }        the Choice column's successor
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { SIZES, slugify, plainName } from "../../config.mjs";

/** A block's data, or the refusal when the line is not a feature line. */
function blockData(args, context, keyword, shape) {
  if (context?.form && (context.form !== "feature")) {
    throw new RuleSyntaxError(`${keyword} is a feature and is written in brackets: \`${shape}\``);
  }
  const data = String(args ?? "").trim();
  if (!data) throw new RuleSyntaxError(`${keyword} is written \`${shape}\``);
  return data;
}

export const trait = {
  id: "trait",
  aliases: [],
  parse(args, context = {}) {
    const name = blockData(args, context, "TRAIT", "[TRAIT Human]");
    if (!/^[A-Za-z][A-Za-z0-9 '-]*$/.test(name)) throw new RuleSyntaxError(`"${name}" is not a trait word`);
    return { name };
  },
  summary(rule) { return `has the ${rule?.name ?? ""} trait`; },
  hooks: {}
};

export const size = {
  id: "size",
  aliases: [],
  parse(args, context = {}) {
    const word = blockData(args, context, "SIZE", "[SIZE Medium]").toLowerCase();
    if (!Object.hasOwn(SIZES, word)) {
      const names = Object.keys(SIZES).map(s => s[0].toUpperCase() + s.slice(1));
      throw new RuleSyntaxError(`"${word}" is not a Size: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
    }
    return { size: word };
  },
  summary(rule) { return `is ${rule?.size ? rule.size[0].toUpperCase() + rule.size.slice(1) : ""} size`; },
  hooks: {}
};

export const speed = {
  id: "speed",
  aliases: [],
  parse(args, context = {}) {
    const text = blockData(args, context, "SPEED", "[SPEED 6] or [SPEED +1]").replace(/\s*(ft\.?|feet)$/i, "").trim();
    const m = text.match(/^([+-]?)(\d+)$/);
    if (!m) throw new RuleSyntaxError(`SPEED is written \`[SPEED 6]\` (the Speed in feet) or \`[SPEED +1]\` (an adjustment), not "${text}"`);
    const feet = Number(m[2]) * (m[1] === "-" ? -1 : 1);
    const mode = m[1] ? "add" : "set";
    if ((mode === "set") && (feet < 1)) throw new RuleSyntaxError("a Speed is 1 foot or more");
    if ((mode === "add") && (feet === 0)) throw new RuleSyntaxError("an adjustment of 0 does nothing");
    return { feet, mode };
  },
  summary(rule) {
    return rule?.mode === "add" ? `Speed ${rule.feet > 0 ? "+" : ""}${rule.feet} ft` : `Speed ${rule?.feet ?? ""} ft per Move`;
  },
  hooks: {}
};

export const vigor = {
  id: "vigor",
  aliases: [],
  parse(args, context = {}) {
    const text = blockData(args, context, "VIGOR", "[VIGOR 8] or [VIGOR opening 12]");
    const m = text.match(/^(?:(opening|level)\s+)?(\d+)(?:\s+(opening|level))?$/i);
    if (!m) throw new RuleSyntaxError(`VIGOR is written \`[VIGOR 8]\` (Vigor per level) or \`[VIGOR opening 12]\` (a Calling's Opening Vigor), not "${text}"`);
    const scope = (m[1] ?? m[3] ?? "level").toLowerCase();
    const value = Number(m[2]);
    if (value < 1) throw new RuleSyntaxError("Vigor is 1 or more");
    return { value, scope };
  },
  summary(rule) { return rule?.scope === "opening" ? `${rule.value} Opening Vigor` : `${rule?.value ?? ""} Vigor per level`; },
  hooks: {}
};

export const sense = {
  id: "sense",
  aliases: [],
  parse(args, context = {}) {
    return { name: blockData(args, context, "SENSES", "[SENSES Low-light vision]") };
  },
  summary(rule) { return `has ${rule?.name ?? ""}`; },
  hooks: {}
};

export const language = {
  id: "language",
  aliases: [],
  parse(args, context = {}) {
    const text = blockData(args, context, "LANGUAGE", "[LANGUAGE Common, Serrovine]");
    const languages = text.split(/\s*[,;•]\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    if (!languages.length) throw new RuleSyntaxError("LANGUAGE names at least one language");
    return { languages };
  },
  summary(rule) { return `knows ${(rule?.languages ?? []).join(", ")}`; },
  hooks: {}
};

export const maneuver = {
  id: "maneuver",
  aliases: [],
  parse(args, context = {}) {
    const name = blockData(args, context, "MANEUVER", "[MANEUVER Steady the Line]");
    const resolve = context?.resolve;
    if (typeof resolve === "function") {
      const found = resolve(name);
      if (!found || (found.type !== "action") || !found.slug) throw new RuleSyntaxError(`"${name}" is not a Maneuver: a [MANEUVER ...] names a row of data/maneuvers.xlsx`);
      return { name: String(found.name ?? name), slug: String(found.slug), enabled: found.enabled !== false };
    }
    return { name, slug: slugify(plainName(name)), enabled: true };
  },
  summary(rule) { return `grants the ${rule?.name ?? ""} Maneuver`; },
  hooks: {}
};

export const talent = {
  id: "talent",
  aliases: [],
  parse(args, context = {}) {
    return { name: plainName(blockData(args, context, "TALENT", "[TALENT Weapon Familiarity]")) };
  },
  summary(rule) { return `grants the ${rule?.name ?? ""} Talent free`; },
  hooks: {}
};

export const choice = {
  id: "choice",
  aliases: [],
  parse(args, context = {}) {
    return { prompt: blockData(args, context, "CHOICE", "[CHOICE Weapon Group]") };
  },
  summary(rule) { return `asks for a ${rule?.prompt ?? ""} at creation`; },
  hooks: {}
};

export const FEATURE_KINDS = Object.freeze([trait, size, speed, vigor, sense, language, maneuver, talent, choice]);
