/**
 * Kling AI Video Generation Service
 * Generates videos from images using Kling AI via PiAPI
 * VERSION: 2.1.0 - Enhanced debugging and resilient task_id parsing
 */

import { randomUUID } from 'crypto';

/**
 * Truncate and optimize prompt for Kling AI's 2500 character limit
 * Intelligently preserves the most important parts of the prompt
 */
function optimizePromptForKling(prompt: string, maxLength = 2500): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }

  console.log(`⚠️ Prompt too long (${prompt.length} chars), optimizing for Kling AI limit (${maxLength} chars)...`);

  // Strategy: Smart content prioritization with robust fallback
  const lines = prompt.split('\n').filter(line => line.trim().length > 0);
  
  // Enhanced section classification with scoring
  const coreSections = [];        // Core motion/action descriptions
  const technicalSections = [];   // Technical/camera/quality directives
  const contextSections = [];     // Arabic context/branding
  const genericSections = [];     // Catch-all for unmatched content
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const lowerLine = trimmedLine.toLowerCase();
    
    // Score and classify lines by importance
    let score = 0;
    let category = 'generic';
    
    // Core motion/action keywords (highest priority)
    if (/(camera|movement|motion|zoom|rotate|dolly|pan|tilt|orbital|smooth|slow|gradual|animation|cinematic)/i.test(trimmedLine)) {
      score += 10;
      category = 'core';
    }
    
    // Technical/quality keywords (high priority)
    if (/(cgi|quality|resolution|lighting|professional|commercial|ultra.*realistic|photorealistic|aspect|duration)/i.test(trimmedLine)) {
      score += 8;
      category = 'technical';
    }
    
    // Product/scene keywords (medium priority)
    if (/(product|scene|object|background|environment|showcase|display|highlight)/i.test(trimmedLine)) {
      score += 6;
      if (category === 'generic') category = 'core';
    }
    
    // Enhanced English detection (expanded punctuation support)
    const isEnglishPrimary = /^[a-zA-Z0-9\s.,!?():;'"\/+%&_-]+$/.test(trimmedLine);
    const hasArabic = /[\u0600-\u06FF]/.test(trimmedLine);
    
    if (isEnglishPrimary && !hasArabic) {
      score += 5; // Boost English content for Kling AI
    }
    
    // Classify into buckets
    if (category === 'core' || (isEnglishPrimary && score >= 6)) {
      coreSections.push({ text: trimmedLine, score });
    } else if (category === 'technical' || (score >= 8)) {
      technicalSections.push({ text: trimmedLine, score });
    } else if (hasArabic) {
      contextSections.push({ text: trimmedLine, score });
    } else {
      genericSections.push({ text: trimmedLine, score });
    }
  }
  
  // Sort sections by score (descending)
  coreSections.sort((a, b) => b.score - a.score);
  technicalSections.sort((a, b) => b.score - a.score);
  contextSections.sort((a, b) => b.score - a.score);
  genericSections.sort((a, b) => b.score - a.score);
  
  // Budget allocation (60% core, 25% technical, 15% context/generic)
  let optimizedPrompt = '';
  const coreBudget = Math.floor(maxLength * 0.6);
  const technicalBudget = Math.floor(maxLength * 0.25);
  const contextBudget = maxLength - coreBudget - technicalBudget;
  
  // 1. Add core sections (highest priority)
  let usedLength = 0;
  for (const section of coreSections) {
    if (usedLength + section.text.length + 1 <= coreBudget) {
      optimizedPrompt += (optimizedPrompt ? ' ' : '') + section.text;
      usedLength += section.text.length + 1;
    }
  }
  
  // 2. Add technical sections
  const remainingAfterCore = maxLength - optimizedPrompt.length;
  const technicalAllowed = Math.min(technicalBudget, remainingAfterCore - contextBudget - 50);
  let technicalUsed = 0;
  
  for (const section of technicalSections) {
    if (technicalUsed + section.text.length + 1 <= technicalAllowed) {
      optimizedPrompt += ' ' + section.text;
      technicalUsed += section.text.length + 1;
    }
  }
  
  // 3. Add context (Arabic keywords extraction + top generic content)
  const finalRemaining = maxLength - optimizedPrompt.length - 20;
  if (finalRemaining > 50) {
    // Extract key Arabic motion words
    const arabicText = contextSections.map(s => s.text).join(' ');
    const arabicKeywords = arabicText.match(/(دوران|حركة|زووم|كاميرا|توهج|سلس|بطيء|تدريجي|مدار|تثبيت|انسيابية)/g) || [];
    
    if (arabicKeywords.length > 0) {
      const keywordSummary = ` Motion: ${arabicKeywords.slice(0, 5).join(', ')}`;
      if (optimizedPrompt.length + keywordSummary.length <= maxLength - 10) {
        optimizedPrompt += keywordSummary;
      }
    }
    
    // Add top generic content if space remains
    const stillRemaining = maxLength - optimizedPrompt.length - 10;
    for (const section of genericSections) {
      if (stillRemaining > section.text.length + 1) {
        optimizedPrompt += ' ' + section.text;
        break;
      }
    }
  }
  
  // Robust fallback: if result is too short, use trimmed original
  if (optimizedPrompt.length < maxLength * 0.3) {
    console.log(`⚠️ Optimized prompt too short (${optimizedPrompt.length} chars), using trimmed fallback...`);
    optimizedPrompt = prompt.substring(0, maxLength - 3) + '...';
  }
  
  // Final safety truncation
  if (optimizedPrompt.length > maxLength) {
    optimizedPrompt = optimizedPrompt.substring(0, maxLength - 3) + '...';
  }
  
  console.log(`✅ Smart prompt optimization completed:`, {
    originalLength: prompt.length,
    optimizedLength: optimizedPrompt.length,
    reductionPercent: Math.round((1 - optimizedPrompt.length / prompt.length) * 100),
    coreSelected: coreSections.length,
    technicalSelected: technicalSections.length,
    contextSelected: contextSections.length,
    genericAvailable: genericSections.length,
    fallbackUsed: optimizedPrompt.endsWith('...') && optimizedPrompt.length >= maxLength * 0.8
  });
  
  return optimizedPrompt;
}


