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
  
  // Toast messages
  toast_unauthorized_title: string;
  toast_unauthorized_description: string;
  toast_project_created_title: string;
  toast_project_created_description: string;
  toast_project_created_success_title: string;
  toast_project_created_success_description: string;
  toast_image_uploaded_title: string;
  toast_product_image_uploaded_description: string;
  toast_scene_image_uploaded_description: string;
  toast_interface_reset_title: string;
  toast_interface_reset_description: string;
  
  // Dashboard content
  dashboard_content_type_image: string;
  dashboard_content_type_video: string;
  dashboard_video_duration_5: string;
  dashboard_video_duration_10: string;
  dashboard_audio_settings: string;
  dashboard_total_cost: string;
  dashboard_current_balance: string;
  dashboard_start_cgi_production: string;
  dashboard_credits_deducted_note: string;
  dashboard_all_projects: string;
  dashboard_processing_filter: string;
  dashboard_completed_filter: string;
  dashboard_failed_filter: string;
  dashboard_costs_tracking: string;
  dashboard_total_actual_cost: string;
  dashboard_total_projects: string;
  dashboard_image_projects: string;
  dashboard_video_projects: string;
  dashboard_project_cost_details: string;
  dashboard_no_projects: string;
  dashboard_start_new_project: string;
  dashboard_no_costs: string;
  dashboard_start_project_to_track: string;
  
  // Form labels advanced
  form_description_placeholder: string;
  form_output_resolution: string;
  form_processing_quality: string;
  
  // Error messages
  error_upload_product_image: string;
  error_upload_scene_image: string;
  error_project_creation: string;
  error_title_required: string;
  error_files_required: string;
  error_insufficient_credits: string;
  error_scene_selection: string;
  
  // Form UI text
  form_start_by_uploading: string;
  form_drag_drop_product: string;
  form_drag_drop_scene: string;
  // Navigation and header
  nav_home_link: string;
  nav_dashboard_link: string;
  nav_pricing_link: string;
  button_admin_panel: string;
  button_logout: string;
  text_credits: string;
  
  // Dashboard page
  dashboard_title: string;
  dashboard_subtitle: string;
  
  // Upload section  
  upload_section_title: string;
  button_clear_all: string;
  button_edit_image: string;
  button_change_scene: string;
  button_custom_upload: string;
  
  // Scene library
  scene_library_title: string;
  scene_library_description: string;
  scene_ai_powered_badge: string;
  
  // Project settings
  project_settings_title: string;
  form_project_title_label: string;
  
  // Additional messages
  toast_file_uploaded: string;
  toast_scene_selected: string;
  toast_files_required: string;
  toast_insufficient_credits: string;
  
  // Features
  features_title: string;
  features_ai_title: string;
  features_ai_description: string;
  features_quality_title: string;
  features_quality_description: string;
  features_speed_title: string;
  features_speed_description: string;


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
    
    // Toast messages
    toast_unauthorized_title: 'Unauthorized',
    toast_unauthorized_description: 'You have been logged out. Logging in again...',
    toast_project_created_title: 'Project Created',
    toast_project_created_description: 'Started processing your CGI project',
    toast_project_created_success_title: 'Project Created ✅',
    toast_project_created_success_description: 'Progress will be shown in "My Projects" tab',
    toast_image_uploaded_title: 'Image Uploaded',
    toast_product_image_uploaded_description: 'Product image uploaded successfully',
    toast_scene_image_uploaded_description: 'Scene image uploaded successfully',
    toast_interface_reset_title: '🔄 Interface Cleaned',
    toast_interface_reset_description: 'Ready to start a new project',
    
    // Dashboard content
    dashboard_content_type_image: 'CGI Image',
    dashboard_content_type_video: 'CGI Video',
    dashboard_video_duration_5: '5 seconds',
    dashboard_video_duration_10: '10 seconds',
    dashboard_audio_settings: 'Audio Settings',
    dashboard_total_cost: 'Total Cost:',
    dashboard_current_balance: 'Your current balance:',
    dashboard_start_cgi_production: 'Start CGI Production',
    dashboard_credits_deducted_note: 'Credits will only be deducted after successful processing',
    dashboard_all_projects: 'All Projects',
    dashboard_processing_filter: 'Processing',
    dashboard_completed_filter: 'Completed',
    dashboard_failed_filter: 'Failed',
    dashboard_costs_tracking: 'Track the real cost of using AI services',
    dashboard_total_actual_cost: 'Total Actual Cost',
    dashboard_total_projects: 'Total Projects',
    dashboard_image_projects: 'Image Projects',
    dashboard_video_projects: 'Video Projects',
    dashboard_project_cost_details: 'Project Cost Details',
    dashboard_no_projects: 'No projects yet',
    dashboard_start_new_project: 'Start creating a new CGI project',
    dashboard_no_costs: 'No costs yet',
    dashboard_start_project_to_track: 'Start creating a project to track actual costs',
    
    // Form labels advanced
    form_description_placeholder: 'Write a description that helps AI blend the product better with the chosen scene',
    form_output_resolution: 'Output Resolution',
    form_processing_quality: 'Processing Quality',
    
    // Error messages
    error_upload_product_image: 'Product Image Upload Error',
    error_upload_scene_image: 'Scene Image Upload Error',
    error_project_creation: 'Project Creation Error',
    error_title_required: 'Project title is required',
    error_files_required: 'Please upload product image and scene file (image or video)',
    error_insufficient_credits: 'Insufficient Credits',
    error_scene_selection: 'Please select a scene first',
    
    // Form UI text
    form_start_by_uploading: 'Start by uploading a product image',
    form_drag_drop_product: 'Drag and drop your product image here',
    form_drag_drop_scene: 'Drag and drop your scene image here',
    // Navigation and header
    nav_home_link: 'Home',
    nav_dashboard_link: 'Dashboard',
    nav_pricing_link: 'Pricing',
    button_admin_panel: 'Admin Panel',
    button_logout: 'Logout',
    text_credits: 'credits',
    
    // Dashboard page
    dashboard_title: 'Dashboard',
    dashboard_subtitle: 'Create a new CGI project or continue your previous projects',
    
    // Upload section  
    upload_section_title: 'Upload Images',
    button_clear_all: 'Clear All',
    button_edit_image: 'Edit Image',
    button_change_scene: 'Change Scene',
    button_custom_upload: 'Custom Upload',
    
    // Scene library
    scene_library_title: 'Choose from Library',
    scene_library_description: 'Amazing collection of ready-made scenes designed specifically for your product',
    scene_ai_powered_badge: 'AI Powered ✨',
    
    // Project settings
    project_settings_title: 'Project Settings',
    form_project_title_label: 'Project Title',
    
    // Additional messages
    toast_file_uploaded: 'File Uploaded',
    toast_scene_selected: 'Scene Selected',
    toast_files_required: 'Files Required',
    toast_insufficient_credits: 'Insufficient Credits',
    
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
    
    // Toast messages
    toast_unauthorized_title: 'غير مخول',
    toast_unauthorized_description: 'تم تسجيل الخروج. جاري تسجيل الدخول مرة أخرى...',
    toast_project_created_title: 'تم إنشاء المشروع',
    toast_project_created_description: 'بدأت معالجة مشروع CGI الخاص بك',
    toast_project_created_success_title: 'تم إنشاء المشروع ✅',
    toast_project_created_success_description: 'سيتم عرض التقدم في تاب "مشاريعي"',
    toast_image_uploaded_title: 'تم رفع الصورة',
    toast_product_image_uploaded_description: 'تم رفع صورة المنتج بنجاح',
    toast_scene_image_uploaded_description: 'تم رفع صورة المشهد بنجاح',
    toast_interface_reset_title: '🔄 تم تنظيف الواجهة',
    toast_interface_reset_description: 'جاهز للبدء في مشروع جديد',
    
    // Dashboard content
    dashboard_content_type_image: 'صورة CGI',
    dashboard_content_type_video: 'فيديو CGI',
    dashboard_video_duration_5: '5 ثوانِ',
    dashboard_video_duration_10: '10 ثوانِ',
    dashboard_audio_settings: 'إعدادات الصوت',
    dashboard_total_cost: 'إجمالي التكلفة:',
    dashboard_current_balance: 'رصيدك الحالي:',
    dashboard_start_cgi_production: 'ابدأ إنتاج CGI',
    dashboard_credits_deducted_note: 'سيتم خصم الكريدت بعد نجاح المعالجة فقط',
    dashboard_all_projects: 'جميع المشاريع',
    dashboard_processing_filter: 'قيد المعالجة',
    dashboard_completed_filter: 'مكتملة',
    dashboard_failed_filter: 'فاشلة',
    dashboard_costs_tracking: 'تتبع التكلفة الحقيقية لاستخدام خدمات الذكاء الاصطناعي',
    dashboard_total_actual_cost: 'إجمالي التكلفة الفعلية',
    dashboard_total_projects: 'إجمالي المشاريع',
    dashboard_image_projects: 'مشاريع الصور',
    dashboard_video_projects: 'مشاريع الفيديو',
    dashboard_project_cost_details: 'تفاصيل تكلفة المشاريع',
    dashboard_no_projects: 'لا توجد مشاريع بعد',
    dashboard_start_new_project: 'ابدأ بإنشاء مشروع CGI جديد',
    dashboard_no_costs: 'لا توجد تكاليف بعد',
    dashboard_start_project_to_track: 'ابدأ بإنشاء مشروع لتتبع التكاليف الفعلية',
    
    // Form labels advanced
    form_description_placeholder: 'اكتب وصف يساعد الذكاء الاصطناعي في دمج المنتج بشكل أفضل مع المشهد المختار',
    form_output_resolution: 'دقة الإخراج',
    form_processing_quality: 'جودة المعالجة',
    
    // Error messages
    error_upload_product_image: 'خطأ في رفع صورة المنتج',
    error_upload_scene_image: 'خطأ في رفع صورة المشهد',
    error_project_creation: 'خطأ في إنشاء المشروع',
    error_title_required: 'عنوان المشروع مطلوب',
    error_files_required: 'يرجى رفع صورة المنتج وملف المشهد (صورة أو فيديو)',
    error_insufficient_credits: 'رصيد غير كافي',
    error_scene_selection: 'يرجى اختيار مشهد أولاً',
    
    // Form UI text
    form_start_by_uploading: 'ابدأ برفع صورة المنتج',
    form_drag_drop_product: 'اسحب وأفلت صورة المنتج هنا',
    form_drag_drop_scene: 'اسحب وأفلت صورة المشهد هنا',
    // Navigation and header
    nav_home_link: 'الرئيسية',
    nav_dashboard_link: 'لوحة التحكم',
    nav_pricing_link: 'الأسعار',
    button_admin_panel: 'لوحة الأدمن',
    button_logout: 'تسجيل الخروج',
    text_credits: 'كريدت',
    
    // Dashboard page
    dashboard_title: 'لوحة التحكم',
    dashboard_subtitle: 'أنشئ مشروع CGI جديد أو تابع مشاريعك السابقة',
    
    // Upload section  
    upload_section_title: 'رفع الصور',
    button_clear_all: 'مسح الكل',
    button_edit_image: 'تعديل الصورة',
    button_change_scene: 'تغيير المشهد',
    button_custom_upload: 'رفع مخصوص',
    
    // Scene library
    scene_library_title: 'اختيار من المكتبة',
    scene_library_description: 'مجموعة مذهلة من المشاهد الجاهزة المصممة خصيصا لمنتجك',
    scene_ai_powered_badge: 'مدعوم بالذكاء الاصطناعي ✨',
    
    // Project settings
    project_settings_title: 'إعدادات المشروع',
    form_project_title_label: 'عنوان المشروع',
    
    // Additional messages
    toast_file_uploaded: 'تم رفع الملف',
    toast_scene_selected: 'تم اختيار المشهد',
    toast_files_required: 'ملفات مطلوبة',
    toast_insufficient_credits: 'كريدت غير كافي',
    
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