/**
 * A check made with other terms (0.21.0; rulings 215 to 222): the pure half of the `substitutions`
 * hook point's caller.
 *
 * A rule of the `substitute` kind (`[EFFECT USE: Presence, Origin, aid]`, Cooperative Instinct)
 * offers to swap a check's two BASE TERMS, the Attribute Bonus and the Proficiency Bonus, or one
 * of them. The engine's dispatcher (module/rules/engine.mjs, `ruleSubstitutions`) says which swaps
 * a roll may take; check/modifiers.mjs assembles the roll once WITHOUT a swap and once WITH each,
 * so "better" is judged on the whole total and never on the two base numbers alone (another rule
 * may read the rank the roll is made at: Jack of All Trades' +1 on an Untrained roll is lost under
 * a Trained Origin); and this file holds what needs no Foundry to say: the terms a swap rolls, the
 * record a card keeps of it, which variant stands, and the marks a roll owes.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS. It imports nothing, so `assets/test_rules.mjs` checks
 * it from plain Node; check/modifiers.mjs, which reads the actor and localizes labels, cannot be
 * imported there.
 */

/**
 * The two terms a swap rolls. `candidate` is one answer of `ruleSubstitutions` (`attribute` a key
 * or null, `proficiency` `{ constellation, name }` or null; null is "the check keeps its own").
 * `own` is the check's own pair: `{ attribute, slug, name, rank, value }`, `attribute` a key or "",
 * `value` its own Proficiency Bonus. `read` reaches the character: `attributeBonus(key)` and
 * `proficiency(slug) -> { name, rank, bonus }`.
 * @returns {{attribute: string|null, attributeValue: number, slug: string, name: string, rank: string, value: number}}
 *          What is rolled: the Attribute's key and bonus, then the Constellation the Proficiency
 *          Bonus comes from (its slug, name and rank) and that bonus.
 */
export function swapTerms(candidate, own, read) {
  const attribute = candidate?.attribute || own?.attribute || null;
  const borrowedSlug = candidate?.proficiency?.constellation ?? null;
  const borrowed = borrowedSlug ? (read?.proficiency?.(borrowedSlug) ?? null) : null;
  return {
    attribute,
    attributeValue: attribute ? (Number(read?.attributeBonus?.(attribute)) || 0) : 0,
    slug: borrowedSlug ? String(borrowedSlug) : String(own?.slug ?? ""),
    name: borrowedSlug ? String(borrowed?.name || candidate.proficiency.name || borrowedSlug) : String(own?.name ?? ""),
    rank: borrowedSlug ? String(borrowed?.rank ?? "untrained") : String(own?.rank ?? "untrained"),
    value: borrowedSlug ? (Number(borrowed?.bonus) || 0) : (Number(own?.value) || 0)
  };
}

/**
 * The record of a swap that stood, as the card's flags keep it (`flags.starwrought.substituted`).
 * It mirrors the rule: `attribute` and `proficiency` are null where the check kept its own term,
 * so a later reading can tell an Attribute swap from a Proficiency swap; `from` is the pair the
 * check would have used. Plain data.
 * @param {object} candidate  The candidate that stood.
 * @param {object} terms      `swapTerms`' answer for it.
 * @param {object} own        The check's own pair, as given to `swapTerms`.
 * @returns {object}
 */
export function substitutionRecord(candidate, terms, own) {
  return {
    key: String(candidate?.key ?? ""),
    itemName: String(candidate?.label ?? candidate?.item?.name ?? ""),
    attribute: candidate?.attribute ?? null,
    proficiency: candidate?.proficiency?.constellation
      ? { constellation: String(candidate.proficiency.constellation), name: String(terms?.name ?? candidate.proficiency.name ?? ""), rank: String(terms?.rank ?? "untrained") }
      : null,
    from: {
      attribute: own?.attribute || null,
      slug: String(own?.slug ?? ""),
      name: String(own?.name ?? ""),
      rank: String(own?.rank ?? "untrained")
    }
  };
}

/**
 * Which variant of a roll stands. `variants` is the roll assembled every way it may be made:
 * `{ key: null, total }` first, the check with its own terms, then one `{ key, total, certain }`
 * per candidate, in sheet order.
 *
 *   choice undefined   the default rule (Mike, 2026-11-10: "ticking it by default when it is a
 *                      better pair"): the candidate with the highest total, only when that total is
 *                      STRICTLY above the unswapped one; a tie or a loss leaves the check as it
 *                      was. Two candidates level with each other: the earlier stands.
 *   choice null        no swap, whatever the totals (the player unticked the box).
 *   choice "<key>"     that candidate (the player ticked it); a key no variant has is no swap.
 *
 * @param {Array<{key: string|null, total: number, certain?: boolean}>} variants
 * @param {string|null|undefined} choice
 * @returns {object|null}  One of `variants`; null only when the list is empty.
 */
export function chooseVariant(variants, choice) {
  const list = Array.isArray(variants) ? variants : [];
  const none = list.find(v => v?.key === null) ?? list[0] ?? null;
  if (choice === null) return none;
  if (typeof choice === "string") return list.find(v => v?.key === choice) ?? none;
  let best = none;
  for (const variant of list) {
    if (!variant || (variant.key === null) || (variant.certain === false)) continue;
    if (Number(variant.total) > Number(best?.total ?? -Infinity)) best = variant;
  }
  return best;
}

/**
 * Two lists of rule marks as one, each mark once (by its key, its `per` and its owner). A roll
 * collects marks from more than one place (the rules that applied, the swap that stood, the boxes
 * the player left ticked), and one line asks for one write.
 * @param {...Array<{key: string, per: string, owner?: string}>} lists
 * @returns {Array<{key: string, per: string, owner?: string}>}
 */
export function mergeMarks(...lists) {
  const out = [];
  for (const list of lists) {
    for (const mark of Array.isArray(list) ? list : []) {
      if (!mark?.key || !mark?.per) continue;
      if (out.some(m => (m.key === mark.key) && (m.per === mark.per) && (m.owner === mark.owner))) continue;
      out.push(mark);
    }
  }
  return out;
}
