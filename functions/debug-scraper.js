/**
 * Debug scraper test script - shows what each selector finds
 * Run with: node debug-scraper.js <url>
 */

const cheerio = require("cheerio");
const { JSDOM } = require("jsdom");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugScraper(url) {
  console.log(`\n🔍 Debugging scraper with URL: ${url}\n`);
  
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QuizBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const $ = cheerio.load(dom.window.document.documentElement.outerHTML);

    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .social-share").remove();

    // Test each selector and see what it finds
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
      // Generic selector (the problematic one)
      '.content',
    ];

    console.log("🔍 Testing each selector:\n");

    for (let i = 0; i < contentSelectors.length; i++) {
      const selector = contentSelectors[i];
      const element = $(selector).first();
      
      if (element.length > 0) {
        // Get text content
        const content = element
          .find("p, h1, h2, h3, h4, h5, h6, li, div")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((text) => text.length > 10)
          .join("\\n\\n");
        
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        
        console.log(`✅ ${i + 1}. "${selector}" - Found ${content.length} chars, ${wordCount} words`);
        console.log(`   Preview: "${content.substring(0, 150)}${content.length > 150 ? '...' : ''}"`);
        
        if (content.length > 100) {
          console.log(`   ⭐ This selector has substantial content!`);
        }
        console.log('');
        
        // If this is the first good match, this is what would be returned
        if (content && content.length > 50) {
          console.log(`🎯 WINNER: This selector would be chosen by the scraper!\n`);
          break;
        }
      } else {
        console.log(`❌ ${i + 1}. "${selector}" - No element found`);
      }
    }

    // Also test the direct AWS content elements to see what they contain
    console.log("\\n🔍 Testing specific AWS elements:\\n");
    
    const awsSelectors = [
      '#main-content',
      '#main-col-body',
      '.awsdocs-view',
      '#awsdocs-content',
      '#main-content p',
      '#main-col-body p', 
      '.awsdocs-view p'
    ];

    for (const selector of awsSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const textContent = element.text().trim();
        const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
        
        console.log(`✅ "${selector}" - Found ${textContent.length} chars, ${wordCount} words`);
        console.log(`   Preview: "${textContent.substring(0, 200)}${textContent.length > 200 ? '...' : ''}"`);
        console.log('');
      } else {
        console.log(`❌ "${selector}" - No element found`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Main execution
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log("Usage: node debug-scraper.js <url>");
    console.log("Example: node debug-scraper.js \"https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html\"");
    process.exit(1);
  }

  await debugScraper(url);
}

main();