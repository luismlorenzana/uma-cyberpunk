// The manual's desktop pages (CY4): renders each docs/game/*.md page to docs/game/previews/<page>.html in one style, with
// Mermaid diagrams drawn in the browser, light and dark. Design docs listed in DESIGN (D20) render the same way to
// docs/design/previews/; the older design pages there are hand-made. A page whose HTML carries `<!-- hand-made -->` is left
// alone (the marker sits right after its doctype). `node scripts/manual-pages.mjs` writes them; its test fails when one is stale. No dependencies: a small
// Markdown subset (headings, paragraphs, lists, tables, code, quotes, bold, italics, code spans and links).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MANUAL = join(root, 'docs/game')
const PREVIEWS = join(MANUAL, 'previews')
const DESIGN_DIR = join(root, 'docs/design')
/** Design docs whose desktop pages are generated (the rest of docs/design/previews is hand-made). */
export const DESIGN = ['life-aboard', 'research-life-aboard', 'story-brief-life-aboard', 'character-sprites', 'combat-sprites-request']

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A link from the Markdown page, re-aimed from the previews folder. */
function href(link) {
  if (/^(https?:|mailto:|#)/.test(link)) return link
  const sibling = /^([a-z0-9-]+)\.md(#.*)?$/.exec(link)
  if (sibling) return `${sibling[1]}.html${sibling[2] ?? ''}`
  if (link.startsWith('previews/')) return link.slice('previews/'.length)
  return `../${link}`
}

function inline(text) {
  const codes = []
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  s = esc(s)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, l) => `<a href="${href(l)}">${t}</a>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`)
}

const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-')

function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')))
  const [head, , ...body] = lines
  return `<div class="scroll"><table><tr>${cells(head).map((c) => `<th>${c}</th>`).join('')}</tr>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`
}

