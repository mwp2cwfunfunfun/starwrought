LIVE TOOLING — do not delete. Everything here rebuilds from data/*.xlsx.

The pipeline (run from the project root):
  1) python3 assets/xlsx_to_trees.py        data/*.xlsx -> trees/backgrounds/languages JSON (validates; refuses to write on errors)
  2) python3 assets/inject.py               templates + JSON -> Starwrought_App.html + Starwrought_Talent_Constellations.html
  3) python3 assets/render_constellations.py   print plates -> assets/constellations/*.png (used by the handbook)
  4) python3 assets/sheet_gen.py            character sheets (blank fillable + Mira)
  5) node assets/build_phb.js               Player's Handbook .docx (needs the docx package; convert to PDF via LibreOffice)

app_template.html / constellation_template.html are the SOURCE for the two HTML files in the
project root — edit templates, then re-run inject.py. The root HTML files are generated output.
All paths are relative: the project folder can be renamed or moved freely.
