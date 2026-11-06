/**
 * A SMALL MARKDOWN-TO-HTML CONVERTER for the build (0.17.0).
 *
 * `AUTOMATION_GRAMMAR.md` in the project root is the grammar's reference, written for the person
 * typing in an Automation cell (CLAUDE.md, standing rule). Since 0.17.0 `assets/build_foundry.mjs`
 * ships it into the game as the "STARWROUGHT Automation Grammar" journal of the rules pack, one page
 * per `## ` section, so the Item sheet's Grammar button opens the same document the author reads.
 * This module turns that Markdown into the HTML a journal text page holds. It reads what the
 * document uses and nothing more: ATX headings, paragraphs, bullet and numbered lists with indented
 * continuation lines, GitHub tables (cells may carry inline code with backslash-escaped backticks
 * inside), fenced code blocks, inline code, bold and italic, and `[[wiki links]]` as their text. It
 * never throws on odd input: a line it does not recognise is a paragraph line. Node built-ins only,
 * no npm dependency, and nothing of Foundry's.
 *
 *   markdownToHtml(markdown) -> html
 *   splitSections(markdown)  -> { title, intro, sections: [{ heading, name, body }] }
 *
 * `splitSections` is the page cut: `title` is the first `# ` line's text, `intro` the Markdown
 * between it and the first `## ` heading, and each section the heading's text (`heading`), the
 * same with a leading "N. " number removed (`name`, the page's name and the stable part of its id)
 * and its Markdown body. A `## ` inside a fenced code block is code, not a heading.
 */

/** The five characters HTML cannot carry in text. */
export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------------------------------- */
/*  Inline                                      */
/* -------------------------------------------- */

/**
 * Inline Markdown to HTML: code spans first (so nothing inside one is read as emphasis), then the
 * text between them escaped and given its bold, italic and wiki-link treatment. Inside a code span
 * a backslash before a backtick is a literal backtick, which is how the grammar document writes
 * `` `CHECK is written \`CHECK: ...\`` `` in a table cell; a backtick never closed is a backtick.
 */
export function inline(text) {
  const source = String(text ?? "");
  const out = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push(styled(buffer));
    buffer = "";
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && source[i + 1] === "`") {
      buffer += "`";
      i += 2;
      continue;
    }
    if (ch === "`") {
      let j = i + 1;
      let code = "";
      let closed = false;
      while (j < source.length) {
        if (source[j] === "\\" && source[j + 1] === "`") {
          code += "`";
          j += 2;
          continue;
        }
        if (source[j] === "`") {
          closed = true;
          break;
        }
        code += source[j];
        j += 1;
      }
      if (!closed) {
        buffer += "`";
        i += 1;
        continue;
      }
      flush();
      out.push(`<code>${escapeHtml(code)}</code>`);
      i = j + 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return out.join("");
}

/** Plain text (no code spans): escaped, wiki links as their text, bold, then italic. */
function styled(text) {
  let html = escapeHtml(text.replace(/\[\[([^\]]*)\]\]/g, "$1"));
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // A single asterisk pair not touching a word or another asterisk on the outside, so "a * b" and
  // the bold already made are left alone.
  html = html.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, "$1<em>$2</em>");
  return html;
}

/* -------------------------------------------- */
/*  Blocks                                      */
/* -------------------------------------------- */

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/**
 * The cells of one table row, split on the pipes that are not inside a code span, the outer pipes
 * dropped, each cell trimmed and still Markdown (inline() renders it).
 */
function cells(line) {
  const text = String(line).trim();
  const out = [];
  let cell = "";
  let inCode = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && (text[i + 1] === "`" || text[i + 1] === "|")) {
      cell += text[i + 1] === "|" ? "|" : "\\`";
      i += 1;
      continue;
    }
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      out.push(cell);
      cell = "";
      continue;
    }
    cell += ch;
  }
  out.push(cell);
  if (text.startsWith("|")) out.shift();
  if (text.endsWith("|") && out.length && out[out.length - 1].trim() === "") out.pop();
  return out.map(c => c.trim());
}

function tableHtml(headers, rows) {
  const head = headers.map(h => `<th>${inline(h)}</th>`).join("");
  const body = rows.map(row => {
    const padded = headers.map((_, index) => row[index] ?? "");
    return `<tr>${padded.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`;
  }).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Markdown to HTML, block by block. Headings keep their level (a page body's `###` is an `<h3>`);
 * a paragraph is its lines joined with a space up to a blank line or the next block; a list is
 * tight, one `<li>` per marker line with indented lines folded into the item before them; a
 * table needs its separator row; a fence runs to the next fence or the end.
 */
export function markdownToHtml(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  const paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flushParagraph();
      const code = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      i += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[i + 1] ?? "")) {
      flushParagraph();
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      html.push(tableHtml(headers, rows));
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const ordered = /^\d/.test(bullet[1]);
      const items = [];
      while (i < lines.length) {
        const marker = lines[i].match(BULLET);
        if (marker) {
          items.push(marker[2]);
          i += 1;
          continue;
        }
        if (/^\s+\S/.test(lines[i]) && !FENCE.test(lines[i])) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map(item => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph();
  return html.join("\n");
}

/* -------------------------------------------- */
/*  Sections                                    */
/* -------------------------------------------- */

/**
 * Cut a document at its `## ` headings. The first `# ` line is the title and goes on no section;
 * the Markdown before the first `## ` is the intro. A section's `name` is its heading without a
 * leading "N. " number, so "## 0. At a glance" is the page "At a glance".
 * @param {string} markdown
 * @returns {{ title: string, intro: string, sections: { heading: string, name: string, body: string }[] }}
 */
export function splitSections(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  const intro = [];
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence) {
      const h1 = line.match(/^#\s+(.*?)\s*#*\s*$/);
      if (h1 && !title && !current) {
        title = h1[1].trim();
        continue;
      }
      const h2 = line.match(/^##\s+(.*?)\s*#*\s*$/);
      if (h2) {
        const heading = h2[1].trim();
        current = { heading, name: heading.replace(/^\d+\.\s+/, ""), lines: [] };
        sections.push(current);
        continue;
      }
    }
    (current ? current.lines : intro).push(line);
  }
  return {
    title,
    intro: intro.join("\n").trim(),
    sections: sections.map(({ heading, name, lines: body }) => ({ heading, name, body: body.join("\n").trim() }))
  };
}