interface KlingVideoResult {
  url: string;
  duration: number;
  fullTaskDetails?: any; // Include complete task details for UI display
}

/**
 * Resilient task_id extraction helper - handles various response formats
 */
function getTaskId(response: any, correlationId: string): string | null {
  console.log(`🔍 [${correlationId}] Extracting task_id from response:`, {
    responseType: typeof response,
    hasData: response && typeof response === 'object' && 'data' in response,
    responseKeys: response && typeof response === 'object' ? Object.keys(response) : null
  });

  // Start with the response, handle string wrapping recursively
  let currentData = response;
  let parseAttempts = 0;
  const maxParseAttempts = 3;

  // Keep parsing if we get JSON strings
  while (typeof currentData === 'string' && parseAttempts < maxParseAttempts) {
    try {
      const parsed = JSON.parse(currentData);
      console.log(`🔍 [${correlationId}] Parsed JSON string (attempt ${parseAttempts + 1}):`, { 
        originalLength: currentData.length,
        parsedType: typeof parsed,
        parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : null
      });
      currentData = parsed;
      parseAttempts++;
    } catch (e) {
      console.log(`🔍 [${correlationId}] Failed to parse as JSON (attempt ${parseAttempts + 1}):`, { 
        data: currentData.substring(0, 100), 
        error: e 
      });
      break;
    }
  }

  // Now extract data wrapper if it exists
  const finalData = (currentData && typeof currentData === 'object' && currentData.data) ? currentData.data : currentData;
  
  console.log(`🔍 [${correlationId}] Final data object for task_id extraction:`, {
    finalDataType: typeof finalData,
    finalDataKeys: finalData && typeof finalData === 'object' ? Object.keys(finalData) : null,
    hasDataWrapper: !!(currentData && typeof currentData === 'object' && currentData.data)
  });

  // Try different possible locations for task_id
  const possiblePaths = [
    finalData?.task_id,           // Standard: data.task_id
    finalData?.taskId,            // Camel case variant
    finalData?.task?.task_id,     // Nested: data.task.task_id
    finalData?.task?.id,          // Nested: data.task.id
    finalData?.id,                // Simple: data.id
    currentData?.task_id,         // Direct on original response
    currentData?.taskId,          // Direct camelCase on original response
  ];

  for (let i = 0; i < possiblePaths.length; i++) {
    const taskId = possiblePaths[i];
    if (taskId && (typeof taskId === 'string' || typeof taskId === 'number') && String(taskId).length > 0) {
      const finalTaskId = String(taskId);
      console.log(`✅ [${correlationId}] Found task_id at path ${i}:`, { taskId: finalTaskId, path: i, originalType: typeof taskId });
      return finalTaskId;
    }
  }

  console.log(`❌ [${correlationId}] No task_id found in any expected location:`, {
    possiblePaths: possiblePaths.map((p, i) => ({ index: i, value: p, type: typeof p })),
    finalDataKeys: finalData && typeof finalData === 'object' ? Object.keys(finalData) : null,
    finalDataType: typeof finalData,
    parseAttempts
  });

  return null;
}


