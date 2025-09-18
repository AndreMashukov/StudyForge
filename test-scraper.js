#!/usr/bin/env node

/**
 * Local scraper test script
 * Run with: node test-scraper.js <url>
 * Example: node test-scraper.js "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html"
 */

const cheerio = require("cheerio");
const { JSDOM } = require("jsdom");
const fetch = require("node-fetch");

// Mock functions logger for local testing
const functions = {
  logger: {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
    debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || '')
  }
};

class LocalWebScraperService {
  static USER_AGENT = "Mozilla/5.0 (compatible; QuizBot/1.0)";
  static TIMEOUT = 10000; // 10 seconds

  /**
   * Extract content from a URL (local version)
   */
  static async extractContent(url) {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid URL protocol. Only HTTP and HTTPS are supported.");
      }

      functions.logger.info(`Scraping URL: ${url}`);

      // Fetch the webpage with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        headers: {
          "User-Agent": this.USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Connection": "keep-alive",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      
      // Use JSDOM for better JavaScript rendering support
      const dom = new JSDOM(html, { url });
      const $ = cheerio.load(dom.window.document.documentElement.outerHTML);

      // Extract content using multiple strategies
      const scrapedContent = this.extractContentFromHtml($, url);
      
      functions.logger.info(`Successfully scraped content from ${url}. Word count: ${scrapedContent.wordCount}`);
      
