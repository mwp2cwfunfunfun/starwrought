/**
 * The Talent data model. Shared pieces: cost.mjs, aura.mjs, rules.mjs. The layout is item.mjs's:
 * one file per type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { costFields, migrateCost, prepareCost } from "./cost.mjs";
import { auraFields, prepareAura, applyAuraRule } from "./aura.mjs";
import { rulesFields, prepareRules } from "./rules.mjs";
// The `grant` rule kind (0.13.0): the Grants column's successor; the kind file is pure.
import { toGrantField } from "../../rules/kinds/grant.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Talent                                      */
/* -------------------------------------------- */

/** One Talent. Every Talent costs exactly 1 Talent Point, from the humblest to the most legendary. */
export class SwTalentData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      constellation: new fields.StringField({ initial: "" }),
      constellationName: new fields.StringField({ initial: "" }),
      tier: new fields.StringField({ required: true, choices: Object.keys(SW.TIERS), initial: "T" }),
      /** Buying the Root is what makes you Trained. Nothing else can be bought before it. */
      root: new fields.BooleanField({ initial: false }),
      /** A Bloodline root: granted by the chargen choice, never listed among buyable Talents. */
      bloodlineRoot: new fields.BooleanField({ initial: false }),
      capstone: new fields.BooleanField({ initial: false }),
      requires: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
      prerequisites: new fields.StringField({ initial: "" }),
      /** A Talent may feed an Attribute other than its Constellation's Key Attribute. */
      attribute: new fields.StringField({ required: false, blank: true, initial: "" }),
      effect: new fields.HTMLField({ initial: "" }),
      /** Action cost, if this Talent is something you do rather than something you are. */
      ...costFields("passive"),
      /** A restricted Talent Point this Talent hands out. */
      grant: new fields.SchemaField({
        n: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        mode: new fields.StringField({ initial: "" }),
        scope: new fields.StringField({ initial: "" }),
        /** The Constellation a Trained Root is directed at (0.16.0, `[Acrobatics trained]`); "" for a point by scope. */
        constellation: new fields.StringField({ initial: "" })
      }),
      /**
       * A build-time pick the Talent's effect demands, and what the player picked. Weapon
       * Familiarity is the case this exists for: without the answer recorded, the Talent has no
       * mechanical effect at all, because nothing knows which Weapon Group you are Familiar with.
       */
      choice: new fields.SchemaField({
        prompt: new fields.StringField({ initial: "" }),
        value: new fields.StringField({ initial: "" })
      }),
      /** Another Talent this one hands over outright, with no Talent Point spent. */
      freeTalent: new fields.StringField({ initial: "" }),
      /**
       * A spell (PHB v4.21, Spellwork; 0.11.0): the structured columns of a magic sheet (Threat,
       * Delivery, Range, Die, Damage, Targets, Quick, Focused, Committed, Defenses; data/README.txt),
       * which `assets/build_foundry.mjs` writes here as the Aura column's precedent. A Talent with
       * `enabled` and a Threat is cast with the Cast Maneuver (SwActor#castSpell: ❷ Quick, ❸ Focused,
       * ❹ Committed) and rolls the discipline's Proficiency with its Key Attribute against the
       * Defenses the Threat permits (`defenses` when the sheet names them, else SW.THREATS'); its
       * damage is `die` per rank of the discipline, typed `types[0]`, delivered `delivery`. The three
       * effect texts are what the card prints; an area, a push, a condition on a Hit, a summons or
       * a healing line stays prose for the table (ruling 136: no Might, no sheet damage bonus).
       */
      spell: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        threat: new fields.StringField({ initial: "" }),
        delivery: new fields.StringField({ initial: "" }),
        /** Range in feet; 0 when the sheet names none. */
        range: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        adjacent: new fields.BooleanField({ initial: false }),
        die: new fields.NumberField({ required: true, nullable: true, integer: true, min: 2, initial: null }),
        types: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
        targets: new fields.StringField({ initial: "" }),
        defenses: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
        effects: new fields.SchemaField({
          quick: new fields.StringField({ initial: "" }),
          focused: new fields.StringField({ initial: "" }),
          committed: new fields.StringField({ initial: "" })
        })
      }),
      /** The "within N feet" of the Effect, drawn on the map (0.5.1). */
      ...auraFields(),
      /** The Automation cell and the rules read from it (0.9.0). See rulesFields. */
      ...rulesFields()
    });
  }

  /**
   * @inheritdoc
   * The v3.4 Weapons Constellation split into Melee and Ranged (PHB v4.10). A Talent still filed
   * under Weapons is filed under Melee, since that is where a weapon in hand rolls; a character
   * whose training was really Ranged moves the Talent by hand.
   */
  static migrateData(source) {
    migrateCost(source, "talent");
    if (source.constellation === SW.WEAPONS_SLUG) {
      source.constellation = SW.MELEE_SLUG;
      if (source.constellationName) source.constellationName = SW.getConstellation(SW.MELEE_SLUG).name;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    this.tierLabel = SW.TIERS[this.tier]?.label ?? "";
    this.requiredRank = SW.TIERS[this.tier]?.rank ?? "trained";
    prepareCost(this);
    // A Talent the book moved between Constellations follows it (Loose and Move, Archery to
    // Ranged in v4.10): the owned copy keeps its id and counts where the book now files it.
    const moved = SW.MOVED_TALENTS[SW.slugify(this.parent?.name ?? "")];
    if (moved && (this.constellation === moved.from)) {
      this.constellation = moved.to;
      this.constellationName = SW.getConstellation(moved.to).name;
    }
    /** A Talent that wants an answer and has not been given one is not doing anything yet. */
    this.needsChoice = !!this.choice.prompt && !this.choice.value;
    if (!this.constellation && this.constellationName) {
      this.constellation = SW.slugify(this.constellationName);
    }
    // The `aura` and `grant` rules in the Automation cell are the authoring (0.13.0): the field is
    // re-derived from the rule here, as the build wrote it, so a GM's edit of the textarea on a
    // world Item takes effect at once and the wizard and the canvas read the fields they always did.
    applyAuraRule(this);
    const grantRule = (this.rules ?? []).find(r => (r?.kind === "grant") && !r.error);
    if (grantRule) this.grant = toGrantField(grantRule);
    // The feature lines (0.16.0): `[CHOICE Weapon Group]` and `[TALENT Weapon Familiarity]` are the
    // Choice and Free Talent columns' successors, so the fields read from the rules when blank.
    const choiceRule = (this.rules ?? []).find(r => (r?.kind === "choice") && !r.error && r.prompt);
    if (choiceRule && !this.choice.prompt) this.choice.prompt = String(choiceRule.prompt);
    const talentRule = (this.rules ?? []).find(r => (r?.kind === "talent") && !r.error && r.name);
    if (talentRule && !this.freeTalent) this.freeTalent = String(talentRule.name);
    this.needsChoice = !!this.choice.prompt && !this.choice.value;
    prepareAura(this);
    prepareRules(this);
    prepareSpell(this);
  }

  get chatDescription() {
    return this.effect || this.description;
  }
}

/**
 * The spell's derived reading (PHB v4.21): is it one, which Defenses answer it, whether it rolls
 * damage, and the lines the sheets print. `isSpell` is the one question the sheets and the Cast
 * ask; everything else is for printing.
 */
function prepareSpell(system) {
  const s = system.spell;
  const threat = SW.THREATS[s.threat] ? s.threat : "";
  system.isSpell = !!s.enabled && !!threat;
  system.spellThreat = threat;
  const named = (s.defenses ?? []).filter(d => SW.DEFENSES[d]);
  system.spellDefenses = named.length ? named : (threat ? [...SW.THREATS[threat].defenses] : []);
  system.spellDelivery = SW.DELIVERIES[s.delivery] ? s.delivery : ((s.die && threat) ? "zoned" : "");
  system.spellDamages = !!s.die && (s.types?.length > 0 || true);
  system.spellType = s.types?.[0] ?? "untyped";
  system.spellRangeText = s.adjacent ? "adjacent" : (s.range ? `${s.range} ft` : "");
}
