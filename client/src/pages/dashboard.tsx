import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import UploadZone from "@/components/upload-zone";
import ProjectCard from "@/components/project-card";
import ProgressModal from "@/components/progress-modal";
import SceneSelectionModal from "@/components/scene-selection-modal";
import { Coins, User, Plus, Image, Video, Wand2, Info, Sparkles, Edit, Camera } from "lucide-react";
import type { User as UserType, Project } from "@shared/schema";
import { CREDIT_COSTS } from "@shared/constants";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Calculate total credits needed for current project configuration
  const calculateTotalCredits = () => {
    if (projectData.contentType === "image") {
      return CREDIT_COSTS.IMAGE_GENERATION;
    } else {
      const videoCost = projectData.videoDurationSeconds <= 5 
        ? CREDIT_COSTS.VIDEO_SHORT 
        : CREDIT_COSTS.VIDEO_LONG;
      const audioCost = projectData.includeAudio ? CREDIT_COSTS.AUDIO_SURCHARGE : 0;
      return videoCost + audioCost;
    }
  };
  const [activeTab, setActiveTab] = useState("new-project");
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [projectData, setProjectData] = useState({
    title: "",
    description: "",
    productImageUrl: "",
    sceneImageUrl: "",
    sceneVideoUrl: "",
    contentType: "image" as "image" | "video",
    videoDurationSeconds: 5,
    resolution: "1920x1080",
    quality: "standard",
    includeAudio: false
  });
  
  // Track upload status separately for validation
  const [isProductImageUploaded, setIsProductImageUploaded] = useState(false);
  const [isSceneImageUploaded, setIsSceneImageUploaded] = useState(false);
  
  // Track reset key to force UploadZone preview reset
  const [resetKey, setResetKey] = useState<string>("");
  const [showSceneSelector, setShowSceneSelector] = useState(false);

  const { data: userData } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    retry: false,
  });

  // Query for actual costs data
  const { data: costsData, isLoading: costsLoading } = useQuery<{
    totalCostMillicents: number;
    totalCostUSD: string;
    breakdown: {
      totalProjects: number;
      imageProjects: number; 
      videoProjects: number;
      estimatedImageCost: number;
      estimatedVideoCost: number;
    };
    projects: Array<{
      id: string;
      title: string;
      contentType: string;
      status: string;
      actualCostMillicents: number;
      actualCostUSD: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/actual-costs"],
    retry: false,
  });

  // Use separate useEffect for polling logic - ONLY when needed
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    
    const hasProcessingProjects = projects.some((project: Project) => 
      project.status && ["pending", "processing", "enhancing_prompt", "generating_image", "generating_video"].includes(project.status)
    );
    
    console.log('🔍 Checking polling status:', {
      projectsCount: projects.length,
      hasProcessingProjects,
      processingStatuses: projects.filter(p => p.status && ["pending", "processing", "enhancing_prompt", "generating_image", "generating_video"].includes(p.status)).map(p => ({ id: p.id, status: p.status }))
    });
    
    if (hasProcessingProjects) {
      console.log('🔄 Starting polling for processing projects...');
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/actual-costs"] });
      }, 5000); // Increase to 5 seconds to reduce load
      return () => {
        console.log('⏹️ Stopping polling - no more processing projects');
        clearInterval(interval);
      };
    } else {
      console.log('✅ No processing projects - polling disabled');
    }
  }, [projects, queryClient]);

  const uploadProductImageMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('productImage', file);
      
      // Upload the file directly using FormData
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      
      return response.json();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "تم تسجيل الخروج. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في رفع صورة المنتج",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Combined scene upload mutation for both image and video
  const uploadSceneMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('productImage', file);
      
      // Upload the file directly using FormData
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      
      return response.json();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "تم تسجيل الخروج. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في رفع صورة المشهد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof projectData) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: (data) => {
      console.log("🎉 Project creation SUCCESS! Data:", data);
      console.log("🚀 About to show modal and switch tabs...");
      
      toast({
        title: "تم إنشاء المشروع",
        description: "بدأت معالجة مشروع CGI الخاص بك",
      });
      
      // 🚀 Auto-navigate to projects tab with clear visual feedback
      console.log("📍 Switching to my-projects tab...");
      setActiveTab("my-projects");
      
      // Show immediate toast feedback to user
      toast({
        title: "تم إنشاء المشروع ✅",
        description: "سيتم عرض التقدم في تاب 'مشاريعي'",
        duration: 3000,
      });
      
      // Scroll to tabs immediately and add longer delay for modal
      const tabsContainer = document.querySelector('[role="tablist"]');
      if (tabsContainer) {
        tabsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      // Longer delay to ensure user sees the tab switch before modal appears
      setTimeout(() => {
        console.log("🔄 Showing progress modal after tab switch...");
        setShowProgressModal(true);
      }, 800);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Reset form
      setProjectData({
        title: "",
        description: "",
        productImageUrl: "",
        sceneImageUrl: "",
        sceneVideoUrl: "",
        contentType: "image",
        videoDurationSeconds: 5,
        resolution: "1920x1080",
        quality: "standard",
        includeAudio: false
      });
      setIsProductImageUploaded(false);
      setIsSceneImageUploaded(false);
      
      // Generate new reset key to clear UploadZone previews
      setResetKey(Date.now().toString());
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "تم تسجيل الخروج. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في إنشاء المشروع",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "غير مخول",
        description: "تم تسجيل الخروج. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, authLoading, toast]);

  const handleLogout = () => {
    // Clear JWT token from localStorage
    localStorage.removeItem('auth_token');
    // Clear any cached user data
    queryClient.clear();
    // Force page reload to home after clearing everything
    window.location.href = "/";
  };

  const handleProductImageUpload = async (file: File) => {
    try {
      const result = await uploadProductImageMutation.mutateAsync(file);
      setProjectData(prev => ({ ...prev, productImageUrl: result.url }));
      setIsProductImageUploaded(true);
      toast({
        title: "تم رفع الصورة",
        description: "تم رفع صورة المنتج بنجاح",
      });
    } catch (error) {
      setProjectData(prev => ({ ...prev, productImageUrl: "" }));
      setIsProductImageUploaded(false);
      // Clear preview on error
      setResetKey(Date.now().toString());
    }
  };

  const handleSceneImageUpload = async (file: File) => {
    try {
      const result = await uploadSceneMutation.mutateAsync(file);
      setProjectData(prev => ({ ...prev, sceneImageUrl: result.url }));
      setIsSceneImageUploaded(true);
      toast({
        title: "تم رفع الصورة",
        description: "تم رفع صورة المشهد بنجاح",
      });
    } catch (error) {
      setProjectData(prev => ({ ...prev, sceneImageUrl: "" }));
      setIsSceneImageUploaded(false);
      // Clear preview on error
      setResetKey(Date.now().toString());
    }
  };

  const handleSceneUpload = async (file: File) => {
    try {
      const result = await uploadSceneMutation.mutateAsync(file);
      
      // Store in appropriate field based on file type
      if (file.type.startsWith('video/')) {
        setProjectData(prev => ({ 
          ...prev, 
          sceneVideoUrl: result.url,
          sceneImageUrl: "" // Clear image URL if video is uploaded
        }));
      } else {
        setProjectData(prev => ({ 
          ...prev, 
          sceneImageUrl: result.url,
          sceneVideoUrl: "" // Clear video URL if image is uploaded
        }));
      }
      
      setIsSceneImageUploaded(true);
      toast({
        title: "تم رفع الملف",
        description: `تم رفع ${file.type.startsWith('video/') ? 'فيديو' : 'صورة'} المشهد بنجاح`,
      });
    } catch (error) {
      setProjectData(prev => ({ 
        ...prev, 
        sceneImageUrl: "", 
        sceneVideoUrl: ""
      }));
      setIsSceneImageUploaded(false);
      // Clear preview on error
      setResetKey(Date.now().toString());
    }
  };

  // Handle scene selection from modal
  const handleSceneSelection = (scene: any, productSize: 'normal' | 'emphasized' = 'normal') => {
    console.log('🎬 Scene selected from modal:', { scene, productSize });
    
    // Update project data with selected scene and product size
    setProjectData(prev => ({
      ...prev,
      sceneImageUrl: scene.imageUrl,
      sceneVideoUrl: "", // Clear video URL when scene image is selected
      productSize: productSize // Store product size preference
    }));
    
    setIsSceneImageUploaded(true);
    
    // Show success toast
    const sizeText = productSize === 'emphasized' ? 'مُبرز وبارز' : 'مناسب للغرفة';
    toast({
      title: "تم اختيار المشهد",
      description: `تم اختيار "${scene.name || scene.title}" بحجم ${sizeText}`,
    });

    // Close the modal
    setShowSceneSelector(false);
  };

  const handleCreateProject = () => {
    // Debug: Log current project data before validation
    console.log("🔍 Frontend projectData before submission:", JSON.stringify(projectData, null, 2));
    
    if (!projectData.title.trim()) {
      toast({
        title: "عنوان مطلوب",
        description: "يرجى إدخال عنوان للمشروع",
        variant: "destructive",
      });
      return;
    }

    const hasSceneFile = projectData.sceneImageUrl || projectData.sceneVideoUrl;
    if (!projectData.productImageUrl || !hasSceneFile) {
      toast({
        title: "ملفات مطلوبة",
        description: "يرجى رفع صورة المنتج وملف المشهد (صورة أو فيديو)",
        variant: "destructive",
      });
      return;
    }

    const creditsNeeded = calculateTotalCredits();
    if (userData && userData.credits < creditsNeeded) {
      toast({
        title: "كريدت غير كافي",
        description: `تحتاج إلى ${creditsNeeded} كريدت لهذا المشروع`,
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate(projectData);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

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
              <a href="#home" className="text-sm font-medium hover:text-primary transition-colors">الرئيسية</a>
              <a href="#dashboard" className="text-sm font-medium text-primary">لوحة التحكم</a>
              <a href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">الأسعار</a>
            </nav>
            <div className="flex items-center space-x-reverse space-x-4">
              <Badge className="credit-badge px-3 py-1 rounded-full text-sm font-bold text-white">
                <Coins className="ml-2 h-4 w-4" />
                <span data-testid="user-credits">{userData?.credits || 0}</span> كريدت
              </Badge>
              <Button 
                onClick={() => window.location.href = "/admin"}
                variant="outline" 
                className="glass-card text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10" 
                data-testid="admin-button"
              >
                <Wand2 className="ml-2 h-4 w-4" />
                لوحة الأدمن
              </Button>
              <Button onClick={handleLogout} variant="outline" className="glass-card" data-testid="logout-button">
                <User className="ml-2 h-4 w-4" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-20">
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">لوحة التحكم</h2>
              <p className="text-xl text-muted-foreground">أنشئ مشروع CGI جديد أو تابع مشاريعك السابقة</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 glass-card p-1">
                <TabsTrigger value="new-project" className="data-[state=active]:gradient-button">
                  <Plus className="ml-2 h-4 w-4" />
                  مشروع جديد
                </TabsTrigger>
                <TabsTrigger value="my-projects" className="data-[state=active]:gradient-button">
                  مشاريعي
                </TabsTrigger>
                <TabsTrigger value="actual-costs" className="data-[state=active]:gradient-button">
                  <Coins className="ml-2 h-4 w-4" />
                  التكاليف الفعلية
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-project" className="mt-8">
                <div className="grid lg:grid-cols-2 gap-8 mb-12">
                  {/* Upload Section */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-2xl">رفع الصور</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {/* Product Image Section */}
                      <div className="space-y-4">
                        <Label className="block text-lg font-semibold text-primary mb-4">
                          📸 صورة المنتج
                        </Label>
                        
                        {!projectData.productImageUrl ? (
                          <UploadZone
                            onFileUpload={handleProductImageUpload}
                            isUploading={uploadProductImageMutation.isPending}
                            previewUrl={projectData.productImageUrl}
                            label="اسحب وأفلت صورة المنتج هنا"
                            sublabel="أو انقر للتصفح - PNG, JPG حتى 10MB"
                            testId="product-upload-zone"
                            resetKey={resetKey}
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="relative group">
                              <img 
                                src={projectData.productImageUrl} 
                                alt="صورة المنتج" 
                                className="w-full h-40 object-cover rounded-lg border border-border"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                                <Button
                                  onClick={() => {
                                    setProjectData(prev => ({ ...prev, productImageUrl: "" }));
                                    setIsProductImageUploaded(false);
                                    setResetKey(Date.now().toString());
                                  }}
                                  className="bg-primary/90 hover:bg-primary text-white"
                                  size="sm"
                                  data-testid="edit-product-image"
                                >
                                  <Wand2 className="ml-2 h-4 w-4" />
                                  تعديل الصورة
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scene Image Section - Only show after product image is uploaded */}
                      {projectData.productImageUrl && (
                        <div className="space-y-6 pt-6 border-t border-border/20">
                          <Label className="block text-lg font-semibold text-primary mb-4">
                            🎬 صورة المشهد
                          </Label>
                          
                          {/* Scene Image Display or Selection */}
                          <div className="space-y-4">
                            {!projectData.sceneImageUrl && !projectData.sceneVideoUrl ? (
                              <>
                                {/* Library Selection Button */}
                                <div 
                                  onClick={() => setShowSceneSelector(true)}
                                  className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 bg-gradient-to-br from-primary/5 to-accent/5 hover:from-primary/10 hover:to-accent/10 transition-all duration-300 p-6"
                                  data-testid="scene-library-button"
                                >
                                  <div className="text-center space-y-3">
                                    <div className="relative mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                                      <Sparkles className="h-8 w-8 text-white" />
                                    </div>
                                    <div>
                                      <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors duration-300">
                                        اختيار من المكتبة
                                      </h3>
                                      <p className="text-sm text-muted-foreground mt-2">
                                        مجموعة مذهلة من المشاهد الجاهزة المصممة خصيصاً لمنتجك
                                      </p>
                                    </div>
                                    <Badge className="bg-primary/20 text-primary border-0 px-4 py-1 text-sm font-medium">
                                      مدعوم بالذكاء الاصطناعي ✨
                                    </Badge>
                                  </div>
                                </div>

                                {/* OR Divider */}
                                <div className="relative py-4">
                                  <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border/40"></span>
                                  </div>
                                  <div className="relative flex justify-center text-sm">
                                    <span className="bg-background px-4 text-muted-foreground font-medium">أو</span>
                                  </div>
                                </div>

                                {/* Custom Upload Zone */}
                                <div className="space-y-2">
                                  <UploadZone
                                    onFileUpload={handleSceneUpload}
                                    isUploading={uploadSceneMutation.isPending}
                                    previewUrl=""
                                    label={projectData.contentType === "video" ? 
                                      "اسحب وأفلت صورة أو فيديو المشهد الخاص بك هنا" : 
                                      "اسحب وأفلت صورة المشهد الخاص بك هنا"
                                    }
                                    sublabel={projectData.contentType === "video" ? 
                                      "أو انقر للتصفح - صور حتى 10MB، فيديو حتى 50MB" : 
                                      "أو انقر للتصفح - PNG, JPG حتى 10MB"
                                    }
                                    testId="scene-upload-zone"
                                    resetKey={resetKey}
                                    acceptedTypes={projectData.contentType === "video" ? "both" : "image"}
                                  />
                                </div>
                              </>
                            ) : (
                              /* Selected Scene Display */
                              <div className="space-y-3">
                                <div className="relative group">
                                  <img 
                                    src={projectData.contentType === "video" ? 
                                      (projectData.sceneVideoUrl || projectData.sceneImageUrl) : 
                                      projectData.sceneImageUrl
                                    } 
                                    alt="صورة المشهد" 
                                    className="w-full h-48 object-cover rounded-lg border border-border"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => setShowSceneSelector(true)}
                                        className="bg-primary/90 hover:bg-primary text-white"
                                        size="sm"
                                        data-testid="change-scene-button"
                                      >
                                        <Sparkles className="ml-2 h-4 w-4" />
                                        تغيير المشهد
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setProjectData(prev => ({ 
                                            ...prev, 
                                            sceneImageUrl: "", 
                                            sceneVideoUrl: "" 
                                          }));
                                          setIsSceneImageUploaded(false);
                                          setResetKey(Date.now().toString());
                                        }}
                                        variant="outline"
                                        className="bg-background/90 hover:bg-background text-foreground border-white/20"
                                        size="sm"
                                        data-testid="remove-scene-button"
                                      >
                                        <Camera className="ml-2 h-4 w-4" />
                                        رفع مخصوص
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Helper message when no product image */}
                      {!projectData.productImageUrl && (
                        <div className="text-center py-8 border border-dashed border-muted-foreground/30 rounded-xl bg-muted/20">
                          <div className="space-y-3">
                            <div className="w-16 h-16 mx-auto bg-muted-foreground/10 rounded-full flex items-center justify-center">
                              <Camera className="h-8 w-8 text-muted-foreground/60" />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                ابدأ برفع صورة المنتج
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                سنقوم بتحليل المنتج واقتراح المشاهد المناسبة تلقائياً
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Project Settings */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-2xl">إعدادات المشروع</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Project Title */}
                      <div>
                        <Label htmlFor="title">عنوان المشروع</Label>
                        <Input
                          id="title"
                          value={projectData.title}
                          onChange={(e) => setProjectData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="اكتب عنوان المشروع..."
                          className="bg-input border-border"
                          data-testid="project-title-input"
                        />
                      </div>

                      {/* Content Type Selection */}
                      <div>
                        <Label className="block text-sm font-medium mb-4">نوع المحتوى</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <Card 
                            className={`cursor-pointer transition-all hover:bg-white/10 ${
                              projectData.contentType === "image" ? "ring-2 ring-primary" : ""
                            }`}
                            onClick={() => setProjectData(prev => ({ ...prev, contentType: "image" }))}
                            data-testid="image-type-card"
                          >
                            <CardContent className="p-6 text-center">
                              <Image className="h-8 w-8 mx-auto mb-3 text-primary" />
                              <h4 className="font-bold mb-2">صورة CGI</h4>
                              <p className="text-sm text-muted-foreground mb-2">{CREDIT_COSTS.IMAGE_GENERATION} كريدت</p>
                              <Badge variant="outline" className="text-xs">صورة واحدة</Badge>
                            </CardContent>
                          </Card>
                          <Card 
                            className={`cursor-pointer transition-all hover:bg-white/10 ${
                              projectData.contentType === "video" ? "ring-2 ring-primary" : ""
                            }`}
                            onClick={() => {
                              console.log("🎬 User clicked video card, changing contentType to video");
                              setProjectData(prev => ({ ...prev, contentType: "video" }));
                            }}
                            data-testid="video-type-card"
                          >
                            <CardContent className="p-6 text-center">
                              <Video className="h-8 w-8 mx-auto mb-3 text-accent" />
                              <h4 className="font-bold mb-2">فيديو CGI</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                {CREDIT_COSTS.VIDEO_SHORT} كريدت (قصير) / {CREDIT_COSTS.VIDEO_LONG} كريدت (طويل)
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">
                                +{CREDIT_COSTS.AUDIO_SURCHARGE} كريدت للصوت
                              </p>
                              <Badge variant="outline" className="text-xs">
                                فيديو واحد
                              </Badge>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Video Duration Selection - Only show for video content */}
                      {projectData.contentType === "video" && (
                        <div>
                          <Label className="block text-sm font-medium mb-4">مدة الفيديو</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <Card 
                              className={`cursor-pointer transition-all hover:bg-white/10 ${
                                projectData.videoDurationSeconds === 5 ? "ring-2 ring-primary" : ""
                              }`}
                              onClick={() => setProjectData(prev => ({ ...prev, videoDurationSeconds: 5 }))}
                              data-testid="duration-5s-card"
                            >
                              <CardContent className="p-4 text-center">
                                <h4 className="font-medium mb-2">5 ثوانٍ</h4>
                                <Badge variant="secondary" className="mb-2">{CREDIT_COSTS.VIDEO_SHORT} كريدت</Badge>
                                <p className="text-xs text-muted-foreground">سريع ومؤثر</p>
                              </CardContent>
                            </Card>
                            <Card 
                              className={`cursor-pointer transition-all hover:bg-white/10 ${
                                projectData.videoDurationSeconds === 10 ? "ring-2 ring-primary" : ""
                              }`}
                              onClick={() => setProjectData(prev => ({ ...prev, videoDurationSeconds: 10 }))}
                              data-testid="duration-10s-card"
                            >
                              <CardContent className="p-4 text-center">
                                <h4 className="font-medium mb-2">10 ثوانٍ</h4>
                                <Badge variant="secondary" className="mb-2">{CREDIT_COSTS.VIDEO_LONG} كريدت</Badge>
                                <p className="text-xs text-muted-foreground">تفصيل أكثر</p>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      )}

                      {/* Audio Settings - Only show for video content */}
                      {projectData.contentType === "video" && (
                        <div>
                          <Label className="block text-sm font-medium mb-4">إعدادات الصوت</Label>
                          <div className="flex items-center space-x-3 space-x-reverse">
                            <Checkbox
                              id="includeAudio"
                              checked={projectData.includeAudio}
                              onCheckedChange={(checked) => 
                                setProjectData(prev => ({ ...prev, includeAudio: !!checked }))
                              }
                              data-testid="include-audio-checkbox"
                            />
                            <Label htmlFor="includeAudio" className="flex items-center gap-2 cursor-pointer">
                              <span>إضافة صوت للفيديو</span>
                              <Badge variant="outline" className="text-xs">
                                +{CREDIT_COSTS.AUDIO_SURCHARGE} كريدت
                              </Badge>
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            يتم إضافة صوت تلقائي مناسب للمشهد
                          </p>
                        </div>
                      )}

                      {/* Project Description */}
                      <div>
                        <Label htmlFor="description">تحسين دمج الصور (اختياري)</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          اكتب وصف يساعد الذكي الاصطناعي في دمج المنتج بشكل أفضل مع المشهد المختار
                        </p>
                        <Textarea
                          id="description"
                          value={projectData.description}
                          onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                          rows={4}
                          placeholder="مثال: منتج فاخر، إضاءة طبيعية، ألوان دافئة، نمط عصري..."
                          className="bg-input border-border"
                          data-testid="project-description-input"
                        />
                      </div>

                      {/* Advanced Settings */}
                      <details className="group">
                        <summary className="text-sm font-medium cursor-pointer mb-4 list-none flex items-center">
                          <span>إعدادات متقدمة</span>
                          <svg className="w-4 h-4 mr-2 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </summary>
                        <div className="space-y-4 pr-4">
                          <div>
                            <Label htmlFor="resolution">دقة الإخراج</Label>
                            <Select
                              value={projectData.resolution}
                              onValueChange={(value) => setProjectData(prev => ({ ...prev, resolution: value }))}
                            >
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1024x1024">1024 × 1024 (مربع)</SelectItem>
                                <SelectItem value="1920x1080">1920 × 1080 (أفقي)</SelectItem>
                                <SelectItem value="1080x1920">1080 × 1920 (رأسي)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="quality">جودة المعالجة</Label>
                            <Select
                              value={projectData.quality}
                              onValueChange={(value) => setProjectData(prev => ({ ...prev, quality: value }))}
                            >
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">عادية (أسرع)</SelectItem>
                                <SelectItem value="high">عالية (أبطأ)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </details>

                      {/* Credit Cost Summary */}
                      <div className="bg-muted/50 rounded-lg p-4 border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-primary" />
                            <span className="font-medium">إجمالي التكلفة:</span>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {calculateTotalCredits()} كريدت
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {projectData.contentType === "image" ? (
                            "صورة CGI واحدة"
                          ) : (
                            <div className="space-y-1">
                              <div>فيديو CGI ({projectData.videoDurationSeconds} ثوانٍ)</div>
                              {projectData.includeAudio && <div>+ صوت تلقائي</div>}
                            </div>
                          )}
                        </div>
                        {userData && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">رصيدك الحالي: </span>
                            <span className={userData.credits >= calculateTotalCredits() ? "text-green-600" : "text-red-600"}>
                              {userData.credits} كريدت
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Generate Button */}
                      <Button 
                        onClick={handleCreateProject}
                        disabled={createProjectMutation.isPending || !projectData.title || !isProductImageUploaded || !isSceneImageUploaded || (userData && userData.credits < calculateTotalCredits())}
                        className="w-full gradient-button"
                        size="lg"
                        data-testid="generate-cgi-button"
                      >
                        <Wand2 className="ml-2 h-5 w-5" />
                        {createProjectMutation.isPending ? "جاري الإنشاء..." : "ابدأ إنتاج CGI"}
                      </Button>
                      
                      {/* Credit Warning */}
                      <Card className="bg-accent/10 border-accent/20">
                        <CardContent className="p-4">
                          <p className="text-sm text-accent-foreground flex items-center">
                            <Info className="ml-2 h-4 w-4" />
                            سيتم خصم الكريدت بعد نجاح المعالجة فقط
                          </p>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="my-projects" className="mt-8">
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl">مشاريعي</CardTitle>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-48 bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع المشاريع</SelectItem>
                          <SelectItem value="processing">قيد المعالجة</SelectItem>
                          <SelectItem value="completed">مكتملة</SelectItem>
                          <SelectItem value="failed">فاشلة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {projectsLoading ? (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="glass-card p-6 rounded-xl animate-pulse">
                            <div className="h-4 bg-muted rounded mb-4"></div>
                            <div className="h-32 bg-muted rounded mb-4"></div>
                            <div className="h-3 bg-muted rounded mb-2"></div>
                            <div className="h-3 bg-muted rounded w-2/3"></div>
                          </div>
                        ))}
                      </div>
                    ) : projects && projects.length > 0 ? (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
                        {projects.map((project) => (
                          <ProjectCard key={project.id} project={project} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12" data-testid="empty-projects">
                        <div className="text-6xl mb-4">📁</div>
                        <h3 className="text-xl font-bold mb-2">لا توجد مشاريع بعد</h3>
                        <p className="text-muted-foreground mb-6">ابدأ بإنشاء مشروع CGI جديد</p>
                        <Button 
                          onClick={() => setActiveTab("new-project")}
                          className="gradient-button"
                          data-testid="create-first-project-button"
                        >
                          <Plus className="ml-2 h-4 w-4" />
                          إنشاء مشروع جديد
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="actual-costs" className="mt-8">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-2xl">التكاليف الفعلية</CardTitle>
                    <p className="text-muted-foreground">تتبع التكلفة الحقيقية لاستخدام خدمات الذكاء الاصطناعي</p>
                  </CardHeader>
                  <CardContent>
                    {costsLoading ? (
                      <div className="animate-pulse">
                        <div className="h-6 bg-muted rounded mb-4 w-1/3"></div>
                        <div className="h-4 bg-muted rounded mb-6 w-1/2"></div>
                        <div className="grid md:grid-cols-3 gap-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card p-4 rounded-xl">
                              <div className="h-4 bg-muted rounded mb-2"></div>
                              <div className="h-6 bg-muted rounded"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : costsData ? (
                      <div className="space-y-6" data-testid="costs-data">
                        {/* Total Cost Summary */}
                        <div className="text-center p-6 glass-card rounded-xl border border-green-500/20">
                          <div className="text-sm text-muted-foreground mb-1">إجمالي التكلفة الفعلية</div>
                          <div className="text-3xl font-bold text-green-400" data-testid="total-cost-usd">
                            ${costsData.totalCostUSD}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ({costsData.totalCostMillicents} millicents)
                          </div>
                        </div>

                        {/* Breakdown Cards */}
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="glass-card p-4 rounded-xl">
                            <div className="text-sm text-muted-foreground mb-1">إجمالي المشاريع</div>
                            <div className="text-xl font-bold" data-testid="total-projects">{costsData.breakdown.totalProjects}</div>
                          </div>
                          <div className="glass-card p-4 rounded-xl">
                            <div className="text-sm text-muted-foreground mb-1">مشاريع الصور</div>
                            <div className="text-xl font-bold text-blue-400" data-testid="image-projects">
                              <Image className="inline ml-1 h-4 w-4" />
                              {costsData.breakdown.imageProjects}
                            </div>
                          </div>
                          <div className="glass-card p-4 rounded-xl">
                            <div className="text-sm text-muted-foreground mb-1">مشاريع الفيديو</div>
                            <div className="text-xl font-bold text-purple-400" data-testid="video-projects">
                              <Video className="inline ml-1 h-4 w-4" />
                              {costsData.breakdown.videoProjects}
                            </div>
                          </div>
                        </div>

                        {/* Project Details */}
                        {costsData.projects && costsData.projects.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">تفاصيل تكلفة المشاريع</h3>
                            <div className="space-y-3">
                              {costsData.projects.map((project) => (
                                <div key={project.id} className="glass-card p-4 rounded-xl flex justify-between items-center">
                                  <div className="flex items-center space-x-reverse space-x-3">
                                    {project.contentType === 'image' ? 
                                      <Image className="h-5 w-5 text-blue-400" /> : 
                                      <Video className="h-5 w-5 text-purple-400" />
                                    }
                                    <div>
                                      <div className="font-medium" data-testid={`project-title-${project.id}`}>
                                        {project.title}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {project.status} • {new Date(project.createdAt).toLocaleDateString('ar-EG')}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <div className="font-bold text-green-400" data-testid={`project-cost-${project.id}`}>
                                      ${project.actualCostUSD}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {project.actualCostMillicents} millicents
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12" data-testid="empty-costs">
                        <div className="text-6xl mb-4">💰</div>
                        <h3 className="text-xl font-bold mb-2">لا توجد تكاليف بعد</h3>
                        <p className="text-muted-foreground mb-6">ابدأ بإنشاء مشروع لتتبع التكاليف الفعلية</p>
                        <Button 
                          onClick={() => setActiveTab("new-project")}
                          className="gradient-button"
                          data-testid="create-project-for-costs-button"
                        >
                          <Plus className="ml-2 h-4 w-4" />
                          إنشاء مشروع جديد
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>

      {/* Progress Modal */}
      {showProgressModal && (
        <ProgressModal 
          isOpen={showProgressModal}
          onClose={() => setShowProgressModal(false)}
        />
      )}

      {/* Scene Selection Modal */}
      <SceneSelectionModal
        isOpen={showSceneSelector}
        onClose={() => setShowSceneSelector(false)}
        onSceneSelect={handleSceneSelection}
        productImageUrl={projectData.productImageUrl}
        productType="أثاث" // TODO: Extract product type from analysis
      />
    </div>
  );
}
