import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Sparkles, ImageIcon, ExternalLink } from 'lucide-react';
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
  onSceneSelect: (scene: SceneData | PinterestScene) => void;
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

  // جلب المشاهد الافتراضية
  const { data: defaultScenes = [], isLoading: defaultLoading } = useQuery<SceneData[]>({
    queryKey: ['/api/scenes/default', productType],
    enabled: isOpen && activeTab === 'default'
  });

  // جلب مشاهد Pinterest
  const { data: pinterestScenes = [], isLoading: pinterestLoading, refetch: refetchPinterest } = useQuery<PinterestScene[]>({
    queryKey: ['/api/scenes/pinterest', searchQuery],
    enabled: false // يتم التشغيل يدوياً
  });

  // تحليل المنتج تلقائياً عند فتح المودال
  useEffect(() => {
    if (isOpen && productImageUrl && activeTab === 'pinterest') {
      analyzeProductAndSearch();
    }
  }, [isOpen, productImageUrl, activeTab]);

  const analyzeProductAndSearch = async () => {
    if (!productImageUrl) return;

    setIsAnalyzing(true);
    try {
      // تحليل المنتج واستخراج كلمات البحث
      const analysisResponse = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: productImageUrl }),
      });

      if (analysisResponse.ok) {
        const analysis = await analysisResponse.json();
        const optimizedQuery = analysis.pinterestSearchTerms?.[0] || 'CGI interior design';
        setSearchQuery(optimizedQuery);
        
        // البحث التلقائي بناء على التحليل
        refetchPinterest();
      }
    } catch (error) {
      console.error('Product analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePinterestSearch = async () => {
    if (!searchQuery.trim()) return;
    refetchPinterest();
  };

  const handleSceneClick = (scene: SceneData | PinterestScene) => {
    onSceneSelect(scene);
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="default" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              المشاهد الجاهزة
            </TabsTrigger>
            <TabsTrigger value="pinterest" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              استكشاف المزيد
            </TabsTrigger>
          </TabsList>

          {/* Default Scenes Tab */}
          <TabsContent value="default" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                مشاهد عالية الجودة مناسبة لمنتجك ({productType})
              </div>

              {defaultLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">جاري تحميل المشاهد...</span>
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

          {/* Pinterest Scenes Tab */}
          <TabsContent value="pinterest" className="mt-4">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <Input
                  placeholder="ابحث عن مشاهد CGI (مثل: modern living room 3D)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePinterestSearch()}
                  data-testid="pinterest-search-input"
                />
                <Button 
                  onClick={handlePinterestSearch}
                  disabled={pinterestLoading || isAnalyzing}
                  data-testid="pinterest-search-button"
                >
                  {pinterestLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
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
                  <div className="text-sm text-muted-foreground">
                    وُجد {pinterestScenes.length} مشهد CGI مناسب
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
                              <Badge className="text-xs bg-red-500">
                                Pinterest
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
                                عرض في Pinterest
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
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}