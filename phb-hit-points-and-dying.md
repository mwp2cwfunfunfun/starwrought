# Hit Points, Dying, and Recovery

Drop-in text. Your existing Temporary Hit Points block is folded in at the right place, unchanged
except for one added line. Design notes and the survival math are at the end.

None of this exists in v2.3 beyond a single line in *Conditions in Brief*, so everything below is
new except where noted.

---

# The drop-in text

> ## Hit Points
>
> ### What Hit Points are
>
> Hit Points are not meat. They are what you have left in you: wind, focus, the strength to keep your
> guard where it belongs, and the sort of luck that turns a killing blow into a shallow one. Losing
> Hit Points is not collecting wounds. It is running out of the things that keep wounds from
> happening.
>
> This is why a character at 3 Hit Points is not carved apart. They are winded, sloppy, and one bad
> moment from finished. It is also why Hit Points come back with a night's sleep, and why a
> tenth-level fighter has more of them without having thicker skin.
>
> **Protection describes what happened to the blow. Hit Points describe what it cost you.** Your
> armor is what the axe met; your Hit Points are what you spent staying on your feet after it.
>
> You do not need Hit Points to model a broken arm, because the Zone rules already did it. A
> Critical Hit to the Arms takes the sword out of your hand. One to the Legs puts you on the ground.
> Real injury lives there, in the place a blow actually landed. Hit Points are free to stay abstract,
> and they should.
>
> ### Your Hit Points
>
> **At 1st level: 10 + your Ancestry's HP + your Calling's HP.**
> **At every level after: add your Ancestry's HP + your Calling's HP again.**
>
> Only your **first** Calling counts toward Hit Points, however many you open later. A classless game
> still needs one answer to the question of how much punishment you can absorb, and it is the life
> you chose first.
>
> ### Temporary Hit Points
>
> Temporary Hit Points are a buffer laid over your Hit Points. Damage comes out of them first, and
> only what is left over reaches your real Hit Points.
>
> - **They are not healing.** Anything that restores Hit Points restores your own, never these.
> - **You can only have one pool at a time.** If an effect would give you a second, keep whichever
>   pool is larger and discard the other. They never add together.
> - **They last** until they are spent or until the effect that granted them ends, whichever comes
>   first.
> - **Losing your last Temporary Hit Point is not the same as being reduced to 0 Hit Points.** It
>   does not make you Dying and it does not make you Wounded.
> - **Protection applies first.** Protection reduces the damage itself, so it comes off before
>   anything reaches your Temporary Hit Points.
>
> ---
>
> ## Going Down
>
> ### Reaching 0 Hit Points
>
> **When damage reduces you to 0 Hit Points, you fall unconscious.** Damage beyond what it took to
> drop you is simply lost; you cannot go below 0.
>
> - If the damage was **nonlethal**, you are unconscious and nothing more. You wake in ten minutes,
>   or sooner if someone rouses you, with 1 Hit Point.
> - Otherwise you are **Dying**.
>
> ### Dying
>
> **Dying** is a value, and it counts up toward the end.
>
> - You begin at **Dying 1**, or **Dying 2** if the blow that dropped you was a Critical Hit.
> - If you are **Wounded**, add your Wounded value to that starting number.
> - While Dying you are unconscious and helpless. You cannot act, and attacks against you succeed
>   without a roll.
> - **Taking damage while Dying increases your Dying value by 1**, or by 2 from a Critical Hit. This
>   is why Persistent Damage kills people.
> - **At Dying 4, you die.**
>
> ### Recovery Checks
>
> **At the start of each of your turns while Dying, make a Recovery check:** an **Endure** check
> against a Threshold of **10 + your Dying value**. It costs no action. The worse shape you are in,
> the harder it is to climb back out.
>
> | Result | Effect |
> |---|---|
> | **Critical success** | Your Dying ends. You are conscious, on your feet if you spend an action to stand, with **1 Hit Point**. |
> | **Success** | Your Dying value drops by 1. If it reaches 0, your Dying ends and you are **stable**: still unconscious, but no longer sliding. |
> | **Failure** | Your Dying value rises by 1. |
> | **Critical failure** | Your Dying value rises by 2. |
>
> **Helping.** An adjacent ally may spend ◆ to press a wound, straighten your neck, or shout you back
> into your body. You gain a +2 circumstance bonus to your next Recovery check.
>
> **Healing.** Any effect that restores even 1 Hit Point to a Dying character ends their Dying at
> once. They are conscious, with those Hit Points, and Wounded.
>
> ### Wounded
>
> **Whenever your Dying ends, for any reason, you become Wounded 1.** If you were already Wounded,
> the value rises by 1 instead.
>
> Wounded does nothing to you directly. What it does is make the next fall worse: **your Dying value
> starts higher by your Wounded value.** Go down twice in a fight and the second time is genuinely
> dangerous. Go down three times and you should be making arrangements.
>
> **Wounded clears** when you have rested for the night, or when an ally spends ten minutes treating
> you and succeeds at a check the GM names.
>
> ### Refusing Death
>
> **When you would die, you may spend all of your Hero Points, and you must have at least one, to
> refuse it.** This is not a roll. It cannot fail, and nothing in the game can stop it.
>
> - Your Dying value drops to 0. You are unconscious and stable at 0 Hit Points.
> - Your Wounded value increases by 1.
> - You have no Hero Points until the GM awards more, or until the next session.
>
> It is the only thing in STARWROUGHT that simply happens. Spend it and describe how: the blow that
> should have finished you turned on a buckle, the arrow found the strap and not the throat, you got
> your chin down at the last possible instant. You have bought one more scene, and paid everything
> you had for it.
>
> ### Getting Hit Points Back
>
> - **A full night's rest** restores all your Hit Points and clears Wounded.
> - **Ten minutes of rest** restores nothing on its own. Hit Points are what you spend staying alive,
>   and they take real rest to rebuild.
> - Talents, and eventually magic, are the fast way. *Second Wind* is the one every character can
>   reach, through the Endure Constellation.
>
> ### Quick reference
>
> | | |
> |---|---|
> | **0 Hit Points** | Unconscious. Dying 1, or Dying 2 from a Critical Hit, plus your Wounded value |
> | **Recovery check** | Endure vs **10 + Dying value**, at the start of each of your turns, no action |
> | **Damage while Dying** | Dying +1, or +2 from a Critical Hit |
> | **Dying 4** | You die |
> | **Dying ends** | You become Wounded 1, or your Wounded rises by 1 |
> | **Wounded** | Your next Dying value starts that much higher |
> | **All your Hero Points** | Refuse death. Dying 0, stable at 0 HP, Wounded +1 |

