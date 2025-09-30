import { GoogleGenerativeAI } from "@google/generative-ai";

export interface MotionMetrics {
  horizontalSpeed: number;
  verticalSpeed: number;
  rotationSpeed: number;
  scaleSpeed: number;
  accelerationType: 'constant' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface VideoFrame {
  frameUrl: string;
  timestamp: number;
  frameNumber: number;
}

export async function extractQuantifiedMotion(frames: VideoFrame[]): Promise<MotionMetrics> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const keyFrames = [
    frames[0],
    frames[Math.floor(frames.length / 2)],
    frames[frames.length - 1]
  ].filter(Boolean);

  console.log("Analyzing motion between", keyFrames.length, "key frames");

  const prompt = 'Analyze the motion between these sequential video frames. Provide NUMERIC values for object/product movement: 1. Horizontal Movement (pixels per frame), 2. Vertical Movement (pixels per frame), 3. Rotation (degrees per frame), 4. Scale Change (percentage per frame), 5. Acceleration Pattern. IMPORTANT: Focus on PRIMARY SUBJECT motion, not camera. Respond ONLY with valid JSON: {"horizontalSpeed":<number>,"verticalSpeed":<number>,"rotationSpeed":<number>,"scaleSpeed":<number>,"accelerationType":"constant|ease-in|ease-out|ease-in-out"}';

  try {
    const frameImages = await Promise.all(
      keyFrames.map(async (frame) => {
        const response = await fetch(frame.frameUrl);
        const buffer = await response.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: 'image/jpeg'
          }
        };
      })
    );

    const result = await model.generateContent([prompt, ...frameImages]);
    const responseText = result.response.text();
    console.log("Motion analysis response:", responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse motion metrics from Gemini response");
    }

    const metrics: MotionMetrics = JSON.parse(jsonMatch[0]);
    console.log("Extracted motion metrics:", metrics);
    return metrics;

  } catch (error) {
    console.error("Motion analysis failed:", error);
    return {
      horizontalSpeed: 0,
      verticalSpeed: 0,
      rotationSpeed: 0,
      scaleSpeed: 0,
      accelerationType: 'constant'
    };
  }
}

/**
 * تحليل الحركة من 6 صور متتالية باستخدام Gemini Vision
 */
export async function analyzeMotionFromFrames(frameUrls: string[]): Promise<MotionMetrics> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  console.log("🎯 Analyzing motion from", frameUrls.length, "sequential frames");

  const prompt = `Analyze these ${frameUrls.length} sequential frames from a video (in chronological order).

Measure the EXACT changes between frames:

1. HORIZONTAL MOVEMENT: pixels per frame (+ = right, - = left)
2. VERTICAL MOVEMENT: pixels per frame (+ = down, - = up)  
3. ROTATION: degrees per frame (+ = clockwise, - = counterclockwise)
4. SCALE CHANGE: percentage per frame (+ = growing, - = shrinking)
5. ACCELERATION: constant|ease-in|ease-out|ease-in-out

CRITICAL: Focus on the PRODUCT/OBJECT motion, NOT camera movement.

Respond ONLY with valid JSON:
{
  "horizontalSpeed": <number>,
  "verticalSpeed": <number>,
  "rotationSpeed": <number>,
  "scaleSpeed": <number>,
  "accelerationType": "constant|ease-in|ease-out|ease-in-out"
}`;

  try {
    const frameImages = await Promise.all(
      frameUrls.map(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: 'image/jpeg'
          }
        };
      })
    );

    const result = await model.generateContent([prompt, ...frameImages]);
    const responseText = result.response.text();
    console.log("📊 Motion analysis from frames:", responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse motion metrics");
    }

    const metrics: MotionMetrics = JSON.parse(jsonMatch[0]);
    console.log("✅ Motion metrics extracted:", metrics);
    return metrics;

  } catch (error) {
    console.error("❌ Motion analysis failed:", error);
    return {
      horizontalSpeed: 0,
      verticalSpeed: 0,
      rotationSpeed: 0,
      scaleSpeed: 0,
      accelerationType: 'constant'
    };
  }
}

export function buildKlingMotionPrompt(
  basePrompt: string,
  motionMetrics: MotionMetrics,
  duration: number,
  fps: number = 30
): string {
  const hSpeedPerSec = motionMetrics.horizontalSpeed * fps;
  const vSpeedPerSec = motionMetrics.verticalSpeed * fps;
  const rotationPerSec = motionMetrics.rotationSpeed * fps;
  const scalePerSec = motionMetrics.scaleSpeed * fps;

  const directionDesc = [];
  if (Math.abs(hSpeedPerSec) > 5) {
    directionDesc.push(hSpeedPerSec > 0 ? "moving RIGHT" : "moving LEFT");
  }
  if (Math.abs(vSpeedPerSec) > 5) {
    directionDesc.push(vSpeedPerSec > 0 ? "moving DOWN" : "moving UP");
  }
  if (Math.abs(rotationPerSec) > 5) {
    directionDesc.push(rotationPerSec > 0 ? "rotating CLOCKWISE" : "rotating COUNTER-CLOCKWISE");
  }
  if (Math.abs(scalePerSec) > 2) {
    directionDesc.push(scalePerSec > 0 ? "GROWING in size" : "SHRINKING in size");
  }

  const motionDescription = directionDesc.length > 0 ? directionDesc.join(", ") : "remaining STATIC";

  const timingMap = {
    'constant': 'linear, constant speed',
    'ease-in': 'starting slow, accelerating',
    'ease-out': 'starting fast, decelerating',
    'ease-in-out': 'smooth acceleration then deceleration'
  };

  return basePrompt + '\n\nMOTION PHYSICS (Apply exactly to product):\nDirection: Product is ' + motionDescription + '\nTiming: Motion is ' + timingMap[motionMetrics.accelerationType] + '\nSpeed: ' + Math.abs(hSpeedPerSec).toFixed(0) + 'px/sec horizontal, ' + Math.abs(vSpeedPerSec).toFixed(0) + 'px/sec vertical\nRotation: ' + Math.abs(rotationPerSec).toFixed(1) + ' degrees/second\nScale: ' + Math.abs(scalePerSec).toFixed(1) + '% size change per second\n\nDuration: ' + duration + ' seconds total\nExecute this EXACT motion pattern on the product while maintaining scene quality.';
}
