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
              {/* CGI Explorer Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 p-2 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">متصفح المشاهد</h3>
                    <p className="text-sm opacity-90">استكشف مشاهد CGI احترافية عالية الجودة</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${pinterestLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <span>{pinterestLoading ? 'يحمل' : 'جاهز'}</span>
                  </div>
                </div>
                
                {/* Pinterest Search Bar */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder={`ابحث عن "${searchQuery || 'مشاهد المنتجات'}"...`}
                    className="w-full pl-11 pr-12 py-3 rounded-full bg-white text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handlePinterestSearch()}
                    data-testid="pinterest-search-input"
                  />
                  <button
                    onClick={handlePinterestSearch}
                    disabled={pinterestLoading || isAnalyzing}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors"
                    data-testid="pinterest-search-button"
                  >
                    {pinterestLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Auto Analysis Status */}
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تحليل المنتج واقتراح مشاهد مناسبة...
                </div>
              )}

              {/* Pinterest Results */}
              {pinterestLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">جاري البحث في مشاهد CGI...</span>
                </div>
              ) : pinterestScenes.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>وُجد {pinterestScenes.length} مشهد CGI احترافي</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => refetchPinterest()}
                      disabled={pinterestLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ml-1 ${pinterestLoading ? 'animate-spin' : ''}`} />
                      تحديث
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto">
                    {pinterestScenes.map((scene: PinterestScene) => (
                      <Card 
                        key={scene.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow group"
                        onClick={() => handleSceneClick(scene)}
                        data-testid={`pinterest-scene-${scene.id}`}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-square relative overflow-hidden rounded-t-lg">
                            <img
                              src={scene.imageUrl}
                              alt={scene.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-scene.jpg';
                              }}
                            />
                            <div className="absolute top-2 left-2">
                              <Badge className="text-xs bg-purple-500">
                                CGI
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="text-xs">
                                {scene.category.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-3">
                            <h4 className="font-medium text-sm truncate">{scene.title}</h4>
                            {scene.userName && (
                              <p className="text-xs text-muted-foreground">
                                بواسطة: {scene.userName}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {scene.extractedKeywords.slice(0, 3).map((keyword) => (
                                <Badge key={keyword} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs h-6 p-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(scene.pinterestUrl, '_blank');
                                }}
                              >
                                <ExternalLink className="h-3 w-3 ml-1" />
                                عرض في المصدر
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : searchQuery && !pinterestLoading && !isAnalyzing ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لم يتم العثور على مشاهد مناسبة</p>
                  <p className="text-sm mt-2">جرب كلمات بحث مختلفة</p>
                </div>
              ) : !pinterestLoading && !isAnalyzing && pinterestScenes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>استكشف مشاهد CGI متنوعة</p>
                  <p className="text-sm mt-2">ابحث عن مشاهد مناسبة لمنتجك</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery('CGI interior design');
                      refetchPinterest();
                    }}
                  >
                    <Sparkles className="h-4 w-4 ml-2" />
                    استكشاف المزيد
                  </Button>
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}