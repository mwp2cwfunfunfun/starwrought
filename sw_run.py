import random, statistics, itertools
from collections import Counter, defaultdict
import sw_sim
from sw_sim import duel, STATS, ZONES
from sw_roster import ROSTER

random.seed(20260822)
N = 4000

print("=" * 96)
print("ROSTER  (level 1, 19 attribute points, 15 gp of gear each)")
print("=" * 96)
print(f"{'':8s} {'HP':>3} {'Awa':>4}{'Eva':>4}{'Gua':>4}{'End':>4} {'atk':>5}  {'weapon':11s} "
      f"{'Prot vs S':>10} {'vs P':>9} {'vs B':>9}")
for p in ROSTER:
    row = lambda t: "/".join(str(p.protection(z, t)) for z in ZONES)
    print(f"{p.name:8s} {p.maxhp:>3} {p.awareness():>4}{p.evade():>4}{p.guard():>4}"
          f"{10+p.level+p.attr['Might']+p.prof:>4} {'+'+str(p.attack_bonus()):>5}  "
          f"{p.weapon.name:11s} {row('S'):>10} {row('P'):>9} {row('B'):>9}")

# ---------------------------------------------------------------- round robin
print("\n" + "=" * 96)
print(f"ROUND ROBIN  ({N} duels per pairing, defender always picks the higher Defense)")
print("=" * 96)
wins = defaultdict(int); fights = defaultdict(int); lengths = []
grid = defaultdict(dict)
for a, b in itertools.combinations(ROSTER, 2):
    w = 0
    for _ in range(N):
        winner, rnd = duel(a, b)
        lengths.append(rnd)
        if winner == a.name: w += 1
        wins[winner] += 1
        fights[a.name] += 1; fights[b.name] += 1
    grid[a.name][b.name] = w / N
    grid[b.name][a.name] = 1 - w / N

names = [p.name for p in ROSTER]
print(f"\n{'':9s}" + "".join(f"{n:>8s}" for n in names) + f"{'OVERALL':>10s}")
for n in names:
    cells = "".join(f"{grid[n][m]*100:7.0f}%" if m in grid[n] else f"{'  -':>8s}" for m in names)
    overall = wins[n] / fights[n] * 100
    print(f"{n:9s}{cells}{overall:9.1f}%")

print(f"\nfights end in a median of {statistics.median(lengths):.0f} rounds "
      f"(mean {statistics.mean(lengths):.1f}, 10th-90th pct "
      f"{sorted(lengths)[len(lengths)//10]}-{sorted(lengths)[len(lengths)*9//10]})")

# ---------------------------------------------------------------- degree + defense mix
tot = sum(STATS[f"deg_{i}"] for i in range(4))
print("\n" + "=" * 96)
print("WHAT THE DICE ACTUALLY DID")
print("=" * 96)
for i, lab in enumerate(["Miss", "Graze", "Hit", "Critical"]):
    print(f"  {lab:9s} {STATS[f'deg_{i}']/tot*100:5.1f}%")
dtot = STATS["def_Evade"] + STATS["def_Guard"]
print(f"\n  defender chose Evade {STATS['def_Evade']/dtot*100:.0f}% of the time, "
      f"Guard {STATS['def_Guard']/dtot*100:.0f}%")
print(f"  Pressed inflicted {STATS['pressed']:,} times · "
      f"Exposed from Clinch {STATS['clinch_expose']:,} · from Twin Openings {STATS['twin_expose']:,}")

print("\n  by attack number in the turn (is the third swing worth taking?)")
print(f"  {'':10s}{'Miss':>8}{'Graze':>8}{'Hit':>8}{'Crit':>8}   {'any damage':>11}")
for m, lab in enumerate(["1st (+0)", "2nd (-5)", "3rd (-10)"]):
    row = [STATS[f"map{m}_deg{d}"] for d in range(4)]
    s = sum(row) or 1
    dealt = (row[1] + row[2] + row[3]) / s * 100
    print(f"  {lab:10s}" + "".join(f"{v/s*100:7.1f}%" for v in row) + f"{dealt:10.1f}%")

# ---------------------------------------------------------------- defense policy test
print("\n" + "=" * 96)
print("DOES THE EVADE-OR-GUARD CHOICE MATTER?  (win rate of the LEFT build)")
print("=" * 96)
print(f"{'pairing':22s}{'picks higher':>14}{'always Evade':>14}{'always Guard':>14}")
for a, b in [(ROSTER[0], ROSTER[3]), (ROSTER[1], ROSTER[4]), (ROSTER[2], ROSTER[3])]:
    out = []
    for pol in ("higher", "always_evade", "always_guard"):
        w = sum(1 for _ in range(N) if duel(a, b, policy=pol)[0] == a.name)
        out.append(w / N * 100)
    print(f"{a.name+' vs '+b.name:22s}" + "".join(f"{v:13.1f}%" for v in out))

# ---------------------------------------------------------------- armor value
print("\n" + "=" * 96)
print("WHAT IS ARMOR WORTH?  expected damage from one landed blow, before and after Protection")
print("=" * 96)
print(f"{'attacker':22s}{'vs bare':>9}{'vs leather':>12}{'vs mail':>9}{'vs plate':>10}")
mats = {"leather": (2, "leather"), "mail": (3, "mail"), "plate": (4, "plate")}
for w in [sw_sim.Weapon("Shortsword 1d6 P", 6, "P"), sw_sim.Weapon("Longsword 1d8 S", 8, "S"),
          sw_sim.Weapon("Mace 1d6 B", 6, "B"), sw_sim.Weapon("Rapier 1d8 P", 8, "P")]:
    avg = w.die / 2 + 0.5
    cells = [avg]
    for mat, (prot, m) in mats.items():
        pc = sw_sim.Piece("Torso", prot, 0, m)
        cells.append(max(0, avg - pc.protection_vs(w.dtype)))
    print(f"{w.name:22s}" + "".join(f"{c:9.1f}" + ("   " if i else "   ") for i, c in enumerate(cells)))
