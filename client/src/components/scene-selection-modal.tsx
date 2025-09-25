import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ExternalLink, Scale, Zap } from 'lucide-react';

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

  const handleUsePinterestImage = () => {
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

    const customScene: SceneData = {
      id: `pinterest_${Date.now()}`,
      name: 'مشهد Pinterest',
      description: 'مشهد تم اختياره من Pinterest',
      imageUrl: pinterestUrl,
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
    const searchQuery = `cgi product scene ${productType}`;
    const pinterestUrl = `https://pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`;
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
              <div className="text-center">
                <button
                  onClick={openPinterest}
                  className="bg-white hover:bg-gray-100 text-red-600 px-12 py-6 text-xl font-bold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 inline-flex items-center gap-3"
                  data-testid="button-open-pinterest"
                >
                  <ExternalLink className="w-6 h-6" />
                  🔍 فتح Pinterest للبحث
                </button>
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
                    placeholder="https://i.pinimg.com/564x/..."
                    className="h-12 text-lg"
                    value={pinterestUrl}
                    onChange={(e) => setPinterestUrl(e.target.value)}
                    data-testid="input-pinterest-url"
                  />
                </div>
                <Button
                  onClick={handleUsePinterestImage}
                  disabled={!pinterestUrl.trim()}
                  className="h-12 px-8 text-lg font-bold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  data-testid="button-use-image"
                >
                  ✅ استخدام الصورة
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}