      return scrapedContent;

    } catch (error) {
      functions.logger.error(`Error scraping URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract content from HTML using Cheerio
   */
  static extractContentFromHtml($, url) {
    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .social-share").remove();

    // Try different strategies to extract the main content
    const title = this.extractTitle($);
    let content = this.extractMainContent($);
    const author = this.extractAuthor($);
    const publishDate = this.extractPublishDate($);

    functions.logger.info(`Raw extracted content length: ${content.length} characters`);
    functions.logger.info(`Content preview: ${content.substring(0, 500)}...`);

    // Clean up content
    content = this.cleanContent(content);
    
    // Calculate word count
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    functions.logger.info(`Clean content word count: ${wordCount}, content length: ${content.length}`);

    // More flexible validation - prioritize content quality over strict word count
    if (wordCount < 20) {
      functions.logger.warn(`Very short content (${wordCount} words) from ${url}`);
      throw new Error("Extracted content is too short to generate a meaningful quiz");
    }
    
    if (wordCount < 50) {
      functions.logger.warn(`Short content (${wordCount} words) from ${url}, but proceeding`);
    }

    return {
      title: title || this.extractTitleFromUrl(url),
      content,
      author,
      publishDate,
      wordCount,
    };
  }

  /**
   * Extract title from various HTML elements
   */
  static extractTitle($) {
    // Try multiple selectors for title
    const titleSelectors = [
      "h1",
      ".entry-title",
      ".post-title",
      ".article-title",
      "[data-testid='headline']",
      ".headline",
      "title",
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 0) {
        return title;
      }
    }

    return "";
  }

  /**
   * Extract main content from article
   */
  static extractMainContent($) {
    // Try multiple selectors for main content (prioritized order)
    const contentSelectors = [
      // AWS documentation specific selectors (prioritized)
      '#main-content',
      '#main-col-body', 
      '.awsdocs-view',
      '#awsdocs-content',
      'article',
      '.entry-content',
      '.post-content',
      '.article-content',
      '[data-testid="article-body"]',
      '.article-body',
      'main',
      '.main-content',
      '.post-body',
      '.article-text',
      '#content',
      '.page-content',
      '.text-content',
      // GitHub documentation selectors
      '.markdown-body',
      '[data-target="readme-toc.content"]',
      // Documentation sites
      '.doc-content',
      '.documentation-content',
      '.guide-content',
      // Generic selector (moved to end to avoid feedback forms)
      '.content',
    ];

    functions.logger.info(`Trying ${contentSelectors.length} content selectors...`);

    for (let i = 0; i < contentSelectors.length; i++) {
      const selector = contentSelectors[i];
      const element = $(selector).first();
      
      if (element.length > 0) {
        functions.logger.info(`Found element with selector "${selector}"`);
        
        // Get text content and preserve some structure
        const content = element
          .find("p, h1, h2, h3, h4, h5, h6, li, div")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((text) => text.length > 10) // More lenient filter
          .join("\\n\\n");
        
        functions.logger.info(`Selector "${selector}" found ${content.length} characters, sample: "${content.substring(0, 300)}..."`);
        
        if (content && content.length > 50) { // Lower threshold
          return content;
        }
      } else {
        functions.logger.info(`No element found for selector "${selector}"`);
      }
    }

    functions.logger.info("Primary selectors failed, trying fallback strategies...");

    // Fallback 1: More aggressive paragraph extraction
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 10) // More lenient
      .join("\\n\\n");

    if (paragraphs && paragraphs.length > 50) {
      functions.logger.info(`Paragraph fallback found ${paragraphs.length} characters`);
      return paragraphs;
    }

    // Fallback 2: Try div elements with substantial text
    const divContent = $("div")
      .filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 100 && text.split(/\s+/).length > 20;
      })
      .first()
      .text()
      .trim();

    if (divContent) {
      functions.logger.info(`Div fallback found ${divContent.length} characters`);
      return divContent;
    }

    // Fallback 3: Extract all meaningful text from body
    const bodyText = $("body")
      .find("p, h1, h2, h3, h4, h5, h6, li")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 10)
      .join("\\n\\n");

    functions.logger.info(`Body text fallback found ${bodyText.length} characters`);
    return bodyText;
  }

  /**
   * Extract author information
   */
  static extractAuthor($) {
    const authorSelectors = [
      ".author",
      ".byline",
      "[rel='author']",
      ".article-author",
      "[data-testid='author']",
    ];

    for (const selector of authorSelectors) {
      const author = $(selector).first().text().trim();
      if (author && author.length > 0) {
        return author;
      }
    }

    return undefined;
  }

  /**
   * Extract publish date
   */
  static extractPublishDate($) {
    const dateSelectors = [
      "time[datetime]",
      ".publish-date",
      ".article-date",
      ".post-date",
      "[data-testid='publish-date']",
    ];

    for (const selector of dateSelectors) {
      const dateElement = $(selector).first();
      const date = dateElement.attr("datetime") || dateElement.text().trim();
      
      if (date) {
        // Try to parse and validate the date
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
    }

    return undefined;
  }

  /**
   * Clean up extracted content
   */
  static cleanContent(content) {
    return content
      .replace(/\\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\\n\\s*\\n/g, "\\n\\n") // Normalize paragraph breaks
      .replace(/^\\s+|\\s+$/g, "") // Trim whitespace
      .replace(/\\u00A0/g, " "); // Replace non-breaking spaces
  }

  /**
   * Extract title from URL as fallback
   */
  static extractTitleFromUrl(url) {
    try {
      const urlPath = new URL(url).pathname;
      const segments = urlPath.split("/").filter(segment => segment.length > 0);
      const lastSegment = segments[segments.length - 1];
      
      // Remove file extensions and convert to readable format
      return lastSegment
        .replace(/\\.[^.]*$/, "") // Remove file extension
        .replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
        .replace(/\\b\\w/g, char => char.toUpperCase()); // Title case
    } catch {
      return "Untitled";
    }
  }
}

// Main execution
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log("Usage: node test-scraper.js <url>");
    console.log("Example: node test-scraper.js \"https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html\"");
    process.exit(1);
  }

  try {
    console.log(`\\n🔍 Testing scraper with URL: ${url}\\n`);
    
    const result = await LocalWebScraperService.extractContent(url);
    
    console.log("\\n📊 SCRAPING RESULTS:");
    console.log("====================");
    console.log(`Title: ${result.title}`);
    console.log(`Author: ${result.author || 'Not found'}`);
    console.log(`Publish Date: ${result.publishDate || 'Not found'}`);
    console.log(`Word Count: ${result.wordCount}`);
    console.log(`Content Length: ${result.content.length} characters`);
    console.log("\\n📝 Content Preview (first 1000 characters):");
    console.log("=" .repeat(50));
    console.log(result.content.substring(0, 1000) + (result.content.length > 1000 ? '...' : ''));
    
    if (result.wordCount < 50) {
      console.log("\\n⚠️  WARNING: Content is short. This might not generate a good quiz.");
    } else {
      console.log("\\n✅ Content looks good for quiz generation!");
    }
    
  } catch (error) {
    console.error("\\n❌ Error:", error.message);
  }
}

main();