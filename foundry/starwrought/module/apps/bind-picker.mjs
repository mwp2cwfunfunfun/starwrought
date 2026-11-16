/**
 * Form a Bind by hand: which implement of each side? (0.27.0, ruling 279.)
 *
 * A Bind forms from a Guard's result card, which names both implements itself. Formed by hand (a
 * Bind the GM narrates, or one ended by mistake), the two names are the table's to say: each side's
 * line is a text box that suggests what that fighter has in hand (a character's held shields and
 * rigid weapons, an adversary's attacks) and takes anything typed, since an implement need not be
 * an Item at all ("a shield controlling a bite"). Returns the two names, or null when the dialog
 * is dismissed.
 */

const { escapeHTML } = foundry.utils;

/**
 * @param {object} options
 * @param {string} options.name      This fighter.
 * @param {string} options.partner   The targeted fighter.
 * @param {{value: string, options: string[]}} options.mine    This side's implement and suggestions.
 * @param {{value: string, options: string[]}} options.theirs  The partner's.
 * @returns {Promise<{mine: string, theirs: string}|null>}
 */
export async function promptForBind({ name = "", partner = "", mine = {}, theirs = {} } = {}) {
  const list = (id, options) => `<datalist id="${id}">${(options ?? []).map(o => `<option value="${escapeHTML(o)}"></option>`).join("")}</datalist>`;
  const row = (field, label, side, id) => `<div class="form-group">
      <label>${escapeHTML(label)}</label>
      <input type="text" name="${field}" value="${escapeHTML(side?.value ?? "")}" list="${id}"
             placeholder="${escapeHTML(game.i18n.localize("STARWROUGHT.Bind.implementPlaceholder"))}">
      ${list(id, side?.options)}
    </div>`;
  const answer = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Bind.formByHand"), icon: "fa-solid fa-link" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.format("STARWROUGHT.Bind.formByHandText", { name: escapeHTML(name), partner: escapeHTML(partner) })}</p>
      ${row("mine", game.i18n.format("STARWROUGHT.Bind.pickImplement", { name }), mine, "sw-bind-mine")}
      ${row("theirs", game.i18n.format("STARWROUGHT.Bind.pickImplement", { name: partner }), theirs, "sw-bind-theirs")}`,
    ok: {
      label: game.i18n.localize("STARWROUGHT.Bind.form"),
      callback: (event, target) => ({
        mine: String(target.form.elements.mine.value ?? "").trim(),
        theirs: String(target.form.elements.theirs.value ?? "").trim()
      })
    },
    rejectClose: false
  });
  return (answer && (typeof answer === "object")) ? answer : null;
}
