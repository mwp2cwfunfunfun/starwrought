/**
 * The Bind's rules, decided in one place (0.27.0; PHB v4.25, Binds and Ending a Bind; rulings 269
 * to 280).
 *
 * Through 0.26.1 the three rules that end a Bind around an attack lived inside a character's weapon
 * Strike (documents/actor/attack.mjs), so an adversary's attack, a Cast and an adversary's Intercept
 * ended nothing; no movement ended one; and Gain Control and Close were cards. Every one of those
 * questions is answered here, from plain data, and the callers only write what this says:
 *
 *  - `attackBindPlan`: what an attack does to the Binds of its attacker and its defenders, once for
 *    the whole attack (combat/attack-coordinator.mjs, and a Strike with no target in
 *    documents/actor/attack.mjs);
 *  - `movementBindPlan`: whether a fighter's own movement ends its Bind, and whether the movement is
 *    a Close (documents/movement.mjs);
 *  - `bindOffer`: what a Stopped Blow offers the defender on the card (dice/check/position.mjs);
 *  - `gainControlOutcome`: who holds the line after a Gain Control (documents/actor/bind.mjs,
 *    documents/cards/gain-control.mjs);
 *  - `sizeGap`, `momentaryFor`, `momentaryStep`: Size and Binds.
 *
 * PURE: no `game`, `CONFIG`, `foundry` or `ui` anywhere, and no Actor either. Every argument is a
 * plain object the caller reads off its documents, so `assets/test_rules.mjs` drives this file from
 * Node. It imports the config files it needs directly, never the barrel's consumers.
 */

import { sameName } from "../config/names.mjs";
import { SIZE_ORDER, MOMENTARY_SIZE_GAP } from "../config/sizes.mjs";
import { invertDegree } from "../config/degrees.mjs";

/** Why a Bind ended, as the keys of `STARWROUGHT.Bind.endedBy.*`. */
export const BIND_END_REASONS = Object.freeze(["strike", "unbound", "cast", "thirdParty", "moved"]);

/**
 * `flags.starwrought.momentaryControl` on a Controller whose Control is a momentary one (ruling
 * 278): `{ bindId, combat, combatant, begun }`, counted by `momentaryStep`.
 */
export const MOMENTARY_FLAG = "momentaryControl";

/**
 * The flag on the Off-Guard a Critical Success on Gain Control put on its target ("Off-Guard until
 * its next Opportunity"): the condition is the Gain Control's own, taken off only when flagged.
 */
export const PRESSED_FLAG = "pressed";

/**
 * Is this attack made with the implement the Bind holds? The book's two halves hang on it: "A
 * participant uses the bound implement to Strike" (the Strike resolves, then the Bind ends, and a
 * Controlled implement takes the -2) against "attacks with an unbound weapon or limb" (the Bind
 * ends before the attack roll).
 *
 *  - a spell is never the bound implement (ruling 273: a Cast is an attack, and not with it);
 *  - a Bind that names no implement of this side holds whatever the fighter attacks with;
 *  - the attack named as the Bind's `mine` is the bound one;
 *  - an adversary with one attack row attacks with it whatever the names say (0.19.0; the rule the
 *    adversary's Controlled penalty has always read).
 *
 * @param {{state?: string, mine?: string}|null} bind  This fighter's side of the Bind.
 * @param {{source?: "weapon"|"attack"|"spell", name?: string, rowCount?: number}} [attack]
 * @returns {boolean}
 */
export function usesBoundImplement(bind, { source = "weapon", name = "", rowCount = 0 } = {}) {
  if (!bind?.state) return false;
  if (source === "spell") return false;
  if (!bind.mine) return true;
  if (name && sameName(bind.mine, name)) return true;
  return (source === "attack") && (rowCount <= 1);
}

