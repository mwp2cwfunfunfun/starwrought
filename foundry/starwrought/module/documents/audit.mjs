/**
 * The player-edit announcer (0.5.1, T10).
 *
 * "Any time a player adjusts the number of actions they have left, it should go out to everyone's
 * chat. Same for Temporary Vigor, Dying, gear and money, Exposed, Size, Senses, Languages,
 * Familiarity, or anything in the Adjustments section." (Mike, v0.51 TODO.) So every update a
 * player makes by hand is read here and said once, in public, as a small card spoken by the
 * character: "Temp Vigor: 0 to 5", "Exposed Head on", "Hrolda adds Longsword".
 *
 * Only the client that made the change posts (the hooks fire everywhere; `userId` says whose
 * edit it was), and only for a player: the GM's own edits are silent. The system's own paths that
 * already put a card on the table (a spend, Recenter, a Posture's reveal, damage, Recovery,
 * Refuse Death, a night's rest, the round's reset) pass `{ swAnnounced: true }` in the update
 * options and are skipped, as is anything the creation wizard writes while its flag is on the
 * actor. The "before" values are read in the pre-update hook, which runs on the editing client
 * before the change lands, and carried to the post-update hook on the operation itself.
 */

import * as SW from "../config.mjs";

const { escapeHTML, flattenObject, getProperty } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** Register the hooks. Called once from starwrought.mjs at init. */
export function registerAudit() {
  Hooks.on("preUpdateActor", onPreUpdateActor);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.on("createItem", onCreateItem);
  Hooks.on("deleteItem", onDeleteItem);
  Hooks.on("preUpdateItem", onPreUpdateItem);
  Hooks.on("updateItem", onUpdateItem);
}

/* -------------------------------------------- */
/*  What is watched                             */
/* -------------------------------------------- */

/** A string value as the card prints it: quoted when it has words, "(blank)" when it has none. */
const text = value => {
  const s = String(value ?? "").trim();
  return s ? `"${s}"` : localize("STARWROUGHT.Audit.blank");
};

/** A Set or an Array of strings, joined; the empty one says so. */
const list = value => {
  const arr = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return arr.length ? arr.join(", ") : localize("STARWROUGHT.Audit.blank");
};

/** Resistances and Weaknesses: rows of {type, value}, as the sheet's own field spells them. */
const damageMods = value => {
  const rows = Array.isArray(value) ? value : [];
  return rows.length ? rows.map(r => `${r.type} ${r.value}`).join(", ") : localize("STARWROUGHT.Audit.blank");
};

const number = value => String(Number(value) || 0);

/** The fixed paths, each with the label its line carries and how its value is printed. */
const FIELDS = Object.freeze({
  "system.actions.value": { label: "STARWROUGHT.Audit.actions", format: number },
  "system.vigor.temp": { label: "STARWROUGHT.Field.tempVigor", format: number },
  "system.dying": { label: "STARWROUGHT.Field.dying", format: number },
  "system.heroPoints.value": { label: "STARWROUGHT.Field.heroPoints", format: number },
  "system.size": {
    label: "STARWROUGHT.Field.size",
    format: value => (SW.SIZES[value] ? localize(SW.SIZES[value].label) : text(value))
  },
  "system.details.ancestry.senses": { label: "STARWROUGHT.Field.senses", format: text },
  "system.details.senses": { label: "STARWROUGHT.Field.senses", format: text },
  "system.details.languages": { label: "STARWROUGHT.Field.languages", format: text },
  "system.familiarity": { label: "STARWROUGHT.Field.familiarity", format: list },
  "system.traits.resistances": { label: "STARWROUGHT.Field.resistances", format: damageMods },
  "system.traits.weaknesses": { label: "STARWROUGHT.Field.weaknesses", format: damageMods },
  "system.traits.immunities": { label: "STARWROUGHT.Field.immunities", format: list },
  "system.bonuses.attack": { label: "STARWROUGHT.Field.attackBonus", format: number },
  "system.bonuses.damage": { label: "STARWROUGHT.Field.damageBonus", format: number },
  "system.bonuses.checks": { label: "STARWROUGHT.Field.checkBonus", format: number },
  "system.bonuses.initiative": { label: "STARWROUGHT.Field.initiativeBonus", format: number },
  "system.bonuses.speed": { label: "STARWROUGHT.Field.speedBonus", format: number },
  "system.bonuses.vigor": { label: "STARWROUGHT.Field.vigorBonus", format: number },
  "system.bonuses.protection": { label: "STARWROUGHT.Field.protectionBonus", format: number }
});

const DEFENSE_BONUS = /^system\.bonuses\.defenses\.(\w+)$/;
const COIN = /^system\.currency\.(\w+)$/;
const EXPOSED = /^system\.zones\.(\w+)\.exposed$/;

/**
 * The lines one actor update produces, read against the actor as it stands before the change.
 * @param {Actor} actor
 * @param {object} changes  The update's diff.
 * @returns {string[]}  HTML-safe lines; empty when nothing watched moved.
 */