/**
 * Add audio to existing video using PiAPI Kling Sound API
 */
async function addAudioToVideo(
  videoTaskId: string, 
  prompt: string, 
  klingApiKey: string,
  // For recovery system - save audio task ID immediately
  projectId?: string,
  storage?: any
): Promise<string> {
  const correlationId = randomUUID().substring(0, 8);
  console.log(`🔧 [${correlationId}] VERSION 2.1.0 - Adding audio to video via PiAPI Kling Sound...`, {
    videoTaskId,
    prompt: prompt.substring(0, 50) + "...",
    correlationId
  });

  // Create audio generation request using the correct origin_task_id method
  const audioRequestPayload = {
    model: "kling",
    task_type: "sound",
    input: {
      origin_task_id: videoTaskId // Use the video generation task ID, not video URL
    }
  };

  // Make request to PiAPI v1 endpoint
  const response = await fetch('https://api.piapi.ai/api/v1/task', {
    method: 'POST',
    headers: {
      'X-API-Key': klingApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(audioRequestPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Kling Sound API error:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Kling Sound API error: ${response.status} - ${errorText}`);
  }

  // 🔍 Raw body logging before JSON parsing
  const rawBody = await response.clone().text();
  console.log(`🔍 [${correlationId}] Raw Kling Sound API response:`, {
    contentType: response.headers.get('content-type'),
    bodyLength: rawBody.length,
    bodyPreview: rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : '')
  });

  const result = await response.json();
  
  // Use the resilient task_id extraction helper
  const taskId = getTaskId(result, correlationId);
  
  console.log(`✅ [${correlationId}] Kling Sound request submitted:`, {
    taskId: taskId,
    status: result?.data?.status || result?.status,
    hasTaskId: !!taskId,
    responseFormat: result.data ? 'wrapped' : 'direct'
  });

  if (!taskId) {
    console.error(`❌ CRITICAL [${correlationId}] Kling Sound API didn't return a task_id!`, {
      fullResponse: JSON.stringify(result, null, 2),
      rawBodyPreview: rawBody.substring(0, 500)
    });
    throw new Error(`Kling Sound API error: No task_id returned. Response: ${JSON.stringify(result)}`);
  }

  // 🚨 RECOVERY SYSTEM: Save audio task ID immediately for failed project recovery
  if (projectId && storage) {
    try {
      await storage.updateProject(projectId, { 
        klingSoundTaskId: taskId
      });
      console.log("✅ RECOVERY: Saved Kling audio task ID for recovery:", {
        projectId,
        soundTaskId: taskId,
        saved: "immediately"
      });
      
      // 🎯 INSTANT STATUS UPDATE: Change to "under_review" immediately after audio task submission
      try {
        await storage.updateProject(projectId, { 
          status: "under_review",
          progress: 90
        });
        console.log("🎯 INSTANT UPDATE: Project status changed to 'under_review' for audio generation:", {
          projectId,
          soundTaskId: taskId,
          newStatus: "under_review",
          progress: 90,
          benefit: "User sees immediate feedback for audio processing!"
        });
      } catch (statusError) {
        console.warn("⚠️ Failed to update audio status to under_review (continuing anyway):", {
          projectId,
          error: statusError instanceof Error ? statusError.message : "Unknown error"
        });
      }
    } catch (saveError) {
      console.error("⚠️ WARNING: Failed to save audio task ID for recovery (continuing anyway):", {
        projectId,
        soundTaskId: taskId,
        error: saveError instanceof Error ? saveError.message : "Unknown error"
      });
      // Don't throw - continue with audio generation even if save fails
    }
  } else {
    console.log("ℹ️ RECOVERY: No project/storage provided - audio task ID not saved for recovery:", {
      hasProjectId: !!projectId,
      hasStorage: !!storage,
      soundTaskId: taskId
    });
  }

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max for audio processing

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    attempts++;

    console.log(`Checking Kling Sound status, attempt ${attempts}/${maxAttempts}...`);

    // Check task status using PiAPI v1 endpoint
    const statusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: {
        'X-API-Key': klingApiKey,
      }
    });

    if (!statusResponse.ok) {
      console.error("Failed to check Kling Sound status:", statusResponse.status);
      
      // If we get persistent errors and have tried enough times, give up
      if (attempts > 5 && (statusResponse.status === 400 || statusResponse.status === 404)) {
        console.error(`Persistent Sound API errors (${statusResponse.status}) after ${attempts} attempts - giving up`);
        throw new Error(`Kling Sound status check failed: HTTP ${statusResponse.status} after ${attempts} attempts`);
      }
      continue;
    }

    const statusResult = await statusResponse.json();
    console.log("Kling Sound status update:", {
      status: statusResult.status,
      progress: statusResult.progress || 'N/A'
    });

    if (statusResult.status === 'completed' || statusResult.status === 'success') {
      console.log("Kling Sound generation completed!");
      
      // Get the video with audio URL from PiAPI v1 format
      const videoWithAudioUrl = statusResult.output?.video_url || 
                               statusResult.output?.works?.[0]?.video?.resource_without_watermark ||
                               statusResult.output?.works?.[0]?.video?.resource;
      
      if (!videoWithAudioUrl) {
        console.error("No video URL found in audio completion result:", statusResult);
        throw new Error("Video with audio URL not found in Kling Sound response");
      }

      console.log("Audio added to video successfully:", {
        originalVideoTaskId: videoTaskId,
        videoWithAudioUrl,
        attempts
      });

      return videoWithAudioUrl;
    }

    if (statusResult.status === 'failed' || statusResult.status === 'error') {
      console.error("Kling Sound generation failed:", statusResult);
      throw new Error(`Kling Sound generation failed: ${statusResult.error || 'Unknown error'}`);
    }

    // Continue polling if still processing
    if (statusResult.status === 'processing' || statusResult.status === 'pending' || statusResult.status === 'running') {
      console.log(`Kling Sound still processing... (${statusResult.progress || 'N/A'})`);
      continue;
    }
  }

  // Timeout reached
  throw new Error(`Kling Sound generation timed out after ${maxAttempts * 10} seconds`);
}