/**
 * What one attack does to the Binds around it (PHB v4.25, Ending a Bind), decided ONCE for the
 * whole attack, before any pairing resolves: a sweep at a third party and at the Bind partner must
 * not find the Bind already gone when the partner's pairing is read, and an adversary's Controlled
 * -2 must reach every defender of the attack, not only the first.
 *
 * The attacker's Bind always ends when the attacker attacks:
 *  - with the bound implement: "A Strike against the other Bind participant resolves before the
 *    Bind ends" (reason `strike`);
 *  - with another weapon or limb: "the Bind ends before the attack roll" (reason `unbound`);
 *  - with a spell (ruling 273; reason `cast`).
 * THE SHIELD EXCEPTION (ruling 270; Chapter 5: "a shield that Controls a foe's weapon opens a Zone
 * for the sword in your other hand"): while the attacker's shield holds the Control and the attack
 * is a Strike at the Controlled partner, the Strike is read as one with the bound implement.
 *
 * A defender who Controls someone other than the attacker loses that Control: "A third party
 * attacks the combatant who currently has Control" (reason `thirdParty`). An ally attacking the
 * Controlled creature breaks nothing, and neither does the partner attacking its Controller (that
 * attack ends the same Bind from the attacker's side).
 *
 * What survives the Bind for this attack rides on the result (ruling 276), since every Bind named
 * here is ended before the first card:
 *  - `controlledAttack`: the attack is made with a Controlled implement, so it takes the -2;
 *  - `zones`: by defender id, the Zone the attacker's Control held open on that defender, which
 *    this attack's damage may still be placed on ("resolves before the Bind ends").
 *
 * @param {object} args
 * @param {{uuid?: string, bind?: object|null, shields?: string[]}} args.attacker  `shields` are the
 *   names of the shields the attacker carries in hand.
 * @param {Array<{id: string, uuid?: string, bind?: object|null}>} args.defenders
 * @param {{source?: string, name?: string, rowCount?: number}} args.maneuver
 * @returns {{ends: Array<{uuid: string, bindId: string, reason: string}>, controlledAttack: boolean,
 *   zones: Record<string, string>}}
 */
export function attackBindPlan({ attacker = {}, defenders = [], maneuver = {} } = {}) {
  const ends = [];
  const zones = {};
  let controlledAttack = false;
  const bind = attacker?.bind?.state ? attacker.bind : null;

  if (bind) {
    const source = maneuver?.source ?? "weapon";
    const bound = usesBoundImplement(bind, maneuver ?? {});
    const partner = defenders.find(d => !!d?.uuid && (d.uuid === bind.partnerUuid)) ?? null;
    const shield = !bound && (source === "weapon") && (bind.state === "controlling") && !!partner
      && (attacker.shields ?? []).some(name => sameName(name, bind.mine));
    const resolvesFirst = bound || shield;
    controlledAttack = bound && (bind.state === "controlled");
    if (resolvesFirst && partner && (bind.state === "controlling") && bind.zone) zones[partner.id] = bind.zone;
    ends.push({
      uuid: attacker.uuid ?? "",
      bindId: bind.id ?? "",
      reason: (source === "spell") ? "cast" : (resolvesFirst ? "strike" : "unbound")
    });
  }

  for (const defender of defenders) {
    const theirs = defender?.bind;
    if (theirs?.state !== "controlling") continue;
    if (theirs.partnerUuid && (theirs.partnerUuid === attacker?.uuid)) continue;
    if (ends.some(end => end.uuid === defender.uuid)) continue;
    ends.push({ uuid: defender.uuid ?? "", bindId: theirs.id ?? "", reason: "thirdParty" });
  }

  return { ends, controlledAttack, zones };
}

