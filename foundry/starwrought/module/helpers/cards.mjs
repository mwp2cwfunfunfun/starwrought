/**
 * The system's chat cards: one builder, the whisper lists, and the `data-sw-combat` buttons.
 *
 * Every card the system posts outside a roll (the round's reminders, an overspend, a Move, an
 * Intercept offer, the party's cards, the Sync content record) is `cardHtml` with a title, lines,
 * small print and buttons, spoken by an actor through `postCard`. A button carries
 * `data-sw-combat="<action>"`, the card's root carries `data-actor-uuid`, and `registerCardButtons`
 * binds every such button on render to the handler registered in `cardActions` under that action,
 * with the actor already resolved and the owner check left to the handler (`requireOwner`). Who
 * sees a card is `ownersOf` (the actor's owners and the GM: a reminder) or `tableFor` (public for
 * a player's creature, the GM's for an adversary: the system's usual split).
 *
 * Nothing here knows what any card says. The round's cards register their handlers in
 * documents/cards/round.mjs, the Intercept's in documents/movement.mjs; the attack, damage,
 * reroll and Position cards use `data-sw-action` and are wired by documents/chat.mjs instead,
 * which predates this map. Through 0.10.0 all of this lived in documents/combat.mjs.
 */

const { escapeHTML } = foundry.utils;

/**
 * Card buttons handled by the system's modules, keyed by their `data-sw-combat` value.
 * A handler receives `{actor, button, root, message}`; `actor` is the document named by the card's
 * `data-actor-uuid`, already resolved.
 * @type {Map<string, (context: {actor: Actor|null, button: HTMLButtonElement, root: HTMLElement|null, message: ChatMessage}) => Promise<unknown>>}
 */
export const cardActions = new Map();

let bound = false;

/** Bind the `data-sw-combat` buttons of every rendered card to `cardActions`. Idempotent. */
export function registerCardButtons() {
  if (bound) return;
  bound = true;
  Hooks.on("renderChatMessageHTML", onRenderCard);
}

/* -------------------------------------------- */
/*  Building and posting                        */
/* -------------------------------------------- */

/**
 * Build a card. Every button carries `data-sw-combat`, which `registerCardButtons` binds to
 * `cardActions`, and the root carries the actor the buttons act for.
 * @param {object} spec
 * @param {string} spec.root            The card's own class, e.g. `sw-round-card`.
 * @param {string} [spec.actorUuid]     Who the buttons act for.
 * @param {string} [spec.glyph]         Action glyphs printed before the title.
 * @param {string} spec.title
 * @param {string[]} [spec.lines]       Body paragraphs (already escaped or trusted).
 * @param {string[]} [spec.notes]       Small print.
 * @param {Array<{action: string, label: string, icon?: string, data?: object}>} [spec.buttons]
 * @param {object} [spec.data]          Extra data attributes on the root.
 * @returns {string}
 */
export function cardHtml({ root, actorUuid = "", glyph = "", title, lines = [], notes = [], buttons = [], data = {} }) {
  const attr = (k, v) => ` data-${k}="${escapeHTML(String(v ?? ""))}"`;
  const rootAttrs = Object.entries(data).map(([k, v]) => attr(k, v)).join("");
  const body = lines.map(l => `<p>${l}</p>`).join("");
  const small = notes.filter(Boolean).map(n => `<p class="sw-card-note">${n}</p>`).join("");
  const row = buttons.length
    ? `<div class="sw-card-buttons">${buttons.map(b => `<button type="button" data-sw-combat="${escapeHTML(b.action)}"${
      Object.entries(b.data ?? {}).map(([k, v]) => attr(k, v)).join("")}>${
      b.icon ? `<i class="${escapeHTML(b.icon)}"></i> ` : ""}${b.label}</button>`).join("")}</div>`
    : "";
  return `<div class="starwrought action-card ${escapeHTML(root)}"${attr("actor-uuid", actorUuid)}${rootAttrs}>
    <h3>${glyph ? `${glyph} ` : ""}${title}</h3>${body}${small}${row}</div>`;
}

/** Every user who owns the actor, and every GM: the people a reminder about it belongs to. */
export function ownersOf(actor) {
  return game.users.filter(u => u.isGM || actor.testUserPermission(u, "OWNER")).map(u => u.id);
}

/**
 * Public for a player-controlled actor (a character, or anything a player owns), the GM's business
 * for an adversary: the system's usual split, and the one spendActions uses (Mike, 2026-10-01).
 */
export function tableFor(actor) {
  const theirs = actor.announcesSpends ?? actor.hasPlayerOwner;
  return theirs ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id);
}

/** Post a card spoken by an actor. */
export function postCard(actor, content, { whisper = [], rolls = [] } = {}) {
  const data = { speaker: ChatMessage.getSpeaker({ actor }), content, whisper };
  if (rolls.length) data.rolls = rolls;
  return ChatMessage.create(data);
}

/* -------------------------------------------- */
/*  The buttons                                 */
/* -------------------------------------------- */

function onRenderCard(message, html) {
  for (const button of html.querySelectorAll("[data-sw-combat]")) {
    button.addEventListener("click", event => onCardButton(event, message));
  }
}

async function onCardButton(event, message) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const handler = cardActions.get(button.dataset.swCombat);
  if (!handler) return;
  const root = button.closest("[data-actor-uuid]");
  const actor = await actorFromUuid(root?.dataset.actorUuid);
  button.disabled = true;
  try {
    await handler({ actor, button, root, message });
  } catch (err) {
    console.error(`STARWROUGHT | ${button.dataset.swCombat} failed`, err);
  } finally {
    button.disabled = false;
  }
}

/** The Actor behind a uuid, whether it names the Actor or its Token. */
export async function actorFromUuid(uuid) {
  if (!uuid) return null;
  const doc = await fromUuid(uuid);
  return doc?.actor ?? doc ?? null;
}

/** A card button acts for its actor's owner only. */
export function requireOwner(actor) {
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
    return false;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return false;
  }
  return true;
}
