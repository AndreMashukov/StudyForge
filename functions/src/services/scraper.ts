import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { ScrapedContent } from "@shared-types";
import * as functions from "firebase-functions";
import { GeminiService } from "./gemini/gemini";
import { promptBuilder } from "./promptBuilder";

/**
 * Web scraping service for extracting article content from URLs
 */

export class WebScraperService {
  private static readonly USER_AGENT = "Mozilla/5.0 (compatible; QuizBot/1.0)";
  private static readonly TIMEOUT = 10000; // 10 seconds

  /**
   * Extract and convert content to clean markdown format
   * @param url - The URL to scrape
   * @param ruleIds - Optional rule IDs to inject into markdown conversion prompt
   * @param userId - User ID for rule resolution
   * @returns ScrapedContent with clean markdown formatting
   */
  public static async extractContentAsMarkdown(
    url: string, 
    ruleIds?: string[], 
    userId?: string
  ): Promise<ScrapedContent & { markdownContent: string }> {
    try {
      functions.logger.info(`Scraping URL for markdown conversion: ${url}`, {
        withRules: !!(ruleIds && ruleIds.length > 0),
        ruleCount: ruleIds?.length || 0,
      });

      // First extract raw content using existing method
      const rawContent = await this.extractContent(url);

      functions.logger.info(`Raw content extracted, converting to markdown...`);

      // Use Gemini to convert and clean the content to proper markdown
      const markdownContent = await this.convertToMarkdown(rawContent, ruleIds, userId);

      return {
        ...rawContent,
        markdownContent,
      };

    } catch (error) {
      functions.logger.error(`Error extracting content as markdown from ${url}:`, error);
      throw new Error(`Failed to extract markdown content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert scraped content to clean, well-structured markdown
   * @param content - The raw scraped content
   * @param ruleIds - Optional rule IDs to inject into conversion prompt
   * @param userId - User ID for rule resolution
   * @returns Clean markdown content
   */
  private static async convertToMarkdown(
    content: ScrapedContent, 
    ruleIds?: string[], 
    userId?: string
  ): Promise<string> {
    try {
      const basePrompt = `Please convert the following scraped web content into clean, well-structured markdown format. Follow these guidelines:

1. Create a proper title using # heading
2. Add the author and publication date if available
3. Structure the content with appropriate headings (##, ###, etc.)
4. Clean up any formatting artifacts or duplicate content
5. Ensure paragraphs are properly separated
6. Remove any navigation text, advertisements, or irrelevant content
7. Keep the core informational content intact
8. Add appropriate line breaks for readability
9. If there are lists, format them properly with - or numbered lists
10. Ensure the markdown is clean and follows standard conventions

Original Content:
Title: ${content.title}
Author: ${content.author || 'Unknown'}
Publish Date: ${content.publishDate || 'Unknown'}
Word Count: ${content.wordCount}

Content:
${content.content}

Please return only the clean markdown content, starting with the title heading:`;

      // Inject rules if provided
      let finalPrompt = basePrompt;
      if (userId && ruleIds && ruleIds.length > 0) {
        functions.logger.info('Injecting rules into scraping prompt', { ruleCount: ruleIds.length });
        finalPrompt = await promptBuilder.injectRules(basePrompt, ruleIds, userId);
      }

      const response = await GeminiService.generateContent(finalPrompt);
      
      if (!response || response.trim().length === 0) {
        throw new Error('Gemini returned empty response for markdown conversion');
      }

      functions.logger.info(`Markdown conversion completed, length: ${response.length} characters`);
      return response.trim();

    } catch (error) {
      functions.logger.error('Failed to convert content to markdown:', error);
      
      // Fallback: Create basic markdown manually if Gemini fails
      functions.logger.info('Using fallback markdown conversion...');
      return this.createFallbackMarkdown(content);
    }
  }

  /**
   * Create basic markdown as fallback if Gemini conversion fails
   * @param content - The raw scraped content
   * @returns Basic markdown content
   */
  private static createFallbackMarkdown(content: ScrapedContent): string {
    functions.logger.info('Creating fallback markdown structure');
    
    let markdown = `# ${content.title}\n\n`;

    // Add metadata section
    const metadata: string[] = [];
    if (content.author) {
      metadata.push(`**Author:** ${content.author}`);
    }
    if (content.publishDate) {
      metadata.push(`**Published:** ${content.publishDate}`);
    }
    metadata.push(`**Word Count:** ${content.wordCount}`);

    if (metadata.length > 0) {
      markdown += metadata.join('  \n') + '\n\n---\n\n';
    }

    // Convert content to structured markdown with better paragraph detection
    const lines = content.content.split('\n').map(line => line.trim());
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines between paragraphs
      if (line.length === 0) {
        if (currentParagraph.length > 0) {
          markdown += this.formatParagraph(currentParagraph) + '\n\n';
          currentParagraph = '';
        }
        continue;
      }
      
      // Detect potential headings (short lines with title case, no ending punctuation)
      const isHeading = line.length < 100 && 
                       line.match(/^[A-Z]/) && 
                       !line.match(/[.!?]$/) &&
                       line.split(' ').length <= 10;
      
      if (isHeading && currentParagraph.length === 0) {
        markdown += `## ${line}\n\n`;
      } else {
        // Accumulate text into paragraphs
        currentParagraph += (currentParagraph.length > 0 ? ' ' : '') + line;
      }
    }
    
    // Add any remaining paragraph
    if (currentParagraph.length > 0) {
      markdown += this.formatParagraph(currentParagraph) + '\n\n';
    }

    functions.logger.info('Fallback markdown created', { 
      length: markdown.length,
      paragraphCount: (markdown.match(/\n\n/g) || []).length 
    });
    
    return markdown;
  }

  /**
   * Format a paragraph with basic markdown enhancements
   * @param paragraph - Raw paragraph text
   * @returns Formatted paragraph
   */
  private static formatParagraph(paragraph: string): string {
    // Detect and format lists
    if (paragraph.match(/^\d+\.\s/)) {
      // Numbered list
      return paragraph;
    }
    if (paragraph.match(/^[-•]\s/)) {
      // Bullet list
      return paragraph.replace(/^[-•]\s/, '- ');
    }
    
    // Regular paragraph - ensure proper spacing
    return paragraph.trim();
  }

  /**
   * Extract content from a URL
   */
  public static async extractContent(url: string): Promise<ScrapedContent> {
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
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout: URL took too long to respond (>${this.TIMEOUT}ms)`);
        }
        if (error.message.includes('HTTP error!')) {
          throw new Error(`HTTP error accessing URL: ${error.message}`);
        }
        if (error.message.includes('too short')) {
          throw new Error(`Content extraction failed: ${error.message}. The webpage may not contain readable article content.`);
        }
      }
      
      throw new Error(`Failed to scrape content from URL: ${error}`);
    }
  }

  /**
   * Extract content from HTML using Cheerio
   */
  private static extractContentFromHtml($: cheerio.CheerioAPI, url: string): ScrapedContent {
    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .social-share").remove();

    // Try different strategies to extract the main content
    const title = this.extractTitle($);
    let content = this.extractMainContent($);
    const author = this.extractAuthor($);
    const publishDate = this.extractPublishDate($);

    functions.logger.info(`Raw extracted content length: ${content.length} characters`);
    functions.logger.info(`Content preview: ${content.substring(0, 200)}...`);

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
  private static extractTitle($: cheerio.CheerioAPI): string {
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
  private static extractMainContent($: CheerioAPI): string {
    // Try multiple selectors for main content (AWS selectors prioritized first)
    const contentSelectors = [
      // AWS documentation specific selectors (highest priority)
      '#main-content',
      '#main-col-body',
      '.awsdocs-view',
      '#awsdocs-content',
      // Common article selectors
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
      // Generic content selector (moved to end to avoid feedback forms)
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
          .join("\n\n");
        
        functions.logger.info(`Selector "${selector}" found ${content.length} characters, sample: "${content.substring(0, 200)}..."`);
        
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
      .join("\n\n");

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
      .join("\n\n");

    functions.logger.info(`Body text fallback found ${bodyText.length} characters`);
    return bodyText;
  }

  /**
   * Extract author information
   */
  private static extractAuthor($: cheerio.CheerioAPI): string | undefined {
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
  private static extractPublishDate($: cheerio.CheerioAPI): string | undefined {
    const dateSelectors = [
      "time[datetime]",
      ".publish-date",
      ".article-date",
      "[data-testid='publish-date']",
    ];

    for (const selector of dateSelectors) {
      const element = $(selector).first();
      const datetime = element.attr("datetime") || element.text().trim();
      if (datetime) {
        return datetime;
      }
    }

    return undefined;
  }

  /**
   * Clean and normalize content text
   */
  private static cleanContent(content: string): string {
    return content
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, "\n\n") // Normalize paragraph breaks
      .trim();
  }

  /**
   * Extract title from URL as fallback
   */
  private static extractTitleFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const segments = pathname.split("/").filter((segment) => segment.length > 0);
      const lastSegment = segments[segments.length - 1] || "";
      
      return lastSegment
        .replace(/[-_]/g, " ")
        .replace(/\.(html|htm|php|asp|aspx)$/i, "")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    } catch {
      return "Untitled Article";
    }
  }

  /**
   * Validate if URL is scrapeable
   */
  public static isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ["http:", "https:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }
}