---

# The survival math, checked

I ran 200,000 trials per case so the numbers below are not guesses. A 1st-level character with
Might +1 and Trained Endure rolls d20+6.

| Situation | Chance of dying | Average turns spent down |
|---|---:|---:|
| Dropped normally (Dying 1) | **4.0%** | 1.4 |
| Dropped by a Critical Hit (Dying 2) | **14.4%** | 2.1 |
| Dropped a second time while Wounded 1 | **14.5%** | 2.1 |
| Tougher character, Might +2 | 2.6% | 1.3 |

That shape is what you want from a playtest. **Going down is frightening but usually survivable, and
a Critical Hit that drops you is three and a half times as lethal**, which gives crits teeth without
making a single bad round the end of a character. Going down twice is as dangerous as being critted,
which is exactly the pressure Wounded is supposed to create.

For comparison, if death came at Dying **3** instead of 4, an ordinary knockdown would kill 9.3% of
the time. That is too punishing for level 1. Four is right.

---

# Two design notes

**The Recovery check stops being a threat at higher levels, and that is a later problem.** Because
the Threshold tops out at 13 while your Endure check grows with both level and rank, a 5th-level
character with Expert Endure rolls d20+14 and cannot fail. Pathfinder has the same property, so it
is a known and survivable design: at high levels characters die from taking an enormous hit, not
from failing to wake up. But it does mean **Dying is a level 1 to 4 mechanic**, and if you ever want
it to bite later, the lever is the Threshold rather than the check. Nothing to do for this playtest.

**Endure being the dying check is the right call and worth keeping visible.** It is the one place
where the Might character's least glamorous investment pays for itself completely, and it gives the
Endure Constellation a job that no other Defense can do. Your Defense table already promises this
("poison, disease, exhaustion, **dying**"), so the section above simply delivers on it.

---

# Three things this section touches elsewhere

**Conditions in Brief** currently reads *"Dying / Wounded: At 0 HP you're dying; Endure checks of
10 + Dying value. Wounded makes the next fall worse."* That is a good one-liner and can stay, but it
should point at this section, and the entry should be split into two rows now that both are real
conditions with distinct rules.

**Second Wind still reads "Once per day"** in the Endure Constellation, though you reduced the amount
healed to half your level plus your Might for SW-048. If you meant to move it to once per 10 minutes,
the talent text did not get the change.

**Nonlethal damage now has somewhere to land.** The *nonlethal* trait says only "It knocks out rather
than kills," which was doing a lot of work with no rules behind it. The *Reaching 0 Hit Points*
paragraph above is what it was pointing at.
