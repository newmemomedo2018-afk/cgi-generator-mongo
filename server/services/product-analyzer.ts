import { GoogleGenerativeAI } from '@google/generative-ai';
import { URL } from 'url';

/**
 * Product Analyzer Service
 * تحليل صور المنتجات باستخدام Gemini لاقتراح المشاهد المناسبة
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ProductAnalysis {
  productType: string;
  productStyle: string;
  productKeywords: string[];
  suggestedCategories: string[];
  pinterestSearchTerms: string[];
  confidence: number;
}

/**
 * فلترة أمان URL لمنع SSRF attacks
 */
function isUrlSafe(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Block internal/private networks
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Block localhost variants
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      return false;
    }
    
    // Block private IP ranges
    if (hostname.match(/^10\./) || hostname.match(/^192\.168\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return false;
    }
    
    // Block metadata services
    if (hostname.includes('169.254.') || hostname.includes('metadata')) {
      return false;
    }
    
    // Block other internal services
    if (hostname.includes('.local') || hostname.startsWith('internal')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * تحليل صورة المنتج لاستخراج معلومات مفيدة للبحث
 */
export async function analyzeProductForScenes(imageUrl: string): Promise<ProductAnalysis> {
  try {
    // أمان URL validation
    if (!imageUrl || !isUrlSafe(imageUrl)) {
      throw new Error('Invalid or unsafe image URL provided');
    }
    
    console.log('🔍 Analyzing product image for scene suggestions:', {
      imageUrl: imageUrl.substring(0, 50) + '...'
    });

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    // تحميل الصورة مع timeout وsize limits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const imageResponse = await fetch(imageUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'CGI-Generator-Bot/1.0',
      }
    });
    clearTimeout(timeoutId);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    // Check content type
    const contentType = imageResponse.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('URL does not point to a valid image');
    }
    
    // Check content length (max 10MB)
    const contentLength = imageResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      throw new Error('Image too large (max 10MB)');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Additional size check after download
    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      throw new Error('Image too large (max 10MB)');
    }
    const imageData = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString('base64'),
        mimeType: imageResponse.headers.get('content-type') || 'image/jpeg'
      }
    };

    const prompt = `
🔍 PRODUCT ANALYSIS FOR SCENE SELECTION

Analyze this product image and extract key information for CGI scene placement:

EXTRACT THE FOLLOWING IN JSON FORMAT:
{
  "productType": "string (e.g., أريكة، مكتب، طاولة، إضاءة، ديكور)",
  "productStyle": "string (modern, classic, minimalist, luxury, cozy, industrial)",
  "productKeywords": ["array of 5-7 relevant keywords in Arabic/English"],
  "suggestedCategories": ["array of suitable room categories: living_room, bedroom, kitchen, office, bathroom"],
  "pinterestSearchTerms": ["array of exactly 2 English search terms - ALWAYS combine product type + 'cgi' (example: 'energy drink cgi' NOT 'cgi', 'energy drink')"],
  "confidence": "number 0-100 (how confident are you in this analysis)"
}

ANALYSIS RULES:
1. Product Type: Be specific (not just "furniture" but "أريكة" or "مكتب")
2. Style: Choose ONE primary style that best matches the design
3. Keywords: Mix Arabic and English, focus on visual characteristics
4. Categories: List ALL suitable room types where this product could be placed
5. Pinterest Terms: IMPORTANT - Create exactly 2 English search terms where EACH term combines product + "cgi" as ONE phrase (e.g., "energy drink cgi", "modern furniture cgi") - NEVER separate them!
6. Confidence: Lower if image is unclear or product is ambiguous

EXAMPLES:
- Modern office chair → keywords: ["مكتب", "كرسي", "modern", "أثاث", "احترافي"] → pinterestSearchTerms: ["office chair cgi", "modern furniture cgi"]
- Classic wooden table → keywords: ["طاولة", "خشب", "كلاسيك", "أثاث", "تقليدي"] → pinterestSearchTerms: ["wooden table cgi", "classic furniture cgi"]
- LED ceiling lamp → keywords: ["إضاءة", "سقف", "LED", "مودرن", "أنيق"] → pinterestSearchTerms: ["ceiling lamp cgi", "LED lighting cgi"]
- Energy drink bottle → keywords: ["مشروب", "طاقة", "Sting", "energy drink", "red", "bottle"] → pinterestSearchTerms: ["energy drink cgi", "beverage bottle cgi"]

WRONG EXAMPLE: ["cgi", "energy drink"] ❌ 
CORRECT EXAMPLE: ["energy drink cgi", "beverage bottle cgi"] ✅

Focus on visual characteristics, materials, and likely usage contexts.
Return ONLY valid JSON, no additional text.
`;

    const result = await model.generateContent([prompt, imageData]);
    const response = await result.response;
    const analysisText = response.text();

    console.log('🤖 Gemini analysis response:', {
      length: analysisText.length,
      preview: analysisText.substring(0, 100)
    });

    // استخراج JSON من الاستجابة
    let analysisJson;
    try {
      // البحث عن JSON في الاستجابة
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisJson = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', parseError);
      console.error('Raw response:', analysisText);
      
      // fallback analysis
      return {
        productType: 'أثاث',
        productStyle: 'modern',
        productKeywords: ['أثاث', 'تصميم', 'منزل'],
        suggestedCategories: ['living_room', 'bedroom'],
        pinterestSearchTerms: ['furniture cgi', 'modern design cgi'],
        confidence: 30
      };
    }

    // التحقق من صحة البيانات
    const analysis: ProductAnalysis = {
      productType: analysisJson.productType || 'أثاث',
      productStyle: analysisJson.productStyle || 'modern', 
      productKeywords: Array.isArray(analysisJson.productKeywords) ? analysisJson.productKeywords : ['أثاث'],
      suggestedCategories: Array.isArray(analysisJson.suggestedCategories) ? analysisJson.suggestedCategories : ['living_room'],
      pinterestSearchTerms: Array.isArray(analysisJson.pinterestSearchTerms) ? analysisJson.pinterestSearchTerms : ['product cgi', 'interior design cgi'],
      confidence: typeof analysisJson.confidence === 'number' ? analysisJson.confidence : 50
    };

    console.log('✅ Product analysis completed:', {
      productType: analysis.productType,
      style: analysis.productStyle,
      keywordCount: analysis.productKeywords.length,
      categoryCount: analysis.suggestedCategories.length,
      confidence: analysis.confidence
    });

    return analysis;

  } catch (error) {
    console.error('❌ Product analysis failed:', error);
    
    // إرجاع تحليل افتراضي في حالة الخطأ
    return {
      productType: 'منتج',
      productStyle: 'modern',
      productKeywords: ['أثاث', 'تصميم'],
      suggestedCategories: ['living_room'],
      pinterestSearchTerms: ['product cgi', 'modern interior cgi'],
      confidence: 20
    };
  }
}

