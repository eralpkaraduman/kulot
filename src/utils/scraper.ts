import { chromium } from 'playwright'
import TurndownService from 'turndown'

interface ReadabilityResult {
  title: string
  content: string
}

interface PageMetadata {
  title: string
  description: string
  siteName: string
}

const COMMON_VIEWPORT = { width: 1716, height: 1055 }
const COMMON_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
  '--disable-extensions',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-plugins',
  '--no-first-run',
  '--no-default-browser-check'
]

export async function scrapeUrlToMarkdown(url: string) {
  const browser = await chromium.launch({
    headless: true,
    args: CHROME_ARGS
  })

  try {
    const context = await browser.newContext({
      userAgent: COMMON_USER_AGENT,
      viewport: COMMON_VIEWPORT,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    })
    
    const page = await context.newPage()
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    
    await page.waitForLoadState('domcontentloaded')
    
    const metadataTimeout = 10000
    
    // Start metadata extraction immediately (don't wait for content detection)
    const metadataPromises = [
      page.title().then(t => t || '').catch(() => ''),
      page.getAttribute('meta[property="og:title"]', 'content').then(t => t || '').catch(() => ''),
      page.getAttribute('meta[property="og:description"]', 'content').then(t => t || '').catch(() => ''),
      page.getAttribute('meta[name="description"]', 'content').then(t => t || '').catch(() => ''),
      page.getAttribute('meta[property="og:site_name"]', 'content').then(t => t || '').catch(() => ''),
      page.textContent('h1').then(t => t || '').catch(() => ''),
    ].map(p => Promise.race([
      p,
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), metadataTimeout))
    ]))

    // Start content detection in parallel (non-blocking)
    const contentDetectionPromise = page.waitForFunction(
      () => {
        // Check for common content indicators
        const hasTitle = document.querySelector('h1, [property="og:title"]')
        const hasContent = document.querySelector('main, article, [role="main"], .content')
        const hasText = (document.body?.textContent?.trim()?.length ?? 0) > 100
        
        return hasTitle || hasContent || hasText
      },
      { timeout: metadataTimeout }
    ).catch(() => false) // Don't crash, just return false
    
    // Race: continue as soon as we have basic metadata OR content is detected
    // This ensures we don't wait unnecessarily while being crash-resistant
    await Promise.race([
      Promise.allSettled(metadataPromises.slice(0, 3)), // title, og:title, og:description
      contentDetectionPromise
    ]).catch(() => {}) // Ensure no crashes

    const results = await Promise.allSettled(metadataPromises)
    const [title, ogTitle, ogDescription, description, ogSiteName, h1Text] = results.map(r => 
      r.status === 'fulfilled' ? r.value : ''
    )
    
    const metadata: PageMetadata = {
      title: ogTitle || title || h1Text || 'Untitled',
      description: ogDescription || description || '',
      siteName: ogSiteName || '',
    }

    // Remove images for cleaner content extraction
    try {
      await page.$$eval('img', imgs => imgs.forEach(img => img.remove()))
    } catch {}

    let article: ReadabilityResult | null = null

    try {
      await page.addScriptTag({ 
        url: 'https://unpkg.com/@mozilla/readability@0.5.0/Readability.js' 
      })
      
      article = await page.evaluate(function() {
        // @ts-expect-error
        var reader = new window.Readability(document, {
          keepClasses: false
        })
        return reader.parse()
      })
    } catch (readabilityError) {
      console.warn('Readability failed, using fallback extraction')
    }
    
    await context.close()
    
    let content = ''
    
    if (article && article.content) {
      const turndownService = new TurndownService({
        headingStyle: 'atx',         
        bulletListMarker: '-',       
        codeBlockStyle: 'fenced',    
        fence: '```',                
        emDelimiter: '_',            
        strongDelimiter: '**',       
      })
      
      turndownService.remove(['script', 'style', 'img', 'iframe', 'a'])
      
      content = turndownService.turndown(article.content || '')
        .replace(/\n{2,}/g, '\n')    // Max 1 newline (no double spacing)
        .replace(/^\s*-\s*$/gm, '')  // Remove empty bullet points
        .trim()                      // Clean edges
    } else {
      // If Readability failed, use description as content fallback
      content = metadata.description || 'Content extraction failed, but metadata was collected successfully.'
    }

    return {
      metadata: {
        ...metadata,
        title: metadata.title || (article ? article.title : null) || 'Untitled',
      },
      content,
    }
  } finally {
    await browser.close()
  }
}
