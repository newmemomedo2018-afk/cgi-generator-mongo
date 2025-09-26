/**
 * Internationalization (i18n) System
 * Supports English (default) and Arabic languages
 */

export type Language = 'en' | 'ar';

export interface TranslationKeys {
  // Navigation
  nav_home: string;
  nav_features: string;
  nav_pricing: string;
  nav_dashboard: string;
  nav_admin: string;

  // Authentication  
  auth_login: string;
  auth_register: string;
  auth_logout: string;
  auth_email: string;
  auth_password: string;
  auth_confirm_password: string;
  auth_name: string;
  auth_first_name: string;
  auth_last_name: string;

  // Landing page
  landing_title: string;
  landing_subtitle: string;
  landing_hero_description: string;
  landing_get_started: string;
  landing_learn_more: string;

  // Features
  features_title: string;
  features_ai_title: string;
  features_ai_description: string;
  features_quality_title: string;
  features_quality_description: string;
  features_speed_title: string;
  features_speed_description: string;

  // Dashboard
  dashboard_new_project: string;
  dashboard_my_projects: string;
  dashboard_title: string;
  dashboard_description: string;
  dashboard_upload_product: string;
  dashboard_upload_scene: string;
  dashboard_content_type: string;
  dashboard_image: string;
  dashboard_video: string;
  dashboard_duration: string;
  dashboard_audio: string;
  dashboard_generate: string;
  dashboard_reset: string;
  dashboard_credits_needed: string;
  dashboard_credits_available: string;

  // Project status
  status_pending: string;
  status_processing: string;
  status_completed: string;
  status_failed: string;

  // Pricing
  pricing_title: string;
  pricing_subtitle: string;
  pricing_free_title: string;
  pricing_starter_title: string;
  pricing_pro_title: string;
  pricing_enterprise_title: string;

  // Common actions
  action_save: string;
  action_cancel: string;
  action_delete: string;
  action_edit: string;
  action_download: string;
  action_preview: string;
  action_upload: string;
  action_close: string;
  action_confirm: string;

  // Messages
  msg_success: string;
  msg_error: string;
  msg_loading: string;
  msg_uploading: string;
  msg_processing: string;
  msg_completed: string;

  // Validation
  validation_required: string;
  validation_email_invalid: string;
  validation_password_short: string;
  validation_passwords_mismatch: string;
}

