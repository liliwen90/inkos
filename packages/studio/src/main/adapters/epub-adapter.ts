/**
 * EPUB 生成器 — 将书籍章节打包为符合 KDP 标准的 EPUB3 文件
 */
import JSZip from 'jszip'
import { randomUUID } from 'crypto'

// ─── 公开类型 ───

export interface EpubChapter {
  number: number
  title: string
  content: string // markdown
}

export interface EpubMetadata {
  title: string
  author: string
  language: 'zh' | 'en'
  description?: string
  keywords?: string[]
  coverImageBase64?: string // data:image/png;base64,... or raw base64
}

export interface KDPFormatOptions {
  includeToC: boolean
  includeTitlePage: boolean
  includeCopyrightPage: boolean
  chapterHeadingStyle: 'chapter-number' | 'title-only' | 'full'
}

// ─── 主入口 ───

export async function buildEpub(
  chapters: EpubChapter[],
  metadata: EpubMetadata,
  options: KDPFormatOptions
): Promise<Buffer> {
  const zip = new JSZip()
  const uid = randomUUID()

  // 1. mimetype（必须最先、不压缩）
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // 2. META-INF
  zip.file('META-INF/container.xml', containerXml())

  // 3. CSS
  zip.file('OEBPS/style.css', epubCss(metadata.language))

  // 4. 封面
  const coverBuf = decodeCoverImage(metadata.coverImageBase64)
  if (coverBuf) {
    zip.file('OEBPS/cover.png', coverBuf)
    zip.file('OEBPS/cover.xhtml', coverXhtml())
  }

  // 5. 扉页
  if (options.includeTitlePage) {
    zip.file('OEBPS/title.xhtml', titlePageXhtml(metadata))
  }

  // 6. 版权页
  if (options.includeCopyrightPage) {
    zip.file('OEBPS/copyright.xhtml', copyrightXhtml(metadata))
  }

  // 7. 章节
  for (const ch of chapters) {
    const fname = chapterFilename(ch.number)
    zip.file(`OEBPS/${fname}`, chapterXhtml(ch, metadata.language, options.chapterHeadingStyle))
  }

  // 8. 目录
  zip.file('OEBPS/toc.ncx', tocNcx(chapters, metadata, options, !!coverBuf, uid))
  zip.file('OEBPS/nav.xhtml', navXhtml(chapters, metadata, options, !!coverBuf))

  // 9. OPF
  zip.file('OEBPS/content.opf', contentOpf(chapters, metadata, options, uid, !!coverBuf))

  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' }) as Promise<Buffer>
}

// ─── 内部工具 ───

function chapterFilename(num: number): string {
  return `chapter_${String(num).padStart(4, '0')}.xhtml`
}

function decodeCoverImage(src?: string): Buffer | null {
  if (!src) return null
  const raw = src.includes(',') ? src.split(',')[1] : src
  return Buffer.from(raw, 'base64')
}

/** 去掉章节 markdown 首行标题 */
function stripFirstHeading(md: string): string {
  const lines = md.split('\n')
  let i = 0
  for (; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '') continue
    if (t.startsWith('#')) { i++; break }
    break
  }
  // 跳过标题后的空行
  while (i < lines.length && lines[i].trim() === '') i++
  return lines.slice(i).join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 简易 markdown → XHTML 段落转换（适用于小说正文） */
function mdToXhtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let para: string[] = []

  const flush = (): void => {
    if (para.length === 0) return
    let text = escapeXml(para.join(' '))
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
    out.push(`    <p>${text}</p>`)
    para = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (t === '') { flush(); continue }
    const hm = t.match(/^(#{1,6})\s+(.+)$/)
    if (hm) {
      flush()
      const lvl = hm[1].length
      out.push(`    <h${lvl}>${escapeXml(hm[2])}</h${lvl}>`)
    } else {
      para.push(t)
    }
  }
  flush()
  return out.join('\n')
}

function chapterHeading(ch: EpubChapter, lang: 'zh' | 'en', style: KDPFormatOptions['chapterHeadingStyle']): string {
  switch (style) {
    case 'chapter-number':
      return lang === 'en' ? `Chapter ${ch.number}` : `第${ch.number}章`
    case 'title-only':
      return ch.title
    case 'full':
      return lang === 'en' ? `Chapter ${ch.number}: ${ch.title}` : `第${ch.number}章 ${ch.title}`
  }
}

// ─── XHTML 模板 ───

const XHTML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">`

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

function coverXhtml(): string {
  return `${XHTML_HEADER}
<head><title>Cover</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body class="cover">
  <div class="cover-img">
    <img src="cover.png" alt="Cover"/>
  </div>
</body>
</html>`
}

function titlePageXhtml(meta: EpubMetadata): string {
  return `${XHTML_HEADER}
<head><title>${escapeXml(meta.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body class="titlepage">
  <div class="titlepage-content">
    <h1>${escapeXml(meta.title)}</h1>
    <p class="author">${escapeXml(meta.author)}</p>
    ${meta.description ? `<p class="description">${escapeXml(meta.description)}</p>` : ''}
  </div>
</body>
</html>`
}

function copyrightXhtml(meta: EpubMetadata): string {
  const year = new Date().getFullYear()
  const lang = meta.language
  return `${XHTML_HEADER}
<head><title>${lang === 'en' ? 'Copyright' : '版权信息'}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body class="copyright">
  <div class="copyright-content">
    <p>${lang === 'en' ? 'Copyright' : '版权所有'} &copy; ${year} ${escapeXml(meta.author)}</p>
    <p>${lang === 'en' ? 'All rights reserved.' : '保留所有权利。'}</p>
    <p>${lang === 'en'
      ? 'No part of this publication may be reproduced, distributed, or transmitted in any form without prior written permission.'
      : '未经著作权人事先书面许可，不得以任何形式复制、分发或传播本出版物的任何部分。'}</p>
    <p>${lang === 'en' ? 'This is a work of fiction.' : '本书纯属虚构。'}</p>
  </div>
</body>
</html>`
}

function chapterXhtml(ch: EpubChapter, lang: 'zh' | 'en', style: KDPFormatOptions['chapterHeadingStyle']): string {
  const heading = chapterHeading(ch, lang, style)
  const body = mdToXhtml(stripFirstHeading(ch.content))
  return `${XHTML_HEADER}
<head><title>${escapeXml(heading)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body class="chapter">
  <h2 class="chapter-title">${escapeXml(heading)}</h2>
${body}
</body>
</html>`
}

// ─── CSS ───

function epubCss(lang: 'zh' | 'en'): string {
  const fontFamily = lang === 'en'
    ? `Georgia, 'Times New Roman', serif`
    : `'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif`

  return `/* HintOS EPUB Stylesheet */
body {
  font-family: ${fontFamily};
  font-size: 1em;
  line-height: 1.8;
  margin: 1em;
  color: #1a1a1a;
}
h1, h2, h3 { text-align: center; margin: 1.5em 0 1em; }
h1 { font-size: 1.8em; }
h2 { font-size: 1.4em; }
h2.chapter-title {
  page-break-before: always;
  margin-top: 3em;
  margin-bottom: 2em;
}
p {
  text-indent: 2em;
  margin: 0.5em 0;
}
.cover { text-align: center; padding: 0; margin: 0; }
.cover-img { height: 100%; }
.cover-img img { max-width: 100%; max-height: 100%; }
.titlepage { text-align: center; margin-top: 30%; }
.titlepage h1 { font-size: 2.2em; margin-bottom: 0.5em; }
.titlepage .author { font-size: 1.3em; color: #555; margin-top: 1em; }
.titlepage .description { font-size: 0.9em; color: #777; margin-top: 2em; max-width: 80%; margin-left: auto; margin-right: auto; }
.copyright { margin-top: 20%; font-size: 0.85em; color: #555; text-align: center; }
.copyright p { text-indent: 0; margin: 0.8em 0; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.4em 0; }
nav a { text-decoration: none; color: #333; }
`
}

// ─── OPF (Package Document) ───

function contentOpf(
  chapters: EpubChapter[],
  meta: EpubMetadata,
  opts: KDPFormatOptions,
  uid: string,
  hasCover: boolean
): string {
  const items: string[] = []
  const spine: string[] = []
  let order = 0

  // Style
  items.push('    <item id="css" href="style.css" media-type="text/css"/>')

  // Cover
  if (hasCover) {
    items.push('    <item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>')
    items.push('    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>')
    spine.push('    <itemref idref="cover" linear="no"/>')
  }

  // Title page
  if (opts.includeTitlePage) {
    items.push('    <item id="titlepage" href="title.xhtml" media-type="application/xhtml+xml"/>')
    spine.push('    <itemref idref="titlepage"/>')
  }

  // Nav
  items.push('    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
  items.push('    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>')

  // Copyright
  if (opts.includeCopyrightPage) {
    items.push('    <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>')
    spine.push('    <itemref idref="copyright"/>')
  }

  // Chapters
  for (const ch of chapters) {
    const id = `ch${ch.number}`
    items.push(`    <item id="${id}" href="${chapterFilename(ch.number)}" media-type="application/xhtml+xml"/>`)
    spine.push(`    <itemref idref="${id}"/>`)
  }

  const kw = meta.keywords?.length ? `\n    <dc:subject>${meta.keywords.map(escapeXml).join(', ')}</dc:subject>` : ''
  const desc = meta.description ? `\n    <dc:description>${escapeXml(meta.description)}</dc:description>` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uid}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}</dc:title>
    <dc:creator>${escapeXml(meta.author)}</dc:creator>
    <dc:language>${meta.language === 'en' ? 'en' : 'zh-CN'}</dc:language>${desc}${kw}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
${items.join('\n')}
  </manifest>
  <spine toc="ncx">
${spine.join('\n')}
  </spine>
</package>`
}

// ─── NCX (EPUB2 兼容目录，KDP 必需) ───

function tocNcx(
  chapters: EpubChapter[],
  meta: EpubMetadata,
  opts: KDPFormatOptions,
  hasCover: boolean,
  uid: string
): string {
  const points: string[] = []
  let seq = 1

  if (opts.includeTitlePage) {
    points.push(navPoint(seq++, 'titlepage', meta.language === 'en' ? 'Title Page' : '扉页', 'title.xhtml'))
  }
  if (opts.includeCopyrightPage) {
    points.push(navPoint(seq++, 'copyright', meta.language === 'en' ? 'Copyright' : '版权信息', 'copyright.xhtml'))
  }
  for (const ch of chapters) {
    const label = chapterHeading(ch, meta.language, opts.chapterHeadingStyle)
    points.push(navPoint(seq++, `ch${ch.number}`, label, chapterFilename(ch.number)))
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(meta.title)}</text></docTitle>
  <navMap>
${points.join('\n')}
  </navMap>
</ncx>`
}

