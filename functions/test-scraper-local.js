/**
 * Local scraper test script using built functions
 * Run with: node test-scraper-local.js <url>
 */

const path = require('path');

// Import the built scraper service
const { WebScraperService } = require('./lib/functions/src/services/scraper.js');

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log("Usage: node test-scraper-local.js <url>");
    console.log("Example: node test-scraper-local.js \"https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html\"");
    process.exit(1);
  }

  try {
    console.log(`\n🔍 Testing scraper with URL: ${url}\n`);
    
    const result = await WebScraperService.extractContent(url);
    
    console.log("\n📊 SCRAPING RESULTS:");
    console.log("====================");
    console.log(`Title: ${result.title}`);
    console.log(`Author: ${result.author || 'Not found'}`);
    console.log(`Publish Date: ${result.publishDate || 'Not found'}`);
    console.log(`Word Count: ${result.wordCount}`);
    console.log(`Content Length: ${result.content.length} characters`);
    console.log("\n📝 Content Preview (first 1000 characters):");
    console.log("=".repeat(50));
    console.log(result.content.substring(0, 1000) + (result.content.length > 1000 ? '...' : ''));
    
    if (result.wordCount < 50) {
      console.log("\n⚠️  WARNING: Content is short. This might not generate a good quiz.");
    } else {
      console.log("\n✅ Content looks good for quiz generation!");
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

main();