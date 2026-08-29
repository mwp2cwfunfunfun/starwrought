# STARWROUGHT build step: templates + data JSON -> the two playable HTML files.
# Run from anywhere:  python3 assets/inject.py   (after assets/xlsx_to_trees.py)
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
def j(f): return io.open(os.path.join(HERE, f), encoding="utf-8").read().strip()
def build(template, out, slots):
    html = io.open(os.path.join(HERE, template), encoding="utf-8").read()
    for ph, f in slots.items():
        html = html.replace(ph, j(f))
        assert ph not in html, f"{template}: {ph} still present after injection"
    io.open(os.path.join(ROOT, out), "w", encoding="utf-8", newline="\n").write(html)
    print("built", out, f"({len(html):,} chars)")
build("app_template.html", "Starwrought_App.html", {
    "__TREES_JSON__": "trees.json", "__ROSTER_JSON__": "roster.json",
    "__SHEET_SPEC__": "sheet_spec.json", "__BACKGROUNDS_JSON__": "backgrounds.json",
    "__LANGUAGES_JSON__": "languages.json"})
build("constellation_template.html", "Starwrought_Talent_Constellations.html", {
    "__TREES_JSON__": "trees.json"})
