/**
 * Pinterest Web Scraper Service - Direct Pinterest search integration
 * Uses Puppeteer to scrape Pinterest.com search results and provide real Pinterest images within the app
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export interface PinterestScrapedPin {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pinterestUrl: string;
  boardName?: string;
  userName?: string;
  isCGI: boolean;
  category: string;
  extractedKeywords: string[];
  scrapedAt: Date;
}

interface PinterestSearchOptions {
  maxResults?: number;
  timeout?: number;
}

/**
 * Pinterest Web Scraper - Direct Pinterest.com Search
 */
export async function searchPinterestDirectly(
  productType: string = 'أثاث',
  productStyle: string = 'modern', 
  keywords: string[] = [],
  options: PinterestSearchOptions = {}
): Promise<PinterestScrapedPin[]> {
  
  console.log('🎯 Pinterest web scraper search for product:', {
    productType,
    productStyle,
    keywords
  });

  const { maxResults = 24, timeout = 30000 } = options;
  
  try {
    // Create intelligent Pinterest search query
    let searchQuery: string;
    if (keywords.length > 0) {
      searchQuery = keywords[0]; // Use first keyword (usually from Gemini analysis)
    } else {
      // Build search from product type and style for Pinterest
      searchQuery = `${productType} ${productStyle} cgi`.trim();
    }
    
    console.log('🔍 Pinterest web search query:', searchQuery);

    // Launch browser with optimized settings for scraping
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set extra headers to look more like real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });
      
      // Navigate to Pinterest search with timeout
      const pinterestSearchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`;
      console.log('🌐 Navigating to Pinterest:', pinterestSearchUrl);
      
      await page.goto(pinterestSearchUrl, { 
        waitUntil: 'networkidle2',
        timeout: timeout 
      });

      // Wait for Pinterest content to load - try multiple selectors
      console.log('⏳ Waiting for Pinterest pins to load...');
      try {
        await page.waitForSelector('[data-test-id="pin"], [data-test-id="pinWrapper"], img[alt*="Pin"], .Yl-, .zI7, article', { 
          timeout: 15000 
        });
        console.log('✅ Pinterest pins found on page');
      } catch (error) {
        console.log('⚠️ Pinterest pins selector timeout, trying to extract anyway...');
      }

      // Scroll to load more pins
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const scrolls = 10; // Limit scrolls
          let scrollCount = 0;
          
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrollCount++;

            if(totalHeight >= scrollHeight || scrollCount >= scrolls){
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      console.log('🔍 Extracting Pinterest pins data...');

      // Extract Pinterest pins data
      const pinterestData = await page.evaluate((maxResults) => {
        const pins = [];
        
        // Multiple selectors for different Pinterest layouts and versions
        const pinSelectors = [
          '[data-test-id="pin"]',
          '[data-test-id="pinWrapper"]', 
          '[data-test-id="pin-story-pin-data-attributes"]',
          '.Yl-', // Pinterest CSS class
          '.zI7', // Pinterest CSS class
          'article',
          'div[role="button"] img',
          '.GrowthUnauthPinImage'
        ];
        
        let pinElements: Element[] = [];
        for (const selector of pinSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            pinElements = elements;
            console.log(`Found ${elements.length} pins using selector: ${selector}`);
            break;
          }
        }
        
        // If no specific pin containers, try to find images directly
        if (pinElements.length === 0) {
          console.log('No pin containers found, looking for images...');
          const images = Array.from(document.querySelectorAll('img[alt*="Pin"], img[src*="pinterest"], img[src*="pinimg"]'));
          pinElements = images.map(img => img.closest('div') || img.parentElement).filter(Boolean) as Element[];
          console.log(`Found ${pinElements.length} image-based pins`);
        }
        
        console.log(`Processing ${Math.min(pinElements.length, maxResults)} pins...`);
        
        for (let i = 0; i < Math.min(pinElements.length, maxResults); i++) {
          const pin = pinElements[i];
          
          try {
            // Extract image - try multiple approaches
            const img = pin.querySelector('img') || (pin as HTMLImageElement);
            if (!img) continue;
            
            let imageUrl = '';
            if (img instanceof HTMLImageElement) {
              imageUrl = img.src || img.dataset?.src || img.currentSrc || '';
            }
            
            // Skip if no valid image URL
            if (!imageUrl || !imageUrl.includes('http')) continue;
            
            // Extract title and description
            const title = img.alt || 
                         pin.querySelector('[data-test-id="pin-title"]')?.textContent || 
                         pin.querySelector('h1, h2, h3, h4, .title, .pin-title')?.textContent || 
                         `Pinterest CGI Scene ${i + 1}`;
            
            const description = pin.querySelector('[data-test-id="pin-description"]')?.textContent ||
                              pin.querySelector('.description, .pinDescription, .pin-description')?.textContent || 
                              pin.querySelector('p')?.textContent ||
                              `Professional CGI scene perfect for product visualization`;
            
            // Extract Pinterest URL
            const linkElement = pin.querySelector('a[href*="/pin/"]') || pin.querySelector('a');
            let pinterestUrl = '';
            if (linkElement instanceof HTMLAnchorElement) {
              pinterestUrl = linkElement.href;
            }
            if (!pinterestUrl) {
              pinterestUrl = `https://pinterest.com/pin/scraped-${Date.now()}-${i}`;
            }
            
            // Extract user info  
            const userElement = pin.querySelector('[data-test-id="pinner"]') || 
                               pin.querySelector('.user-name, .author, .pinner') ||
                               pin.querySelector('[class*="user"], [class*="author"]');
            const userName = userElement?.textContent?.trim() || 'Pinterest User';
            
            // Extract board info
            const boardElement = pin.querySelector('[data-test-id="board-name"]') ||
                                pin.querySelector('.board-name, .board');
            const boardName = boardElement?.textContent?.trim() || 'Pinterest Board';
            
            pins.push({
              id: `pinterest_scraped_${Date.now()}_${i}`,
              title: title.trim().substring(0, 200), // Limit length
              description: description.trim().substring(0, 500), // Limit length  
              imageUrl: imageUrl,
              pinterestUrl: pinterestUrl,
              userName: userName.substring(0, 100), // Limit length
              boardName: boardName.substring(0, 100) // Limit length
            });
            
          } catch (err) {
            console.log(`Error processing pin ${i}:`, err);
            continue;
          }
        }
        
        console.log(`Successfully extracted ${pins.length} pins`);
        return pins;
      }, maxResults);

      await browser.close();

      console.log('✅ Pinterest web scraping completed:', {
        query: searchQuery,
        totalResults: pinterestData.length,
        sampleTitles: pinterestData.slice(0, 3).map((p: any) => p.title)
      });

      // Convert Pinterest data to expected format
      const scenes: PinterestScrapedPin[] = pinterestData.map((pin: any, index: number) => ({
        id: pin.id,
        title: pin.title,
        description: pin.description,
        imageUrl: pin.imageUrl,
        pinterestUrl: pin.pinterestUrl,
        boardName: pin.boardName,
        userName: pin.userName,
        isCGI: true,
        category: getCategoryFromProductType(productType),
        extractedKeywords: extractKeywordsFromPinterest(pin.title, pin.description, keywords),
        scrapedAt: new Date()
      }));

      return scenes;
      
    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error) {
    console.error('❌ Pinterest web scraping failed:', error);
    console.log('🔄 Falling back to curated scenes');
    return await getFallbackScenes(productType, keywords, maxResults);
  }
}

