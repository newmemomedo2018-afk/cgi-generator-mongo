/**
 * Pinterest Web Scraper Service  
 * سحب مشاهد CGI احترافية من Pinterest باستخدام Web Scraping مع Puppeteer
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// إعداد puppeteer مع stealth plugin
puppeteer.use(StealthPlugin());

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

// Pinterest API Configuration
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || 'pina_AMA7UXYXACN34BAAGDADMDTN55CHVGIBQBIQCDFP7J7EONGFEWTPNQS2CGFLUX5XXVGOIIGKOH5RYUHSUKSV475QRXTFF7IA';
const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

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
 * Pinterest Web Scraping للحصول على CGI scenes
 */
async function scrapePinterestWeb(query: string, limit: number = 20): Promise<any[]> {
  console.log('🕷️ Starting Pinterest web scraping:', { query, limit });

  let browser = null;
  try {
    // تشغيل المتصفح مع إعدادات مخفية
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    const page = await browser.newPage();
    
    // إعداد viewport وheaders
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // URL البحث في Pinterest
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
    console.log('🔍 Scraping Pinterest URL:', searchUrl);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // انتظار تحميل النتائج
    await page.waitForSelector('[data-test-id="pin"]', { timeout: 15000 });
    
    // استخراج بيانات الـ pins
    const pins = await page.evaluate((maxPins) => {
      const pinElements = document.querySelectorAll('[data-test-id="pin"]');
      const results = [];
      
      for (let i = 0; i < Math.min(pinElements.length, maxPins); i++) {
        const pin = pinElements[i];
        
        try {
          // استخراج الصورة
          const imgElement = pin.querySelector('img');
          const imageUrl = imgElement?.src || imgElement?.getAttribute('data-src') || '';
          
          // استخراج العنوان
          const titleElement = pin.querySelector('[data-test-id="pinTitle"]') || 
                                pin.querySelector('[data-test-id="pin-closeup-title"]') ||
                                pin.querySelector('h1') ||
                                pin.querySelector('.pinTitle');
          const title = titleElement?.textContent?.trim() || `CGI Scene ${i + 1}`;
          
          // استخراج الوصف
          const descElement = pin.querySelector('[data-test-id="pin-closeup-description"]') ||
                              pin.querySelector('.pinDescription') ||
                              pin.querySelector('[data-test-id="pinDescription"]');
          const description = descElement?.textContent?.trim() || '';
          
          // استخراج الرابط
          const linkElement = pin.querySelector('a[href*="/pin/"]');
          const pinterestUrl = linkElement ? `https://pinterest.com${linkElement.getAttribute('href')}` : '';
          
          // فلترة الصور عالية الجودة
          if (imageUrl && !imageUrl.includes('236x') && title.length > 5) {
            results.push({
              id: `scrapped_${Date.now()}_${i}`,
              title: title,
              description: description,
              imageUrl: imageUrl.replace('236x', '736x').replace('474x', '736x'), // تحسين جودة الصورة
              pinterestUrl: pinterestUrl,
              boardName: 'Pinterest Search',
              userName: 'pinterest_user',
              isCGI: true, // سيتم فلترتها لاحقاً
              category: 'unknown',
              extractedKeywords: [],
              scrapedAt: new Date()
            });
          }
        } catch (error) {
          console.log('Error extracting pin data:', error);
        }
      }
      
      return results;
    }, limit);
    
    console.log(`📌 Scraped ${pins.length} pins from Pinterest`);
    
    // فلترة النتائج للـ CGI فقط
    const cgiPins = pins.filter(pin => {
      const text = `${pin.title} ${pin.description}`.toLowerCase();
      return CGI_KEYWORDS.some(keyword => text.includes(keyword));
    });
    
    // تصنيف المشاهد
    const categorizedPins = cgiPins.map(pin => ({
      ...pin,
      category: categorizeScene(pin.title, pin.description),
      extractedKeywords: extractKeywords(pin.title, pin.description)
    }));
    
    console.log(`✅ Pinterest scraping completed: ${categorizedPins.length} CGI scenes found`);
    
    return categorizedPins;
    
  } catch (error) {
    console.error('❌ Pinterest scraping failed:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Pinterest API search for CGI interior scenes (DEPRECATED - using scraper instead)
 */
async function searchPinterestAPI(query: string, limit: number = 20): Promise<any[]> {
  const searchUrl = `${PINTEREST_API_BASE}/search/pins`;
  
  // ⚠️ WARNING: Pinterest API v5 has limitations - only works with user's own content
  console.warn('⚠️  Pinterest API v5 Limitation: Search only works on user\'s own pins/boards');
  
  const params = new URLSearchParams({
    query: query + ' CGI interior design 3D rendering',
    limit: limit.toString(),
    fields: 'id,title,description,link,media,board,creator'
  });

  console.log('🔍 Pinterest API search:', {
    url: `${searchUrl}?${params}`,
    query: query
  });

  try {
    const response = await fetch(`${searchUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PINTEREST_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CGI-Generator/1.0'
      }
    });

    // طباعة الـ raw response أولاً قبل أي معالجة
    const rawResponseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ Pinterest API error:', {
        status: response.status,
        statusText: response.statusText,
        headers: {
          contentType: response.headers.get('content-type'),
          rateLimit: response.headers.get('x-ratelimit-remaining')
        },
        rawResponse: rawResponseText
      });
      throw new Error(`Pinterest API error: ${response.status} - ${rawResponseText}`);
    }

    // طباعة الـ JSON الفعلي من Pinterest API
    console.log('📥 ACTUAL Pinterest API JSON Response:');
    console.log('=' .repeat(80));
    console.log(rawResponseText);
    console.log('=' .repeat(80));
    
    // محاولة parse الـ JSON
    let data;
    try {
      data = JSON.parse(rawResponseText);
      console.log('✅ Pinterest API parsed successfully:', {
        itemsCount: data.items?.length || 0,
        hasMore: !!data.bookmark,
        structure: Object.keys(data)
      });
    } catch (parseError) {
      console.error('❌ Failed to parse Pinterest JSON:', parseError);
      throw new Error('Invalid JSON from Pinterest API');
    }

    return data.items || [];
  } catch (error) {
    console.error('❌ Pinterest API request failed:', error);
    
    // تطوير - إرجاع mock data للاختبار
    console.log('🔧 Falling back to mock Pinterest data for development...');
    return [
      {
        id: 'mock_pin_1',
        title: 'Modern CGI Living Room Chandelier Visualization',
        description: '3D rendered interior with contemporary chandelier design',
        imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        pinterestUrl: 'https://pinterest.com/pin/mock1',
        boardName: 'CGI Interior Design',
        userName: 'cgi_designer',
        isCGI: true,
        category: 'living_room',
        extractedKeywords: ['cgi', '3d', 'chandelier', 'modern', 'interior'],
        scrapedAt: new Date()
      },
      {
        id: 'mock_pin_2', 
        title: 'Photorealistic Bedroom 3D Render',
        description: 'Architectural visualization of modern bedroom lighting',
        imageUrl: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        pinterestUrl: 'https://pinterest.com/pin/mock2',
        boardName: '3D Architecture', 
        userName: 'render_studio',
        isCGI: true,
        category: 'bedroom',
        extractedKeywords: ['3d', 'render', 'bedroom', 'lighting'],
        scrapedAt: new Date()
      },
      {
        id: 'mock_pin_3',
        title: 'CGI Kitchen Design with Modern Lighting',  
        description: 'Computer generated kitchen interior with LED fixtures',
        imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        pinterestUrl: 'https://pinterest.com/pin/mock3',
        boardName: 'CGI Kitchens',
        userName: 'interior_3d',
        isCGI: true, 
        category: 'kitchen',
        extractedKeywords: ['cgi', 'kitchen', 'modern', 'led'],
        scrapedAt: new Date()
      }
    ];
  }
}

/**
 * سحب مشاهد من Pinterest باستخدام الـ API الرسمي
 */
export async function scrapePinterestScenes(
  searchKeywords: string,
  options: ScrapingOptions = {}
): Promise<PinterestScene[]> {
  const {
    maxResults = 20
  } = options;

  console.log('🕷️ Starting Pinterest web scraping:', {
    searchKeywords,
    maxResults
  });

  try {
    const pinterestResults = await scrapePinterestWeb(searchKeywords, maxResults);

    console.log(`🕷️ Scraped ${pinterestResults.length} pins from Pinterest web`);

    // النتائج جاهزة من الـ scraper - لا نحتاج معالجة إضافية
    console.log('✅ Pinterest web scraping completed:', {
      totalPinsFound: pinterestResults.length,
      cgiScenesFiltered: pinterestResults.length, // كلها CGI لأنها مفلترة
      categories: Array.from(new Set(pinterestResults.map(s => s.category)))
    });

    return pinterestResults;

  } catch (error) {
    console.error('❌ Pinterest API search failed:', error);
    return [];
  }
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