/**
 * Does this fighter's own movement end its Bind (PHB v4.25: "Either participant Moves or Steps,
 * unless an ability expressly preserves the Bind"; ruling 269)? The caller hands over only a drag
 * the system counts as that fighter's own movement (a Move, a Step, a Rush or a Crawl in a started
 * encounter); giving ground, a Shove and a GM's repositioning never reach this.
 *
 *  - CLOSE (ruling 277; the row: "Step toward that foe. The Bind does not end due to this
 *    movement"): the Controller's Step that ends nearer the partner keeps the Bind. No click names
 *    it: the Step toward the foe IS the Close, at the Step's own cost.
 *  - SIZE (ruling 278; "The larger creature can Move without first breaking the Bind"): two or
 *    more Sizes apart, the larger fighter's movement keeps the Bind.
 *  - anything else ends it.
 *
 * @param {object} args
 * @param {{state?: string}|null} args.bind  The mover's side of the Bind.
 * @param {string} args.kind  The drag as classified: move | step | rush | crawl.
 * @param {boolean} [args.towardPartner]  The drag ends nearer the partner than it began.
 * @param {number} [args.sizeGap]  Sizes between the two (`sizeGap`).
 * @param {boolean} [args.moverIsLarger]
 * @returns {{ends: boolean, close: boolean, larger: boolean}}
 */
export function movementBindPlan({ bind, kind = "move", towardPartner = false, sizeGap: gap = 0, moverIsLarger = false } = {}) {
  if (!bind?.state) return { ends: false, close: false, larger: false };
  if ((gap >= MOMENTARY_SIZE_GAP) && moverIsLarger) return { ends: false, close: false, larger: true };
  if ((bind.state === "controlling") && (kind === "step") && towardPartner) return { ends: false, close: true, larger: false };
  return { ends: true, close: false, larger: false };
}

/**
 * What a Stopped Blow offers the defender (PHB v4.25, Binds: "A Bind forms when a rigid weapon or
 * shield Guards against a melee Attack that Grazes or Misses, provided the implements involved can
 * Bind. Graze. A neutral Bind forms. Miss. The defender gains Control of the attacking implement.").
 *
 *  - A QUICK STRIKE that is Stopped forms at most a neutral Bind (ruling 272; `controllable` is the
 *    Strike kind's own flag).
 *  - PARRY follows its Talent (ruling 271, replacing 131): "If the Strike is a Graze or a Miss, you
 *    may immediately attempt to Gain Control of the attacking weapon." A Miss of a Deliberate or
 *    Committed Strike hands over Control to any Guard; where the Bind a Parry leaves is neutral, the
 *    card adds Gain Control at no further cost (the Subordinate Maneuver rule).
 *  - RIPOSTE ("After you successfully Parry, instead of Controlling the attacking weapon, you may
 *    at once make a Quick Strike against its owner") stands beside either, when owned.
 *
 * @param {object} args
 * @param {string} args.outcome  miss | graze | hit | critical.
 * @param {string|null} args.defense  The Defense that answered.
 * @param {boolean} args.rigid  The defender holds a rigid implement.
 * @param {boolean} args.bindable  The attack can be bound (melee, not Flexible, not Unparryable).
 * @param {boolean} args.controllable  The Strike kind can be Controlled on a Miss.
 * @param {boolean} [args.parried]  The answer was a Reaction whose Stop is Parry's.
 * @param {boolean} [args.ownsRiposte]
 * @returns {{mode: "control"|"neutral", gainControl: boolean, riposte: boolean}|null}  Null when
 *   the Stop forms no Bind.
 */
export function bindOffer({ outcome, defense, rigid, bindable, controllable, parried = false, ownsRiposte = false } = {}) {
  if (!["miss", "graze"].includes(outcome)) return null;
  if ((defense !== "guard") || !rigid || !bindable) return null;
  const control = !!controllable && (outcome === "miss");
  return {
    mode: control ? "control" : "neutral",
    gainControl: !!parried && !control,
    riposte: !!parried && !!ownsRiposte
  };
}

