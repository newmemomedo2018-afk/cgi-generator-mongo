import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
// Removed Tabs - Pinterest direct only now
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
  // Removed activeTab - Pinterest direct only now
  const [searchQuery, setSearchQuery] = useState('');
  const [lastDetectedUrl, setLastDetectedUrl] = useState('');
  const [urlDetectionStatus, setUrlDetectionStatus] = useState('🤖 جاهز للاستقبال التلقائي');
  const [isAutoDetecting, setIsAutoDetecting] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedProductType, setAnalyzedProductType] = useState<string | null>(null);
  const [productSize, setProductSize] = useState<'normal' | 'emphasized'>('normal');

  // Removed default scenes query - Pinterest direct only now

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
    if (isOpen) {  // Pinterest direct only now
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
  }, [isOpen]); // Pinterest direct only now

  // فتح Pinterest في popup منفصل مع bookmarklet مبسط
  const openPinterestPopup = () => {
    const pinterestUrl = `https://pinterest.com/search/pins/?q=cgi+product+scene+${encodeURIComponent(productType || 'product')}`;
    const popup = window.open(pinterestUrl, 'pinterest-popup', 'width=1400,height=900,scrollbars=yes,resizable=yes,toolbar=yes');
    
    if (popup) {
      console.log('📌 Pinterest popup opened successfully');
      setUrlDetectionStatus('📌 Pinterest مفتوح! استخدم الـ bookmarklet للنسخ السريع');
      
      // مراقبة إغلاق النافذة
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          console.log('📌 Pinterest popup closed');
          setUrlDetectionStatus('🤖 جاهز للاستقبال التلقائي');
        }
      }, 1000);
    } else {
      console.error('❌ Failed to open Pinterest popup');
      alert('❌ فشل في فتح Pinterest. تأكد من إلغاء حجب النوافذ المنبثقة.');
    }
  };

  // نسخ bookmarklet مبسط للاستخدام في Pinterest
  const copySimpleBookmarklet = () => {
    const bookmarkletCode = `javascript:(function(){
      var imgs = document.querySelectorAll('img[src*="pinimg.com"]');
      if(imgs.length === 0) {
        alert('❌ لم يتم العثور على صور Pinterest في هذه الصفحة');
        return;
      }
      var overlay = document.createElement('div');
      overlay.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:linear-gradient(135deg,#e60023,#ff4757);color:white;padding:30px;border-radius:20px;text-align:center;font-family:Arial;box-shadow:0 20px 40px rgba(0,0,0,0.3);"><h3 style="margin:0 0 20px 0;font-size:24px;">🎯 اختر صورة المشهد</h3><p style="margin:0 0 20px 0;">اضغط على أي صورة لنسخ رابطها وإرسالها للتطبيق</p><button onclick="this.parentElement.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:10px 20px;border-radius:10px;cursor:pointer;">❌ إلغاء</button></div>';
      document.body.appendChild(overlay);
      imgs.forEach(function(img) {
        img.style.cursor = 'copy';
        img.style.transition = 'transform 0.2s';
        img.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var url = img.src.replace(/\\d+x\\d+/,'1920x1080').replace('/236x/','/1920x/').replace('/474x/','/1920x/');
          if(window.opener) {
            window.opener.postMessage({type:'PINTEREST_IMAGE_URL',url:url,source:'Popup Bookmarklet'},'*');
            window.close();
          } else {
            navigator.clipboard.writeText(url);
            alert('✅ تم نسخ الرابط: ' + url);
            window.close();
          }
        });
        img.addEventListener('mouseover', function() {
          this.style.transform = 'scale(1.05)';
          this.style.border = '3px solid #e60023';
        });
        img.addEventListener('mouseout', function() {
          this.style.transform = 'scale(1)';
          this.style.border = 'none';
        });
      });
    })();`;
    
    navigator.clipboard?.writeText(bookmarkletCode);
    setUrlDetectionStatus('✅ تم نسخ الـ Bookmarklet! الصقه في شريط العناوين في Pinterest');
    alert('✅ تم نسخ الـ Bookmarklet!\n\n1. اذهب لنافذة Pinterest\n2. الصق الكود في شريط العناوين\n3. اضغط Enter\n4. اضغط على أي صورة لاختيارها');
  };

  // Auto-Detection System للروابط من Pinterest
  useEffect(() => {
    if (!isOpen) return;

    let pollInterval: NodeJS.Timeout;
    let lastCheckedTimestamp = Date.now() - 1000; // Check for URLs from 1 second ago

    // مراقبة الـ postMessage من Pinterest popup
    const handleMessage = (event: MessageEvent) => {
      // تحقق أمني صارم - Pinterest domains فقط
      const trustedOrigins = [
        'https://www.pinterest.com',
        'https://pinterest.com', 
        'https://in.pinterest.com',
        'https://br.pinterest.com'
      ];
      
      // Parse origin URL securely  
      let originHostname: string;
      try {
        const originUrl = new URL(event.origin);
        originHostname = originUrl.hostname;
      } catch (e) {
        console.log('🚫 Invalid origin URL:', event.origin);
        return;
      }
      
      const trustedHostnames = [
        'pinterest.com',
        'www.pinterest.com', 
        'in.pinterest.com',
        'br.pinterest.com',
        'i.pinimg.com'
      ];
      
      const isPinterestDomain = trustedHostnames.includes(originHostname) ||
                               event.origin === window.location.origin;
      
      if (!isPinterestDomain || event.data?.type !== 'PINTEREST_IMAGE_URL') {
        console.log('🚫 Rejected untrusted message:', { origin: event.origin, hostname: originHostname, type: event.data?.type });
        return;
      }

      if (event.data?.type === 'PINTEREST_IMAGE_URL' && event.data?.url) {
        console.log('📨 Received Pinterest URL via postMessage:', event.data.url);
        handleDetectedUrl(event.data.url, 'PostMessage');
      }
    };

    // مراقبة الـ localStorage للروابط الجديدة
    const checkLocalStorage = () => {
      try {
        const storedUrl = localStorage.getItem('pinterest_copied_url');
        const storedTimestamp = parseInt(localStorage.getItem('pinterest_copied_timestamp') || '0');
        
        if (storedUrl && storedTimestamp > lastCheckedTimestamp) {
          console.log('📦 Detected Pinterest URL from localStorage:', storedUrl);
          handleDetectedUrl(storedUrl, 'LocalStorage');
          lastCheckedTimestamp = storedTimestamp;
        }
      } catch (e) {
        console.log('⚠️ LocalStorage check failed:', e);
      }
    };

    // مراقبة الحافظة (إذا أُمكن)
    const checkClipboard = async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && 
              (clipboardText.includes('pinimg.com') || clipboardText.includes('pinterest.com')) &&
              clipboardText.startsWith('http') &&
              clipboardText !== lastDetectedUrl) {
            console.log('📋 Detected Pinterest URL from clipboard:', clipboardText);
            handleDetectedUrl(clipboardText, 'Clipboard');
          }
        }
      } catch (e) {
        // Clipboard access denied - normal behavior
      }
    };

    const handleDetectedUrl = (url: string, source: string) => {
      if (url === lastDetectedUrl) return; // تجنب التكرار

      setLastDetectedUrl(url);
      setSearchQuery(url);
      setUrlDetectionStatus(`🎉 تم اكتشاف رابط من ${source}!`);
      
      // تأثير بصري
      setTimeout(() => {
        setUrlDetectionStatus('🤖 جاري مراقبة روابط جديدة...');
      }, 3000);

      // تطبيق الرابط تلقائياً إذا كان صحيحاً
      if (url.includes('pinimg.com') || url.includes('pinterest.com')) {
        setTimeout(() => {
          const customScene: SceneData = {
            id: `pinterest_auto_${Date.now()}`,
            name: 'مشهد Pinterest - تلقائي',
            description: `تم اختياره تلقائياً من ${source}`,
            imageUrl: url,
            category: 'pinterest-auto',
            style: 'auto-detected',
            keywords: ['pinterest', 'auto', source.toLowerCase()],
            lighting: 'natural',
            colors: ['متنوع']
          };
          
          if (isAutoDetecting) {
            setUrlDetectionStatus('✅ تم تطبيق المشهد تلقائياً!');
            onSceneSelect(customScene, productSize);
            onClose();
          }
        }, 1000);
      }
    };

    // بدء المراقبة
    window.addEventListener('message', handleMessage);
    
    // فحص دوري للحافظة فقط (localStorage لن يعمل cross-origin)  
    pollInterval = setInterval(() => {
      checkClipboard();
    }, 2000); // كل ثانيتين

    // فحص فوري للحافظة
    checkClipboard();

    console.log('🤖 Pinterest Auto-Detection started');

    // تنظيف عند الإغلاق
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollInterval) clearInterval(pollInterval);
      console.log('🛑 Pinterest Auto-Detection stopped');
    };
  }, [isOpen, isAutoDetecting, lastDetectedUrl, productSize, onSceneSelect, onClose]);

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
        
        console.log('✅ Analysis completed, updating Pinterest scenes:', {
          analyzedProductType: analysis.productType,
          searchQuery: optimizedQuery,
          pinterestSearchTerms: analysis.pinterestSearchTerms
        });
        
        // تحديث مشاهد Pinterest بناء على التحليل الجديد
        setTimeout(() => {
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
                    // تحقق أمني - Pinterest URLs فقط
                    let isPinterestUrl = false;
                    if (searchQuery) {
                      try {
                        const url = new URL(searchQuery);
                        const trustedHosts = ['pinterest.com', 'www.pinterest.com', 'i.pinimg.com', 'in.pinterest.com', 'br.pinterest.com'];
                        isPinterestUrl = trustedHosts.includes(url.hostname) || searchQuery.includes('pinimg.com');
                      } catch (e) {
                        isPinterestUrl = searchQuery.includes('pinimg.com') || searchQuery.includes('pinterest.com');
                      }
                    }
                    
                    if (searchQuery && isPinterestUrl) {
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
              <div className="flex items-center justify-between gap-3 text-white/80 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isAutoDetecting ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span>{urlDetectionStatus}</span>
                </div>
                <button
                  onClick={() => setIsAutoDetecting(!isAutoDetecting)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isAutoDetecting 
                      ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                      : 'bg-red-500/20 text-red-300 border border-red-400/30'
                  }`}
                >
                  {isAutoDetecting ? '🔄 مُفعل' : '⏹ مُوقف'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Pinterest Helper Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">💡 استخدم Pinterest Helper للنسخ السريع!</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  انسخ الكود التالي وحفظه كـ bookmark في متصفحك، ثم استخدمه على أي صفحة Pinterest:
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3">
                  <code className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all select-all">
                    {`javascript:(function(){var s=document.createElement("script");s.src="/pinterest-helper.js";document.head.appendChild(s);})()`}
                  </code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const bookmarkletCode = `javascript:(function(){var s=document.createElement("script");s.src="/pinterest-helper.js";document.head.appendChild(s);})();`;
                      navigator.clipboard?.writeText(bookmarkletCode);
                      alert('تم نسخ كود Pinterest Helper! الصقه كـ bookmark في متصفحك');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                  >
                    📋 نسخ الكود
                  </button>
                  <button
                    onClick={() => window.open('/pinterest-helper.js', '_blank')}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                  >
                    📄 عرض الكود كاملاً
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pinterest Popup Button */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl">
            <div className="text-center p-12">
              <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-12 h-12 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">🚀 ابحث واختر من Pinterest</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                ستفتح نافذة Pinterest منفصلة. استخدم الـ bookmarklet للنسخ السريع!
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => openPinterestPopup()}
                  className="bg-red-600 hover:bg-red-700 text-white px-12 py-6 rounded-full font-bold text-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full"
                  data-testid="open-pinterest-popup"
                >
                  📌 فتح Pinterest للبحث
                </button>
                
                <button
                  onClick={() => copySimpleBookmarklet()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full"
                  data-testid="copy-bookmarklet"
                >
                  📋 نسخ أداة الاختيار السريع
                </button>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-yellow-400 text-white p-2 rounded-full flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>طريقة الاستخدام:</strong><br/>
                      1. اضغط "فتح Pinterest" أولاً<br/>
                      2. ثم اضغط "نسخ أداة الاختيار"<br/>
                      3. في Pinterest، الصق الأداة في شريط العناوين<br/>
                      4. اضغط Enter واختر أي صورة!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}