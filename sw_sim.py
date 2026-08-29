"""STARWROUGHT v1.9 combat simulator. Close-quarters duel, level 1, player-facing rules.

Implements: d20 + level + attribute + Weapons prof vs the defender's CHOSEN Defense;
four degrees with nat20/nat1 stepping; Graze = one weapon die and nothing else;
Protection by zone with material weakness; Graze costs (Yield / Pressed); Exposed;
MAP -5/-10 (agile -4/-8); stances; Rage; Sneak Attack.
"""
import random, statistics
from collections import Counter, defaultdict

ZONES = ["Head", "Torso", "Arms", "Legs"]
WEAK = {"padded": "S", "leather": "S", "mail": "P", "plate": "B"}   # material -> type it turns poorly

class Piece:
    def __init__(self, zone, prot, load, material):
        self.zone, self.prot, self.load, self.material = zone, prot, load, material
    def protection_vs(self, dtype):
        p = self.prot
        if WEAK.get(self.material) == dtype:
            p -= 2
        return max(0, p)

class Weapon:
    def __init__(self, name, die, dtype, traits=(), hands=1):
        self.name, self.die, self.dtype, self.traits, self.hands = name, die, dtype, set(traits), hands
    @property
    def agile(self): return "agile" in self.traits

class PC:
    def __init__(self, name, calling, style, might, agility, wits, presence,
                 weapon, armor, shield=None, talents=(), notes=""):
        self.name, self.calling, self.style, self.notes = name, calling, style, notes
        self.pts = dict(Might=might, Agility=agility, Wits=wits, Presence=presence)
        self.attr = {k: min(5, v // 3) for k, v in self.pts.items()}
        self.weapon, self.armor, self.shield = weapon, armor, shield
        self.talents = set(talents)
        self.level = 1
        self.prof = 4                                   # Trained in everything relevant at L1
        self.load = sum(p.load for p in armor) + (shield[2] if shield else 0)
        self.strain = max(0, self.load - self.attr["Might"])
        anc_hp, call_hp = 8, {"Rage": 4, "Ambusher": 2}[calling]
        self.maxhp = 10 + anc_hp + call_hp
        self.style_attr = {"Brawling": "Might", "Dueling": "Agility",
                           "Shield Fighting": "Presence", "Two-Weapon": "Agility"}[style]
        self.reset()

    def reset(self):
        self.hp, self.temp = self.maxhp, 0
        self.exposed, self.pressed, self.offguard = set(), False, False
        self.raging, self.rage_left, self.stance = False, 0, None
        self.shield_raised, self.map_count = False, 0
        self.unshaken_used = False

    # ---- defenses
    def evade(self):
        v = 10 + self.level + self.attr["Agility"] + self.prof - self.strain
        if self.raging: v -= 1
        if self.offguard: v -= 2
        return v
    def guard(self):
        v = 10 + self.level + self.attr["Presence"] + self.prof
        if self.shield and (self.shield_raised or self.stance == "Shield Wall"):
            v += self.shield[1]
        if "En Garde" in self.talents: v += 1
        if "Off-Hand Guard" in self.talents: v += 1
        if self.pressed: v -= 2
        if self.offguard: v -= 2
        return v
    def awareness(self):
        return 10 + self.level + self.attr["Wits"] + self.prof

    def attack_bonus(self):
        a = self.attr[self.style_attr]
        if "finesse" in self.weapon.traits:
            a = max(a, self.attr["Agility"])
        return self.level + a + self.prof

    def protection(self, zone, dtype):
        for p in self.armor:
            if p.zone == zone:
                return p.protection_vs(dtype)
        return 0

def roll(n, d): return sum(random.randint(1, d) for _ in range(n))

def degree(total, dc, nat):
    m = total - dc
    d = 3 if m >= 10 else 2 if m >= 0 else 1 if m >= -9 else 0   # 3 crit,2 hit,1 graze,0 miss
    if nat == 20: d = min(3, d + 1)
    if nat == 1:  d = max(0, d - 1)
    return d

def choose_defense(defender, policy):
    """Returns ('Evade'|'Guard', value)."""
    e, g = defender.evade(), defender.guard()
    if policy == "higher":
        return ("Guard", g) if g >= e else ("Evade", e)
    if policy == "always_evade":  return ("Evade", e)
    if policy == "always_guard":  return ("Guard", g)
    raise ValueError(policy)

STATS = Counter()

def resolve_strike(att, dfn, policy, log):
    nat = random.randint(1, 20)
    pen = 0
    if att.map_count == 1: pen = -4 if att.weapon.agile else -5
    elif att.map_count >= 2: pen = -8 if att.weapon.agile else -10
    total = nat + att.attack_bonus() + pen
    which, dc = choose_defense(dfn, policy)
    d = degree(total, dc, nat)
    att.map_count += 1
    STATS[f"deg_{d}"] += 1
    STATS[f"def_{which}"] += 1
    STATS[f"map{min(att.map_count-1,2)}_deg{d}"] += 1

    if d == 0:
        return 0
    dtype = att.weapon.dtype
    # where does it land
    if d == 3:
        zone = min(ZONES, key=lambda z: dfn.protection(z, dtype))      # attacker picks the softest
    elif d == 2:
        zone = min(dfn.exposed, key=lambda z: dfn.protection(z, dtype)) if dfn.exposed else "Torso"
    else:
        zone = max(ZONES, key=lambda z: dfn.protection(z, dtype))      # defender picks the hardest
    # damage
    if d == 1:                                   # Graze: one die, nothing else
        dmg = roll(1, att.weapon.die)
    else:
        dmg = roll(1, att.weapon.die)
        if att.raging: dmg += 2
        if "Sneak Attack" in att.talents and dfn.offguard: dmg += roll(1, 6)
        if d == 3:
            dmg *= 2
            if "deadly d8" in att.weapon.traits: dmg += roll(1, 8)
    dmg = max(0, dmg - dfn.protection(zone, dtype))
    # graze cost
    if d == 1:
        if which == "Evade":
            if att.stance == "Clinch":           # cannot yield away from a brawler
                dfn.exposed.add(random.choice(ZONES)); STATS["clinch_expose"] += 1
            # otherwise the defender yields 5 ft; in a duel this just cedes ground
        else:
            if "Unshaken" in dfn.talents and not dfn.unshaken_used:
                dfn.unshaken_used = True
            else:
                dfn.pressed = True; STATS["pressed"] += 1
    # twin openings
    if d >= 2 and att.stance == "Twin Openings":
        att._hits_this_turn = getattr(att, "_hits_this_turn", 0) + 1
        if att._hits_this_turn == 2:
            dfn.exposed.add(random.choice(ZONES)); STATS["twin_expose"] += 1
    if dmg:
        absorbed = min(dfn.temp, dmg); dfn.temp -= absorbed; dfn.hp -= (dmg - absorbed)
    return dmg

def take_turn(pc, foe, policy, log):
    pc.map_count = 0
    pc._hits_this_turn = 0
    actions = 3
    # stance / rage setup
    if pc.calling == "Rage" and not pc.raging:
        pc.raging, pc.rage_left = True, 10
        pc.temp += pc.level + pc.attr["Might"]
        actions -= 1
    stance_for = {"Two-Weapon": "Twin Openings", "Shield Fighting": "Shield Wall",
                  "Brawling": "Clinch", "Dueling": "The Measure"}
    want = stance_for[pc.style]
    if pc.stance != want and actions > 0:
        pc.stance = want; actions -= 1
    elif pc.shield and not pc.shield_raised and pc.stance != "Shield Wall" and actions > 0:
        pc.shield_raised = True; actions -= 1
    # clear a bad state if it is really hurting
    if (pc.pressed or pc.exposed) and actions >= 2 and random.random() < 0.5:
        pc.pressed = False; pc.exposed.clear(); actions -= 1
    while actions > 0:
        resolve_strike(pc, foe, policy, log)
        actions -= 1
        if foe.hp <= 0: return

def duel(a, b, policy="higher", maxr=30):
    a.reset(); b.reset()
    ia = random.randint(1, 20) + a.awareness() - 10
    ib = random.randint(1, 20) + b.awareness() - 10
    first, second = (a, b) if ia >= ib else (b, a)
    for rnd in range(1, maxr + 1):
        for pc, foe in ((first, second), (second, first)):
            if pc.hp <= 0 or foe.hp <= 0: continue
            take_turn(pc, foe, policy, None)
            if pc.pressed: pc.pressed = False        # expires end of your next turn
        if a.hp <= 0 or b.hp <= 0:
            winner = a if b.hp <= 0 else b
            return winner.name, rnd
    return None, maxr