/**
 * تحسين استعلام البحث بناء على التحليل
 */
export function generateOptimizedSearchQuery(analysis: ProductAnalysis): string {
  const { productType, productStyle, productKeywords } = analysis;
  
  // دمج أهم العناصر في استعلام واحد
  const searchElements = [
    'CGI interior design',
    '3D rendered room',
    productType,
    productStyle,
    ...productKeywords.slice(0, 2), // أول كلمتين فقط
    'architectural visualization'
  ].filter(Boolean);

  const searchQuery = searchElements.join(' ');
  
  console.log('🔍 Generated optimized search query:', searchQuery);
  return searchQuery;
}

/**
 * ترجيح الفئات بناء على التحليل
 */
export function prioritizeCategories(analysis: ProductAnalysis): string[] {
  const { productType, suggestedCategories } = analysis;
  
  // خريطة أولويات حسب نوع المنتج
  const priorityMap: Record<string, string[]> = {
    'أريكة': ['living_room', 'bedroom', 'office'],
    'سرير': ['bedroom'],
    'مكتب': ['office', 'bedroom'],
    'طاولة': ['living_room', 'kitchen', 'office'],
    'كرسي': ['living_room', 'office', 'bedroom'],
    'إضاءة': ['living_room', 'bedroom', 'kitchen', 'office'],
    'مطبخ': ['kitchen'],
    'حمام': ['bathroom']
  };

  // الحصول على الأولويات المحددة أو الافتراضية
  const prioritizedOrder = priorityMap[productType] || ['living_room', 'bedroom', 'office'];
  
  // ترتيب الفئات المقترحة حسب الأولوية
  const sortedCategories = suggestedCategories.sort((a, b) => {
    const aIndex = prioritizedOrder.indexOf(a);
    const bIndex = prioritizedOrder.indexOf(b);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });

  console.log('📊 Prioritized categories:', {
    productType,
    original: suggestedCategories,
    prioritized: sortedCategories
  });

  return sortedCategories;
}