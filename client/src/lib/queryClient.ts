import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Maps API error responses to user-friendly Arabic messages
 */
function mapApiErrorToUserMessage(statusCode: number, errorText: string): string {
  const lowerText = errorText.toLowerCase();

  // Map specific error patterns
  if (lowerText.includes("insufficient credits") || lowerText.includes("credit")) {
    return "رصيد الكريديت غير كافي. يرجى شراء المزيد من الكريديت.";
  }
  
  if (lowerText.includes("unauthorized") || statusCode === 401) {
    return "انتهت صلاحية جلسة العمل. يرجى تسجيل الدخول مرة أخرى.";
  }
  
  if (lowerText.includes("forbidden") || statusCode === 403) {
    return "ليس لديك صلاحية للوصول لهذه الخدمة.";
  }
  
  if (lowerText.includes("not found") || statusCode === 404) {
    return "الصفحة أو المحتوى المطلوب غير موجود.";
  }
  
  if (lowerText.includes("file size") || lowerText.includes("too large")) {
    return "حجم الملف كبير جداً. الحد الأقصى المسموح 10 ميجابايت.";
  }
  
  if (lowerText.includes("invalid format") || lowerText.includes("file type")) {
    return "نوع الملف غير مدعوم. يرجى استخدام ملفات PNG أو JPG.";
  }
  
  if (lowerText.includes("pinterest") || lowerText.includes("extract")) {
    return "لا يمكن استخراج المحتوى من رابط Pinterest. يرجى التأكد من الرابط.";
  }
  
  if (lowerText.includes("network") || lowerText.includes("fetch failed")) {
    return "مشكلة في الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى.";
  }
  
  if (statusCode >= 500) {
    return "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.";
  }
  
  if (statusCode === 429) {
    return "تم تجاوز الحد المسموح للطلبات. يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.";
  }
  
  // Default messages by status code
  const statusMessages: { [key: number]: string } = {
    400: "طلب غير صحيح. يرجى التحقق من البيانات المدخلة.",
    402: "يجب الدفع لاستخدام هذه الخدمة.",
    409: "يوجد تضارب في البيانات. يرجى المحاولة مرة أخرى.",
    413: "حجم البيانات كبير جداً.",
    502: "خدمة خارجية غير متاحة حالياً.",
    503: "الخدمة غير متاحة مؤقتاً."
  };
  
  return statusMessages[statusCode] || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
}

export class ApiError extends Error {
  public statusCode: number;
  public userMessage: string;
  public originalError: string;

  constructor(statusCode: number, originalError: string) {
    const userMessage = mapApiErrorToUserMessage(statusCode, originalError);
    super(userMessage);
    
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.originalError = originalError;
    this.name = 'ApiError';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorText = res.statusText;
    
    try {
      const responseText = await res.text();
      if (responseText) {
        // Try to parse JSON error response
        try {
          const errorData = JSON.parse(responseText);
          errorText = errorData.error || errorData.message || responseText;
        } catch {
          // Use raw text if not JSON
          errorText = responseText;
        }
      }
    } catch {
      // Use status text if can't read response
      errorText = res.statusText;
    }
    
    throw new ApiError(res.status, errorText);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  
  // Only set Content-Type for JSON data, not for FormData
  if (data && !(data instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    // Pass FormData directly, JSON.stringify for other data
    body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Global error handler function
export function handleGlobalError(error: any, type: 'query' | 'mutation' = 'query') {
  // Import toast dynamically to avoid circular dependency
  import("@/hooks/use-toast").then(({ toast }) => {
    if (error instanceof ApiError) {
      toast({
        variant: "destructive",
        title: type === 'query' ? "خطأ" : "فشل في العملية",
        description: error.userMessage,
      });
    } else if (error?.message) {
      toast({
        variant: "destructive",
        title: type === 'query' ? "خطأ" : "فشل في العملية",
        description: error.message.includes("401") ? 
          "انتهت صلاحية جلسة العمل. يرجى تسجيل الدخول مرة أخرى." :
          type === 'query' ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." :
          "فشل في تنفيذ العملية. يرجى المحاولة مرة أخرى.",
      });
    }
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        handleGlobalError(error, 'mutation');
      },
    },
  },
});
