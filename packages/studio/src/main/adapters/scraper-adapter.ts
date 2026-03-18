/**
 * 在线采样适配器 — 从 Royal Road / ScribbleHub 抓取标的小说章节文本
 * 用于风格分析和 AI 建议生成的数据源
 */

import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { request as httpsRequest, type IncomingMessage } from 'node:https'
import { createGunzip, createInflate } from 'node:zlib'
import * as cheerio from 'cheerio'

// ─── Types ───

export interface ScrapeTarget {
  platform: 'royalroad' | 'scribblehub'
  fictionUrl: string
  title: string
}

export interface ChapterInfo {
  number: number
  title: string
  url: string
}

export interface ScrapeProgress {
  phase: 'chapters' | 'sampling'
  current: number
  total: number
  chapterTitle?: string
}

export interface ScrapeResult {
  title: string
  author: string
  platform: string
  totalChapters: number
  sampledChapters: number
  wordCount: number
  savedPath: string
}

// ─── Constants ───

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const POLITE_DELAY_MS = 1500

// ─── HTTP Fetch (reuses trending-adapter pattern) ───

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = httpsRequest({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Referer': parsed.origin + '/',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      }
    }, (res: IncomingMessage) => {
      // Follow 3xx redirects (same-origin only)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location
        if (loc.startsWith('http') && !loc.includes(parsed.hostname)) {
          // Skip cross-origin ad redirects
          res.resume()
          reject(new Error(`Ad redirect detected: ${loc.substring(0, 80)}`))
          return
        }
        const fullLoc = loc.startsWith('http') ? loc : `${parsed.origin}${loc}`
        fetchHtml(fullLoc).then(resolve, reject)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} from ${url}`))
        return
      }
      let stream: NodeJS.ReadableStream = res
      const encoding = res.headers['content-encoding']
      if (encoding === 'gzip') stream = res.pipe(createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(createInflate())

      let data = ''
      stream.setEncoding('utf-8')
      stream.on('data', (chunk: string) => { data += chunk })
      stream.on('end', () => resolve(data))
      stream.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ─── Royal Road Parser ───

function parseRRFictionPage(html: string): { author: string; chapters: ChapterInfo[] } {
  const $ = cheerio.load(html)
  const author = $('h4 a[href^="/profile/"]').first().text().trim() || 'Unknown'

  const chapters: ChapterInfo[] = []
  // RR chapter table rows: each row has <a href="/fiction/.../chapter/...">title</a>
  $('table#chapters tbody tr, table tbody tr').each((_, row) => {
    const link = $(row).find('td a[href*="/chapter/"]').first()
    if (!link.length) return
    const href = link.attr('href')
    const title = link.text().trim()
    if (href && title) {
      chapters.push({
        number: chapters.length + 1,
        title,
        url: href.startsWith('http') ? href : `https://www.royalroad.com${href}`,
      })
    }
  })

  // Fallback: regex if table selector misses (RR sometimes paginates TOC)
  if (chapters.length === 0) {
    const pattern = /href="(\/fiction\/\d+\/[^"]*\/chapter\/\d+\/[^"]*)"/g
    let m: RegExpExecArray | null
    const seen = new Set<string>()
    while ((m = pattern.exec(html)) !== null) {
      if (seen.has(m[1])) continue
      seen.add(m[1])
      chapters.push({
        number: chapters.length + 1,
        title: `Chapter ${chapters.length + 1}`,
        url: `https://www.royalroad.com${m[1]}`,
      })
    }
  }

  return { author, chapters }
}

function parseRRChapterContent(html: string): string {
  const $ = cheerio.load(html)
  // Remove author notes, ads, and scripts
  $('.author-note, .portlet-body .author-note-portlet, script, .ads, .advertisement').remove()
  const content = $('.chapter-content').text().trim()
  return content
}

// ─── ScribbleHub Parser ───

function parseSHSeriesPage(html: string): { author: string; chapters: ChapterInfo[] } {
  const $ = cheerio.load(html)
  const author = $('span.auth_name_fic').text().trim()
    || $('a[href*="/profile/"]').first().text().trim()
    || 'Unknown'

  const chapters: ChapterInfo[] = []
  // SH TOC: <li class="toc_w"><a href="...">Chapter Title</a></li>
  $('.toc_ol a[href*="/read/"]').each((_, el) => {
    const href = $(el).attr('href')
    const title = $(el).text().trim()
    if (href && title) {
      chapters.push({
        number: chapters.length + 1,
        title,
        url: href.startsWith('http') ? href : `https://www.scribblehub.com${href}`,
      })
    }
  })

  // Fallback regex
  if (chapters.length === 0) {
    const pattern = /href="(https?:\/\/www\.scribblehub\.com\/read\/[^"]+)"/g
    let m: RegExpExecArray | null
    const seen = new Set<string>()
    while ((m = pattern.exec(html)) !== null) {
      if (seen.has(m[1])) continue
      seen.add(m[1])
      chapters.push({
        number: chapters.length + 1,
        title: `Chapter ${chapters.length + 1}`,
        url: m[1],
      })
    }
  }

  return { author, chapters }
}

function parseSHChapterContent(html: string): string {
  const $ = cheerio.load(html)
  // SH chapter content is in div#chp_raw or div.chp_raw
  $('script, .ads, .advertisement, .wi_authornotes').remove()
  const content = $('#chp_raw').text().trim() || $('.chp_raw').text().trim()
  return content
}

// ─── Smart Sampling ───

