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
  const [activeTab, setActiveTab] = useState<'default' | 'pinterest'>('default');
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

        {/* Pinterest Direct Browser */}
        <div className="space-y-4">
          
          {/* Pinterest URL Auto-Detector */}
          <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/20 p-4 rounded-full">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">🎯 Pinterest Direct</h2>
                <p className="text-lg opacity-90">ابحث واختر مشاهد CGI احترافية بكليك واحدة!</p>
              </div>
            </div>
            
            {/* URL Auto-Input */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 z-10">
                    <Search className="w-6 h-6" />
                  </div>
                  <input
                    type="text"
                    placeholder="🤖 سيتم لصق رابط الصورة هنا أوتوماتيكياً..."
                    className="w-full pl-14 pr-6 py-5 text-lg rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-4 focus:ring-white/30 focus:border-white/40 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="pinterest-auto-url-input"
                  />
                </div>
                <button
                  onClick={() => {
                    if (searchQuery && (searchQuery.includes('pinimg.com') || searchQuery.includes('pinterest.com') || searchQuery.startsWith('http'))) {
                      const customScene: SceneData = {
                        id: `pinterest_auto_${Date.now()}`,
                        name: 'مشهد Pinterest المختار',
                        description: 'مشهد تم اختياره تلقائياً من Pinterest',
                        imageUrl: searchQuery,
                        category: 'pinterest',
                        style: 'auto-selected',
                        keywords: ['pinterest', 'auto'],
                        lighting: 'natural',
                        colors: ['متنوع']
                      };
                      onSceneSelect(customScene, productSize);
                      onClose();
                    } else {
                      // Open Pinterest in popup
                      const pinterestUrl = `https://pinterest.com/search/pins/?q=cgi+product+scene+${encodeURIComponent(productType || 'product')}`;
                      window.open(pinterestUrl, 'pinterest-browser', 'width=1400,height=900,scrollbars=yes,resizable=yes,location=yes,toolbar=yes,menubar=yes,status=yes');
                    }
                  }}
                  className="bg-white hover:bg-gray-100 text-red-600 px-10 py-5 text-lg font-bold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 whitespace-nowrap border-2 border-white/20"
                  data-testid="pinterest-action-button"
                >
                  {searchQuery ? '🚀 استخدام المشهد' : '🔍 فتح Pinterest'}
                </button>
              </div>
              
              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span>جاهز للاستقبال التلقائي للروابط من Pinterest</span>
              </div>
            </div>
          </div>
          
          {/* Pinterest Embedded Browser */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
            <div className="bg-gray-100 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 bg-white dark:bg-gray-800 rounded-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                  📌 pinterest.com/search/pins/?q=cgi+{productType}
                </div>
                <div className="text-xs text-gray-500">Pinterest Browser</div>
              </div>
            </div>
            <div style={{height: '700px'}} className="relative">
              <iframe
                src={`https://pinterest.com/search/pins/?q=cgi+product+scene+${encodeURIComponent(productType || 'product')}`}
                className="w-full h-full border-0"
                title="Pinterest Embedded Browser"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads"
                loading="eager"
                onLoad={() => {
                  console.log('✅ Pinterest embedded browser loaded successfully');
                }}
                onError={() => {
                  console.log('❌ Pinterest iframe blocked - showing fallback');
                }}
              />
              {/* Fallback overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-gray-800/95" style={{display: 'none'}} id="pinterest-fallback-overlay">
                <div className="text-center p-8">
                  <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Pinterest محجوب!</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">Pinterest لا يسمح بالعرض داخل التطبيقات</p>
                  <button
                    onClick={() => {
                      const pinterestUrl = `https://pinterest.com/search/pins/?q=cgi+product+scene+${encodeURIComponent(productType || 'product')}`;
                      window.open(pinterestUrl, '_blank', 'width=1400,height=900');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    🌐 فتح Pinterest في نافذة منفصلة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}