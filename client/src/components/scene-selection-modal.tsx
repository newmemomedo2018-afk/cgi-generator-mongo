import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ExternalLink, Scale, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/**
 * Scene Selection Modal - Pinterest Simple
 * اختيار مشهد من Pinterest بطريقة بسيطة
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

interface SceneSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSceneSelect: (scene: SceneData, productSize?: 'normal' | 'emphasized') => void;
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
  const [pinterestUrl, setPinterestUrl] = useState('');
  const [productSize, setProductSize] = useState<'normal' | 'emphasized'>('normal');
  const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [smartSearchTerms, setSmartSearchTerms] = useState<string[]>([]);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);

  // Debug logging for state changes
  console.log('🔄 Modal state:', { 
    isOpen, 
    productImageUrl: productImageUrl?.substring(0, 50) + '...', 
    extractedImageUrl: extractedImageUrl?.substring(0, 50) + '...', 
    isExtracting,
    smartSearchTerms 
  });

  // Analyze product when modal opens and productImageUrl is available
  useEffect(() => {
    if (isOpen && productImageUrl && !smartSearchTerms.length) {
      analyzeProductForSearch();
    }
  }, [isOpen, productImageUrl]);

  const analyzeProductForSearch = async () => {
    if (!productImageUrl) return;

    try {
      setIsAnalyzingProduct(true);
      
      // Use the built-in apiRequest function that handles authentication automatically
      const response = await apiRequest('POST', '/api/analyze-product', {
        imageUrl: productImageUrl
      });

      const analysis = await response.json();
      console.log('✅ Product analysis result:', analysis);
      
      if (analysis.pinterestSearchTerms && analysis.pinterestSearchTerms.length > 0) {
        setSmartSearchTerms(analysis.pinterestSearchTerms);
        console.log('🎯 Smart Pinterest search terms:', analysis.pinterestSearchTerms);
      } else {
        // Fallback to default terms if no search terms found
        setSmartSearchTerms([`${productType} cgi scene`]);
      }
      
    } catch (error) {
      console.error('Product analysis failed:', error);
      // Fallback to default terms
      setSmartSearchTerms([`${productType} cgi scene`]);
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  const handleUsePinterestImage = async () => {
    if (!pinterestUrl.trim()) {
      alert('يرجى إدخال رابط الصورة من Pinterest');
      return;
    }
    
    // Validate Pinterest URL
    const isValidPinterestUrl = pinterestUrl.includes('pinterest.com') || pinterestUrl.includes('pinimg.com');
    
    if (!isValidPinterestUrl) {
      alert('يرجى إدخال رابط صورة من Pinterest صحيح');
      return;
    }

    try {
      setIsExtracting(true);
      setExtractedImageUrl(null);
      
      // Extract real image URL from Pinterest post
      const response = await fetch('/api/extract-pinterest-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pinterestUrl })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في استخراج الصورة');
      }

      const result = await response.json();
      console.log('🔍 Full API response:', result);
      
      const { imageUrl } = result;
      console.log('✅ Pinterest image extracted:', { original: pinterestUrl, extracted: imageUrl });
      
      if (!imageUrl) {
        throw new Error('لم يتم العثور على رابط صورة صالح');
      }
      
      // Show preview of extracted image
      console.log('🎯 Setting extracted image URL:', imageUrl);
      setExtractedImageUrl(imageUrl);
      console.log('✅ State updated with extracted URL');
      setIsExtracting(false);
      
      // Auto-confirm and close modal after successful extraction
      console.log('🚀 Auto-confirming Pinterest image selection...');
      setTimeout(() => {
        const customScene: SceneData = {
          id: `pinterest_${Date.now()}`,
          name: 'مشهد Pinterest',
          description: 'مشهد تم اختياره من Pinterest',
          imageUrl: imageUrl,
          category: 'pinterest',
          style: 'user-selected',
          keywords: ['pinterest'],
          lighting: 'natural',
          colors: ['متنوع']
        };
        
        onSceneSelect(customScene, productSize);
        onClose();
        console.log('✅ Pinterest scene auto-selected and modal closed');
      }, 500); // Small delay to let user see the extracted image briefly
      
    } catch (error) {
      console.error('Pinterest image extraction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      alert(`فشل في استخراج الصورة: ${errorMessage}`);
      setIsExtracting(false);
    }
  };

  const handleConfirmSelection = () => {
    if (!extractedImageUrl) return;
    
    const customScene: SceneData = {
      id: `pinterest_${Date.now()}`,
      name: 'مشهد Pinterest',
      description: 'مشهد تم اختياره من Pinterest',
      imageUrl: extractedImageUrl,
      category: 'pinterest',
      style: 'user-selected',
      keywords: ['pinterest'],
      lighting: 'natural',
      colors: ['متنوع']
    };
    
    onSceneSelect(customScene, productSize);
    onClose();
  };

  const openPinterest = () => {
    // Use smart search terms if available, otherwise fallback to default
    let searchQuery;
    if (smartSearchTerms.length > 0) {
      // Use the first smart search term
      searchQuery = smartSearchTerms[0];
    } else {
      // Fallback to basic search
      searchQuery = `${productType} cgi scene`;
    }
    
    const pinterestUrl = `https://pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`;
    console.log('🔍 Opening Pinterest with search query:', searchQuery);
    window.open(pinterestUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            اختيار مشهد للمنتج
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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

          {/* Pinterest Section */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/20 p-4 rounded-full">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 19c-.68 0-1.32-.063-1.94-.18.27-.43.68-1.07.85-1.65l.59-2.25c.3.58 1.19.98 2.13.98 2.8 0 4.71-2.55 4.71-5.96 0-2.58-2.19-5.02-5.52-5.02-4.14 0-6.23 2.98-6.23 5.46 0 1.5.57 2.84 1.78 3.34.2.08.38 0 .44-.22l.36-1.45c.05-.2.03-.27-.1-.45-.29-.35-.47-.8-.47-1.44 0-1.86 1.39-3.53 3.63-3.53 1.98 0 3.07 1.21 3.07 2.83 0 2.13-0.94 3.92-2.34 3.92-.77 0-1.35-.64-1.16-1.42.22-.93.66-1.94.66-2.61 0-.6-.32-.11-.32-1.71 0-.15.02-.3.05-.44.18-.92.92-2.2 2.09-2.2.85 0 1.28.52 1.28 1.24 0 .92-.48 1.68-.48 2.84 0 .64.34 1.16.95 1.16 1.4 0 2.35-1.79 2.35-3.96 0-2.58-2.19-5.02-5.52-5.02z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">🎯 اختيار من بنترست</h2>
                <p className="text-lg opacity-90">ابحث واختر مشاهد CGI احترافية من Pinterest</p>
              </div>
            </div>
            
            {/* Step 1: Open Pinterest */}
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <button
                  onClick={openPinterest}
                  disabled={isAnalyzingProduct}
                  className="bg-white hover:bg-gray-100 text-red-600 px-12 py-6 text-xl font-bold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-open-pinterest"
                >
                  <ExternalLink className="w-6 h-6" />
                  {isAnalyzingProduct ? '🔍 جاري تحليل المنتج...' : '🔍 فتح Pinterest للبحث'}
                </button>
                
                {smartSearchTerms.length > 0 && (
                  <div className="text-sm text-white/80 bg-white/10 rounded-lg p-2 max-w-md mx-auto">
                    💡 سيتم البحث عن: "{smartSearchTerms[0]}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Paste URL */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6 shadow-xl">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                📝 الصق رابط الصورة من Pinterest
              </h3>
              
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2" data-testid="text-instructions">
                  💡 كيفية الحصول على رابط الصورة:
                </h4>
                <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>افتح Pinterest من الزر أعلاه</li>
                  <li>اختر الصورة التي تعجبك</li>
                  <li>اضغط بالزر الأيمن على الصورة واختر "نسخ عنوان الصورة"</li>
                  <li>الصق الرابط في المربع أدناه</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="https://www.pinterest.com/pin/..."
                    className="h-12 text-lg"
                    value={pinterestUrl}
                    onChange={(e) => setPinterestUrl(e.target.value)}
                    data-testid="input-pinterest-url"
                  />
                </div>
                <Button
                  onClick={handleUsePinterestImage}
                  disabled={!pinterestUrl.trim() || isExtracting}
                  className="h-12 px-8 text-lg font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                  data-testid="button-extract-image"
                >
                  {isExtracting ? '⏳ جاري الاستخراج...' : '🔍 استخراج الصورة'}
                </Button>
              </div>
              
              {/* Preview Section */}
              {extractedImageUrl ? (
                <div className="mt-6 p-4 border-2 border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="text-lg font-bold text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
                    ✅ تم استخراج الصورة بنجاح!
                  </h4>
                  
                  {/* Debug info */}
                  <div className="text-xs text-gray-600 mb-2">
                    🔍 Debug: {extractedImageUrl.substring(0, 80)}...
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <img 
                        src={extractedImageUrl} 
                        alt="صورة Pinterest المستخرجة"
                        className="w-full max-w-md h-48 object-cover rounded-lg shadow-lg border"
                        data-testid="img-pinterest-preview"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                        🎯 هذه هي الصورة التي تم استخراجها من Pinterest بجودة عالية. يمكنك الآن استخدامها كمشهد لمنتجك.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleConfirmSelection}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
                          data-testid="button-confirm-selection"
                        >
                          ✅ استخدام هذا المشهد
                        </Button>
                        <Button
                          onClick={() => {
                            setExtractedImageUrl(null);
                            setPinterestUrl('');
                          }}
                          variant="outline"
                          className="py-3 px-4 rounded-lg"
                          data-testid="button-try-another"
                        >
                          🔄 جرب صورة أخرى
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}