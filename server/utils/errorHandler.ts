/**
 * Enhanced Error Handling System
 * Converts technical errors to user-friendly messages
 */

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  userMessage?: string;
}

export class CustomError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public userMessage: string;

  constructor(message: string, statusCode: number = 500, userMessage?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.userMessage = userMessage || this.getDefaultUserMessage(statusCode);
    
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultUserMessage(statusCode: number): string {
    const arabicMessages: { [key: number]: string } = {
      400: "طلب غير صحيح. يرجى التحقق من البيانات المدخلة.",
      401: "يجب تسجيل الدخول أولاً للوصول لهذه الخدمة.",
      403: "ليس لديك صلاحية للوصول لهذه الخدمة.",
      404: "الصفحة أو الخدمة المطلوبة غير موجودة.",
      409: "يوجد تضارب في البيانات. يرجى المحاولة مرة أخرى.",
      413: "حجم الملف كبير جداً. الحد الأقصى المسموح 10 ميجابايت.",
      429: "تم تجاوز الحد المسموح للطلبات. يرجى المحاولة لاحقاً.",
      500: "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.",
      502: "خدمة خارجية غير متاحة حالياً. يرجى المحاولة لاحقاً.",
      503: "الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.",
    };

    const englishMessages: { [key: number]: string } = {
      400: "Invalid request. Please check your input data.",
      401: "Please log in to access this service.", 
      403: "You don't have permission to access this service.",
      404: "The requested page or service was not found.",
      409: "Data conflict occurred. Please try again.",
      413: "File size too large. Maximum allowed is 10MB.",
      429: "Too many requests. Please try again later.",
      500: "Server error occurred. Please try again later.",
      502: "External service unavailable. Please try again later.",
      503: "Service temporarily unavailable. Please try again later.",
    };

    // Default to Arabic, fallback to English, then generic message
    return arabicMessages[statusCode] || englishMessages[statusCode] || "حدث خطأ غير متوقع";
  }
}

/**
 * Maps technical error patterns to user-friendly messages
 */
export function mapErrorToUserMessage(error: any): { statusCode: number; userMessage: string } {
  const errorMessage = error?.message || error?.toString() || "";
  const lowerMessage = errorMessage.toLowerCase();

  // Network and External Service Errors
  if (lowerMessage.includes("fetch") || lowerMessage.includes("network") || lowerMessage.includes("timeout")) {
    return {
      statusCode: 502,
      userMessage: "مشكلة في الاتصال بالخدمات الخارجية. يرجى المحاولة مرة أخرى."
    };
  }

  // Gemini AI Errors  
  if (lowerMessage.includes("gemini") || lowerMessage.includes("generative")) {
    return {
      statusCode: 502, 
      userMessage: "خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة لاحقاً."
    };
  }

  // Kling AI Errors
  if (lowerMessage.includes("kling") || lowerMessage.includes("video generation")) {
    return {
      statusCode: 502,
      userMessage: "خدمة إنتاج الفيديو غير متاحة حالياً. يرجى المحاولة لاحقاً."
    };
  }

  // Cloudinary/Upload Errors
  if (lowerMessage.includes("cloudinary") || lowerMessage.includes("upload")) {
    return {
      statusCode: 502,
      userMessage: "خدمة رفع الملفات غير متاحة حالياً. يرجى المحاولة لاحقاً."
    };
  }

  // Pinterest Extraction Errors
  if (lowerMessage.includes("pinterest") || lowerMessage.includes("extract")) {
    return {
      statusCode: 400,
      userMessage: "لا يمكن استخراج المحتوى من رابط Pinterest. يرجى التأكد من الرابط."
    };
  }

  // Credit/Payment Errors
  if (lowerMessage.includes("credit") || lowerMessage.includes("insufficient")) {
    return {
      statusCode: 402,
      userMessage: "رصيد الكريديت غير كافي. يرجى شراء المزيد من الكريديت."
    };
  }

  // File Size/Type Errors
  if (lowerMessage.includes("file size") || lowerMessage.includes("too large")) {
    return {
      statusCode: 413,
      userMessage: "حجم الملف كبير جداً. الحد الأقصى المسموح 10 ميجابايت."
    };
  }

  if (lowerMessage.includes("file type") || lowerMessage.includes("invalid format")) {
    return {
      statusCode: 400,
      userMessage: "نوع الملف غير مدعوم. يرجى استخدام ملفات PNG أو JPG."
    };
  }

  // Database Errors
  if (lowerMessage.includes("database") || lowerMessage.includes("connection")) {
    return {
      statusCode: 503,
      userMessage: "قاعدة البيانات غير متاحة مؤقتاً. يرجى المحاولة لاحقاً."
    };
  }

  // Authentication Errors
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("token")) {
    return {
      statusCode: 401,
      userMessage: "انتهت صلاحية جلسة العمل. يرجى تسجيل الدخول مرة أخرى."
    };
  }

  // JSON/Parsing Errors
  if (lowerMessage.includes("json") || lowerMessage.includes("parse")) {
    return {
      statusCode: 400,
      userMessage: "بيانات غير صحيحة. يرجى التحقق من المدخلات."
    };
  }

  // Default fallback
  return {
    statusCode: 500,
    userMessage: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم."
  };
}

/**
 * Multer error handling middleware
 */
export function handleMulterError(error: any, req: any, res: any, next: any) {
  if (error) {
    console.error("🚨 Multer error:", error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: "حجم الملف كبير جداً. الحد الأقصى المسموح 10 ميجابايت.",
        code: 413
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: "عدد الملفات كبير جداً.",
        code: 400
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: "نوع الملف غير مدعوم.",
        code: 400
      });
    }
    
    // Default multer error
    return res.status(400).json({
      success: false,
      error: "خطأ في رفع الملف. يرجى المحاولة مرة أخرى.",
      code: 400
    });
  }
  
  next();
}

/**
 * Express error handling middleware
 */
export function errorHandler(error: any, req: any, res: any, next: any) {
  // Log the full error for debugging
  console.error("🚨 Error occurred:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Handle custom errors
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.userMessage,
      code: error.statusCode
    });
  }

  // Map common errors to user-friendly messages
  const { statusCode, userMessage } = mapErrorToUserMessage(error);
  
  res.status(statusCode).json({
    success: false,
    error: userMessage,
    code: statusCode
  });
}

/**
 * Async wrapper to catch errors in route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler for Zod errors
 */
export function handleValidationError(error: any) {
  if (error.name === 'ZodError') {
    const messages = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`);
    throw new CustomError(
      `Validation failed: ${messages.join(', ')}`,
      400,
      "البيانات المدخلة غير صحيحة. يرجى التحقق من جميع الحقول المطلوبة."
    );
  }
  throw error;
}