export async function generateVideoWithKling(
  imageUrl: string, 
  prompt: string, 
  durationSeconds: number = 10,
  includeAudio: boolean = false,
  negativePrompt: string = "",
  // For recovery system - save task ID immediately
  projectId?: string,
  storage?: any
): Promise<KlingVideoResult> {
  const correlationId = randomUUID().substring(0, 8);
  console.log(`🎬 [${correlationId}] VERSION 2.1.0 - Starting Kling AI video generation...`, {
    imageUrl,
    prompt: prompt.substring(0, 100) + "...",
    duration: durationSeconds,
    correlationId
  });

  try {
    // Use direct image URL instead of downloading and processing
    console.log("🌐 Using direct image URL for Kling API:", imageUrl);
    
    // Basic URL validation
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      throw new Error(`Invalid image URL: ${imageUrl}`);
    }
    
    console.log("✅ Direct URL approach - skipping image processing:", {
      imageUrl,
      urlLength: imageUrl.length,
      approach: "direct_url",
      payloadSize: "minimal"
    });

    // Prepare Kling AI request via PiAPI
    const klingApiKey = process.env.KLING_API_KEY;
    if (!klingApiKey) {
      throw new Error("KLING_API_KEY environment variable is required");
    }

    // ⚠️ CRITICAL: Optimize prompt for Kling AI's 2500 character limit
    const optimizedPrompt = optimizePromptForKling(prompt, 2500);
    


    // Validate and enhance prompt before sending to Kling

    // CRITICAL FIX: Keep prompt SIMPLE and SHORT for product preservation
let finalKlingPrompt = optimizedPrompt;

// Extract only the FIRST sentence about the product
const firstSentence = optimizedPrompt.split(/[.!]\s+/)[0];
const productMatch = firstSentence.match(/(can|bottle|box|product|energy drink)/i);
const baseDescription = productMatch ? firstSentence : optimizedPrompt.substring(0, 100);

// Check motion type and create CONCISE instruction
if (optimizedPrompt.toLowerCase().includes('inflate') || 
    optimizedPrompt.toLowerCase().includes('expand')) {
  
  finalKlingPrompt = `${baseDescription}. Product gradually inflates 25% larger, then returns to normal size.`;
  console.log("✅ Simplified inflation prompt (product preservation mode)");
  
} else if (optimizedPrompt.toLowerCase().includes('rotat')) {
  
  finalKlingPrompt = `${baseDescription}. Product slowly rotates 360 degrees showing all sides.`;
  console.log("✅ Simplified rotation prompt (product preservation mode)");
  
} else {
  // Default: Use only first 150 characters for static shots
  finalKlingPrompt = optimizedPrompt.substring(0, 150);
  console.log("✅ Simplified static prompt (product preservation mode)");
}

console.log("🎯 Kling prompt simplification:", {
  originalLength: optimizedPrompt.length,
  finalLength: finalKlingPrompt.length,
  reduction: `${Math.round((1 - finalKlingPrompt.length / optimizedPrompt.length) * 100)}%`,
  preservationMode: "ACTIVE"
});


// Check if prompt mentions rotation
if (optimizedPrompt.toLowerCase().includes('rotate') || 
    optimizedPrompt.toLowerCase().includes('spin')) {
  
  finalKlingPrompt = `PRODUCT ROTATION:
Product must SPIN showing different sides.
This is ROTATION, not inflation or glow.

${optimizedPrompt}`;
  
  console.log("✅ Added rotation clarification to Kling");
}

const requestPayload = {
  model: "kling",
  task_type: "video_generation", 
  input: {
    prompt: finalKlingPrompt,  // ← استخدم البرومبت المحسّن
    image_url: imageUrl,
    duration: durationSeconds,
    aspect_ratio: "16:9",
    mode: "std",
    cfg_scale: 0.7, // ← زوّد من 0.5 لـ 0.7
    negative_prompt: negativePrompt || "deformed, distorted, unnatural proportions"
  }
};
    // EXPLICIT LOGGING BEFORE PiAPI CALL - USE BYTE-ACCURATE VALIDATION
    const jsonPayload = JSON.stringify(requestPayload);
    const payloadSizeBytes = Buffer.byteLength(jsonPayload, 'utf8');
    console.log("🚀 SENDING REQUEST TO KLING AI VIA PiAPI - USING DIRECT URL METHOD:", {
      model: requestPayload.model,
      task_type: requestPayload.task_type,
      duration: requestPayload.input.duration,
      aspectRatio: requestPayload.input.aspect_ratio,
      imageUrl: imageUrl,
      imageUrlLength: imageUrl.length,
      originalPromptLength: prompt.length,
      optimizedPromptLength: optimizedPrompt.length,
      promptOptimized: prompt.length !== optimizedPrompt.length,
      promptReduction: prompt.length > optimizedPrompt.length ? `${Math.round((1 - optimizedPrompt.length / prompt.length) * 100)}%` : 'none',
      promptBytes: Buffer.byteLength(optimizedPrompt, 'utf8'),
      payloadSizeBytes,
      payloadSizeKB: Math.round(payloadSizeBytes / 1024),
      METHOD: "DIRECT_URL_NO_BASE64",
      apiEndpoint: 'https://api.piapi.ai/api/v1/task'
    });
    
    // ✅ EXPLICIT VALIDATION: Make sure we're sending URL not base64
    if (requestPayload.input.image_url.startsWith('/9j/') || requestPayload.input.image_url.length > 1000) {
      throw new Error(`🚨 CRITICAL: Still sending base64 instead of URL! Length: ${requestPayload.input.image_url.length}`);
    }
    
    console.log("✅ VALIDATION PASSED: Sending direct URL to Kling API:", requestPayload.input.image_url);

    // Make request to PiAPI v1 endpoint
    const response = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'X-API-Key': klingApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kling AI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Kling AI API error: ${response.status} - ${errorText}`);
    }

    // 🔍 Raw body logging before JSON parsing
    const rawBody = await response.clone().text();
    console.log(`🔍 [${correlationId}] Raw Kling AI response:`, {
      contentType: response.headers.get('content-type'),
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : '')
    });

    const result = await response.json();
    
    // 🔍 CRITICAL DEBUG: Let's see exactly what getTaskId receives
    console.log(`🔍 [${correlationId}] EXACT RESPONSE ANALYSIS:`, {
      result: result,
      resultType: typeof result,
      resultJSON: JSON.stringify(result, null, 2)
    });
    
    // Use the resilient task_id extraction helper
    const taskId = getTaskId(result, correlationId);
    
    // 🔍 CRITICAL DEBUG: Let's see what getTaskId returned
    console.log(`🔍 [${correlationId}] getTaskId RETURNED:`, {
      taskId: taskId,
      taskIdType: typeof taskId,
      taskIdLength: taskId ? taskId.length : 0
    });
    
    console.log(`✅ [${correlationId}] Kling AI request submitted successfully:`, {
      taskId: taskId,
      status: result?.data?.status || result?.status,
      hasTaskId: !!taskId,
      responseFormat: result.data ? 'wrapped' : 'direct'
    });

    // Validate that we got a task ID
    if (!taskId) {
      console.error(`❌ CRITICAL [${correlationId}] Kling AI didn't return a task_id!`, {
        fullResponse: JSON.stringify(result, null, 2),
        rawBodyPreview: rawBody.substring(0, 500)
      });
      throw new Error(`Kling AI API error: No task_id returned. Response: ${JSON.stringify(result)}`);
    }

    // 🚨 RECOVERY SYSTEM: Save task ID immediately for failed project recovery
    if (projectId && storage) {
      try {
        await storage.updateProject(projectId, { 
          klingVideoTaskId: taskId
          // Don't overwrite includeAudio - keep original user choice
        });
        console.log("✅ RECOVERY: Saved Kling video task ID for recovery:", {
          projectId,
          taskId,
          includeAudio,
          saved: "immediately"
        });
        
        // 🎯 INSTANT STATUS UPDATE: Change to "under_review" immediately after task submission
        try {
          await storage.updateProject(projectId, { 
            status: "under_review",
            progress: 85
          });
          console.log("🎯 INSTANT UPDATE: Project status changed to 'under_review' immediately after Kling submission:", {
            projectId,
            taskId,
            newStatus: "under_review",
            progress: 85,
            benefit: "User sees immediate feedback instead of waiting 4 minutes!"
          });
        } catch (statusError) {
          console.warn("⚠️ Failed to update status to under_review (continuing anyway):", {
            projectId,
            error: statusError instanceof Error ? statusError.message : "Unknown error"
          });
        }
      } catch (saveError) {
        console.error("⚠️ WARNING: Failed to save task ID for recovery (continuing anyway):", {
          projectId,
          taskId,
          error: saveError instanceof Error ? saveError.message : "Unknown error"
        });
        // Don't throw - continue with video generation even if save fails
      }
    } else {
      console.log("ℹ️ RECOVERY: No project/storage provided - task ID not saved for recovery:", {
        hasProjectId: !!projectId,
        hasStorage: !!storage,
        taskId
      });
    }

    // NEW 4-MINUTE WAIT STRATEGY: Single wait + one status check to save API costs
    // IMPROVED POLLING STRATEGY: Check every 10 seconds with progress updates
