/**
 * Pinterest API Service  
 * سحب مشاهد CGI احترافية من Pinterest باستخدام الـ API الرسمي
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
 * Pinterest API search for CGI interior scenes
 */
async function searchPinterestAPI(query: string, limit: number = 20): Promise<any[]> {
  const searchUrl = `${PINTEREST_API_BASE}/pins/search`;
  
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Pinterest API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      throw new Error(`Pinterest API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('✅ Pinterest API response:', {
      itemsCount: data.items?.length || 0,
      hasMore: !!data.bookmark
    });

    return data.items || [];
  } catch (error) {
    console.error('❌ Pinterest API request failed:', error);
    return [];
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

  console.log('🔍 Starting Pinterest API search:', {
    searchKeywords,
    maxResults
  });

  try {
    const pinterestResults = await searchPinterestAPI(searchKeywords, maxResults);

    console.log(`📌 Retrieved ${pinterestResults.length} pins from Pinterest API`);

    // معالجة النتائج وفلترة CGI
    const processedScenes: PinterestScene[] = [];

    for (const pin of pinterestResults) {
      try {
        const title = pin.title || '';
        const description = pin.description || '';
        
        // فحص إذا كان المشهد CGI
        const isCGI = isCGIScene(title, description);
        
        if (isCGI && pin.media?.images?.['600x']) {
          const scene: PinterestScene = {
            id: `pinterest_api_${pin.id}`,
            title: title,
            description: description,
            imageUrl: pin.media.images['600x'].url,
            pinterestUrl: `https://www.pinterest.com/pin/${pin.id}/`,
            userName: pin.creator?.username || '',
            isCGI: true,
            category: categorizeScene(title, description),
            extractedKeywords: extractKeywords(title, description),
            scrapedAt: new Date()
          };
          
          processedScenes.push(scene);
        }
      } catch (error) {
        console.warn('Error processing pin:', error);
      }
    }

    console.log('✅ Pinterest API search completed:', {
      totalPinsFound: pinterestResults.length,
      cgiScenesFiltered: processedScenes.length,
      categories: Array.from(new Set(processedScenes.map(s => s.category)))
    });

    return processedScenes;

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