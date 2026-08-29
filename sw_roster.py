"""Six legal level-1 STARWROUGHT characters, 19 attribute points and 15 gp each."""
from sw_sim import PC, Piece, Weapon

# ---- gear catalogue (v1.9 prices)
def P(zone, prot, load, mat): return Piece(zone, prot, load, mat)
COIF   = lambda: P("Head", 1, 0, "padded")      # 1 gp
OHELM  = lambda: P("Head", 3, 1, "plate")       # 5
CHELM  = lambda: P("Head", 4, 1, "plate")       # 10
GAMB   = lambda: P("Torso", 1, 0, "padded")     # 1
LCUIR  = lambda: P("Torso", 2, 0, "leather")    # 5
MSHIRT = lambda: P("Torso", 3, 1, "mail")       # 10
BPLATE = lambda: P("Torso", 4, 1, "plate")      # 15
LBRAC  = lambda: P("Arms", 2, 0, "leather")     # 1
MSLV   = lambda: P("Arms", 3, 1, "mail")        # 5
VAMB   = lambda: P("Arms", 4, 1, "plate")       # 10
LLEGS  = lambda: P("Legs", 2, 0, "leather")     # 1
MCHAUS = lambda: P("Legs", 3, 1, "mail")        # 5
GREAVE = lambda: P("Legs", 4, 1, "plate")       # 10

BUCKLER = ("Buckler", 1, 0)   # name, guard bonus, load   1 gp
SHIELD  = ("Shield",  2, 1)   # 5 gp

FIST  = Weapon("Iron Fists", 6, "B", ["agile", "finesse"])
SSWD  = Weapon("Shortsword", 6, "P", ["agile", "finesse"])
MACE  = Weapon("Mace", 6, "B", ["shove"])
RAPIER= Weapon("Rapier", 8, "P", ["finesse", "deadly d8", "parry"])
LSWD  = Weapon("Longsword", 8, "S", ["parry"])
WHAM  = Weapon("Warhammer", 8, "B", ["shove"])

ROSTER = [
    # ---------------------------------------------------------------- Might / Endure
    PC("Bear",  "Rage", "Brawling",
       might=10, agility=3, wits=3, presence=3,           # Mgt+3
       weapon=FIST, armor=[COIF(), MSHIRT(), LBRAC(), LLEGS()],   # 1+10+1+1 = 13 gp, Load 1
       talents=["Iron Fists"],
       notes="Rage brawler. Clinch stance, agile fists, mail torso."),

    # ---------------------------------------------------------------- Presence / Guard
    PC("Ward",  "Rage", "Shield Fighting",
       might=6, agility=3, wits=3, presence=7,            # Pre+2, Mgt+2
       weapon=MACE, armor=[COIF(), LCUIR(), LBRAC(), LLEGS()],    # 1+5+1+1 = 8 + shield 5 = 13
       shield=SHIELD, talents=["Unshaken"],
       notes="Rage shield-waller. Shield Wall stance keeps the shield up for free."),

    PC("Tover", "Rage", "Dueling",
       might=4, agility=6, wits=3, presence=6,            # Agi+2, Pre+2
       weapon=LSWD, armor=[COIF(), LCUIR(), LBRAC(), LLEGS()],    # 8 gp, Load 0
       talents=["En Garde"],
       notes="Rage duelist. The Measure stance, En Garde, Guard-leaning."),

    # ---------------------------------------------------------------- Agility / Evade
    PC("Quill", "Ambusher", "Two-Weapon",
       might=3, agility=10, wits=3, presence=3,           # Agi+3
       weapon=SSWD, armor=[COIF(), LCUIR(), LBRAC(), LLEGS()],    # 8 gp, Load 0
       talents=["Sneak Attack", "Off-Hand Guard"],
       notes="Ambusher with two shortswords. Twin Openings stance."),

    PC("Sable", "Ambusher", "Dueling",
       might=3, agility=9, wits=4, presence=3,            # Agi+3
       weapon=RAPIER, armor=[COIF(), LCUIR(), LBRAC(), LLEGS()],  # 8 + rapier 5 = 13
       talents=["Sneak Attack", "En Garde"],
       notes="Ambusher duelist. Rapier, deadly d8, The Measure."),

    # ---------------------------------------------------------------- the armor test
    PC("Marrow","Rage", "Shield Fighting",
       might=7, agility=3, wits=3, presence=6,            # Mgt+2, Pre+2
       weapon=WHAM, armor=[MSHIRT()],                             # 10 gp, arms/legs/head BARE
       shield=BUCKLER, talents=["Unshaken"],               # +1 gp = 12, warhammer 5 = 17 -> mace instead
       notes="Deliberately lopsided: strong torso, nothing on the limbs."),
]
# keep Marrow inside 15 gp by swapping the warhammer for a mace
ROSTER[-1].weapon = MACE

if __name__ == "__main__":
    print(f"{'name':8s} {'calling':9s} {'style':16s} {'HP':>3} {'Awa':>4}{'Eva':>4}{'Gua':>4}{'End':>4} "
          f"{'atk':>4} {'weapon':11s} {'Prot H/T/A/L':>13} {'Load':>4}")
    for p in ROSTER:
        prot = "/".join(str(p.protection(z, "S")) for z in ("Head", "Torso", "Arms", "Legs"))
        print(f"{p.name:8s} {p.calling:9s} {p.style:16s} {p.maxhp:>3} "
              f"{p.awareness():>4}{p.evade():>4}{p.guard():>4}"
              f"{10+p.level+p.attr['Might']+p.prof:>4} "
              f"{'+'+str(p.attack_bonus()):>4} {p.weapon.name:11s} {prot:>13} {p.load:>4}")
        print(f"         attrs Mgt+{p.attr['Might']} Agi+{p.attr['Agility']} "
              f"Wit+{p.attr['Wits']} Pre+{p.attr['Presence']}   {p.notes}")
