import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  FolderOpen, 
  CreditCard, 
  TrendingUp, 
  Crown, 
  Activity,
  Calendar,
  DollarSign,
  Play,
  Plus,
  Minus,
  History,
  Eye,
  Edit
} from "lucide-react";
import type { User as UserType, Project } from "@shared/schema";
import { Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface PlatformStats {
  totalUsers: number;
  totalProjects: number; 
  completedProjects: number;
  totalTransactions: number;
}

interface UserTransaction {
  id: number;
  amount: number;
  credits: number;
  status: string;
  processedAt: string;
  stripePaymentIntentId: string;
}

interface UserDetails {
  user: {
    id: number;
    email: string;
    currentCredits: number;
    isAdmin: boolean;
  };
  transactions: UserTransaction[];
  projects: any[];
  summary: {
    totalTransactions: number;
    totalCreditsSpent: number;
    totalProjects: number;
    completedProjects: number;
  };
}

// Credit Management Schema
const creditManagementSchema = z.object({
  action: z.enum(["add", "subtract"], {
    required_error: "يجب اختيار نوع العملية",
  }),
  amount: z.coerce.number({
    required_error: "كمية الكريديت مطلوبة",
    invalid_type_error: "يجب أن تكون كمية الكريديت رقم صحيح",
  }).min(1, "يجب أن تكون كمية الكريديت أكبر من صفر").max(1000, "الحد الأقصى 1000 كريديت"),
  reason: z.string().optional(),
});

type CreditManagementForm = z.infer<typeof creditManagementSchema>;

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Credit management state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);

  // Credit management form
  const creditForm = useForm<CreditManagementForm>({
    resolver: zodResolver(creditManagementSchema),
    defaultValues: {
      action: "add",
      amount: 1,
      reason: "",
    },
  });

  // Become admin mutation
  const becomeAdminMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/make-admin");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "أصبحت أدمن",
        description: "تم منحك صلاحيات الإدارة بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Admin data queries
  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!(user as UserType & { isAdmin?: boolean })?.isAdmin,
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/admin/projects"],
    enabled: !!(user as UserType & { isAdmin?: boolean })?.isAdmin,
  });

  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!(user as UserType & { isAdmin?: boolean })?.isAdmin,
  });

  // User details query (for selected user)
  const { data: userDetails } = useQuery<UserDetails>({
    queryKey: ["/api/admin/users", selectedUserId, "transactions"],
    enabled: !!(user as UserType & { isAdmin?: boolean })?.isAdmin && !!selectedUserId,
  });

  // Credit management mutation
  const creditManagementMutation = useMutation({
    mutationFn: async ({ userId, formData }: {
      userId: number;
      formData: CreditManagementForm;
    }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/credits`, {
        amount: formData.amount,
        action: formData.action,
        reason: formData.reason || "",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم بنجاح",
        description: `تم ${data.user.action === 'add' ? 'إضافة' : 'خصم'} ${data.user.amount} كريديت بنجاح`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowCreditModal(false);
      creditForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إدارة الكريديت",
        description: error.message || "فشل في تحديث الكريديت",
        variant: "destructive",
      });
    },
  });

  // Handle credit management form submission
  const onCreditSubmit = (data: CreditManagementForm) => {
    if (selectedUserId) {
      creditManagementMutation.mutate({
        userId: selectedUserId,
        formData: data,
      });
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "غير محدد";
    return new Date(date).toLocaleDateString("ar-EG");
  };

  if (!user) {
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
                🛡️ لوحة تحكم الأدمن
              </div>
            </div>
            <div className="flex items-center space-x-reverse space-x-4">
              <Badge className="credit-badge px-3 py-1 rounded-full text-sm font-bold text-white">
                <Crown className="ml-2 h-4 w-4" />
                {(user as UserType & { isAdmin?: boolean })?.isAdmin ? "أدمن" : "مستخدم"}
              </Badge>
              <Link href="/">
                <Button 
                  variant="outline" 
                  className="glass-card"
                  data-testid="back-to-dashboard"
                >
                  العودة للوحة الرئيسية
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-20">
        <section className="py-12">
          <div className="container mx-auto px-4">
            {!(user as UserType & { isAdmin?: boolean })?.isAdmin ? (
              // Non-admin view - access denied
              <div className="text-center">
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-3xl font-bold mb-4">منطقة الأدمن</h2>
                <p className="text-xl text-muted-foreground mb-8">
                  تحتاج صلاحيات الأدمن للوصول لهذه الصفحة
                </p>
                <p className="text-muted-foreground">
                  يرجى التواصل مع المدير للحصول على صلاحيات الأدمن
                </p>
                {/* Only show make-admin button in development */}
                {import.meta.env.DEV && (
                  <>
                    <Button 
                      onClick={() => becomeAdminMutation.mutate()}
                      disabled={becomeAdminMutation.isPending}
                      className="gradient-button mt-4"
                      size="lg"
                      data-testid="become-admin-button"
                    >
                      <Crown className="ml-2 h-5 w-5" />
                      {becomeAdminMutation.isPending ? "جاري المعالجة..." : "اجعلني أدمن"}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      (للتطوير فقط - مخفي في الإنتاج)
                    </p>
                  </>
                )}
              </div>
            ) : (
              // Admin view - show dashboard
              <>
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-bold mb-4">لوحة تحكم الأدمن</h2>
                  <p className="text-xl text-muted-foreground">مراقبة وإدارة منصة مولد CGI</p>
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">إجمالي المستخدمين</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="total-users">
                        {platformStats?.totalUsers || 0}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">إجمالي المشاريع</CardTitle>
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="total-projects">
                        {platformStats?.totalProjects || 0}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">المشاريع المكتملة</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="completed-projects">
                        {platformStats?.completedProjects || 0}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">المعاملات المالية</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="total-transactions">
                        {platformStats?.totalTransactions || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Data Tables */}
                <Tabs defaultValue="users" className="w-full">
                  <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 glass-card p-1">
                    <TabsTrigger value="users" className="data-[state=active]:gradient-button">
                      <Users className="ml-2 h-4 w-4" />
                      المستخدمين
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="data-[state=active]:gradient-button">
                      <FolderOpen className="ml-2 h-4 w-4" />
                      المشاريع
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="users" className="mt-8">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="text-2xl">جميع المستخدمين</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-right py-3">البريد الإلكتروني</th>
                                <th className="text-right py-3">الاسم</th>
                                <th className="text-right py-3">الكريديت</th>
                                <th className="text-right py-3">أدمن</th>
                                <th className="text-right py-3">تاريخ التسجيل</th>
                                <th className="text-right py-3">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allUsers?.map((user) => (
                                <tr key={user.id} className="border-b border-white/5">
                                  <td className="py-3" data-testid={`user-email-${user.id}`}>
                                    {user.email}
                                  </td>
                                  <td className="py-3">
                                    {user.firstName} {user.lastName}
                                  </td>
                                  <td className="py-3">
                                    <Badge variant="outline">{user.credits}</Badge>
                                  </td>
                                  <td className="py-3">
                                    {(user as UserType & { isAdmin?: boolean })?.isAdmin ? (
                                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">أدمن</Badge>
                                    ) : (
                                      <Badge variant="secondary">مستخدم</Badge>
                                    )}
                                  </td>
                                  <td className="py-3">{formatDate(user.createdAt)}</td>
                                  <td className="py-3">
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedUserId(user.id);
                                          setShowUserDetailsModal(true);
                                        }}
                                        data-testid={`view-user-${user.id}`}
                                        title="عرض تفاصيل المستخدم"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedUserId(user.id);
                                          creditForm.reset({ action: "add", amount: 1, reason: "" });
                                          setShowCreditModal(true);
                                        }}
                                        data-testid={`add-credit-${user.id}`}
                                        title="إضافة كريديت"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedUserId(user.id);
                                          creditForm.reset({ action: "subtract", amount: 1, reason: "" });
                                          setShowCreditModal(true);
                                        }}
                                        data-testid={`subtract-credit-${user.id}`}
                                        title="خصم كريديت"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="projects" className="mt-8">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="text-2xl">جميع المشاريع</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-right py-3">العنوان</th>
                                <th className="text-right py-3">النوع</th>
                                <th className="text-right py-3">الحالة</th>
                                <th className="text-right py-3">المستخدم</th>
                                <th className="text-right py-3">الكريديت المستخدم</th>
                                <th className="text-right py-3">التاريخ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allProjects?.map((project) => (
                                <tr key={project.id} className="border-b border-white/5">
                                  <td className="py-3" data-testid={`project-title-${project.id}`}>
                                    {project.title}
                                  </td>
                                  <td className="py-3">
                                    <Badge variant="outline">
                                      {project.contentType === "video" ? "فيديو" : "صورة"}
                                    </Badge>
                                  </td>
                                  <td className="py-3">
                                    <Badge 
                                      className={
                                        project.status === "completed" 
                                          ? "bg-gradient-to-r from-green-500 to-blue-500"
                                          : project.status === "failed"
                                          ? "bg-gradient-to-r from-red-500 to-pink-500"
                                          : "bg-gradient-to-r from-orange-500 to-red-500"
                                      }
                                    >
                                      {project.status === "completed" ? "مكتمل" :
                                       project.status === "failed" ? "فاشل" : "قيد المعالجة"}
                                    </Badge>
                                  </td>
                                  <td className="py-3">{project.userId.substring(0, 8)}...</td>
                                  <td className="py-3">{project.creditsUsed}</td>
                                  <td className="py-3">{formatDate(project.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Credit Management Modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="text-2xl" data-testid="credit-modal-title">
              {creditForm.watch("action") === "add" ? "إضافة كريديت" : "خصم كريديت"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...creditForm}>
            <form onSubmit={creditForm.handleSubmit(onCreditSubmit)} className="space-y-4">
              {/* Selected User Info */}
              {selectedUserId && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10" data-testid="selected-user-info">
                  <p className="text-sm text-muted-foreground">المستخدم المحدد:</p>
                  <p className="font-medium" data-testid="selected-user-email">
                    {allUsers?.find(u => u.id === selectedUserId)?.email}
                  </p>
                  <p className="text-sm">
                    الكريديت الحالي: <Badge variant="outline" data-testid="current-credits">{allUsers?.find(u => u.id === selectedUserId)?.credits || 0}</Badge>
                  </p>
                </div>
              )}

              {/* Action Selection */}
              <FormField
                control={creditForm.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع العملية</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="credit-action-select">
                          <SelectValue placeholder="اختر نوع العملية" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="add" data-testid="action-add">إضافة كريديت</SelectItem>
                        <SelectItem value="subtract" data-testid="action-subtract">خصم كريديت</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount Input */}
              <FormField
                control={creditForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كمية الكريديت</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="أدخل كمية الكريديت (1-1000)"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="credit-amount-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reason Input */}
              <FormField
                control={creditForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سبب العملية (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="اكتب سبب إضافة أو خصم الكريديت..."
                        {...field}
                        data-testid="credit-reason-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  variant="outline"
                  className="flex-1"
                  data-testid="cancel-credit-button"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedUserId || creditManagementMutation.isPending}
                  className="flex-1 gradient-button"
                  data-testid="confirm-credit-button"
                >
                  {creditManagementMutation.isPending ? "جاري التنفيذ..." : `${creditForm.watch("action") === "add" ? "إضافة" : "خصم"} الكريديت`}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={showUserDetailsModal} onOpenChange={setShowUserDetailsModal}>
        <DialogContent className="sm:max-w-4xl glass-card max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">تفاصيل المستخدم</DialogTitle>
          </DialogHeader>
          
          {userDetails && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">معلومات المستخدم</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>البريد الإلكتروني:</strong> {userDetails.user.email}</p>
                    <p><strong>الكريديت الحالي:</strong> <Badge variant="outline">{userDetails.user.currentCredits}</Badge></p>
                    <p><strong>نوع الحساب:</strong> 
                      {userDetails.user.isAdmin ? (
                        <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 mr-2">أدمن</Badge>
                      ) : (
                        <Badge variant="secondary" className="mr-2">مستخدم</Badge>
                      )}
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">إحصائيات الاستخدام</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>إجمالي المعاملات:</strong> {userDetails.summary.totalTransactions}</p>
                    <p><strong>إجمالي الكريديت المستخدم:</strong> {userDetails.summary.totalCreditsSpent}</p>
                    <p><strong>إجمالي المشاريع:</strong> {userDetails.summary.totalProjects}</p>
                    <p><strong>المشاريع المكتملة:</strong> {userDetails.summary.completedProjects}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions History */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">تاريخ المعاملات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-right py-2">المبلغ</th>
                          <th className="text-right py-2">الكريديت</th>
                          <th className="text-right py-2">الحالة</th>
                          <th className="text-right py-2">التاريخ</th>
                          <th className="text-right py-2">ID المعاملة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetails.transactions.map((transaction) => (
                          <tr key={transaction.id} className="border-b border-white/5">
                            <td className="py-2">${(transaction.amount / 100).toFixed(2)}</td>
                            <td className="py-2">{transaction.credits}</td>
                            <td className="py-2">
                              <Badge 
                                className={transaction.status === "completed" 
                                  ? "bg-gradient-to-r from-green-500 to-blue-500"
                                  : "bg-gradient-to-r from-orange-500 to-red-500"
                                }
                              >
                                {transaction.status === "completed" ? "مكتمل" : "قيد المعالجة"}
                              </Badge>
                            </td>
                            <td className="py-2">{formatDate(transaction.processedAt)}</td>
                            <td className="py-2 font-mono text-xs">{transaction.stripePaymentIntentId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Projects History */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">تاريخ المشاريع</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-right py-2">العنوان</th>
                          <th className="text-right py-2">النوع</th>
                          <th className="text-right py-2">الكريديت المستخدم</th>
                          <th className="text-right py-2">الحالة</th>
                          <th className="text-right py-2">تاريخ الإنشاء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetails.projects.map((project) => (
                          <tr key={project.id} className="border-b border-white/5">
                            <td className="py-2">{project.title}</td>
                            <td className="py-2">
                              <Badge variant="outline">
                                {project.contentType === "video" ? "فيديو" : "صورة"}
                              </Badge>
                            </td>
                            <td className="py-2">{project.creditsUsed}</td>
                            <td className="py-2">
                              <Badge 
                                className={
                                  project.status === "completed" 
                                    ? "bg-gradient-to-r from-green-500 to-blue-500"
                                    : project.status === "failed"
                                    ? "bg-gradient-to-r from-red-500 to-pink-500"
                                    : "bg-gradient-to-r from-orange-500 to-red-500"
                                }
                              >
                                {project.status === "completed" ? "مكتمل" :
                                 project.status === "failed" ? "فاشل" : "قيد المعالجة"}
                              </Badge>
                            </td>
                            <td className="py-2">{formatDate(project.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}