function selectSampleChapters(chapters: ChapterInfo[], maxSamples: number = 15): ChapterInfo[] {
  const total = chapters.length
  if (total <= maxSamples) return chapters

  const selected: ChapterInfo[] = []
  const perSection = Math.floor(maxSamples / 3)

  // Front 5: opening hook and style establishment
  for (let i = 0; i < Math.min(perSection, total); i++) {
    selected.push(chapters[i])
  }

  // Middle 5: stable-period pacing
  const midStart = Math.floor(total / 2) - Math.floor(perSection / 2)
  for (let i = 0; i < perSection && midStart + i < total; i++) {
    const ch = chapters[midStart + i]
    if (!selected.includes(ch)) selected.push(ch)
  }

  // Latest 5: current writing style
  const remaining = maxSamples - selected.length
  const tailStart = Math.max(total - remaining, 0)
  for (let i = tailStart; i < total && selected.length < maxSamples; i++) {
    const ch = chapters[i]
    if (!selected.includes(ch)) selected.push(ch)
  }

  return selected
}

// ─── Main Adapter ───

export class ScraperAdapter {
  private projectRoot: string | null = null
  private onProgress: ((p: ScrapeProgress) => void) | null = null

  setProjectRoot(root: string): void { this.projectRoot = root }

  setProgressCallback(cb: (p: ScrapeProgress) => void): void { this.onProgress = cb }

  private getRoot(): string {
    if (!this.projectRoot) throw new Error('Project root not set')
    return this.projectRoot
  }

  private styleBooksDir(bookId: string): string {
    return join(this.getRoot(), 'books', bookId, 'humanize', 'style-books')
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }

  /**
   * Parse a fiction URL to detect platform
   */
  detectPlatform(url: string): 'royalroad' | 'scribblehub' | null {
    if (url.includes('royalroad.com')) return 'royalroad'
    if (url.includes('scribblehub.com')) return 'scribblehub'
    return null
  }

  /**
   * Fetch the table of contents for a fiction
   */
  async fetchChapterList(fictionUrl: string): Promise<{ author: string; chapters: ChapterInfo[] }> {
    const platform = this.detectPlatform(fictionUrl)
    if (!platform) throw new Error(`Unsupported platform URL: ${fictionUrl}`)

    const html = await fetchHtml(fictionUrl)

    if (platform === 'royalroad') return parseRRFictionPage(html)
    return parseSHSeriesPage(html)
  }

  /**
   * Scrape sample chapters and save as a style reference book
   */
  async scrapeForStyleAnalysis(
    bookId: string,
    fictionUrl: string,
    fictionTitle: string,
    maxSamples: number = 15,
  ): Promise<ScrapeResult> {
    const platform = this.detectPlatform(fictionUrl)
    if (!platform) throw new Error(`Unsupported platform URL: ${fictionUrl}`)

    // Step 1: Fetch chapter list
    this.onProgress?.({ phase: 'chapters', current: 0, total: 1 })
    const { author, chapters } = await this.fetchChapterList(fictionUrl)
    if (chapters.length === 0) throw new Error(`No chapters found at ${fictionUrl}`)
    this.onProgress?.({ phase: 'chapters', current: 1, total: 1 })

    // Step 2: Smart sampling
    const samples = selectSampleChapters(chapters, maxSamples)

    // Step 3: Fetch each chapter with polite delay
    const texts: string[] = []
    let totalWords = 0
    for (let i = 0; i < samples.length; i++) {
      const ch = samples[i]
      this.onProgress?.({ phase: 'sampling', current: i + 1, total: samples.length, chapterTitle: ch.title })

      try {
        const html = await fetchHtml(ch.url)
        const text = platform === 'royalroad'
          ? parseRRChapterContent(html)
          : parseSHChapterContent(html)

        if (text.length > 100) { // Skip empty/broken chapters
          texts.push(`--- ${ch.title} ---\n\n${text}`)
          totalWords += text.split(/\s+/).length
        }
      } catch {
        // Skip failed chapters silently, continue sampling
      }

      // Polite delay between requests
      if (i < samples.length - 1) await sleep(POLITE_DELAY_MS)
    }

    if (texts.length === 0) throw new Error('Failed to extract any chapter content')

    // Step 4: Save combined text as style book
    const dir = this.styleBooksDir(bookId)
    await this.ensureDir(dir)
    const safeName = fictionTitle.replace(/[<>:"/\\|?*]/g, '_').substring(0, 60)
    const fileName = `${safeName} [${platform}].txt`
    const filePath = join(dir, fileName)

    const header = [
      `# Style Reference: ${fictionTitle}`,
      `# Author: ${author}`,
      `# Platform: ${platform === 'royalroad' ? 'Royal Road' : 'ScribbleHub'}`,
      `# Sampled: ${texts.length} of ${chapters.length} chapters`,
      `# Word Count: ~${totalWords.toLocaleString()}`,
      `# Scraped: ${new Date().toISOString()}`,
      '',
      ''
    ].join('\n')

    await writeFile(filePath, header + texts.join('\n\n'), 'utf-8')

    return {
      title: fictionTitle,
      author,
      platform: platform === 'royalroad' ? 'Royal Road' : 'ScribbleHub',
      totalChapters: chapters.length,
      sampledChapters: texts.length,
      wordCount: totalWords,
      savedPath: fileName,
    }
  }

  /**
   * Check if a style reference already exists for this fiction
   */
  async hasStyleBook(bookId: string, fictionTitle: string): Promise<boolean> {
    const dir = this.styleBooksDir(bookId)
    if (!existsSync(dir)) return false
    const safeName = fictionTitle.replace(/[<>:"/\\|?*]/g, '_').substring(0, 60)
    return existsSync(join(dir, `${safeName} [royalroad].txt`))
      || existsSync(join(dir, `${safeName} [scribblehub].txt`))
  }
}
