# Other Damage Modifiers

Drop-in text for the section after *Special Damage Types*, plus the consolidated Protection rules.

**Yes, this is the right home for detailed Protection.** Protection is currently explained in four
places, each partially: the Damage Rolls formula, the Protection heading under Zones, the Equipment
chapter, and Key Terms. None of them says what happens when two modifiers touch the same number. And
Protection is not a *kind* of damage, it is a *modifier* to damage, so "Other Damage Modifiers" is
exactly where a reader will look for it. Keep the flavor in Equipment ("the sword rules the
unarmored field") and move the mechanics here.

---

# The drop-in text

> ## Other Damage Modifiers
>
> ### Protection
>
> **Protection** is armor, and armor decides how much of a blow your body actually feels. It never
> makes you harder to hit. Each Zone has its own Protection, and that number subtracts from every
> instance of damage that lands on that Zone, a Graze included.
>
> **Protection alone can never reduce damage below 1.** Something always gets through. Resistance and
> Immunity can take it to 0; armor cannot.
>
> To find a Zone's Protection when it matters, work down this list:
>
> | Step | |
> |---|---|
> | 1 | Start with the **Protection of the piece worn there**. No piece worn means 0. |
> | 2 | **Add** any bonus that applies to that Zone (a matched harness adds 1 to your Torso; some Talents add to every Zone). |
> | 3 | **Subtract 1** if the incoming damage type is the one that piece's material turns poorly. A Zone with no armor has no material, and so has no such weakness. |
> | 4 | **Subtract** any Protection the attacker ignores. |
> | 5 | If the Zone is **Exposed**, its Protection is **0** instead, whatever the steps above produced. |
>
> ### Resistance
>
> **Resistance N** reduces each instance of damage of the named type by N. It is written as
> *resistance 5 (fire)* or *resistance 3 (piercing)*. Unlike Protection, Resistance can reduce an
> instance of damage all the way to 0.
>
> ### Weakness
>
> **Weakness N** increases each instance of damage of the named type by N. It is written as
> *weakness 5 (fire)*.
>
> **A single point is enough.** If any damage of that type reaches the creature at all, it takes the
> full Weakness. One point of fire against *weakness 5 (fire)* deals 6. This is why a torch is a real
> weapon against the right monster, and why finding the weakness matters more than hitting hard.
>
> ### Immunity
>
> **Immunity** means that kind of damage or effect does nothing whatsoever. An immune creature takes
> no damage of that type, and ignores conditions, traits, and effects it is immune to. Immunity is
> checked before Weakness and Resistance, and it overrides the rule that at least 1 damage always
> gets through.
>
> ### The order it all happens in
>
> Work top to bottom. Skip anything that does not apply.
>
> | Step | |
> |---|---|
> | 1 | **Roll the damage** and add everything that adds to it, Precision Damage included. |
> | 2 | **Double it** if this is a Critical Hit. |
> | 3 | **Subtract Protection**, to a minimum of 1. |
> | 4 | **Immunity.** If the target is immune, the damage is 0 and you are finished. |
> | 5 | **Add Weakness.** |
> | 6 | **Subtract Resistance.** This may reduce the damage to 0. |
> | 7 | Apply what remains to **Temporary Hit Points** first, then to Hit Points. |
>
> Weakness is added before Resistance is subtracted, so a creature with both *weakness 5 (fire)* and
> *resistance 5 (fire)* simply takes normal fire damage rather than one cancelling the other out
> early.
>
> ### What is not a damage type
>
> **Precision** and **Persistent** are not damage types. They describe where damage came from and
> when it arrives, not what kind it is. Persistent fire damage is still fire, so a creature with
> resistance to fire resists it, and a creature with weakness to fire suffers from it every turn.
> Precision Damage carries the damage type of the Strike that delivered it.

---

# Worked examples, if you want one in the book

A single boxed example does more work than another paragraph of rules here, because the whole
difficulty is sequencing.

> **The same blow, four ways.** A burning brand critically hits Kessa's Legs for 6, doubled to 12.
> Her leather leggings are Protection 2, and although leather turns slashing poorly, this is fire, so
> the full 2 applies. **12 − 2 = 10 damage.**
>
> - The same blow against a creature with **resistance 5 (fire)**: 12 − 2 = 10, then − 5 = **5**.
> - Against a creature with **weakness 5 (fire)**: 12 − 2 = 10, then + 5 = **15**.
> - Against a creature **immune to fire**: **0**, and the rule that 1 always gets through does not
>   save it.

---

# The design calls I made, and why

**Protection comes off before Weakness, Resistance and Immunity.** Your own line already argues for
it: armor "decides how much of a blow your body actually feels." Protection is the interception;
Weakness, Resistance and Immunity are what the body does with whatever arrived. Ordering it the
other way would mean armor helps a troll resist fire, which nobody wants to explain twice.

**The minimum of 1 is an armor rule, not a damage rule.** This is the choice worth being deliberate
about. You ruled in SW-002 that Protection cannot reduce damage to 0, and that rule is doing real
work: it keeps heavy armor from becoming immunity to small weapons, and it means a dagger is never
completely useless against plate. But Resistance and Immunity *should* be able to zero something
out, because that is their entire purpose. Scoping the floor to Protection specifically keeps both
rules doing their jobs. If you would rather the floor apply to the final number, say so in step 7
instead, and Immunity will need its own explicit exception either way.

**"A single point is enough" is what makes Weakness fun.** Without that clause, Weakness is just a
damage bonus. With it, the tactic becomes *find any way at all to deal that type*, which is why a
torch, a flask, or *Turn the Weapon* suddenly matter. It is the single most engaging rule in this
whole section and it costs one sentence.

**Weakness before Resistance** matters only when a creature has both to the same type, which is
rare, but it is exactly the case a rules lawyer will find. Stating the order costs nothing now and
settles it forever.

---

# One terminology decision worth locking in

You have used **"turns poorly"** for the armor material rule ("mail turns piercing poorly") and never
the word *weakness*. That is lucky, and I would protect it deliberately, because **Weakness** is now
a keyword that means something else entirely.

- **Armor of proof** is a property of a *material*, reduces *Protection* by 1, and applies to a Zone.
- **Weakness** is a property of a *creature*, *adds* damage, and applies to the whole creature.

Keeping "turns poorly" for the first and reserving "Weakness" for the second means the two never
collide in a sentence. I would add one line to the *Armor of proof* paragraph making the distinction
explicit, since we have both been calling the armor rule "material weakness" in conversation and
that phrase will leak into the book eventually:

> *Armor of proof is not the same as a creature's Weakness. Material turns a Zone's Protection down
> by 1; Weakness adds damage to the creature.*

---

# Two follow-ons this creates

**Damage types are never listed anywhere.** The book uses B, P and S on the weapon tables and now
fire, acid and poison in these rules, but no section says what the full set is. A three-line list
belongs right above Resistance: *bludgeoning, piercing and slashing are physical; fire, cold,
acid, electricity, sonic and poison are energy; anything else is named where it appears.*

**Double Slice needs rewording.** It currently reads "combine the damage against resistance," which
was shorthand for a rule that did not exist yet. Now that Resistance is defined, it should say what
it means: *"Combine both weapons' damage into a single instance before Protection and Resistance are
applied."* That is a real benefit and worth stating plainly, because under these rules two separate
instances would each lose Protection and each lose Resistance.