function navPoint(order: number, id: string, label: string, src: string): string {
  return `    <navPoint id="${id}" playOrder="${order}">
      <navLabel><text>${escapeXml(label)}</text></navLabel>
      <content src="${src}"/>
    </navPoint>`
}

// ─── NAV (EPUB3 导航) ───

function navXhtml(
  chapters: EpubChapter[],
  meta: EpubMetadata,
  opts: KDPFormatOptions,
  hasCover: boolean
): string {
  const lis: string[] = []

  if (opts.includeTitlePage)
    lis.push(`      <li><a href="title.xhtml">${meta.language === 'en' ? 'Title Page' : '扉页'}</a></li>`)
  if (opts.includeCopyrightPage)
    lis.push(`      <li><a href="copyright.xhtml">${meta.language === 'en' ? 'Copyright' : '版权信息'}</a></li>`)
  for (const ch of chapters) {
    const label = chapterHeading(ch, meta.language, opts.chapterHeadingStyle)
    lis.push(`      <li><a href="${chapterFilename(ch.number)}">${escapeXml(label)}</a></li>`)
  }

  return `${XHTML_HEADER}
<head><title>${meta.language === 'en' ? 'Table of Contents' : '目录'}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${meta.language === 'en' ? 'Table of Contents' : '目录'}</h1>
    <ol>
${lis.join('\n')}
    </ol>
  </nav>
</body>
</html>`
}
