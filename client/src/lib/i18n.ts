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
  landing_hero_title: string;
  landing_hero_description: string;
  landing_get_started: string;
  landing_watch_demo: string;
  landing_examples_title: string;
  
  // How it works section
  landing_step1_title: string;
  landing_step1_description: string;
  landing_step2_title: string;
  landing_step2_description: string;
  landing_step3_title: string;
  landing_step3_description: string;
  
  // Examples section
  landing_examples_before: string;
  landing_examples_after: string;
  
  // Features section
  landing_features_title: string;
  landing_features_subtitle: string;
  
  // CTA section
  landing_cta_title: string;
  landing_cta_subtitle: string;
  
  // Dashboard
  dashboard_users: string;
  dashboard_projects: string;
  dashboard_actual_costs: string;
  dashboard_new_project: string;
  dashboard_my_projects: string;
  
  // Dashboard table headers
  table_title: string;
  table_type: string;
  table_status: string;
  table_user: string;
  table_credits_used: string;
  table_date: string;
  
  // Project statuses
  status_processing: string;
  status_completed: string;
  status_failed: string;
  status_pending: string;
  status_enhancing_prompt: string;
  status_generating_image: string;
  status_generating_video: string;
  
  // Project form labels
  form_product_image: string;
  form_scene_image: string;
  form_project_title: string;
  form_content_type: string;
  form_video_duration: string;
  form_include_audio: string;
  form_enhance_integration: string;
  form_advanced_settings: string;
  
  // Progress modal
  progress_modal_title: string;
  progress_modal_description: string;
  progress_step_enhance: string;
  progress_step_image: string;
  progress_step_video_prompt: string;
  progress_step_video: string;
  progress_overall: string;
  progress_cancel: string;
  
  // Upload zone
  upload_uploading: string;
  upload_please_wait: string;
  upload_preview: string;
  upload_click_change: string;
  upload_drag_drop: string;
  upload_or_browse: string;
  upload_extract_failed: string;
  
  // Time and actions
  time_now: string;
  time_minutes_ago: string;
  time_hours_ago: string;
  time_days_ago: string;
  action_download: string;
  action_preview: string;
  action_play: string;

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
    landing_hero_title: 'Create Professional CGI Images and Videos with AI',
    landing_hero_description: 'Upload your product and scene images and let us blend them into professional CGI images or videos using cutting-edge AI technology.',
    landing_get_started: 'Get Started Free',
    landing_watch_demo: 'Watch How It Works',
    landing_examples_title: 'Results Examples',
    
    // How it works section
    landing_step1_title: 'Upload Images',
    landing_step1_description: 'Upload your product image and the desired scene image',
    landing_step2_title: 'AI Processing',
    landing_step2_description: 'AI analyzes and blends the content with precision',
    landing_step3_title: 'Professional Result',
    landing_step3_description: 'Get high-quality CGI image or video',
    
    // Examples section
    landing_examples_before: 'Before - Original Images',
    landing_examples_after: 'After - Final Result',
    
    // Features section
    landing_features_title: 'CGI Generator Platform Features',
    landing_features_subtitle: 'Advanced technologies for professional CGI content production',
    
    // CTA section
    landing_cta_title: 'Ready to Create Amazing CGI Content?',
    landing_cta_subtitle: 'Start with 5 free credits and discover the power of AI',
    
    // Dashboard
    dashboard_users: 'Users',
    dashboard_projects: 'Projects',
    dashboard_actual_costs: 'Actual Costs',
    dashboard_new_project: 'New Project',
    dashboard_my_projects: 'My Projects',
    
    // Dashboard table headers
    table_title: 'Title',
    table_type: 'Type',
    table_status: 'Status',
    table_user: 'User',
    table_credits_used: 'Credits Used',
    table_date: 'Date',
    
    // Project statuses
    status_processing: 'Processing',
    status_completed: 'Completed',
    status_failed: 'Failed',
    status_pending: 'Pending',
    status_enhancing_prompt: 'Enhancing Description',
    status_generating_image: 'Generating Image',
    status_generating_video: 'Generating Video',
    
    // Project form labels
    form_product_image: 'Product Image',
    form_scene_image: 'Scene Image',
    form_project_title: 'Project Title',
    form_content_type: 'Content Type',
    form_video_duration: 'Video Duration',
    form_include_audio: 'Add Audio to Video',
    form_enhance_integration: 'Enhance Image Integration (Optional)',
    form_advanced_settings: 'Advanced Settings',
    
    // Progress modal
    progress_modal_title: 'Producing CGI',
    progress_modal_description: 'Please wait, this may take a few minutes',
    progress_step_enhance: 'Enhancing Description',
    progress_step_image: 'Generating Image',
    progress_step_video_prompt: 'Enhancing Video Prompt',
    progress_step_video: 'Generating Video',
    progress_overall: 'Overall Progress',
    progress_cancel: 'Cancel Operation',
    
    // Upload zone
    upload_uploading: 'Uploading image...',
    upload_please_wait: 'Please wait',
    upload_preview: 'Image Preview',
    upload_click_change: 'Click to change',
    upload_drag_drop: 'Drag and drop product image here',
    upload_or_browse: 'or click to browse',
    upload_extract_failed: 'Failed to extract image',
    
    // Time and actions
    time_now: 'now',
    time_minutes_ago: 'minutes ago',
    time_hours_ago: 'hours ago',
    time_days_ago: 'days ago',
    action_download: 'Download',
    action_preview: 'Preview',
    action_play: 'Play',

    // Features
    features_title: 'Powerful Features',
    features_ai_title: 'AI-Powered Generation',
    features_ai_description: 'Advanced AI creates professional CGI content',
    features_quality_title: 'High Quality Output',
    features_quality_description: 'Professional-grade images and videos',
    features_speed_title: 'Fast Processing',
    features_speed_description: 'Generate content in minutes, not hours',

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
    landing_hero_title: 'اصنع صور وفيديوهات CGI احترافية بالذكاء الاصطناعي',
    landing_hero_description: 'ارفع صورة منتجك وصورة المشهد واتركنا ندمجهم في صورة أو فيديو CGI احترافي باستخدام أحدث تقنيات الذكاء الاصطناعي.',
    landing_get_started: 'ابدأ الآن مجاناً',
    landing_watch_demo: 'شاهد كيف يعمل',
    landing_examples_title: 'أمثلة على النتائج',
    
    // How it works section
    landing_step1_title: 'ارفع الصور',
    landing_step1_description: 'ارفع صورة منتجك وصورة المشهد المطلوب',
    landing_step2_title: 'معالجة ذكية',
    landing_step2_description: 'الذكاء الاصطناعي يحلل ويدمج المحتوى بدقة',
    landing_step3_title: 'نتيجة احترافية',
    landing_step3_description: 'احصل على صورة أو فيديو CGI بجودة عالية',
    
    // Examples section
    landing_examples_before: 'قبل - الصور الأصلية',
    landing_examples_after: 'بعد - النتيجة النهائية',
    
    // Features section
    landing_features_title: 'مميزات منصة مولد CGI',
    landing_features_subtitle: 'تقنيات متقدمة لإنتاج محتوى CGI احترافي',
    
    // CTA section
    landing_cta_title: 'جاهز لإنشاء محتوى CGI مذهل؟',
    landing_cta_subtitle: 'ابدأ بـ 5 كريدت مجانية واكتشف قوة الذكاء الاصطناعي',
    
    // Dashboard
    dashboard_users: 'المستخدمين',
    dashboard_projects: 'المشاريع',
    dashboard_actual_costs: 'التكاليف الفعلية',
    dashboard_new_project: 'مشروع جديد',
    dashboard_my_projects: 'مشاريعي',
    
    // Dashboard table headers
    table_title: 'العنوان',
    table_type: 'النوع',
    table_status: 'الحالة',
    table_user: 'المستخدم',
    table_credits_used: 'الكريدت المستخدم',
    table_date: 'التاريخ',
    
    // Project statuses
    status_processing: 'قيد المعالجة',
    status_completed: 'مكتمل',
    status_failed: 'فاشل',
    status_pending: 'في الانتظار',
    status_enhancing_prompt: 'تحسين الوصف',
    status_generating_image: 'إنتاج الصورة',
    status_generating_video: 'إنتاج الفيديو',
    
    // Project form labels
    form_product_image: 'صورة المنتج',
    form_scene_image: 'صورة المشهد',
    form_project_title: 'عنوان المشروع',
    form_content_type: 'نوع المحتوى',
    form_video_duration: 'مدة الفيديو',
    form_include_audio: 'إضافة صوت للفيديو',
    form_enhance_integration: 'تحسين دمج الصور (اختياري)',
    form_advanced_settings: 'إعدادات متقدمة',
    
    // Progress modal
    progress_modal_title: 'جاري إنتاج CGI',
    progress_modal_description: 'يرجى الانتظار، هذا قد يستغرق بضع دقائق',
    progress_step_enhance: 'تحسين الوصف',
    progress_step_image: 'إنتاج الصورة',
    progress_step_video_prompt: 'تحسين برومبت الفيديو',
    progress_step_video: 'إنتاج الفيديو',
    progress_overall: 'التقدم الإجمالي',
    progress_cancel: 'إلغاء العملية',
    
    // Upload zone
    upload_uploading: 'جاري رفع الصورة...',
    upload_please_wait: 'يرجى الانتظار',
    upload_preview: 'معاينة الصورة',
    upload_click_change: 'انقر لتغيير',
    upload_drag_drop: 'اسحب وأفلت صورة المنتج هنا',
    upload_or_browse: 'أو انقر للتصفح',
    upload_extract_failed: 'فشل في استخراج الصورة',
    
    // Time and actions
    time_now: 'الآن',
    time_minutes_ago: 'دقيقة',
    time_hours_ago: 'ساعة',
    time_days_ago: 'يوم',
    action_download: 'تحميل',
    action_preview: 'معاينة',
    action_play: 'تشغيل',

    // Features
    features_title: 'مميزات قوية',
    features_ai_title: 'توليد بالذكاء الاصطناعي',
    features_ai_description: 'ذكاء اصطناعي متقدم ينشئ محتوى CGI احترافي',
    features_quality_title: 'جودة عالية',
    features_quality_description: 'صور ومقاطع فيديو بجودة احترافية',
    features_speed_title: 'معالجة سريعة',
    features_speed_description: 'أنتج المحتوى في دقائق وليس ساعات',


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