/**
 * Who holds the line after a Gain Control (the row: "Critical Success You Control the weapon, and
 * the target is Off-Guard until its next Opportunity. Success You Control the weapon. Failure A
 * neutral Bind forms. Critical Failure You pressed badly. The target Controls your weapon
 * instead."). A Failure makes the Bind neutral even when the foe held Control (ruling 274).
 *
 * An adversary rolls nothing: its partner rolls Guard against the adversary's Attack Threshold and
 * the degree is read from the other side (ruling 275; `inverted`), as a Defense roll is.
 *
 * @param {string} degree  critSuccess | success | fail | critFail, as rolled.
 * @param {{state?: string, inverted?: boolean}} [options]  `state` is the side of the one who
 *   USED Gain Control, before the roll.
 * @returns {{degree: string, state: "controlling"|"neutral"|"controlled", pressed: boolean,
 *   changed: boolean}|null}  `state` is that same fighter's side afterwards.
 */
export function gainControlOutcome(degree, { state = "neutral", inverted = false } = {}) {
  const read = inverted ? invertDegree(degree) : degree;
  const after = { critSuccess: "controlling", success: "controlling", fail: "neutral", critFail: "controlled" }[read];
  if (!after) return null;
  return { degree: read, state: after, pressed: read === "critSuccess", changed: after !== state };
}

/**
 * The Sizes between two creatures (PHB v4.25, Size and Binds: "Creatures of the same Size, or one
 * Size apart, Bind normally"). A Size the table does not know counts as Medium.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function sizeGap(a, b) {
  return Math.abs(sizeIndex(a) - sizeIndex(b));
}

/** Is `a` the larger of the two? */
export function isLarger(a, b) {
  return sizeIndex(a) > sizeIndex(b);
}

function sizeIndex(size) {
  const index = SIZE_ORDER.indexOf(String(size ?? "").toLowerCase());
  return (index < 0) ? SIZE_ORDER.indexOf("medium") : index;
}

/**
 * Is a Control momentary (ruling 278; "When the combatants are two or more Sizes apart, the smaller
 * creature can gain only momentary Control. That Control ends after its first benefit is used or
 * at the end of the controller's next Opportunity, whichever comes first.")?
 * @param {string} controllerSize
 * @param {string} controlledSize
 * @returns {boolean}
 */
export function momentaryFor(controllerSize, controlledSize) {
  return (sizeIndex(controlledSize) - sizeIndex(controllerSize)) >= MOMENTARY_SIZE_GAP;
}

/**
 * Count a momentary Control's window on a change of Opportunity. The record is the Controller's
 * own (`flags.starwrought.momentaryControl`): `{ bindId, combat, combatant, begun }`, written when
 * the Control is, `begun` false until the Controller's NEXT Opportunity begins (one that is running
 * when the Control is taken is not the next one).
 *
 *  - "begin": the Controller's Opportunity has begun; the window is running;
 *  - "release": that Opportunity has ended, or the encounter has, or the record is another
 *    Combat's: the Control falls back to a neutral Bind (it does not outlive its encounter);
 *  - "drop": the Control or its Bind is gone already; forget the record;
 *  - null: nothing to do.
 *
 * @param {{bindId?: string, combat?: string, combatant?: string, begun?: boolean}|null} record
 * @param {{combat?: string, began?: string|null, ended?: string|null, bindId?: string,
 *   controlling?: boolean, over?: boolean}} change  `bindId` and `controlling` are the Controller's
 *   Bind now; `over` when the encounter itself has ended.
 * @returns {"begin"|"release"|"drop"|null}
 */
export function momentaryStep(record, { combat = "", began = null, ended = null, bindId = "", controlling = false, over = false } = {}) {
  if (!record) return null;
  if (!controlling || (record.bindId !== bindId)) return "drop";
  if (over || (record.combat && combat && (record.combat !== combat))) return "release";
  if (record.begun && ended && (ended === record.combatant)) return "release";
  if (!record.begun && began && (began === record.combatant)) return "begin";
  return null;
}