function list(lines) {
  // Items start at indent 0 ("- " or "1. "); deeper lines nest or continue the item.
  const ordered = /^\d+\./.test(lines[0].trim())
  const items = []
  for (const line of lines) {
    if (/^(- |\d+\. )/.test(line)) items.push([line.replace(/^(- |\d+\. )/, '')])
    else items[items.length - 1].push(line.replace(/^ {2,3}/, ''))
  }
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}>${items.map((it) => {
    // The item's own text runs on until a nested list, table, fence or blank line; the rest renders as blocks.
    let cut = it.findIndex((l, k) => k > 0 && (!l.trim() || /^(- |\d+\. |\||```)/.test(l)))
    if (cut < 0) cut = it.length
    const text = it.slice(0, cut).map((l) => l.trim()).join(' ')
    const rest = it.slice(cut)
    return `<li>${inline(text)}${rest.length ? blocks(rest) : ''}</li>`
  }).join('')}</${tag}>`
}

/** Markdown blocks to HTML. */
export function blocks(lines) {
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const fence = /^```(\w*)/.exec(line)
    if (fence) {
      const body = []
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i])
      i++
      out.push(fence[1] === 'mermaid' ? `<pre class="mermaid">${esc(body.join('\n'))}</pre>` : `<pre><code>${esc(body.join('\n'))}</code></pre>`)
      continue
    }
    const heading = /^(#{1,4}) (.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length, text = inline(heading[2])
      out.push(`<h${level} id="${slug(heading[2])}">${text}</h${level}>`)
      i++
      continue
    }
    if (line.startsWith('|')) {
      const rows = []
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i])
      out.push(table(rows))
      continue
    }
    if (line.startsWith('>')) {
      const quote = []
      for (; i < lines.length && lines[i].startsWith('>'); i++) quote.push(lines[i].replace(/^> ?/, ''))
      out.push(`<blockquote>${blocks(quote)}</blockquote>`)
      continue
    }
    if (/^(- |\d+\. )/.test(line)) {
      const items = []
      for (; i < lines.length && (/^(- |\d+\. )/.test(lines[i]) || (/^ {2,}\S/.test(lines[i])) || (!lines[i].trim() && /^( {2,}|- |\d+\. )/.test(lines[i + 1] ?? ''))); i++)
        if (lines[i].trim()) items.push(lines[i])
      out.push(list(items))
      continue
    }
    const para = []
    for (; i < lines.length && lines[i].trim() && !/^(#{1,4} |```|\||>|- |\d+\. )/.test(lines[i]); i++) para.push(lines[i].trim())
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

const STYLE = `
  :root { --page:#eef1f7; --panel:#fff; --raised:#f4f6fb; --sunken:#e5e9f2; --ink:#10131f; --ink-soft:#56607a; --ink-faint:#8891a8;
    --accent:#0a9fbc; --accent-wash:#ddf5fa; --magenta:#c2268f; --hairline:rgb(16 19 31/.08); --hairline-strong:rgb(16 19 31/.16); color-scheme:light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --page:#0b0d17; --panel:#141827; --raised:#1b2033; --sunken:#090b13;
    --ink:#e8ebf5; --ink-soft:#a3abc2; --ink-faint:#6d7590; --accent:#2ee6ff; --accent-wash:#0e2a33; --magenta:#ff3dc8;
    --hairline:rgb(255 255 255/.08); --hairline-strong:rgb(255 255 255/.16); color-scheme:dark; } }
  :root[data-theme="dark"] { --page:#0b0d17; --panel:#141827; --raised:#1b2033; --sunken:#090b13; --ink:#e8ebf5; --ink-soft:#a3abc2;
    --ink-faint:#6d7590; --accent:#2ee6ff; --accent-wash:#0e2a33; --magenta:#ff3dc8; --hairline:rgb(255 255 255/.08); --hairline-strong:rgb(255 255 255/.16); color-scheme:dark; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--page); color:var(--ink); font:14px/1.5 system-ui,-apple-system,'Inter',sans-serif; }
  .wrap { display:grid; grid-template-columns:240px minmax(0,1fr); gap:24px; max-width:1240px; margin:0 auto; padding:24px 16px 64px; }
  nav.toc { position:sticky; top:16px; align-self:start; max-height:calc(100vh - 32px); overflow:auto; font-size:12.5px; }
  nav.toc a { display:block; padding:3px 8px; border-radius:6px; color:var(--ink-soft); text-decoration:none; }
  nav.toc a.h3 { padding-left:20px; font-size:12px; }
  nav.toc a:hover { background:var(--sunken); color:var(--ink); }
  main { background:var(--panel); border-radius:14px; padding:24px 28px; box-shadow:0 1px 0 var(--hairline-strong); min-width:0; }
  h1 { font:700 26px/1.2 ui-rounded,'SF Pro Rounded',system-ui,sans-serif; margin:0 0 12px; }
  h2 { font:700 19px/1.3 ui-rounded,system-ui,sans-serif; margin:28px 0 10px; padding-top:14px; border-top:1px solid var(--hairline); }
  h3 { font:700 15px/1.3 system-ui,sans-serif; margin:20px 0 8px; color:var(--accent); }
  h4 { font:700 13px/1.3 system-ui,sans-serif; margin:16px 0 6px; }
  p, li { color:var(--ink-soft); max-width:92ch; } b { color:var(--ink); }
  a { color:var(--accent); }
  code { font:12px ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--sunken); padding:1px 5px; border-radius:5px; color:var(--ink); }
  pre { background:var(--sunken); padding:12px 14px; border-radius:10px; overflow:auto; } pre code { background:none; padding:0; }
  pre.mermaid { background:var(--raised); text-align:center; }
  blockquote { margin:12px 0; padding:8px 14px; border-left:3px solid var(--accent); background:var(--accent-wash); border-radius:0 10px 10px 0; }
  blockquote p { color:var(--ink); }
  .scroll { overflow-x:auto; margin:10px 0; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--hairline); vertical-align:top; }
  th { font:700 12px system-ui; color:var(--ink-soft); background:var(--raised); }
  td:first-child { font-weight:600; color:var(--ink); }
  .foot { margin-top:28px; font-size:12px; color:var(--ink-faint); }
  @media (max-width: 860px) { .wrap { grid-template-columns:1fr; } nav.toc { position:static; max-height:none; } }
`

/** The page for one Markdown file. */
export function page(name, markdown, { source = `docs/game/${name}.md`, foot = 'The manual is what the game is, as built.' } = {}) {
  const lines = markdown.replace(/\r/g, '').split('\n').filter((l) => !/^<!-- .* -->$/.test(l.trim()))
  const title = (/^# (.*)$/m.exec(markdown)?.[1] ?? name).replace(/`/g, '')
  const body = blocks(lines)
  const toc = [...body.matchAll(/<h([23]) id="([^"]+)">(.*?)<\/h\1>/g)].map(([, l, id, t]) => `<a class="h${l}" href="#${id}">${t.replace(/<[^>]+>/g, '')}</a>`).join('')
  const mermaid = body.includes('class="mermaid"')
    ? `\n<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });</script>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- Generated from ${source} by scripts/manual-pages.mjs. Edit the Markdown, then run the script. -->
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<nav class="toc"><a href="#top"><b>${esc(title)}</b></a>${toc}</nav>
<main id="top">
${body}
<p class="foot">From <a href="../${name}.md">${source}</a>. ${foot}</p>
</main>
</div>${mermaid}
</body>
</html>
`
}

/** Every generated page: [path, html]. */
export function pages() {
  const manual = readdirSync(MANUAL).filter((f) => f.endsWith('.md') && f !== 'README.md').flatMap((f) => {
    const name = f.slice(0, -3), path = join(PREVIEWS, `${name}.html`)
    if (existsSync(path) && readFileSync(path, 'utf8').slice(0, 200).includes('<!-- hand-made -->')) return []
    return [[path, page(name, readFileSync(join(MANUAL, f), 'utf8'))]]
  })
  const design = DESIGN.filter((name) => existsSync(join(DESIGN_DIR, `${name}.md`))).map((name) => [join(DESIGN_DIR, 'previews', `${name}.html`),
    page(name, readFileSync(join(DESIGN_DIR, `${name}.md`), 'utf8'), { source: `docs/design/${name}.md`, foot: 'A design page: every call is a recommendation, adopted until the owner changes it.' })])
  return [...manual, ...design]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, html] of pages()) writeFileSync(path, html)
  console.log(`manual pages → ${PREVIEWS}; design pages → ${join(DESIGN_DIR, 'previews')}`)
}
