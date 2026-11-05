/**
 * The Actor document.
 *
 * Everything a character does at the table is a method here: rolling a check, answering a blow,
 * settling Position, Recentering, taking a Wound, going down, and coming back. The rules
 * arithmetic lives in the data model; this class is the verbs.
 *
 * PHB v4.10 vocabulary, as the code uses it: six actions a round, spent across Opportunities;
 * a Strike is Quick ❶, Deliberate ❷ or Committed ❸ (Prepared); a Reaction is paid from the same
 * six; Vigor is what stands between a blow and the body, Spent is 0 Vigor, Wounds are per Zone,
 * and Dying begins when the Torso or the Head carries its final Wound.
 *
 * Since 0.10.1 the verbs are written one section per file in module/documents/actor/, each a mixin
 * over the class before it, composed here in the order below; every method is still
 * `actor.<name>()` and no caller moved. A `#private` member is scoped to the file that declares it,
 * so a helper two sections share is a module function, never a private. This file keeps the
 * composition, the lookups and the lifecycle hooks.
 */

import * as SW from "../config.mjs";
import { rulesOfKind as rulesOfKindOn } from "../rules/engine.mjs";
// THE BIND'S PAIR (0.10.1): the uuid resolver, defined once with the pair-keeper.
import { resolveActor as resolveActorByUuid } from "./bind.mjs";
import { ConditionsMixin } from "./actor/conditions.mjs";
import { WoundsMixin } from "./actor/wounds.mjs";
import { ChecksMixin } from "./actor/checks.mjs";
import { DefenseMixin } from "./actor/defense.mjs";
import { AttackMixin } from "./actor/attack.mjs";
import { PointsMixin } from "./actor/points.mjs";
import { ActionsMixin } from "./actor/actions.mjs";
import { CarryingMixin } from "./actor/carrying.mjs";
import { PositionMixin } from "./actor/position.mjs";
import { AurasMixin } from "./actor/auras.mjs";
import { BindMixin } from "./actor/bind.mjs";
import { FlaresMixin } from "./actor/flares.mjs";
import { RestMixin } from "./actor/rest.mjs";
import { CastMixin } from "./actor/cast.mjs";

/**
 * The sections, in the order they are layered over Foundry's Actor. The order carries no meaning
 * beyond reading: no section overrides another's method, and `super` in a section reaches Actor.
 */
const SECTIONS = [
  ConditionsMixin,
  WoundsMixin,
  ChecksMixin,
  DefenseMixin,
  AttackMixin,
  PointsMixin,
  ActionsMixin,
  CarryingMixin,
  PositionMixin,
  AurasMixin,
  BindMixin,
  FlaresMixin,
  RestMixin,
  CastMixin
];

const Composed = SECTIONS.reduce((Base, mixin) => mixin(Base), Actor);

export class SwActor extends Composed {
  /* -------------------------------------------- */
  /*  Lookups                                     */
  /* -------------------------------------------- */

  /**
   * The Actor behind a uuid, whether the uuid names an Actor or a Token.
   * @param {string} uuid
   * @returns {Actor|null}
   */
  static resolveActor(uuid) {
    return resolveActorByUuid(uuid);
  }

  /**
   * The rules of one kind across every owned Talent, action and Constellation Item (0.9.0;
   * ruling 119), from the index the data model collects at prepare (`system.rules.byKind`,
   * SwActorData#_prepareRules). Each entry is `{ rule, item }`: the stored rule, with whatever its
   * kind's `parse` put in it, and the Item carrying it. The engine's own `rulesOfKind` does the
   * reading, so an alias resolves to its kind's id here as it does in a cell, and a party, which
   * has no SwActorData and so no index, is collected on the spot and answers an empty list like
   * any actor with no rules. This is the question a kind's engine hook asks: since 0.10.0 the
   * `modifiers` dispatcher (ruleModifiers in rules/engine.mjs) asks it for every registered kind
   * from the check engine and the Defense pass (ruling 124), and the `bonus` kind answers for
   * Humanity. No damage, condition, movement or aura code reads the index yet; those hook points
   * are defined with the first kind that needs each (ruling 119). An unknown kind's rules sit in
   * `system.rules.unknown`, not here.
   * @param {string} kind  The kind's word, as before the colon in the cell.
   * @returns {Array<{rule: object, item: Item}>}
   */
  rulesOfKind(kind) {
    return rulesOfKindOn(this, kind);
  }

  /**
   * This actor's token on the current scene: the one you have selected if it is one of yours,
   * otherwise the first. Null when the actor is not on the map, in which case nothing that needs a
   * distance applies.
   * @returns {TokenDocument|null}
   */
  tokenOnScene() {
    if (this.isToken) return this.token;
    const docs = this.getActiveTokens(false, true);
    return docs.find(d => d.object?.controlled) ?? docs[0] ?? null;
  }

  /* -------------------------------------------- */
  /*  Creation                                    */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * A party (0.7.0, party-sheet-plan.md: "GM-owned, default ownership Observer so every player can
   * open it") is created linked, since there is one document and no copies of it on a map, and
   * with Observer as its default ownership unless whoever created it set a default of their own.
   * It gets none of the body's token settings: no sight, no bars, no footprint from a Size it does
   * not have. Nothing draws a party token in phase 1.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    if (this.type === SW.PARTY_TYPE) {
      const source = {
        prototypeToken: { actorLink: true, displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, width: 1, height: 1 }
      };
      if (data.ownership?.default === undefined) {
        source.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
      }
      this.updateSource(source);
      return;
    }

    const prototypeToken = {
      sight: { enabled: true },
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    };
    if (this.type === "character") {
      Object.assign(prototypeToken, { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
    }
    // The grid is 1 foot, so a Medium creature is a 3x3 token rather than a 1x1.
    const space = SW.SIZES[data.system?.size ?? "medium"]?.space ?? 3;
    prototypeToken.width = space;
    prototypeToken.height = space;
    this.updateSource({ prototypeToken });
  }

  /** @inheritdoc */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    // Keep the token footprint honest when Size changes: the grid is in feet.
    const size = changes.system?.size;
    if (size && SW.SIZES[size]) {
      const space = SW.SIZES[size].space;
      foundry.utils.setProperty(changes, "prototypeToken.width", space);
      foundry.utils.setProperty(changes, "prototypeToken.height", space);
    }
  }
}