/**
 * Fallback scenes when Pinterest scraping fails
 */
async function getFallbackScenes(productType: string, keywords: string[], maxResults: number): Promise<PinterestScrapedPin[]> {
  console.log('🔄 Using curated fallback CGI scenes');
  
  try {
    // Load default scenes as fallback
    const { getAllDefaultScenes } = await import('./default-scenes');
    const defaultScenes = await getAllDefaultScenes();
    
    // Convert default scenes to PinterestScrapedPin format
    const fallbackScenes: PinterestScrapedPin[] = defaultScenes.slice(0, maxResults).map((scene: any, index: number) => ({
      id: `fallback_cgi_${scene.id}`,
      title: `${scene.name} - CGI Scene`,
      description: `Professional CGI scene for ${productType} - ${scene.description}`,
      imageUrl: scene.imageUrl || '',
      pinterestUrl: '#',
      boardName: 'Curated CGI Scenes',
      userName: 'CGI Studio',
      isCGI: true,
      category: scene.category || getCategoryFromProductType(productType),
      extractedKeywords: [...keywords, 'cgi', '3d', 'professional', productType],
      scrapedAt: new Date()
    }));
    
    console.log('✅ Loaded', fallbackScenes.length, 'fallback CGI scenes');
    return fallbackScenes;
  } catch (error) {
    console.error('❌ Failed to load fallback scenes:', error);
    return [];
  }
}

/**
 * Extract keywords from Pinterest pin data
 */
function extractKeywordsFromPinterest(title?: string, description?: string, searchKeywords: string[] = []): string[] {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  const words = text.split(/\s+/).filter(word => word.length > 2);
  const relevantWords = words.filter(word => 
    word.includes('cgi') || 
    word.includes('3d') || 
    word.includes('render') || 
    word.includes('design') ||
    word.includes('mockup') ||
    searchKeywords.some(keyword => word.includes(keyword.toLowerCase()))
  );
  
  return [...searchKeywords, ...relevantWords.slice(0, 5)];
}

/**
 * Get category based on product type
 */
function getCategoryFromProductType(productType: string): string {
  const type = productType.toLowerCase();
  
  // Energy drinks and beverages
  if (type.includes('مشروب') || type.includes('طاقة') || type.includes('energy') || type.includes('drink') || type.includes('beverage')) {
    return 'commercial';
  }
  
  // Furniture and living room items
  if (type.includes('أريكة') || type.includes('sofa') || type.includes('معيشة') || type.includes('أثاث')) {
    return 'living_room';
  }
  if (type.includes('سرير') || type.includes('bed') || type.includes('نوم')) {
    return 'bedroom';
  }
  if (type.includes('مكتب') || type.includes('office') || type.includes('كرسي')) {
    return 'office';
  }
  
  // Lighting and electrical
  if (type.includes('إضاءة') || type.includes('ثريا') || type.includes('lighting') || type.includes('lamp')) {
    return 'dining_room'; // Chandeliers usually go in dining rooms
  }
  
  // Electronics and tech
  if (type.includes('إلكترونيات') || type.includes('electronics') || type.includes('هاتف') || type.includes('phone')) {
    return 'office';
  }
  
  return 'studio'; // Default to studio for generic products
}