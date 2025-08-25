import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { execa } from 'execa'
import { authMiddleware } from '../middlewares/auth.js'
import { scrapeUrlToMarkdown } from '../utils/scraper.js'
import type { PinoLogger } from 'hono-pino'

type Variables = {
  logger: PinoLogger
}

export const urlSummaryRoute = new Hono<{ Variables: Variables }>()

urlSummaryRoute.post('/url-summary',
  authMiddleware,
  zValidator('json', z.object({
    url: z.string().min(1, "URL is required").refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid URL format" }
    )
  })),
  async (c) => {
    const { url } = c.req.valid('json')
    const { logger } = c.var
    const scrapeResult = await scrapeUrlToMarkdown(url)    

    logger.info({ url }, 'Starting Claude CLI for URL bookmark summary')
    logger.info({ scrapeResult }, 'Scrape result')

    // Trim content to reasonable length for Claude processing (8000 chars ~2000 tokens)
    const maxContentLength = 8000
    const trimmedContent = scrapeResult.content.length > maxContentLength
      ? scrapeResult.content.substring(0, maxContentLength) + '...[content truncated]'
      : scrapeResult.content

    const prompt = `
Please create a single line summary of this website url in markdown format with additional 1 sentence description: ${url}
Be as quick and concidse as possible.
<example>[title of the page or short url](${url}) very short summary about what this website is about.</example>
Respond with only resulting markdown formatted text. Do not write anything about the process. 
Do not visit the website, please use only the given information below. I already stripped its content down to basic markdown.  
If for some reason you can not create the summary respond with plain text briefly explaining why it failed only.
If it is a youtube or similar site video use the template <example>[YouTube(or site name): video title from the #title element](${url}) additional description summary of the video if possible</example> 
<url>${url}</url>
<title>${scrapeResult.metadata.title}</title>
<site-name>${scrapeResult.metadata.siteName}</site-name>
<description>${scrapeResult.metadata.description}</description>
<content-markdown>${trimmedContent}</content-markdown>
`
    
    logger.info({ promptLength: prompt.length }, 'Executing Claude CLI command');
    
    try {
      const startTime = Date.now()
      
      const { stdout } = await execa('claude', ['--model', 'sonnet', '-p'], {
        timeout: 60000,
        input: prompt,
        env: {
          ...process.env,
        }
      })
      
      const executionTime = Date.now() - startTime
      logger.info({ 
        executionTime, 
        outputLength: stdout.length,
        outputPreview: stdout.substring(0, 150)
      }, 'Claude CLI completed successfully')
      
      return c.text(stdout)
    } catch (error: any) {
      const stderr = error.stderr || ''
      const errorMessage = stderr || error.message || String(error)
      
      logger.error({ 
        error: errorMessage, 
        stderr: stderr ? stderr.substring(0, 200) : undefined 
      }, 'Claude CLI execution failed')
      
      return c.text(`Error: ${errorMessage}`, 500)
    }
  }
)