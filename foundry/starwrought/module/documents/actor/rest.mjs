/**
 * SwActor: a night's rest (PHB v4.11): Vigor back by level times the Presence bonus, Fatigued off,
 * and one card.
 */



/** @param {typeof Actor} Base */
export const RestMixin = Base => class extends Base {
  /**
   * A full night's rest restores Vigor equal to your level times your Presence (or your level, if
   * Presence is 1 or less). Wounds do not come back with sleep (PHB v4.10, Treating Wounds).
   * Fatigued "ends after ten minutes of rest" (PHB v4.13, Conditions), and a night is longer than
   * ten minutes, so it comes off here too and the card says so when it did (ruling 81). The ten
   * minutes without the night are the Fatigued card's own button (combat.mjs, onWindRest); the end
   * of the Combat clears nothing since 0.6.2.
   */
  async restForTheNight() {
    const sys = this.system;
    const vigor = sys.vigor ?? { value: 0, temp: 0 };
    const rest = Number.isNumeric(vigor.rest)
      ? vigor.rest
      : (sys.level ?? 1) * Math.max(1, sys.attributes?.presence?.mod ?? 0);
    const max = Number.isNumeric(vigor.max) ? vigor.max : (vigor.value + rest);
    const healed = Math.max(0, Math.min(rest, max - vigor.value));
    // A night's rest gives no Hero Point (Mike, 0.5.1 T12); the GM awards those. The rest card
    // says what the night did, so the audit stays quiet about the Temporary Vigor it cleared.
    const updates = { "system.vigor.value": vigor.value + healed, "system.vigor.temp": 0 };
    await this.update(updates, { swAnnounced: true });
    if ((vigor.value + healed) > 0) await this.setCondition("spent", false);
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
};
