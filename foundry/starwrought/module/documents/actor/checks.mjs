/**
 * SwActor: checks. The roll data, a Constellation check through the check engine, and the Relevant
 * Check picker (a Maneuver that says "Relevant Check" opens it carrying the Maneuver, ruling 123).
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { enabledConstellations } from "../../helpers/content.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/** @param {typeof Actor} Base */
export const ChecksMixin = Base => class extends Base {
  /**
   * @inheritdoc
   * Actor#getRollData returns the live system object, so this builds a plain copy instead: a
   * roll formula must never be able to write back onto the character. Active Effects also ask
   * for roll data during prepareEmbeddedDocuments, before the derived pass, so every derived
   * value read here has to survive being asked too early.
   */
  getRollData() {
    const sys = this.system;
    const data = sys.toObject();
    data.level = sys.level ?? 1;
    if (this.type !== "character") return data;
    for (const [key, attr] of Object.entries(sys.attributes ?? {})) data[key] = attr.mod ?? 0;
    // Weapon dice by rank (PHB v4.21): Melee's as @dice, Ranged's as @rangedDice. The v4.10 to
    // v4.15 @spec and @rangedSpec are 0 now, kept so an old formula still evaluates.
    data.dice = sys.melee?.dice ?? 1;
    data.rangedDice = sys.ranged?.dice ?? 1;
    data.spec = 0;
    data.rangedSpec = 0;
    data.loadStrain = sys.loadStrain ?? 0;
    data.wounds = this.woundCount;
    return data;
  }

  /**
   * Roll a check in a Constellation. Untrained is a real answer, not an error.
   * @param {string} slug
   * @param {object} [options]
   */
  async rollCheck(slug, options = {}) {
    const meta = this.system.constellations?.[slug] ?? SW.getConstellation(slug);
    return SwCheck.roll(foundry.utils.mergeObject({
      actor: this,
      kind: "check",
      slug,
      label: meta.name,
      subtitle: game.i18n.localize("STARWROUGHT.Roll.check")
    }, options, { inplace: false }));
  }

  /**
   * Roll a Relevant Check.
   *
   * The handbook's term (Mike, 2026-09-26) for a roll whose Constellation is the actor's to
   * choose, subject to their justification and the GM's approval: Aid is written with it, and
   * initiative-by-activity has always worked this way. The system's part is to make the choice
   * visible rather than to police it: the actor picks from every Constellation, Untrained ones
   * included (Untrained is a real answer, at +0 Proficiency), says why, and the card names both.
   * The roll itself is an ordinary check in that Constellation, so a critical can Flare it.
   *
   * A Maneuver whose check names no Constellation comes through here from SwItem#use (0.10.0;
   * ruling 123), with itself as `item` and its plain name as `label`, so Aid's roll is called
   * Aid and the Automation rules see the Maneuver behind it (ruling 122). The caller's label
   * stands when given; the subtitle is always the picker's, since it is the approval surface.
   * The number beside each Constellation is computed with the same Item, so an Aid bonus ranks
   * the list as the dice will see it.
   * @param {object} [options]  Passed through to the roll. `threshold` prefills the picker.
   * @param {string} [options.slug]  Opens the picker on this Constellation (0.7.2, ruling 107: the
   *                                 Party Sheet's Investigate row hands over the member's chosen Lore
   *                                 or Skill). A preselection, not the roll's Constellation: the
   *                                 player still confirms or changes it, and it is not passed on.
   * @param {Item} [options.item]    The Maneuver behind the roll, when there is one.
   * @param {string} [options.label] What the card is called; "Relevant Check" when not given.
   */
  async rollRelevantCheck(options = {}) {
    if (this.type !== "character") {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Roll.relevantNpc"));
      return null;
    }
    // The picker's opening value is taken out of what goes on to the roll: `rollCheck` merges its
    // options over the chosen slug, so a `slug` left in them would roll it whatever the player picked.
    const { slug: preselect = "", ...passed } = options;
    const sys = this.system;
    // The number beside each Constellation is the one the roll dialog will open with, computed
    // by the check engine itself, so Load Strain on a Stealth check or a Frightened value shows
    // here and ranks the list the way the dice will see it.
    const row = (slug, name, rank, attribute) => ({
      slug,
      name,
      rank,
      rankLabel: game.i18n.localize(SW.RANKS[rank].label),
      glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "",
      mod: SwCheck.previewTotal(this, { kind: "check", slug, item: passed.item ?? null }),
      trained: rank !== "untrained"
    });

    // Every Constellation that ships (Enabled? = Yes, ruling 61), at this character's rank in it;
    // the character's own Constellations are added below, so an owned one that has since been
    // disabled still appears. The Lore template is not itself rollable; the Lores this character
    // has opened are on the character.
    const rows = enabledConstellations()
      .filter(c => c.slug && (c.slug !== "lore"))
      .map(c => {
        const p = sys.proficiency(c.slug);
        return row(c.slug, p.name ?? c.name, p.rank, p.attribute);
      });
    for (const [slug, con] of Object.entries(sys.constellations ?? {})) {
      if (rows.some(r => r.slug === slug)) continue;
      rows.push(row(slug, con.name, con.rank, con.attribute));
    }
    rows.sort((a, b) => (Number(b.trained) - Number(a.trained)) || (b.mod - a.mod) || a.name.localeCompare(b.name));
    // A preselection the list cannot offer (a Lore this character has not opened) opens nowhere in
    // particular, as the picker always did.
    const opening = rows.some(r => r.slug === preselect) ? preselect : "";

    const content = await renderTemplate("systems/starwrought/templates/dice/relevant-check.hbs", {
      trained: rows.filter(r => r.trained),
      untrained: rows.filter(r => !r.trained),
      threshold: Number.isNumeric(passed.threshold) ? passed.threshold : ""
    });
    const answer = await DialogV2.wait({
      window: { title: game.i18n.localize("STARWROUGHT.Roll.relevantCheck"), icon: "fa-solid fa-scale-balanced" },
      classes: ["starwrought", "check-dialog"],
      position: { width: 460 },
      content,
      // The template marks no option selected, so the opening value is set once the dialog is
      // drawn. v14 hands the DialogV2 instance; an earlier build handed the <dialog> element.
      render: (event, dialog) => {
        if (!opening) return;
        const root = (dialog instanceof HTMLElement) ? dialog : (dialog?.element ?? null);
        const select = root?.querySelector?.("select[name='slug']");
        if (select) select.value = opening;
      },
      buttons: [
        { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel") || !answer.slug) return null;

    const chosen = rows.find(r => r.slug === answer.slug);
    if (!chosen) return null;
    const why = String(answer.why ?? "").trim();
    const opts = {
      ...passed,
      // A Maneuver's name when one was used (Aid), else the book's term for the roll.
      label: passed.label ?? game.i18n.localize("STARWROUGHT.Roll.relevantCheck"),
      // The card's subtitle is the approval surface: which Constellation, and the reason given.
      subtitle: why ? `${chosen.name}: ${why}` : chosen.name
    };
    if (Number.isNumeric(answer.threshold)) opts.threshold = Number(answer.threshold);
    return this.rollCheck(chosen.slug, opts);
  }
};
