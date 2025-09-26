// Credit package definitions - shared between frontend and backend - UPDATED FOR 300% PROFIT
export const CREDIT_PACKAGES = {
  tester: { credits: 125, price: 10.00, name: "المبتدئ" },      // $0.08 per credit
  starter: { credits: 315, price: 25.00, name: "العادي" },      // $0.079 per credit
  pro: { credits: 650, price: 50.00, name: "البرو" },          // $0.077 per credit
  business: { credits: 1350, price: 100.00, name: "الأعمال" }  // $0.074 per credit
} as const;

// AI Service Costs - UPDATED FOR 300% PROFIT MARGIN
// These are the prices charged to users (4x actual cost for 300% profit)
export const COSTS = {
  GEMINI_PROMPT_ENHANCEMENT: 8,    // $0.008 per request (was $0.002) - 300% profit 
  GEMINI_IMAGE_GENERATION: 156,   // $0.156 per request (was $0.039) - 300% profit
  GEMINI_VIDEO_ANALYSIS: 12,      // $0.012 per video analysis (was $0.003) - 300% profit  
  VIDEO_GENERATION: 1040          // $1.04 per 5s video (was $0.26) - 300% profit
} as const;

// Actual service costs (for reference and profit calculation)
export const ACTUAL_COSTS = {
  GEMINI_PROMPT_ENHANCEMENT: 2,   // $0.002 actual cost
  GEMINI_IMAGE_GENERATION: 39,    // $0.039 actual cost
  GEMINI_VIDEO_ANALYSIS: 3,       // $0.003 actual cost
  VIDEO_GENERATION: 260           // $0.26 actual cost to Kling AI
} as const;

// Credit costs for services (consistent across all interfaces)
export const CREDIT_COSTS = {
  IMAGE_GENERATION: 2,           // 2 credits per image
  VIDEO_SHORT: 13,               // 13 credits per short video (5s)
  VIDEO_LONG: 18,                // 18 credits per long video (10s)
  AUDIO_SURCHARGE: 5             // +5 credits for audio in videos
} as const;