console.log(`🕐 [${correlationId}] Starting polling with progress updates...`, { 
  taskId,
  checkInterval: "10 seconds",
  maxDuration: "5 minutes"
});

const maxAttempts = 30; // 30 attempts × 10 seconds = 5 minutes max
let attempts = 0;
let statusResult: any;

while (attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  attempts++;

  // Calculate progress percentage (80-95% range during video generation)
  const progressPercent = 80 + Math.floor((attempts / maxAttempts) * 15);
  
  // Update database progress if we have projectId and storage
  if (projectId && storage) {
    try {
      await storage.updateProject(projectId, { 
        progress: progressPercent 
      });
      console.log(`📊 [${correlationId}] Progress updated:`, {
        attempt: attempts,
        maxAttempts,
        progress: progressPercent
      });
    } catch (updateError) {
      console.warn(`⚠️ Failed to update progress:`, updateError);
      // Continue even if update fails
    }
  }

  console.log(`🔍 [${correlationId}] Checking video status (${attempts}/${maxAttempts})...`);

  // Check task status
  const statusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
    headers: { 'X-API-Key': klingApiKey }
  });

  if (!statusResponse.ok) {
    console.warn(`⚠️ [${correlationId}] Status check failed:`, {
      status: statusResponse.status,
      attempt: attempts
    });
    
    // Only throw error after multiple failures
    if (attempts > 3 && statusResponse.status === 404) {
      throw new Error(`Task not found after ${attempts} attempts`);
    }
    continue;
  }

  statusResult = await statusResponse.json();
  const taskStatus = statusResult?.status || statusResult?.data?.status;
  const taskProgress = statusResult?.progress || statusResult?.data?.progress;

  console.log(`📹 [${correlationId}] Status:`, {
    status: taskStatus,
    progress: taskProgress || 'N/A',
    attempt: attempts
  });

  // Check if completed
  if (taskStatus === 'completed' || taskStatus === 'success') {
    console.log(`✅ [${correlationId}] Video completed after ${attempts * 10} seconds!`);
    break;
  }

  // Check if failed
  if (taskStatus === 'failed' || taskStatus === 'error') {
    const errorMessage = statusResult.error || statusResult.data?.error || 'Unknown error';
    throw new Error(`Kling AI generation failed: ${errorMessage}`);
  }

  // Continue polling if still processing
  if (taskStatus === 'processing' || taskStatus === 'pending' || taskStatus === 'running') {
    console.log(`⏳ [${correlationId}] Still processing...`);
    continue;
  }
}

