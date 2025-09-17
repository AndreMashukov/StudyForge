import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import { ScrapedContent } from "../../../libs/shared-types/src";
import * as functions from "firebase-functions";

/**
 * Web scraping service for extracting article content from URLs
 */

export class WebScraperService {
  private static readonly USER_AGENT = "Mozilla/5.0 (compatible; QuizBot/1.0)";
  private static readonly TIMEOUT = 10000; // 10 seconds

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
    let title = this.extractTitle($);
    let content = this.extractMainContent($);
    let author = this.extractAuthor($);
    let publishDate = this.extractPublishDate($);

    // Clean up content
    content = this.cleanContent(content);
    
    // Calculate word count
    const wordCount = content.split(/\s+/).length;

    // Validate minimum content length
    if (wordCount < 50) {
      throw new Error("Extracted content is too short to generate a meaningful quiz");
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
  private static extractMainContent($: cheerio.CheerioAPI): string {
    // Try multiple selectors for main content
    const contentSelectors = [
      "article",
      ".entry-content",
      ".post-content",
      ".article-content",
      ".content",
      "[data-testid='article-body']",
      ".article-body",
      "main",
      ".main-content",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        // Get text content and preserve some structure
        const content = element
          .find("p, h1, h2, h3, h4, h5, h6, li")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((text) => text.length > 0)
          .join("\n\n");
        
        if (content && content.length > 100) {
          return content;
        }
      }
    }

    // Fallback: extract all paragraph text
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 20)
      .join("\n\n");

    return paragraphs;
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