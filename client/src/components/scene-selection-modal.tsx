import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Sparkles, ImageIcon, ExternalLink, Scale, Zap, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

/**
 * Scene Selection Modal
 * اختيار المشاهد من المكتبة الافتراضية أو Pinterest
 */

interface SceneData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  style: string;
  keywords: string[];
  lighting: string;
  colors: string[];
}

interface PinterestScene {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pinterestUrl: string;
  userName?: string;
  category: string;
  extractedKeywords: string[];
}

interface SceneSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSceneSelect: (scene: SceneData | PinterestScene, productSize?: 'normal' | 'emphasized') => void;
  productImageUrl?: string;
  productType?: string;
}

export default function SceneSelectionModal({
  isOpen,
  onClose,
  onSceneSelect,
  productImageUrl,
  productType = 'أثاث'
}: SceneSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'pinterest'>('pinterest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedProductType, setAnalyzedProductType] = useState<string | null>(null);
  const [productSize, setProductSize] = useState<'normal' | 'emphasized'>('normal');

  // جلب المشاهد الافتراضية
  const { data: defaultScenes = [], status: defaultStatus, error: defaultError, refetch: refetchDefault } = useQuery<SceneData[]>({
    queryKey: ['/api/scenes/default', analyzedProductType, productType],
    queryFn: async () => {
      const currentProductType = analyzedProductType || productType || 'أثاث';
      console.log('🎯 Default scenes with analyzed product type:', { 
        originalProductType: productType, 
        analyzedProductType,
        finalProductType: currentProductType 
      });
      const params = new URLSearchParams();
      if (currentProductType) params.append('productType', currentProductType);
      
      const token = localStorage.getItem('auth_token');
      console.log('🔍 Fetching default scenes:', {
        url: `/api/scenes/default?${params}`,
        originalProductType: productType,
        analyzedProductType,
        finalProductType: currentProductType,
        isOpen,
        activeTab,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
      });
      
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/scenes/default?${params}`, {
        headers
      });
      
      console.log('📡 Default scenes response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Default scenes error:', {
          status: response.status,
          error: errorText,
          hasToken: !!token
        });
        throw new Error(`Failed to load default scenes: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Default scenes loaded:', {
        count: data.length,
        firstScene: data[0]?.name,
        categories: Array.from(new Set(data.map((s: SceneData) => s.category))),
        scenes: data.map((s: SceneData) => ({ id: s.id, name: s.name })),
        hasImageUrls: data.filter((s: SceneData) => s.imageUrl).length,
        imageUrls: data.slice(0, 3).map((s: SceneData) => ({ id: s.id, imageUrl: s.imageUrl })),
        fullData: data[0] // Show first complete scene for debugging
      });
      
      return data;
    },
    enabled: isOpen,
    retry: 1,
    staleTime: 0,
    gcTime: 0
  });

  // جلب مشاهد Pinterest
  const { data: pinterestScenes = [], isLoading: pinterestLoading, error: pinterestError, refetch: refetchPinterest } = useQuery<PinterestScene[]>({
    queryKey: ['/api/scenes/pinterest', searchQuery, analyzedProductType],
    queryFn: () => {
      if (!searchQuery?.trim()) return Promise.resolve([]);
      const currentProductType = analyzedProductType || productType || 'أثاث';
      console.log('🔍 Pinterest search with analyzed product type:', { 
        searchQuery, 
        originalProductType: productType, 
        analyzedProductType,
        finalProductType: currentProductType 
      });
      const params = new URLSearchParams({
        q: searchQuery,
        productType: currentProductType,
        maxResults: '24'
      });
      return fetch(`/api/scenes/pinterest?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      }).then(res => {
        if (!res.ok) throw new Error('Pinterest search failed');
        return res.json();
      });
    },
    enabled: false, // يتم التشغيل يدوياً
    retry: 2
  });

  // تحليل المنتج تلقائياً عند فتح المودال  
  useEffect(() => {
    if (isOpen && activeTab === 'pinterest') {
      console.log('🔄 Auto-loading Pinterest scenes...', { productImageUrl: !!productImageUrl });
      if (productImageUrl) {
        // إذا توفرت صورة المنتج، قم بالتحليل والبحث الذكي
        analyzeProductAndSearch();
      } else {
        // إذا لم تتوفر صورة المنتج، ابدأ بحث عام فوراً
        console.log('🎯 No product image, starting general CGI search...');
        setSearchQuery('CGI interior design');
        setTimeout(() => refetchPinterest(), 100); // Small delay to ensure state is set
      }
    }
  }, [isOpen, activeTab]); // Remove productImageUrl dependency to prevent re-triggering

  const analyzeProductAndSearch = async () => {
    if (!productImageUrl) {
      // إذا لم تتوفر صورة منتج، ابدأ بـ search عام
      setSearchQuery('CGI interior design');
      refetchPinterest();
      return;
    }

    setIsAnalyzing(true);
    try {
      // تحليل المنتج واستخراج كلمات البحث
      const analysisResponse = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ imageUrl: productImageUrl }),
      });

      if (analysisResponse.ok) {
        const analysis = await analysisResponse.json();
        const optimizedQuery = analysis.pinterestSearchTerms?.[0] || 'CGI interior design';
        
        // حفظ نوع المنتج المحلل
        setAnalyzedProductType(analysis.productType);
        setSearchQuery(optimizedQuery);
        
        console.log('✅ Analysis completed, updating both default and Pinterest scenes:', {
          analyzedProductType: analysis.productType,
          searchQuery: optimizedQuery,
          pinterestSearchTerms: analysis.pinterestSearchTerms
        });
        
        // تحديث المشاهد الافتراضية والـ Pinterest بناء على التحليل الجديد
        setTimeout(() => {
          refetchDefault();  // إعادة جلب المشاهد الافتراضية بنوع المنتج الجديد
          refetchPinterest(); // إعادة جلب مشاهد Pinterest
        }, 100);
      } else {
        throw new Error(`Analysis failed: ${analysisResponse.status}`);
      }
    } catch (error) {
      console.error('Product analysis failed:', error);
      // Set a fallback search query without changing product type
      setSearchQuery('CGI interior design');
      setTimeout(() => refetchPinterest(), 100);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePinterestSearch = async () => {
    if (!searchQuery.trim()) return;
    refetchPinterest();
  };

  const handleSceneClick = (scene: SceneData | PinterestScene) => {
    onSceneSelect(scene, productSize);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            اختيار مشهد للمنتج
          </DialogTitle>
        </DialogHeader>

        {/* خيارات حجم المنتج */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">حجم المنتج في المشهد</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={productSize === 'normal' ? 'default' : 'outline'}
              onClick={() => setProductSize('normal')}
              className="flex items-center gap-2 h-auto py-3 justify-start"
              data-testid="product-size-normal"
            >
              <Scale className="h-4 w-4" />
              <div className="text-right">
                <div className="font-medium text-sm">مناسب للغرفة</div>
                <div className="text-xs opacity-75">حجم طبيعي ومتناسق</div>
              </div>
            </Button>
            <Button
              variant={productSize === 'emphasized' ? 'default' : 'outline'}
              onClick={() => setProductSize('emphasized')}
              className="flex items-center gap-2 h-auto py-3 justify-start"
              data-testid="product-size-emphasized"
            >
              <Zap className="h-4 w-4" />
              <div className="text-right">
                <div className="font-medium text-sm">مُبرز وبارز</div>
                <div className="text-xs opacity-75">إبراز للمنتج كنقطة تركيز</div>
              </div>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pinterest" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              المكتبة
            </TabsTrigger>
            <TabsTrigger value="default" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              المشاهد الجاهزة
            </TabsTrigger>
          </TabsList>

          {/* Default Scenes Tab */}
          <TabsContent value="default" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  مشاهد عالية الجودة مناسبة لمنتجك ({productType})
                </div>
                <Button 
                  onClick={() => refetchDefault()}
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  data-testid="refresh-default-scenes"
                >
                  🔄 تحديث
                </Button>
              </div>

              {defaultStatus === 'pending' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="mt-3 text-sm font-medium">جاري تحميل المشاهد...</span>
                  <span className="mt-1 text-xs text-muted-foreground">انتظر قليلاً...</span>
                </div>
              ) : defaultStatus === 'error' ? (
                <div className="text-center py-12">
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <p className="text-red-600 dark:text-red-400 font-medium">حدث خطأ في تحميل المشاهد</p>
                    <p className="text-sm mt-2 text-red-500 dark:text-red-300">{defaultError?.message}</p>
                    <Button 
                      onClick={() => refetchDefault()}
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      data-testid="retry-default-scenes"
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                </div>
              ) : !defaultScenes || defaultScenes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                    <p className="text-yellow-600 dark:text-yellow-400">لا توجد مشاهد متاحة حالياً</p>
                    <Button 
                      onClick={() => refetchDefault()}
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      data-testid="retry-default-scenes"
                    >
                      إعادة التحميل
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto">
                  {defaultScenes.map((scene: SceneData) => (
                    <Card 
                      key={scene.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow group"
                      onClick={() => handleSceneClick(scene)}
                      data-testid={`default-scene-${scene.id}`}
                    >
                      <CardContent className="p-0">
                        <div className="aspect-square relative overflow-hidden rounded-t-lg">
                          <img
                            src={scene.imageUrl}
                            alt={scene.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder-scene.jpg';
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs">
                              {scene.category.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3">
                          <h4 className="font-medium text-sm truncate">{scene.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {scene.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {scene.keywords.slice(0, 3).map((keyword) => (
                              <Badge key={keyword} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Pinterest Browser Tab */}
          <TabsContent value="pinterest" className="mt-4">
            <div className="space-y-4">
              {/* Pinterest Live Browser Header */}
              <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 p-2 rounded-full">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">Pinterest Live Browser</h3>
                    <p className="text-sm opacity-90">متصفح Pinterest الحقيقي داخل التطبيق</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>pinterest.com</span>
                  </div>
                </div>
                
                {/* Pinterest Live Browser Search */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                      <Search className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      placeholder={`ابحث في Pinterest: "${searchQuery || 'energy drink cgi'}"...`}
                      className="w-full pl-11 pr-4 py-3 rounded-full bg-white text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="pinterest-live-search-input"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const searchTerm = searchQuery || 'energy drink cgi';
                      const pinterestUrl = `https://pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}`;
                      window.open(pinterestUrl, 'pinterest-live-browser', 'width=1200,height=800,scrollbars=yes,resizable=yes,location=yes,menubar=yes,toolbar=yes');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                    data-testid="pinterest-open-button"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    فتح Pinterest
                  </button>
                </div>
              </div>

              {/* Pinterest Browser Guide */}
              <div className="space-y-6">
                
                {/* Step 1: Open Pinterest */}
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">1</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        🚀 افتح Pinterest وابحث عن مشاهد CGI
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        هنفتحلك Pinterest في نافذة جديدة عشان تدور على مشهد CGI حلو لمنتجك
                      </p>
                      <button
                        onClick={() => {
                          const searchTerm = searchQuery || 'energy drink cgi';
                          const pinterestUrl = `https://pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}`;
                          window.open(pinterestUrl, 'pinterest-browser', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-colors flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                        data-testid="pinterest-open-button"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                        </svg>
                        🔍 ابدأ البحث في Pinterest
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Step 2: Copy Image */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">2</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        🖼️ اختار مشهد CGI وانسخ رابط الصورة
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        لما تلاقي صورة حلوة، اضغط عليها كليك يمين واختار "Copy image address" أو "نسخ عنوان الصورة"
                      </p>
                      <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="font-medium">انسخ رابط الصورة من Pinterest</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Step 3: Return to App */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">3</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        ✨ ارجع للتطبيق والصق رابط الصورة
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">
                        ارجع للتاب "مشاهد جاهزة" والصق رابط الصورة في خانة "رابط مشهد مخصص" عشان نعمل CGI بالمشهد اللي اخترته
                      </p>
                      <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-green-300 dark:border-green-600 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">الصق في تاب "مشاهد جاهزة" → "رابط مشهد مخصص"</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Quick Search Suggestions */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-center">
                    🔥 اقتراحات بحث لمشاهد CGI
                  </h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      'energy drink cgi render',
                      'product photography studio', 
                      'modern kitchen interior',
                      'lifestyle commercial photography',
                      'beverage bottle mockup',
                      'clean background product'
                    ].map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setSearchQuery(term);
                          const pinterestUrl = `https://pinterest.com/search/pins/?q=${encodeURIComponent(term)}`;
                          window.open(pinterestUrl, 'pinterest-browser', 'width=1200,height=800');
                        }}
                        className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}