// Check if we completed successfully
if (attempts >= maxAttempts) {
  throw new Error(`Video generation timed out after ${maxAttempts * 10} seconds`);
}

// Now statusResult has the completed task
const taskStatus = statusResult?.status || statusResult?.data?.status;
    const taskProgress = statusResult?.progress || statusResult?.data?.progress;
    
    console.log(`✅ [${correlationId}] Final status check result:`, {
      status: taskStatus,
      progress: taskProgress || 'N/A',
      extractedFrom: statusResult?.status ? 'direct' : statusResult?.data?.status ? 'data.status' : 'none',
      waitTime: "4 minutes",
      apiCallsUsed: 1
    });

    if (taskStatus === 'completed' || taskStatus === 'success') {
      console.log(`🎬 [${correlationId}] Kling AI video generation completed after 4-minute wait!`);
        
      // Get video URL from response
      const outputData = statusResult.output || statusResult.data?.output;
      const videoUrl = outputData?.video_url || 
                      outputData?.works?.[0]?.video?.resource_without_watermark ||
                      outputData?.works?.[0]?.video?.resource;
      
      if (!videoUrl) {
        console.error(`❌ [${correlationId}] No video URL found in completed result:`, {
          statusResult,
          outputData,
          hasOutput: !!outputData,
          outputKeys: outputData ? Object.keys(outputData) : null
        });
        throw new Error("Video URL not found in Kling AI response");
      }

      console.log(`🎉 [${correlationId}] Kling AI video generation successful:`, {
        videoUrl,
        duration: durationSeconds,
        strategy: "4-minute-wait",
        apiCallsUsed: 1,
        costSavings: "59 API calls saved!"
      });

      // Add audio if requested
      let finalVideoUrl = videoUrl;
      if (includeAudio) {
        console.log(`🔊 [${correlationId}] AUDIO INTEGRATION REQUESTED:`, {
          originalVideoUrl: videoUrl,
          prompt: prompt.substring(0, 100) + "...",
          includeAudio: includeAudio
        });
        try {
          finalVideoUrl = await addAudioToVideo(taskId, prompt, klingApiKey, projectId, storage);
          console.log(`🎵 [${correlationId}] AUDIO ADDED SUCCESSFULLY:`, {
            originalVideoUrl: videoUrl,
            originalVideoTaskId: taskId,
            videoWithAudioUrl: finalVideoUrl,
            audioIntegrationSuccess: true
          });
        } catch (audioError) {
          const errorMessage = audioError instanceof Error ? audioError.message : String(audioError);
          const errorStack = audioError instanceof Error ? audioError.stack : undefined;
          console.error(`❌ [${correlationId}] AUDIO INTEGRATION FAILED:`, {
            originalVideoUrl: videoUrl,
            audioError: errorMessage,
            audioErrorStack: errorStack,
            fallbackToOriginalVideo: true
          });
          // Continue with original video if audio fails
        }
      } else {
        console.log(`🔇 [${correlationId}] NO AUDIO REQUESTED - using original video only`);
      }

      return {
        url: finalVideoUrl,
        duration: durationSeconds,
        fullTaskDetails: statusResult // NEW: Include complete task details for UI display
      };
    }

    if (taskStatus === 'failed' || taskStatus === 'error') {
      console.error(`❌ [${correlationId}] Kling AI generation failed:`, statusResult);
      const errorMessage = statusResult.error || statusResult.data?.error || statusResult.message || statusResult.data?.message || 'Unknown error';
      throw new Error(`Kling AI generation failed: ${errorMessage}`);
    }

    // If still processing after 4 minutes, might need more time
    if (taskStatus === 'processing' || taskStatus === 'pending' || taskStatus === 'running') {
      console.warn(`⏳ [${correlationId}] Video still processing after 4 minutes - this is unusual but can happen for complex videos`);
      throw new Error(`Kling AI generation still processing after 4 minutes. Status: ${taskStatus}. This might need manual checking.`);
    }
    
    // Unexpected status
    console.error(`❓ [${correlationId}] Unexpected Kling AI status after 4 minutes:`, {
      status: taskStatus,
      fullTaskDetails: statusResult
    });
    throw new Error(`Unexpected Kling AI status after 4 minutes: ${taskStatus}`);

  } catch (error) {
    console.error(`❌ [${correlationId}] Kling AI video generation error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Re-throw with more context
    throw new Error(`Kling AI video generation failed: ${errorMessage}`);
  }
}