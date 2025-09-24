import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Enable stealth plugin لتجنب detection
puppeteer.use(StealthPlugin());

/**
 * Pinterest Scraper Service  
 * سحب مشاهد CGI احترافية من Pinterest
 */

export interface PinterestScene {
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

interface ScrapingOptions {
  maxResults?: number;
  minImageQuality?: 'low' | 'medium' | 'high';
  timeout?: number;
  retryCount?: number;
}

/**
 * User Agents للتبديل العشوائي
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
];

/**
 * Keywords للتأكد إن المشهد CGI
 */
const CGI_KEYWORDS = [
  'cgi', '3d', 'render', 'rendered', 'visualization', 'virtual', 'digital',
  'architectural visualization', 'interior design 3d', 'photorealistic',
  'computer generated', 'vray', 'blender', 'cinema 4d', 'modeling',
  'architectural render', '3d interior', 'interior rendering'
];

/**
 * Keywords مشبوهة (تجنبها)
 */
const NON_CGI_KEYWORDS = [
  'photo', 'photograph', 'real estate photo', 'actual', 'before and after',
  'diy', 'tutorial', 'inspiration only', 'real home', 'photographer'
];

/**
 * فلترة CGI ذكية
 */
function isCGIScene(title: string, description: string = ''): boolean {
  const text = `${title} ${description}`.toLowerCase();
  
  // تحقق من وجود كلمات CGI إيجابية
  const hasCGIKeywords = CGI_KEYWORDS.some(keyword => text.includes(keyword));
  
  // تحقق من عدم وجود كلمات سلبية
  const hasNonCGIKeywords = NON_CGI_KEYWORDS.some(keyword => text.includes(keyword));
  
  // إذا كان فيه كلمات CGI ومفيهوش كلمات سلبية
  return hasCGIKeywords && !hasNonCGIKeywords;
}

/**
 * تحديد فئة المشهد بناء على المحتوى
 */
function categorizeScene(title: string, description: string = ''): string {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes('living room') || text.includes('غرفة معيشة') || text.includes('salon')) {
    return 'living_room';
  }
  if (text.includes('bedroom') || text.includes('غرفة نوم') || text.includes('chambre')) {
    return 'bedroom';
  }
  if (text.includes('kitchen') || text.includes('مطبخ') || text.includes('cuisine')) {
    return 'kitchen';
  }
  if (text.includes('office') || text.includes('مكتب') || text.includes('bureau') || text.includes('workspace')) {
    return 'office';
  }
  if (text.includes('bathroom') || text.includes('حمام') || text.includes('salle de bain')) {
    return 'bathroom';
  }
  
  return 'general'; // فئة عامة
}

/**
 * استخراج keywords من النص
 */
function extractKeywords(title: string, description: string = ''): string[] {
  const text = `${title} ${description}`.toLowerCase();
  
  const commonKeywords = [
    'furniture', 'أثاث', 'modern', 'عصري', 'classic', 'كلاسيكي',
    'minimalist', 'مينيمال', 'luxury', 'فاخر', 'cozy', 'مريح',
    'lighting', 'إضاءة', 'interior', 'داخلي', 'design', 'تصميم',
    'wood', 'خشب', 'marble', 'رخام', 'glass', 'زجاج', 'metal', 'معدن'
  ];
  
  return commonKeywords.filter(keyword => text.includes(keyword));
}

/**
 * وقت انتظار عشوائي لمحاكاة السلوك البشري
 */
function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * سحب مشاهد من Pinterest بحسب الكلمات المفتاحية
 */
