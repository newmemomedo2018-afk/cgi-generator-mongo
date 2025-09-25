/**
 * Pinterest Real API Service - Connects to actual Pinterest API
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

interface SearchOptions {
  maxResults?: number;
  styleFilter?: string;
  categoryFilter?: string;
}

/**
 * Real Pinterest API Search Implementation
 */
export async function searchPinterestForProduct(
  productType: string = 'أثاث',
  productStyle: string = 'modern', 
  keywords: string[] = [],
  options: SearchOptions = {}
): Promise<PinterestScene[]> {
  
  console.log('🎯 Real Pinterest API search for product:', {
    productType,
    productStyle,
    keywords
  });

  const { maxResults = 24 } = options;
  const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('❌ No Pinterest access token found');
    return [];
  }

  try {
    // Create search query from keywords
    const searchQuery = keywords.length > 0 ? keywords.join(' ') : 'cgi 3d render';
    console.log('🔍 Pinterest search query:', searchQuery);

    // Pinterest API v5 search endpoint - public pins only (no secret permissions needed)
    const response = await fetch(`https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(searchQuery)}&limit=${Math.min(maxResults, 50)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pinterest API error:', response.status, response.statusText);
      console.error('❌ Pinterest API error response:', errorText);
      return getFallbackScenes(productType, keywords, maxResults);
    }

    const data = await response.json();
    console.log('✅ Pinterest API raw response:', JSON.stringify(data, null, 2));
    console.log('✅ Pinterest API response summary:', { totalResults: data.items?.length || 0 });

    if (!data.items || data.items.length === 0) {
      console.log('⚠️ No Pinterest results found, using fallback');
      return getFallbackScenes(productType, keywords, maxResults);
    }

    // Convert Pinterest API response to our format
    const scenes: PinterestScene[] = data.items.slice(0, maxResults).map((pin: any, index: number) => {
      return {
        id: `pinterest_real_${pin.id}`,
        title: pin.title || `${productType} CGI Scene`,
        description: pin.description || `Pinterest CGI scene for ${productType}`,
        imageUrl: pin.media?.images?.['600x']?.url || pin.media?.images?.original?.url || '',
        pinterestUrl: pin.link || `https://pinterest.com/pin/${pin.id}`,
        boardName: pin.board_name || 'CGI Scenes',
        userName: pin.pinner?.username || 'Pinterest User',
        isCGI: true,
        category: getCategoryFromProductType(productType),
        extractedKeywords: extractKeywordsFromPinterest(pin.title, pin.description, keywords),
        scrapedAt: new Date()
      };
    });

    console.log('📊 Real Pinterest search completed:', {
      query: searchQuery,
      totalResults: scenes.length,
      topCategories: Array.from(new Set(scenes.map(s => s.category)))
    });

    return scenes;

  } catch (error) {
    console.error('❌ Pinterest API request failed:', error);
    return getFallbackScenes(productType, keywords, maxResults);
  }
}

/**
 * Fallback scenes when Pinterest API fails
 */
function getFallbackScenes(productType: string, keywords: string[], maxResults: number): PinterestScene[] {
  console.log('🔄 Using fallback scenes due to Pinterest API unavailable');
  return [];
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
    searchKeywords.some(keyword => word.includes(keyword.toLowerCase()))
  );
  
  return [...searchKeywords, ...relevantWords.slice(0, 5)];
}

/**
 * Get category based on product type
 */
function getCategoryFromProductType(productType: string): string {
  const type = productType.toLowerCase();
  
  // Energy drinks and beverages - prioritize this check
  if (type.includes('مشروب') || type.includes('طاقة') || type.includes('energy') || type.includes('drink') || type.includes('beverage') || type.includes('sting')) {
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
  // Food and beverages -> kitchen setting
  if (type.includes('مشروب') || type.includes('drink') || type.includes('طاقة') || type.includes('energy') || 
      type.includes('عصير') || type.includes('ماء') || type.includes('coca') || type.includes('pepsi') || 
      type.includes('sting') || type.includes('coffee') || type.includes('tea') || type.includes('قهوة') ||
      type.includes('الطاقة')) { // Added for "مشروب الطاقة" variant
    return 'kitchen';
  }
  if (type.includes('طعام') || type.includes('food') || type.includes('أكل') || type.includes('وجبة')) {
    return 'dining_room';
  }
  // Lighting and electrical
  if (type.includes('إضاءة') || type.includes('ثريا') || type.includes('lighting') || type.includes('lamp')) {
    return 'dining_room'; // Chandeliers usually go in dining rooms
  }
  // Electronics and tech
  if (type.includes('إلكترونيات') || type.includes('electronics') || type.includes('هاتف') || type.includes('phone') || 
      type.includes('حاسوب') || type.includes('computer') || type.includes('تقنية')) {
    return 'office';
  }
  // Personal care and cosmetics
  if (type.includes('تجميل') || type.includes('cosmetics') || type.includes('عطر') || type.includes('perfume') || 
      type.includes('مكياج') || type.includes('makeup') || type.includes('شامبو')) {
    return 'bathroom';
  }
  // Clothing and fashion  
  if (type.includes('ملابس') || type.includes('clothing') || type.includes('أزياء') || type.includes('fashion') || 
      type.includes('حقيبة') || type.includes('bag') || type.includes('حذاء')) {
    return 'bedroom';
  }
  if (type.includes('مطبخ') || type.includes('kitchen')) {
    return 'kitchen';
  }
  if (type.includes('حمام') || type.includes('bathroom')) {
    return 'bathroom';
  }
  
  return 'studio'; // Default to studio for generic products
}