export function auditLines(actor, changes) {
  const flat = flattenObject(changes ?? {});
  const lines = [];
  const same = (a, b) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));

  for (const [path, next] of Object.entries(flat)) {
    const field = FIELDS[path];
    const defense = path.match(DEFENSE_BONUS);
    const coin = path.match(COIN);
    const zone = path.match(EXPOSED);
    if (!field && !defense && !coin && !zone) continue;

    const previous = getProperty(actor, path);
    if (same(previous, next)) continue;

    if (zone) {
      const label = SW.ZONES[zone[1]] ? localize(SW.ZONES[zone[1]].label) : zone[1];
      lines.push(escapeHTML(format(next ? "STARWROUGHT.Audit.exposedOn" : "STARWROUGHT.Audit.exposedOff", { zone: label })));
      continue;
    }

    let label;
    let show = number;
    if (field) {
      label = localize(field.label);
      show = field.format;
    } else if (defense) {
      const def = SW.DEFENSES[defense[1]];
      label = format("STARWROUGHT.Audit.defenseBonus", { defense: def ? localize(def.label) : defense[1] });
    } else {
      label = format("STARWROUGHT.Audit.coin", { coin: coin[1] });
    }
    lines.push(escapeHTML(format("STARWROUGHT.Audit.change", { field: label, from: show(previous), to: show(next) })));
  }
  return lines;
}

/** Sets become arrays so a SetField's old value compares with the array the sheet submits. */
function normalise(value) {
  if (value instanceof Set) return [...value];
  if (value === undefined) return null;
  return value;
}

/* -------------------------------------------- */
/*  Who is talking                              */
/* -------------------------------------------- */

/**
 * Is this a player's own hand edit, made on this client, that the audit should read? The GM's
 * edits are silent; so is anything a system path marked as already said, and anything the
 * system created on its own (`swAuto`).
 */
function mine(options, userId) {
  if (userId !== game.user.id) return false;
  if (game.user.isGM) return false;
  if (options?.swAnnounced || options?.swAuto) return false;
  return true;
}

/**
 * The creation wizard writes identity fields in bulk and takes them back on Start over; that is
 * creation, not adjustment. Its flag is on the actor from the first step to Finish.
 */
function inChargen(actor, changes = null) {
  if (!actor) return false;
  if (actor.getFlag(SW.SYSTEM_ID, "chargen")) return true;
  const flags = changes?.flags?.[SW.SYSTEM_ID];
  return !!flags && (("chargen" in flags) || ("-=chargen" in flags));
}

/** The actor a physical Item belongs to, or null when the Item is not gear on an actor. */
function gearOwner(item) {
  if (item?.parent?.documentName !== "Actor") return null;
  return SW.PHYSICAL_TYPES.includes(item.type) ? item.parent : null;
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

function onPreUpdateActor(actor, changes, options, userId) {
  if (!mine(options, userId)) return;
  if (inChargen(actor, changes)) return;
  const lines = auditLines(actor, changes);
  // Carried on the operation, which the server echoes back to the post-update hook.
  if (lines.length) options.swAudit = lines;
}

function onUpdateActor(actor, changes, options, userId) {
  if (userId !== game.user.id) return;
  const lines = options?.swAudit;
  if (!Array.isArray(lines) || !lines.length) return;
  postAudit(actor, lines).catch(err => console.error("STARWROUGHT | the adjustment card could not be posted", err));
}

function onCreateItem(item, options, userId) {
  if (!mine(options, userId)) return;
  const actor = gearOwner(item);
  if (!actor || inChargen(actor)) return;
  const line = escapeHTML(format("STARWROUGHT.Audit.adds", { name: actor.name, item: item.name }));
  postAudit(actor, [line]).catch(err => console.error("STARWROUGHT | the adjustment card could not be posted", err));
}

function onDeleteItem(item, options, userId) {
  if (!mine(options, userId)) return;
  const actor = gearOwner(item);
  if (!actor || inChargen(actor)) return;
  const line = escapeHTML(format("STARWROUGHT.Audit.drops", { name: actor.name, item: item.name }));
  postAudit(actor, [line]).catch(err => console.error("STARWROUGHT | the adjustment card could not be posted", err));
}

function onPreUpdateItem(item, changes, options, userId) {
  if (!mine(options, userId)) return;
  const actor = gearOwner(item);
  if (!actor || inChargen(actor)) return;
  const lines = [];
  const state = changes.system?.state;
  if ((state !== undefined) && (state !== item.system.state)) {
    const word = key => (SW.CARRY_STATES[key] ? localize(SW.CARRY_STATES[key].label) : String(key ?? ""));
    lines.push(escapeHTML(format("STARWROUGHT.Audit.state", {
      item: item.name, from: word(item.system.state), to: word(state)
    })));
  }
  const quantity = changes.system?.quantity;
  if ((quantity !== undefined) && (Number(quantity) !== Number(item.system.quantity))) {
    lines.push(escapeHTML(format("STARWROUGHT.Audit.quantity", {
      item: item.name, from: Number(item.system.quantity) || 0, to: Number(quantity) || 0
    })));
  }
  if (lines.length) options.swAudit = lines;
}

function onUpdateItem(item, changes, options, userId) {
  if (userId !== game.user.id) return;
  const lines = options?.swAudit;
  if (!Array.isArray(lines) || !lines.length) return;
  const actor = gearOwner(item);
  if (!actor) return;
  postAudit(actor, lines).catch(err => console.error("STARWROUGHT | the adjustment card could not be posted", err));
}

/* -------------------------------------------- */
/*  The card                                    */
/* -------------------------------------------- */

/**
 * One public card per batch, spoken by the actor, in the action-card style with a small
 * "Adjusted" heading and one line per change.
 * @param {Actor} actor
 * @param {string[]} lines  Already escaped.
 */
async function postAudit(actor, lines) {
  const items = lines.map(line => `<li>${line}</li>`).join("");
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="starwrought action-card sw-audit-card" data-actor-uuid="${actor.uuid}">
      <h3><i class="fa-solid fa-pen-to-square"></i> ${localize("STARWROUGHT.Audit.title")}</h3>
      <ul class="sw-audit-lines">${items}</ul></div>`,
    flags: { [SW.SYSTEM_ID]: { kind: "audit", actorUuid: actor.uuid } }
  });
}