export async function scrapePinterestScenes(
  searchKeywords: string,
  options: ScrapingOptions = {}
): Promise<PinterestScene[]> {
  const {
    maxResults = 20,
    timeout = 60000,
    retryCount = 3
  } = options;

  console.log('🔍 Starting Pinterest scraping:', {
    searchKeywords,
    maxResults,
    timeout
  });

  let browser;
  let attempt = 0;
  
  while (attempt < retryCount) {
    try {
      attempt++;
      console.log(`📱 Launch attempt ${attempt}/${retryCount}`);

      // إعداد Puppeteer مع stealth
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        defaultViewport: {
          width: 1366,
          height: 768
        }
      });

      const page = await browser.newPage();
      
      // تعيين User Agent عشوائي
      const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      await page.setUserAgent(randomUserAgent);
      
      // تعيين headers إضافية لمحاكاة متصفح حقيقي
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });

      console.log('🌐 Navigating to Pinterest search...');
      
      // بناء URL البحث
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchKeywords)}`;
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2', 
        timeout 
      });

      // انتظار تحميل النتائج
      await randomDelay(2000, 4000);

      console.log('📊 Extracting Pinterest pins...');

      // استخراج البيانات من الصفحة
      const pinterestResults = await page.evaluate((maxRes) => {
        const pins = [];
        const pinElements = document.querySelectorAll('[data-test-id="pin"]');
        
        console.log(`Found ${pinElements.length} pin elements on page`);
        
        for (let i = 0; i < Math.min(pinElements.length, maxRes); i++) {
          const pinElement = pinElements[i];
          
          try {
            // استخراج الصورة
            const imgElement = pinElement.querySelector('img');
            const imageUrl = imgElement?.src || imgElement?.getAttribute('data-src') || '';
            
            // استخراج العنوان
            const titleElement = pinElement.querySelector('[data-test-id="pinrep-title"]') || 
                                 pinElement.querySelector('[title]');
            const title = titleElement?.textContent || titleElement?.getAttribute('title') || 'Untitled';
            
            // استخراج الرابط
            const linkElement = pinElement.querySelector('a[href*="/pin/"]');
            const pinterestUrl = linkElement ? `https://www.pinterest.com${linkElement.getAttribute('href')}` : '';
            
            // استخراج معلومات إضافية
            const userElement = pinElement.querySelector('[data-test-id="creator-profile-link"]');
            const userName = userElement?.textContent || '';
            
            if (imageUrl && title && pinterestUrl) {
              pins.push({
                title: title.trim(),
                imageUrl: imageUrl,
                pinterestUrl: pinterestUrl,
                userName: userName.trim(),
                description: '' // سنضيفه لاحقاً إذا أمكن
              });
            }
          } catch (error) {
            console.warn('Error extracting pin data:', error);
          }
        }
        
        return pins;
      }, maxResults);

      console.log(`📌 Extracted ${pinterestResults.length} pins from Pinterest`);

      // إغلاق المتصفح
      await browser.close();

      // معالجة النتائج وفلترة CGI
      const processedScenes: PinterestScene[] = [];

      for (const result of pinterestResults) {
        // فحص إذا كان المشهد CGI
        const isCGI = isCGIScene(result.title, result.description);
        
        if (isCGI) {
          const scene: PinterestScene = {
            id: `pinterest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: result.title,
            description: result.description || '',
            imageUrl: result.imageUrl,
            pinterestUrl: result.pinterestUrl,
            userName: result.userName,
            isCGI: true,
            category: categorizeScene(result.title, result.description),
            extractedKeywords: extractKeywords(result.title, result.description),
            scrapedAt: new Date()
          };
          
          processedScenes.push(scene);
        }
      }

      console.log('✅ Pinterest scraping completed:', {
        totalPinsFound: pinterestResults.length,
        cgiScenesFiltered: processedScenes.length,
        categories: Array.from(new Set(processedScenes.map(s => s.category)))
      });

      return processedScenes;

    } catch (error) {
      console.error(`❌ Pinterest scraping attempt ${attempt} failed:`, error);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('Warning: failed to close browser:', closeError);
        }
      }

      if (attempt >= retryCount) {
        throw new Error(`Pinterest scraping failed after ${retryCount} attempts: ${error}`);
      }

      // انتظار قبل إعادة المحاولة
      await randomDelay(5000, 10000);
    }
  }

  return []; // fallback
}

/**
 * بحث ذكي بناء على تحليل المنتج
 */
export async function searchPinterestForProduct(
  productType: string,
  productStyle: string = 'modern',
  productKeywords: string[] = [],
  options: ScrapingOptions = {}
): Promise<PinterestScene[]> {
  
  console.log('🎯 Smart Pinterest search for product:', {
    productType,
    productStyle,
    keywords: productKeywords.slice(0, 3)
  });

  // بناء استعلام البحث الذكي
  const searchTerms = [
    'CGI interior design',
    '3D rendered room',
    productType,
    productStyle,
    ...productKeywords.slice(0, 2), // أول كلمتين فقط
    'architectural visualization'
  ];

  const searchQuery = searchTerms.filter(Boolean).join(' ');
  
  console.log('🔍 Generated search query:', searchQuery);

  try {
    const results = await scrapePinterestScenes(searchQuery, options);
    
    // ترتيب النتائج حسب الصلة
    const sortedResults = results.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // نقاط للعنوان المطابق
      if (a.title.toLowerCase().includes(productType.toLowerCase())) scoreA += 10;
      if (b.title.toLowerCase().includes(productType.toLowerCase())) scoreB += 10;
      
      // نقاط للستايل
      if (a.title.toLowerCase().includes(productStyle.toLowerCase())) scoreA += 5;
      if (b.title.toLowerCase().includes(productStyle.toLowerCase())) scoreB += 5;
      
      // نقاط للكلمات المفتاحية
      productKeywords.forEach(keyword => {
        if (a.extractedKeywords.includes(keyword.toLowerCase())) scoreA += 3;
        if (b.extractedKeywords.includes(keyword.toLowerCase())) scoreB += 3;
      });
      
      return scoreB - scoreA;
    });

    console.log('📊 Pinterest search completed:', {
      query: searchQuery,
      totalResults: sortedResults.length,
      topCategories: Array.from(new Set(sortedResults.slice(0, 10).map(s => s.category)))
    });

    return sortedResults;

  } catch (error) {
    console.error('❌ Smart Pinterest search failed:', error);
    return [];
  }
}

/**
 * تنظيف وتحسين جودة الصور
 */
export function filterHighQualityScenes(scenes: PinterestScene[]): PinterestScene[] {
  return scenes.filter(scene => {
    // تصفية الصور عالية الدقة
    const imageUrl = scene.imageUrl;
    
    // تجنب الصور الصغيرة جداً
    if (imageUrl.includes('150x') || imageUrl.includes('236x')) return false;
    
    // تفضيل الصور عالية الدقة
    if (imageUrl.includes('736x') || imageUrl.includes('1080x') || imageUrl.includes('originals')) return true;
    
    // تجنب العناوين القصيرة جداً أو غير الواضحة
    if (scene.title.length < 10) return false;
    
    return true;
  });
}