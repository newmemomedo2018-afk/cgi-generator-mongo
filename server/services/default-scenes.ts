import fs from 'fs';
import path from 'path';

/**
 * Default Scenes Service
 * إدارة مكتبة المشاهد الافتراضية المحلية
 */

export interface SceneData {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  isVideo?: boolean;
  category: string;
  style: string;
  keywords: string[];
  lighting: string;
  colors: string[];
}

export interface SceneCategory {
  name: string;
  description: string;
  scenes: SceneData[];
}

export interface ScenesCatalog {
  version: string;
  lastUpdated: string;
  categories: Record<string, SceneCategory>;
  totalScenes: number;
  searchableKeywords: string[];
}

let scenesCatalog: ScenesCatalog | null = null;

/**
 * تحميل كتالوج المشاهد من JSON
 */
async function loadScenesCatalog(): Promise<ScenesCatalog> {
  if (scenesCatalog) return scenesCatalog;
  
  try {
    const catalogPath = path.join(process.cwd(), 'attached_assets', 'default_scenes', 'scenes-catalog.json');
    const catalogData = fs.readFileSync(catalogPath, 'utf-8');
    scenesCatalog = JSON.parse(catalogData);
    
    console.log('✅ Default scenes catalog loaded:', {
      version: scenesCatalog!.version,
      totalScenes: scenesCatalog!.totalScenes,
      categories: Object.keys(scenesCatalog!.categories).length
    });
    
    return scenesCatalog!;
  } catch (error) {
    console.error('❌ Failed to load scenes catalog:', error);
    throw new Error('Failed to load default scenes catalog');
  }
}

/**
 * الحصول على جميع المشاهد الافتراضية
 */
export async function getAllDefaultScenes(): Promise<SceneData[]> {
  const catalog = await loadScenesCatalog();
  const allScenes: SceneData[] = [];
  
  Object.values(catalog.categories).forEach(category => {
    allScenes.push(...category.scenes);
  });
  
  return allScenes;
}

/**
 * الحصول على المشاهد حسب الفئة
 */
export async function getScenesByCategory(categoryId: string): Promise<SceneData[]> {
  const catalog = await loadScenesCatalog();
  const category = catalog.categories[categoryId];
  
  if (!category) {
    throw new Error(`Category not found: ${categoryId}`);
  }
  
  return category.scenes;
}

/**
 * البحث في المشاهد باستخدام keywords
 */
export async function searchDefaultScenes(query: string): Promise<SceneData[]> {
  const catalog = await loadScenesCatalog();
  const allScenes = await getAllDefaultScenes();
  
  if (!query || query.trim().length === 0) {
    return allScenes;
  }
  
  const searchTerms = query.toLowerCase().split(' ');
  
  const scoredScenes = allScenes.map(scene => {
    let score = 0;
    
    // البحث في الاسم (أولوية عالية)
    searchTerms.forEach(term => {
      if (scene.name.toLowerCase().includes(term)) score += 10;
      if (scene.description.toLowerCase().includes(term)) score += 5;
      if (scene.style.toLowerCase().includes(term)) score += 7;
      if (scene.category.toLowerCase().includes(term)) score += 8;
    });
    
    // البحث في Keywords
    scene.keywords.forEach(keyword => {
      searchTerms.forEach(term => {
        if (keyword.toLowerCase().includes(term)) score += 6;
      });
    });
    
    // البحث في الألوان
    scene.colors.forEach(color => {
      searchTerms.forEach(term => {
        if (color.toLowerCase().includes(term)) score += 3;
      });
    });
    
    return { scene, score };
  });
  
  // فرز حسب النتيجة وإرجاع أفضل النتائج
  return scoredScenes
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.scene);
}

/**
 * اقتراح مشاهد مناسبة بناء على تحليل المنتج
 */
