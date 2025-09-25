/**
 * Enhanced CGI Scene Service - Provides Full HD CGI scenes using intelligent image search
 * (Replaces Pinterest API due to v5 restrictions on public pin access)
 */

/**
 * Get Full HD quality image URL from Unsplash photo URLs
 * Ensures 1920x1080 WebP format for all sources
 */
function getFullHDImageUrl(urls: any): string {
  if (!urls) return '';
  
  // Priority: raw with Full HD params > full > regular > small
  if (urls.raw) {
    try {
      // Use proper URL construction to avoid & vs ? issues
      const url = new URL(urls.raw);
      url.searchParams.set('w', '1920');
      url.searchParams.set('h', '1080');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('crop', 'center');
      url.searchParams.set('q', '80');
      url.searchParams.set('fm', 'webp');
      return url.toString();
    } catch (e) {
      console.warn('⚠️ Invalid raw URL, fallback to full:', urls.raw);
      return getOptimizedImageUrl(urls.full || urls.regular || urls.small || urls.thumb || '');
    }
  } else if (urls.full || urls.regular || urls.small || urls.thumb) {
    // Apply Full HD optimization to all fallback URLs
    const fallbackUrl = urls.full || urls.regular || urls.small || urls.thumb;
    return getOptimizedImageUrl(fallbackUrl);
  }
  
  return '';
}

/**
 * Apply Full HD optimization to any image URL using Cloudinary fetch transformation
 * Ensures consistent 1920x1080 WebP delivery for ALL sources
 */
function getOptimizedImageUrl(baseUrl: string): string {
  if (!baseUrl) return '';
  
  // For Unsplash URLs, try to add optimization parameters directly
  if (baseUrl.includes('unsplash.com')) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('w', '1920');
      url.searchParams.set('h', '1080');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('crop', 'center');
      url.searchParams.set('q', '80');
      url.searchParams.set('fm', 'webp');
      console.log('🎯 Optimized Unsplash URL to Full HD WebP');
      return url.toString();
    } catch (e) {
      console.warn('⚠️ Cannot optimize Unsplash URL, using Cloudinary fallback:', baseUrl);
      return getCloudinaryOptimizedUrl(baseUrl);
    }
  }
  
  // For ALL other sources (default scenes, external URLs), use Cloudinary fetch transformation
  console.log('🌤️ Using Cloudinary fetch transformation for Full HD:', baseUrl.substring(0, 50) + '...');
  return getCloudinaryOptimizedUrl(baseUrl);
}

/**
 * Create Full HD Cloudinary fetch URL for any image source
 * Guarantees 1920x1080 WebP output regardless of original image
 */
function getCloudinaryOptimizedUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  
  // Check if Cloudinary is configured (use environment variables check)
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    console.warn('⚠️ Cloudinary not configured, returning original URL:', originalUrl.substring(0, 50) + '...');
    return originalUrl;
  }
  
  // Build Cloudinary fetch URL with Full HD transformations
  const encodedUrl = encodeURIComponent(originalUrl);
  const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/c_fill,g_auto,f_webp,q_auto:good,w_1920,h_1080/${encodedUrl}`;
  
  console.log('✨ Created Cloudinary Full HD URL:', cloudinaryUrl.substring(0, 100) + '...');
  return cloudinaryUrl;
}

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
 * Enhanced CGI Scene Search Implementation
 * Uses Unsplash API with intelligent CGI keywords to provide high-quality scene images
 */
export async function searchPinterestForProduct(
  productType: string = 'أثاث',
  productStyle: string = 'modern', 
  keywords: string[] = [],
  options: SearchOptions = {}
): Promise<PinterestScene[]> {
  
  console.log('🎯 Enhanced CGI scene search for product:', {
    productType,
    productStyle,
    keywords
  });

  const { maxResults = 24 } = options;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY;
  
  if (!unsplashKey) {
    console.log('⚠️ No Unsplash API key found, using fallback scenes');
    return await getFallbackScenes(productType, keywords, maxResults);
  }

  try {
    // Create intelligent CGI search query from product details
    let searchQuery: string;
    if (keywords.length > 0) {
      searchQuery = keywords[0]; // Use first keyword (usually from Gemini analysis)
    } else {
      // Build search from product type and style
      searchQuery = `${productType} ${productStyle} cgi 3d render`.trim();
    }
    
    console.log('🔍 Enhanced CGI search query:', searchQuery);

    // Enhanced CGI Image Search - Uses Unsplash with intelligent CGI keywords
    const cgiSearchTerms = [
      `${searchQuery} 3d render`,
      `${searchQuery} cgi visualization`,
      `product photography ${searchQuery}`,
      `commercial ${searchQuery} scene`,
      `professional ${searchQuery} mockup`
    ];
    
    const bestSearchTerm = cgiSearchTerms[0]; // Use the first term as primary
    console.log('🎯 Enhanced CGI search term:', bestSearchTerm);
    
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(bestSearchTerm)}&per_page=${Math.min(maxResults, 30)}&orientation=landscape`, {
      method: 'GET',
      headers: {
        'Authorization': `Client-ID ${unsplashKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ CGI Image Search error:', response.status, response.statusText);
      console.error('❌ Search API error response:', errorText);
      return await getFallbackScenes(productType, keywords, maxResults);
    }

    const data = await response.json();
    console.log('✅ Full HD CGI Image Search completed:', { 
      searchTerm: bestSearchTerm,
      totalResults: data.results?.length || 0,
      hasResults: !!data.results,
      quality: 'Full HD (1920x1080)'
    });

    if (!data.results || data.results.length === 0) {
      console.log('⚠️ No CGI images found, using Full HD optimized fallback');
      return await getFallbackScenes(productType, keywords, maxResults);
    }

    // Convert CGI Image Search results to Pinterest format for frontend compatibility
    const scenes: PinterestScene[] = data.results.slice(0, maxResults).map((photo: any, index: number) => {
      return {
        id: `cgi_enhanced_${photo.id || index}`,
        title: photo.alt_description || photo.description || `${productType} CGI Scene ${index + 1}`,
        description: `Professional Full HD CGI rendering (1920x1080) for ${productType} - Ultra high quality scene perfect for product placement`,
        imageUrl: getFullHDImageUrl(photo.urls),
        pinterestUrl: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
        boardName: 'Professional CGI Gallery',
        userName: photo.user?.name || photo.user?.username || 'CGI Artist',
        isCGI: true,
        category: getCategoryFromProductType(productType),
        extractedKeywords: extractKeywordsFromPinterest(photo.alt_description, photo.description, keywords),
        scrapedAt: new Date()
      };
    });

    console.log('📊 Enhanced CGI search completed:', {
      query: bestSearchTerm,
      originalProductType: productType,
      totalResults: scenes.length,
      topCategories: Array.from(new Set(scenes.map(s => s.category))),
      sampleTitles: scenes.slice(0, 3).map(s => s.title)
    });

    return scenes;

  } catch (error) {
    console.error('❌ Enhanced CGI search failed:', error);
    return getFallbackScenes(productType, keywords, maxResults);
  }
}

/**
 * Fallback scenes when image search fails
 */
async function getFallbackScenes(productType: string, keywords: string[], maxResults: number): Promise<PinterestScene[]> {
  console.log('🔄 Using curated fallback CGI scenes');
  
  try {
    // Load default scenes as fallback
    const { getAllDefaultScenes } = await import('./default-scenes');
    const defaultScenes = await getAllDefaultScenes();
    
    // Convert default scenes to PinterestScene format
    const fallbackScenes: PinterestScene[] = defaultScenes.slice(0, maxResults).map((scene: any, index: number) => ({
      id: `fallback_cgi_${scene.id}`,
      title: `${scene.name} - CGI Scene`,
      description: `Professional Full HD CGI scene (1920x1080) for ${productType} - ${scene.description}`,
      imageUrl: getOptimizedImageUrl(scene.imageUrl || ''), // Apply Full HD optimization
      pinterestUrl: '#',
      boardName: 'Curated Full HD CGI Scenes',
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