import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Star, Rocket, Crown, Building, TestTube, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CREDIT_PACKAGES, CREDIT_COSTS } from "@shared/constants";

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }

    const selectedPackage = packages.find(pkg => pkg.id === packageId);
    if (!selectedPackage) return;

    setPurchasingPackage(packageId);

    try {
      // Create payment intent using apiRequest
      const response = await apiRequest('POST', '/api/purchase-credits', {
        amount: selectedPackage.price,
        credits: selectedPackage.credits,
        packageId: selectedPackage.id
      });

      const { clientSecret } = await response.json();
      
      // Load Stripe
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      // Redirect to Stripe checkout
      const { error } = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard?payment=success`,
        },
      });

      if (error) {
        toast({
          title: "خطأ في الدفع",
          description: error.message || "حدث خطأ أثناء معالجة الدفعة",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "خطأ في الدفع",
        description: "حدث خطأ أثناء معالجة الدفعة. يرجى المحاولة مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setPurchasingPackage(null);
    }
  };

  const packages = [
    {
      id: "tester",
      name: CREDIT_PACKAGES.tester.name,
      icon: <TestTube className="h-8 w-8" />,
      price: CREDIT_PACKAGES.tester.price,
      credits: CREDIT_PACKAGES.tester.credits,
      features: [
        `${CREDIT_PACKAGES.tester.credits} كريدت`,
        "صور CGI عالية الجودة (1024x1024)",
        "فيديوهات CGI قصيرة (5 ثواني)",
        `تكلفة الصورة: ${CREDIT_COSTS.IMAGE_GENERATION} كريدت`,
        `تكلفة الفيديو: ${CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) / ${CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)`,
        `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت`,
        "دعم فني عبر الإيميل",
        "صالح لمدة 6 أشهر",
      ],
      popular: false,
    },
    {
      id: "starter",
      name: CREDIT_PACKAGES.starter.name,
      icon: <Rocket className="h-8 w-8" />,
      price: CREDIT_PACKAGES.starter.price,
      credits: CREDIT_PACKAGES.starter.credits,
      features: [
        `${CREDIT_PACKAGES.starter.credits} كريدت`,
        "صور CGI عالية الجودة (1024x1024)",
        "فيديوهات CGI قصيرة وطويلة",
        `تكلفة الصورة: ${CREDIT_COSTS.IMAGE_GENERATION} كريدت`,
        `تكلفة الفيديو: ${CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) / ${CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)`,
        `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت`,
        "دعم فني سريع",
        "صالح لمدة 6 أشهر",
      ],
      popular: false,
    },
    {
      id: "pro",
      name: CREDIT_PACKAGES.pro.name,
      icon: <Star className="h-8 w-8" />,
      price: CREDIT_PACKAGES.pro.price,
      credits: CREDIT_PACKAGES.pro.credits,
      features: [
        `${CREDIT_PACKAGES.pro.credits} كريدت (أفضل قيمة!)`,
        "صور CGI عالية الجودة (1024x1024)",
        "فيديوهات CGI بدون حدود",
        `تكلفة الصورة: ${CREDIT_COSTS.IMAGE_GENERATION} كريدت`,
        `تكلفة الفيديو: ${CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) / ${CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)`,
        `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت`,
        "أولوية في المعالجة",
        "دعم فني متقدم",
        "صالح لمدة 12 شهر",
      ],
      popular: true,
    },
    {
      id: "business",
      name: CREDIT_PACKAGES.business.name,
      icon: <Building className="h-8 w-8" />,
      price: CREDIT_PACKAGES.business.price,
      credits: CREDIT_PACKAGES.business.credits,
      features: [
        `${CREDIT_PACKAGES.business.credits} كريدت (أقصى توفير!)`,
        "صور CGI عالية الجودة (1024x1024)",
        "فيديوهات CGI بدون حدود",
        `تكلفة الصورة: ${CREDIT_COSTS.IMAGE_GENERATION} كريدت`,
        `تكلفة الفيديو: ${CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) / ${CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)`,
        `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت`,
        "معالجة فورية",
        "دعم فني مخصص",
        "صالح لمدة 12 شهر",
      ],
      popular: false,
    },
  ];

  const features = [
    { name: "عدد الكريدت", tester: `${CREDIT_PACKAGES.tester.credits}`, starter: `${CREDIT_PACKAGES.starter.credits}`, pro: `${CREDIT_PACKAGES.pro.credits}`, business: `${CREDIT_PACKAGES.business.credits}` },
    { name: "دقة الصور", tester: "1024x1024", starter: "1024x1024", pro: "1024x1024", business: "1024x1024" },
    { name: "الصور CGI", tester: `${CREDIT_COSTS.IMAGE_GENERATION} كريدت`, starter: `${CREDIT_COSTS.IMAGE_GENERATION} كريدت`, pro: `${CREDIT_COSTS.IMAGE_GENERATION} كريدت`, business: `${CREDIT_COSTS.IMAGE_GENERATION} كريدت` },
    { name: "الفيديوهات CGI (قصير)", tester: `${CREDIT_COSTS.VIDEO_SHORT} كريدت`, starter: `${CREDIT_COSTS.VIDEO_SHORT} كريدت`, pro: `${CREDIT_COSTS.VIDEO_SHORT} كريدت`, business: `${CREDIT_COSTS.VIDEO_SHORT} كريدت` },
    { name: "الفيديوهات CGI (طويل)", tester: `${CREDIT_COSTS.VIDEO_LONG} كريدت`, starter: `${CREDIT_COSTS.VIDEO_LONG} كريدت`, pro: `${CREDIT_COSTS.VIDEO_LONG} كريدت`, business: `${CREDIT_COSTS.VIDEO_LONG} كريدت` },
    { name: "إضافة الصوت", tester: `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت`, starter: `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت`, pro: `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت`, business: `+${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت` },
    { name: "دعم Pinterest", tester: true, starter: true, pro: true, business: true },
    { name: "أولوية المعالجة", tester: false, starter: false, pro: true, business: true },
    { name: "صالح لمدة", tester: "6 أشهر", starter: "6 أشهر", pro: "12 شهر", business: "12 شهر" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 glass-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-reverse space-x-4">
              <div className="text-2xl font-bold gradient-text">
                🎬 مولد CGI
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-reverse space-x-8">
              <a href="/" className="text-sm font-medium hover:text-primary transition-colors">الرئيسية</a>
              <a href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">لوحة التحكم</a>
              <a href="/pricing" className="text-sm font-medium text-primary">الأسعار</a>
            </nav>
            <div className="flex items-center space-x-reverse space-x-4">
              {isAuthenticated ? (
                <Button onClick={() => window.location.href = "/dashboard"} className="gradient-button">
                  لوحة التحكم
                </Button>
              ) : (
                <Button onClick={() => window.location.href = "/api/login"} className="gradient-button">
                  تسجيل الدخول
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="pt-20">
        {/* Pricing Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">باقات الأسعار</h2>
              <p className="text-xl text-muted-foreground mb-8">اختر الباقة المناسبة لاحتياجاتك</p>
              
              {/* Credit Packages Description */}
              <div className="text-center mb-8">
                <p className="text-lg text-muted-foreground">
                  اشتري كريدت واستخدمها متى شئت - صالحة لمدة 6-12 شهر
                </p>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              {packages.map((pkg) => (
                <Card 
                  key={pkg.id}
                  className={`glass-card relative ${pkg.popular ? "border-2 border-primary" : ""}`}
                  data-testid={`package-${pkg.id}`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 right-1/2 transform translate-x-1/2">
                      <Badge className="gradient-button">الأكثر شعبية</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 text-primary">{pkg.icon}</div>
                    <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                    <div className="text-4xl font-bold mb-2">${pkg.price}</div>
                    <p className="text-muted-foreground">لمرة واحدة</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {pkg.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchasingPackage === pkg.id}
                      className={pkg.popular ? "w-full gradient-button" : "w-full bg-secondary hover:bg-secondary/80"}
                      data-testid={`purchase-${pkg.id}`}
                    >
                      {purchasingPackage === pkg.id ? (
                        <>
                          <CreditCard className="ml-2 h-4 w-4 animate-spin" />
                          جاري المعالجة...
                        </>
                      ) : (
                        <>
                          <CreditCard className="ml-2 h-4 w-4" />
                          اختيار الباقة
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Feature Comparison Table */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-2xl text-center">مقارنة المميزات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="feature-comparison-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-4 text-right">المميزة</th>
                        <th className="p-4">{CREDIT_PACKAGES.tester.name}</th>
                        <th className="p-4">{CREDIT_PACKAGES.starter.name}</th>
                        <th className="p-4">{CREDIT_PACKAGES.pro.name}</th>
                        <th className="p-4">{CREDIT_PACKAGES.business.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((feature, index) => (
                        <tr key={index} className="border-b border-border">
                          <td className="p-4 font-medium">{feature.name}</td>
                          <td className="p-4 text-center">
                            {typeof feature.tester === "boolean" ? (
                              feature.tester ? (
                                <Check className="h-4 w-4 text-primary mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-destructive mx-auto" />
                              )
                            ) : (
                              feature.tester
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.starter === "boolean" ? (
                              feature.starter ? (
                                <Check className="h-4 w-4 text-primary mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-destructive mx-auto" />
                              )
                            ) : (
                              feature.starter
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.pro === "boolean" ? (
                              feature.pro ? (
                                <Check className="h-4 w-4 text-primary mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-destructive mx-auto" />
                              )
                            ) : (
                              feature.pro
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {typeof feature.business === "boolean" ? (
                              feature.business ? (
                                <Check className="h-4 w-4 text-primary mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-destructive mx-auto" />
                              )
                            ) : (
                              feature.business
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* FAQ Section */}
            <Card className="glass-card mt-12">
              <CardHeader>
                <CardTitle className="text-2xl text-center">الأسئلة الشائعة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium">ما هو نظام الكريدت؟</span>
                      <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <p className="mt-4 text-muted-foreground">
نظام الكريدت هو طريقة بسيطة للدفع مقابل استخدام خدمات CGI المتقدمة. كل صورة CGI تكلف ${CREDIT_COSTS.IMAGE_GENERATION} كريدت، والفيديو القصير يكلف ${CREDIT_COSTS.VIDEO_SHORT} كريدت والطويل ${CREDIT_COSTS.VIDEO_LONG} كريدت (مع إضافة ${CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت). يمكنك دمج منتجاتك في مشاهد Pinterest بذكاء اصطناعي.
                    </p>
                  </details>
                  
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium">هل تنتهي صلاحية الكريدت؟</span>
                      <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <p className="mt-4 text-muted-foreground">
الكريدت صالح لمدة 6 أشهر للباقات الصغيرة، و12 شهر للباقات الكبيرة. لا يوجد اشتراك شهري - تشتري الكريدت مرة واحدة وتستخدمه عند الحاجة.
                    </p>
                  </details>
                  
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium">ما هي أنواع الملفات المدعومة؟</span>
                      <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <p className="mt-4 text-muted-foreground">
                      ندعم جميع أنواع الصور الشائعة مثل PNG، JPG، JPEG، وWEBP. حجم الملف الأقصى هو 10 ميجابايت.
                    </p>
                  </details>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