export async function suggestScenesForProduct(
  productType: string, 
  productStyle: string = 'modern',
  productKeywords: string[] = []
): Promise<SceneData[]> {
  console.log('🔍 Suggesting scenes for product:', {
    productType,
    productStyle,
    productKeywords: productKeywords.slice(0, 5) // عرض أول 5 كلمات فقط
  });
  
  const catalog = await loadScenesCatalog();
  const allScenes = await getAllDefaultScenes();
  
  // خريطة المنتجات للفئات
  const productToCategoryMap: Record<string, string[]> = {
    'أثاث': ['living_room', 'bedroom', 'office'],
    'أريكة': ['living_room'],
    'سرير': ['bedroom'],
    'مكتب': ['office'],
    'طاولة': ['living_room', 'office', 'kitchen'],
    'كرسي': ['living_room', 'office', 'bedroom'],
    'خزانة': ['bedroom', 'kitchen', 'office'],
    'إضاءة': ['living_room', 'bedroom', 'kitchen', 'office'],
    'ديكور': ['living_room', 'bedroom', 'office'],
    'مطبخ': ['kitchen'],
    'حمام': ['bedroom'], // backup category
    'نباتات': ['living_room', 'office'],
    'تلفزيون': ['living_room', 'bedroom'],
    'كمبيوتر': ['office', 'bedroom'],
    'لابتوب': ['office', 'bedroom'],
    // Food and beverages
    'مشروب': ['kitchen', 'dining_room'],
    'مشروب طاقة': ['kitchen', 'office'], // Energy drinks for workout/office scenarios
    'مشروب الطاقة': ['kitchen', 'office'], // Alternative form with "الطاقة"
    'طاقة': ['kitchen', 'office'],
    'عصير': ['kitchen', 'dining_room'],
    'قهوة': ['kitchen', 'office'],
    'شاي': ['kitchen', 'living_room'],
    'ماء': ['kitchen', 'office'],
    'طعام': ['kitchen', 'dining_room'],
    'أكل': ['kitchen', 'dining_room'],
    // Electronics and tech
    'إلكترونيات': ['office', 'living_room'],
    'هاتف': ['office', 'bedroom'],
    'تقنية': ['office'],
    // Personal care and cosmetics
    'تجميل': ['bedroom', 'bathroom'],
    'عطر': ['bedroom', 'bathroom'],
    'مكياج': ['bedroom', 'bathroom'],
    'شامبو': ['bathroom'],
    // Clothing and fashion
    'ملابس': ['bedroom'],
    'أزياء': ['bedroom'],
    'حقيبة': ['bedroom', 'office'],
    'حذاء': ['bedroom']
  };
  
  // تحديد الفئات المناسبة
  let relevantCategories: string[] = [];
  
  // البحث بناء على نوع المنتج
  for (const [product, categories] of Object.entries(productToCategoryMap)) {
    if (productType.includes(product) || productKeywords.some(k => k.includes(product))) {
      relevantCategories.push(...categories);
    }
  }
  
  // إذا لم نجد فئات محددة، ارجع المشاهد الأكثر شيوعاً
  if (relevantCategories.length === 0) {
    relevantCategories = ['living_room', 'bedroom', 'office'];
  }
  
  // إزالة التكرار
  relevantCategories = Array.from(new Set(relevantCategories));
  
  console.log('📂 Relevant categories found:', relevantCategories);
  
  // جلب المشاهد المناسبة
  const suggestedScenes: SceneData[] = [];
  
  for (const categoryId of relevantCategories) {
    try {
      const categoryScenes = await getScenesByCategory(categoryId);
      
      // فرز حسب الستايل المطلوب
      const styleFiltered = categoryScenes.filter(scene => {
        if (productStyle === 'modern' && ['modern', 'contemporary', 'minimalist'].some(s => scene.style.includes(s))) return true;
        if (productStyle === 'classic' && ['classic', 'traditional', 'luxury'].some(s => scene.style.includes(s))) return true;
        if (productStyle === 'cozy' && ['cozy', 'warm', 'comfortable'].some(s => scene.style.includes(s))) return true;
        return true; // إذا لم نحدد ستايل معين، خذ كل المشاهد
      });
      
      suggestedScenes.push(...styleFiltered);
    } catch (error) {
      console.warn(`⚠️ Could not load category ${categoryId}:`, error);
    }
  }
  
  // ترتيب المشاهد حسب الأولوية (living room أولاً عادة)
  const priorityOrder = ['living_room', 'bedroom', 'kitchen', 'office'];
  suggestedScenes.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.category);
    const bIndex = priorityOrder.indexOf(b.category);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
  
  console.log('✅ Suggested scenes:', {
    total: suggestedScenes.length,
    categories: Array.from(new Set(suggestedScenes.map(s => s.category)))
  });
  
  // إرجاع أفضل 8 مشاهد
  return suggestedScenes.slice(0, 8);
}

/**
 * الحصول على إحصائيات المشاهد
 */
export async function getDefaultScenesStats(): Promise<{
  totalScenes: number;
  categoriesCount: number;
  categories: Record<string, number>;
}> {
  const catalog = await loadScenesCatalog();
  
  const categories: Record<string, number> = {};
  Object.entries(catalog.categories).forEach(([key, category]) => {
    categories[key] = category.scenes.length;
  });
  
  return {
    totalScenes: catalog.totalScenes,
    categoriesCount: Object.keys(catalog.categories).length,
    categories
  };
}