export const translations: Record<Language, TranslationKeys> = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_features: 'Features',
    nav_pricing: 'Pricing',
    nav_dashboard: 'Dashboard',
    nav_admin: 'Admin',

    // Authentication
    auth_login: 'Login',
    auth_register: 'Sign Up',
    auth_logout: 'Logout',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_confirm_password: 'Confirm Password',
    auth_name: 'Name',
    auth_first_name: 'First Name',
    auth_last_name: 'Last Name',

    // Landing page
    landing_title: 'CGI Generator',
    landing_subtitle: 'Transform Your Products into Stunning CGI',
    landing_hero_description: 'Create professional CGI images and videos using advanced AI technology. Upload your product and scene images to generate amazing visual content.',
    landing_get_started: 'Get Started Free',
    landing_learn_more: 'Learn More',

    // Features
    features_title: 'Powerful Features',
    features_ai_title: 'AI-Powered Generation',
    features_ai_description: 'Advanced AI creates professional CGI content',
    features_quality_title: 'High Quality Output',
    features_quality_description: 'Professional-grade images and videos',
    features_speed_title: 'Fast Processing',
    features_speed_description: 'Generate content in minutes, not hours',

    // Dashboard
    dashboard_new_project: 'New Project',
    dashboard_my_projects: 'My Projects',
    dashboard_title: 'Project Title',
    dashboard_description: 'Description',
    dashboard_upload_product: 'Upload Product Image',
    dashboard_upload_scene: 'Upload Scene Image/Video',
    dashboard_content_type: 'Content Type',
    dashboard_image: 'Image',
    dashboard_video: 'Video',
    dashboard_duration: 'Duration',
    dashboard_audio: 'Include Audio',
    dashboard_generate: 'Generate',
    dashboard_reset: 'Reset',
    dashboard_credits_needed: 'Credits Needed',
    dashboard_credits_available: 'Credits Available',

    // Project status
    status_pending: 'Pending',
    status_processing: 'Processing',
    status_completed: 'Completed',
    status_failed: 'Failed',

    // Pricing
    pricing_title: 'Choose Your Plan',
    pricing_subtitle: 'Select the perfect plan for your needs',
    pricing_free_title: 'Free',
    pricing_starter_title: 'Starter',
    pricing_pro_title: 'Pro',
    pricing_enterprise_title: 'Enterprise',

    // Common actions
    action_save: 'Save',
    action_cancel: 'Cancel',
    action_delete: 'Delete',
    action_edit: 'Edit',
    action_download: 'Download',
    action_preview: 'Preview',
    action_upload: 'Upload',
    action_close: 'Close',
    action_confirm: 'Confirm',

    // Messages
    msg_success: 'Success',
    msg_error: 'Error',
    msg_loading: 'Loading...',
    msg_uploading: 'Uploading...',
    msg_processing: 'Processing...',
    msg_completed: 'Completed',

    // Validation
    validation_required: 'This field is required',
    validation_email_invalid: 'Please enter a valid email address',
    validation_password_short: 'Password must be at least 6 characters',
    validation_passwords_mismatch: 'Passwords do not match',
  },

  ar: {
    // Navigation
    nav_home: 'الرئيسية',
    nav_features: 'المميزات',
    nav_pricing: 'الأسعار',
    nav_dashboard: 'لوحة التحكم',
    nav_admin: 'الإدارة',

    // Authentication
    auth_login: 'تسجيل الدخول',
    auth_register: 'إنشاء حساب',
    auth_logout: 'تسجيل الخروج',
    auth_email: 'البريد الإلكتروني',
    auth_password: 'كلمة المرور',
    auth_confirm_password: 'تأكيد كلمة المرور',
    auth_name: 'الاسم',
    auth_first_name: 'الاسم الأول',
    auth_last_name: 'اسم العائلة',

    // Landing page
    landing_title: 'مولد CGI',
    landing_subtitle: 'حول منتجاتك إلى محتوى CGI مذهل',
    landing_hero_description: 'أنشئ صور ومقاطع فيديو CGI احترافية باستخدام تقنية الذكاء الاصطناعي المتقدمة. ارفع صور منتجك والمشهد لتوليد محتوى بصري مذهل.',
    landing_get_started: 'ابدأ مجاناً',
    landing_learn_more: 'تعلم المزيد',

    // Features
    features_title: 'مميزات قوية',
    features_ai_title: 'توليد بالذكاء الاصطناعي',
    features_ai_description: 'ذكاء اصطناعي متقدم ينشئ محتوى CGI احترافي',
    features_quality_title: 'جودة عالية',
    features_quality_description: 'صور ومقاطع فيديو بجودة احترافية',
    features_speed_title: 'معالجة سريعة',
    features_speed_description: 'أنتج المحتوى في دقائق وليس ساعات',

    // Dashboard
    dashboard_new_project: 'مشروع جديد',
    dashboard_my_projects: 'مشاريعي',
    dashboard_title: 'عنوان المشروع',
    dashboard_description: 'الوصف',
    dashboard_upload_product: 'رفع صورة المنتج',
    dashboard_upload_scene: 'رفع صورة/فيديو المشهد',
    dashboard_content_type: 'نوع المحتوى',
    dashboard_image: 'صورة',
    dashboard_video: 'فيديو',
    dashboard_duration: 'المدة',
    dashboard_audio: 'تضمين الصوت',
    dashboard_generate: 'توليد',
    dashboard_reset: 'إعادة تعيين',
    dashboard_credits_needed: 'الأرصدة المطلوبة',
    dashboard_credits_available: 'الأرصدة المتاحة',

    // Project status
    status_pending: 'في الانتظار',
    status_processing: 'قيد المعالجة',
    status_completed: 'مكتمل',
    status_failed: 'فشل',

    // Pricing
    pricing_title: 'اختر خطتك',
    pricing_subtitle: 'اختر الخطة المثالية لاحتياجاتك',
    pricing_free_title: 'مجاني',
    pricing_starter_title: 'المبتدئ',
    pricing_pro_title: 'المحترف',
    pricing_enterprise_title: 'المؤسسات',

    // Common actions
    action_save: 'حفظ',
    action_cancel: 'إلغاء',
    action_delete: 'حذف',
    action_edit: 'تعديل',
    action_download: 'تنزيل',
    action_preview: 'معاينة',
    action_upload: 'رفع',
    action_close: 'إغلاق',
    action_confirm: 'تأكيد',

    // Messages
    msg_success: 'نجح',
    msg_error: 'خطأ',
    msg_loading: 'جاري التحميل...',
    msg_uploading: 'جاري الرفع...',
    msg_processing: 'جاري المعالجة...',
    msg_completed: 'مكتمل',

    // Validation
    validation_required: 'هذا الحقل مطلوب',
    validation_email_invalid: 'يرجى إدخال عنوان بريد إلكتروني صحيح',
    validation_password_short: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
    validation_passwords_mismatch: 'كلمات المرور غير متطابقة',
  },
};

// Default language - Changed to English for international marketing
export const DEFAULT_LANGUAGE: Language = 'en';

// Export types and data for use in components
export type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationKeys) => string;
  isRTL: boolean;
};

// Helper function for conditional styling based on language direction
export function directionClass(ltrClass: string, rtlClass: string, isRTL: boolean): string {
  return isRTL ? rtlClass : ltrClass;
}