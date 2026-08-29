"""Maneuver layer for the STARWROUGHT sim: Trip, Grapple, Shove, Disarm, Escape, Recenter,
prone / grabbed conditions, and tactical AI policies. Wraps sw_sim."""
import random
from collections import Counter
import sw_sim
from sw_sim import ZONES, roll, degree, resolve_strike, STATS

M = Counter()

# ---- extra state -----------------------------------------------------------
def fresh(pc):
    pc.prone = False
    pc.grabbed = False
    pc.disarmed = False
    pc.dist = 5            # feet between the two fighters
_oldreset = sw_sim.PC.reset
def reset(self):
    _oldreset(self); fresh(self)
sw_sim.PC.reset = reset

# ---- condition-aware defenses ---------------------------------------------
_oe, _og = sw_sim.PC.evade, sw_sim.PC.guard
def evade(self):
    v = _oe(self)
    if self.prone: v -= 2
    return v
def guard(self):
    v = _og(self)
    if self.prone: v -= 2
    return v
sw_sim.PC.evade, sw_sim.PC.guard = evade, guard

def defenses_available(pc):
    """Grabbed removes Evade entirely; that is the interlock."""
    return (["Guard"] if pc.grabbed else ["Evade", "Guard"])

def choose_defense(defender, policy="higher"):
    opts = defenses_available(defender)
    vals = {"Evade": defender.evade(), "Guard": defender.guard()}
    if policy == "always_evade" and "Evade" in opts: return "Evade", vals["Evade"]
    if policy == "always_guard": return "Guard", vals["Guard"]
    best = max(opts, key=lambda k: vals[k])
    return best, vals[best]
sw_sim.choose_defense = choose_defense

def athletics(pc):
    return pc.level + pc.attr["Might"] + (4 if pc.athletics_trained else 0)

# ---- maneuvers -------------------------------------------------------------
def maneuver(att, dfn, kind):
    nat = random.randint(1, 20)
    pen = 0 if att.map_count == 0 else (-5 if att.map_count == 1 else -10)
    which, dc = choose_defense(dfn)
    if kind == "Trip" and "Braced Frame" in dfn.talents and which == "Guard": dc += 2
    d = degree(nat + athletics(att) + pen, dc, nat)
    att.map_count += 1
    M[f"{kind}_{d}"] += 1
    if d == 0:                                   # you overcommit
        if kind == "Trip": att.prone = True
        else: att.offguard = True
        return
    if d == 1:                                   # Graze: no effect, defender still pays
        if which == "Guard":
            if "Unshaken" in dfn.talents and not dfn.unshaken_used: dfn.unshaken_used = True
            else: dfn.pressed = True
        elif att.stance == "Clinch":
            dfn.exposed.add(random.choice(ZONES))
        return
    if kind == "Trip":
        dfn.prone = True; dfn.offguard = True
        if d == 3: dfn.hp -= att.attr["Might"]
    elif kind == "Grapple":
        dfn.grabbed = True; dfn.offguard = True
    elif kind == "Shove":
        dfn.dist = att.dist = min(30, att.dist + (10 if d == 3 else 5))
    elif kind == "Disarm":
        dfn.disarmed = True
    M[f"{kind}_land"] += 1

# ---- turn logic ------------------------------------------------------------
def strike(att, dfn):
    if att.disarmed: att.map_count += 0   # penalty applied below
    return resolve_strike(att, dfn, "higher", None)

def take_turn(pc, foe, policy):
    pc.map_count = 0; pc._hits_this_turn = 0
    a = 3
    if pc.calling == "Rage" and not pc.raging:
        pc.raging = True; pc.temp += pc.level + pc.attr["Might"]; a -= 1
    want = {"Two-Weapon": "Twin Openings", "Shield Fighting": "Shield Wall",
            "Brawling": "Clinch", "Dueling": "The Measure"}[pc.style]
    if pc.stance != want and a > 0:
        pc.stance = want; a -= 1

    while a > 0:
        # stand up first, it is nearly always right
        if pc.prone:
            pc.prone = False; a -= 1; continue
        if pc.grabbed:
            nat = random.randint(1, 20)
            w, dc = choose_defense(foe)
            if degree(nat + max(athletics(pc), pc.level + pc.attr["Agility"] + 4), dc, nat) >= 2:
                pc.grabbed = False
            a -= 1; continue
        if pc.dist > 5:
            pc.dist = foe.dist = 5; a -= 1; continue

        act = pick(pc, foe, policy, a)
        if act == "Strike":  strike(pc, foe)
        elif act == "Recenter": pc.pressed = False; pc.exposed.clear()
        else: maneuver(pc, foe, act)
        M[f"chose_{act}"] += 1
        a -= 1
        if foe.hp <= 0: return

def pick(pc, foe, policy, actions_left):
    """Which action to spend. Policies differ in how tactical they are."""
    if policy == "bang":
        return "Strike"
    setup_ok = pc.map_count == 0 and actions_left >= 2      # only worth it before you swing
    if policy == "trip":
        if setup_ok and not foe.prone and not foe.offguard: return "Trip"
        return "Strike"
    if policy == "grapple":
        if setup_ok and not foe.grabbed: return "Grapple"
        return "Strike"
    if policy == "smart":
        # clear a crippling state
        if pc.pressed and pc.exposed and actions_left >= 2: return "Recenter"
        # Sneak Attack wants off-guard badly; Athletics-trained builds set it up
        if setup_ok and not foe.offguard and pc.athletics_trained:
            if "Sneak Attack" in pc.talents: return "Grapple"   # also strips their Evade
            if foe.evade() > foe.guard() + 1: return "Grapple"  # force them onto the worse defense
            return "Trip"
        return "Strike"
    return "Strike"

def duel(a, b, policy_a="smart", policy_b="smart", maxr=30):
    a.reset(); b.reset()
    ia = random.randint(1, 20) + a.awareness() - 10
    ib = random.randint(1, 20) + b.awareness() - 10
    order = [(a, b, policy_a), (b, a, policy_b)] if ia >= ib else [(b, a, policy_b), (a, b, policy_a)]
    for rnd in range(1, maxr + 1):
        for pc, foe, pol in order:
            if pc.hp <= 0 or foe.hp <= 0: continue
            take_turn(pc, foe, pol)
            pc.pressed = False
            pc.offguard = pc.grabbed or pc.prone
        if a.hp <= 0 or b.hp <= 0:
            return (a if b.hp <= 0 else b).name, rnd
    return None, maxr
