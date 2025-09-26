import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Play, Camera, Bot, Film, Star, Check, Menu, X } from "lucide-react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/language-switcher";
import { CREDIT_COSTS } from "@shared/constants";
import productImage from "@assets/generated_images/Modern_smartphone_product_photo_8515c516.png";
import sceneImage from "@assets/generated_images/Modern_living_room_scene_8d384239.png";
import resultImage from "@assets/generated_images/CGI_smartphone_composite_result_bc061ac4.png";

export default function Landing() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, isRTL } = useLanguage();
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 glass-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-4 ${isRTL ? 'space-x-reverse' : ''}`}>
              <div className="text-2xl font-bold gradient-text">
                🎬 {t('landing_title')}
              </div>
            </div>
            <nav className={`hidden md:flex items-center space-x-8 ${isRTL ? 'space-x-reverse' : ''}`}>
              <a href="#home" className="text-sm font-medium hover:text-primary transition-colors">{t('nav_home')}</a>
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">{t('nav_features')}</a>
              <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">{t('nav_pricing')}</a>
            </nav>
            {/* Mobile Navigation */}
            <div className="md:hidden">
              <button 
                className="p-3 rounded-md glass-card hover:bg-white/20 mobile-touch-target"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav"
                aria-label="Toggle mobile menu"
                data-testid="mobile-menu-button"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
            <div className={`flex items-center space-x-4 ${isRTL ? 'space-x-reverse' : ''}`}>
              <LanguageSwitcher />
              <AuthDialog>
                <Button className="gradient-button mobile-touch-target mobile-button-padding" data-testid="login-button">
                  <i className={`fas fa-user ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
                  {t('auth_login')}
                </Button>
              </AuthDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <nav 
          id="mobile-nav" 
          className="fixed top-20 left-0 right-0 z-40 md:hidden animate-in slide-in-from-top-2"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="glass-card m-4 p-4 space-y-4">
            <a 
              href="#home" 
              className="block py-3 text-center hover:text-primary transition-colors mobile-touch-target"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-home"
            >
              {t('nav_home')}
            </a>
            <a 
              href="#features" 
              className="block py-3 text-center hover:text-primary transition-colors mobile-touch-target"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-features"
            >
              {t('nav_features')}
            </a>
            <a 
              href="#pricing" 
              className="block py-3 text-center hover:text-primary transition-colors mobile-touch-target"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-pricing"
            >
              {t('nav_pricing')}
            </a>
          </div>
        </nav>
      )}

      <div className="pt-20">
        {/* Hero Section */}
        <section id="home" className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              {t('landing_hero_title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              {t('landing_hero_description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <AuthDialog defaultTab="register">
                <Button 
                  size="lg" 
                  className="gradient-button mobile-touch-target mobile-button-padding"
                  data-testid="start-free-button"
                >
                  <Rocket className="ml-2 h-5 w-5" />
                  {t('landing_get_started')}
                </Button>
              </AuthDialog>
              <Button 
                variant="outline" 
                size="lg" 
                className="glass-card hover:bg-white/20 text-white border-white/20 mobile-touch-target mobile-button-padding"
                onClick={() => {
                  const exampleSection = document.getElementById('example-section');
                  exampleSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="watch-demo-button"
              >
                <Play className="ml-2 h-5 w-5" />
                {t('landing_watch_demo')}
              </Button>
            </div>

            {/* How it works */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <Card className="glass-card text-center">
                <CardContent className="p-8">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-4">{t('landing_step1_title')}</h3>
                  <p className="text-muted-foreground">{t('landing_step1_description')}</p>
                </CardContent>
              </Card>
              <Card className="glass-card text-center">
                <CardContent className="p-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-accent" />
                  <h3 className="text-xl font-bold mb-4">{t('landing_step2_title')}</h3>
                  <p className="text-muted-foreground">{t('landing_step2_description')}</p>
                </CardContent>
              </Card>
              <Card className="glass-card text-center">
                <CardContent className="p-8">
                  <Film className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-4">{t('landing_step3_title')}</h3>
                  <p className="text-muted-foreground">{t('landing_step3_description')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Before/After Examples */}
            <Card id="example-section" className="glass-card">
              <CardContent className="p-8">
                <h2 className="text-3xl font-bold mb-8">{t('landing_examples_title')}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold mb-4">{t('landing_examples_before')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <img 
                        src={productImage} 
                        alt="منتج - هاتف ذكي" 
                        className="rounded-lg shadow-lg"
                        data-testid="example-product-image"
                      />
                      <img 
                        src={sceneImage} 
                        alt="مشهد - غرفة معيشة عصرية" 
                        className="rounded-lg shadow-lg"
                        data-testid="example-scene-image"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-4">{t('landing_examples_after')}</h4>
                    <img 
                      src={resultImage} 
                      alt="نتيجة CGI - هاتف مدمج في المشهد" 
                      className="rounded-lg shadow-lg w-full"
                      data-testid="example-result-image"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">{t('landing_features_title')}</h2>
              <p className="text-xl text-muted-foreground">{t('landing_features_subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <Badge className="credit-badge">محسّن</Badge>
                    <h3 className="text-lg font-bold mr-2">Google Gemini AI</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">إنتاج صور عالية الجودة بتكلفة معقولة - {CREDIT_COSTS.IMAGE_GENERATION} كريدت لكل صورة</p>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 ml-1" />
                    <span className="text-sm">جودة فائقة</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <Badge className="credit-badge">متطور</Badge>
                    <h3 className="text-lg font-bold mr-2">Kling AI Video</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">فيديوهات CGI بجودة عالية - {CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) أو {CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)</p>
                  <p className="text-xs text-muted-foreground mb-2">+{CREDIT_COSTS.AUDIO_SURCHARGE} كريدت إضافية للصوت</p>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 ml-1" />
                    <span className="text-sm">جودة HD+</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <Badge className="credit-badge">ذكي</Badge>
                    <h3 className="text-lg font-bold mr-2">تحسين الأوصاف</h3>
                  </div>
                  <p className="text-muted-foreground mb-4">تحسين أوتوماتيكي لوصف المشاريع باستخدام Gemini AI</p>
                  <div className="flex items-center">
                    <Bot className="h-4 w-4 text-blue-500 ml-1" />
                    <span className="text-sm">تحسين ذكي</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <Card className="glass-card">
              <CardContent className="p-12">
                <h2 className="text-4xl font-bold mb-4">{t('landing_cta_title')}</h2>
                <p className="text-xl text-muted-foreground mb-8">
                  {t('landing_cta_subtitle')}
                </p>
                <AuthDialog defaultTab="register">
                  <Button 
                    size="lg" 
                    className="gradient-button"
                    data-testid="cta-start-button"
                  >
                    <Rocket className="ml-2 h-5 w-5" />
                    ابدأ مجاناً الآن
                  </Button>
                </AuthDialog>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 mt-20">
          <div className="container mx-auto px-4">
            <Card className="glass-card">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                  <div>
                    <div className="text-2xl font-bold gradient-text mb-4">
                      🎬 مولد CGI
                    </div>
                    <p className="text-muted-foreground">
                      منصة احترافية لإنتاج صور وفيديوهات CGI بالذكاء الاصطناعي
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold mb-4">المنتج</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li><a href="#" className="hover:text-white transition-colors">المميزات</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">الأسعار</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">الوثائق</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold mb-4">الشركة</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li><a href="#" className="hover:text-white transition-colors">من نحن</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">المدونة</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">وظائف</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">اتصل بنا</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold mb-4">الدعم</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li><a href="#" className="hover:text-white transition-colors">مركز المساعدة</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">الأسئلة الشائعة</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">الدعم الفني</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">الحالة</a></li>
                    </ul>
                  </div>
                </div>
                <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
                  <p className="text-muted-foreground text-sm mb-4 md:mb-0">
                    © 2024 مولد CGI. جميع الحقوق محفوظة.
                  </p>
                  <div className="flex space-x-reverse space-x-6">
                    <a href="#" className="text-muted-foreground hover:text-white transition-colors">
                      <i className="fab fa-twitter"></i>
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-white transition-colors">
                      <i className="fab fa-instagram"></i>
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-white transition-colors">
                      <i className="fab fa-linkedin"></i>
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-white transition-colors">
                      <i className="fab fa-youtube"></i>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </footer>
      </div>
    </div>
  );
}
