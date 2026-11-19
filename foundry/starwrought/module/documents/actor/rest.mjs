/**
 * SwActor: the two rests (PHB v4.21, Vigor): a night, which restores all Vigor and ends Fatigued,
 * and ten minutes, which restore level times Presence and lower Fatigued by 1 (0.36.0; rulings
 * 372 and 373). Each is one card.
 */

import * as SW from "../../config.mjs";
import { tableFor } from "../../helpers/cards.mjs";

/** @param {typeof Actor} Base */
export const RestMixin = Base => class extends Base {
  /**
   * "A full night's rest restores all of your Vigor" (PHB v4.21; through v4.15 it was level times
   * Presence, or level). Wounds do not come back with sleep (Treating Wounds). Fatigued drops by
   * 1 for every ten minutes of uninterrupted rest (the Fatigued row of data/conditions.xlsx since
   * 2026-11-19) and a night is long enough for all of it, so it comes off here whole, whatever
   * its value, and the card says so when it did (rulings 81 and 373; Mike, by question: a night's
   * rest ends it). The ten minutes without the night are
   * `restTenMinutes`, which the Fatigued card's button calls (cards/round.mjs, onWindRest); the
   * end of the Combat clears nothing since 0.6.2. Sleeping in armor without Comfort ("waking up
   * Fatigued value equal to your Load Strain, maximum 3") is not applied: the table decides, as
   * the party's rest dialog says.
   */
  async restForTheNight() {
    const sys = this.system;
    const vigor = sys.vigor ?? { value: 0, temp: 0 };
    const max = Number.isNumeric(vigor.max) ? vigor.max : vigor.value;
    const healed = Math.max(0, max - vigor.value);
    // A night's rest gives no Hero Point (Mike, 0.5.1 T12); the GM awards those. The rest card
    // says what the night did, so the audit stays quiet about the Temporary Vigor it cleared.
    const updates = { "system.vigor.value": max, "system.vigor.temp": 0 };
    await this.update(updates, { swAnnounced: true });
    if (max > 0) await this.setCondition("spent", false);
    const fatigued = Number(this.conditionValue("fatigued")) || 0;
    if (fatigued) await this.setCondition("fatigued", false);
    const lines = [game.i18n.format("STARWROUGHT.Rest.text", { name: this.name, hp: healed, wounds: this.woundCount })];
    if (fatigued) lines.push(game.i18n.format("STARWROUGHT.Rest.fatigued", { name: this.name, value: fatigued }));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Rest.title")}</h3>
        <p>${lines.join(" ")}</p></div>`
    });
  }

  /**
   * Ten minutes' rest (PHB v4.21: "10 minutes spent relaxing and refocusing restores Vigor equal
   * to your level * your Presence (if positive)"). The Vigor is the data model's
   * `vigor.shortRest`, 0 when Presence is not positive (ruling 144), and never past the maximum.
   *
   * FATIGUED DROPS BY 1 (0.36.0; ruling 372): the Fatigued row of data/conditions.xlsx says
   * "Reduce by 1 after every ten minutes of uninterrupted rest", and the sheet is the only
   * authority for what a Condition says. Through 0.35.1 the row said "Ends after ten minutes of
   * rest" and this took Fatigued off whole. ONE CALL IS ONE STRETCH OF TEN MINUTES (ruling 374):
   * thirty minutes are three presses, each with its Vigor, for a character and an adversary
   * alike. The arithmetic is `SW.fatiguedAfterRest`; a value of 0 takes the Condition off.
   *
   * The system has no clock for ten minutes, so this is the table's word that they passed, and
   * passed uninterrupted: the sheet's button and the Fatigued card's. One card, saying what the
   * ten minutes did; a Spent character who gets any Vigor back is Spent no longer.
   * @returns {Promise<{healed: number, fatigued: number, now: number}>}  `fatigued` is the value
   *          before the rest, `now` the value after it.
   */
  async restTenMinutes() {
    const sys = this.system;
    const vigor = sys.vigor ?? { value: 0 };
    const max = Number.isNumeric(vigor.max) ? vigor.max : vigor.value;
    const restores = Number.isNumeric(vigor.shortRest)
      ? vigor.shortRest
      : Math.max(0, (sys.level ?? 1) * Math.max(0, sys.attributes?.presence?.mod ?? 0));
    const healed = Math.max(0, Math.min(restores, max - vigor.value));
    const fatigued = Number(this.conditionValue("fatigued")) || 0;
    if (healed) await this.update({ "system.vigor.value": vigor.value + healed }, { swAnnounced: true });
    if (healed && ((vigor.value + healed) > 0)) await this.setCondition("spent", false);
    const now = SW.fatiguedAfterRest(fatigued, 1);
    // A numeric Condition written at 0 goes off (setCondition); above 0 its value is lowered.
    if (fatigued) await this.setCondition("fatigued", now);
    const lines = [game.i18n.format("STARWROUGHT.Rest.shortText", { name: this.name, hp: healed })];
    if (fatigued) {
      lines.push(game.i18n.format(now > 0 ? "STARWROUGHT.Rest.shortFatiguedDrops" : "STARWROUGHT.Rest.shortFatiguedEnds", { name: this.name, value: fatigued, now }));
    }
    if (!healed && !fatigued) lines.push(game.i18n.localize("STARWROUGHT.Rest.shortNothing"));
    // WHO SEES IT is the system's usual split (helpers/cards.mjs, `tableFor`): public for a
    // player's creature, the GM's for an adversary, as the Wind card and the Fatigued card are.
    // Through 0.35.1 the card was public for everyone, so the button on an adversary's Fatigued
    // card (which only the GM sees) told the table how winded the adversary still was. The branch
    // of `onWindRest` that whispered was never reached once every Actor had this method (the live
    // drive of 0.36.0).
    await ChatMessage.create({
      whisper: tableFor(this),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-wind-rest-card"><h3>${game.i18n.localize("STARWROUGHT.Rest.shortTitle")}</h3>
        <p>${lines.join(" ")}</p></div>`
    });
    return { healed, fatigued, now };
  }
};
