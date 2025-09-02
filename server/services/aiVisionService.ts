import OpenAI from "openai";
import { db } from "../db";
import { system_settings } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VerificationResult {
  ai_verification_result: "complete" | "not_complete" | "unclear";
  ai_feedback: string;
}

/**
 * Analyzes uploaded photos to verify task completion
 * @param taskTitle The title of the task to verify
 * @param base64Images Array of base64 encoded image data
 * @param previousAttempts Previous verification attempts
 * @param userTimezone User's timezone for date context
 * @returns AI verification result and feedback
 */
/**
 * Get the AI verification prompt from database or use default
 */
async function getAIPrompt(): Promise<string> {
  try {
    const [promptSetting] = await db
      .select()
      .from(system_settings)
      .where(eq(system_settings.setting_key, 'ai_verification_prompt'))
      .limit(1);
    
    if (promptSetting?.setting_value) {
      return promptSetting.setting_value;
    }
  } catch (error) {
    console.error("Failed to fetch AI prompt from database:", error);
  }
  
  // Return default prompt if database fetch fails or no prompt exists
  return `You are an AI assistant helping users verify task completion through photos.

Task to verify: {task_title}

Analyze the image(s) and determine if the task has been completed:
- For cleaning tasks: Look for clean, organized spaces
- For exercise/outdoor tasks: Be lenient, any relevant activity counts
- For work/study tasks: Look for evidence of completed work
- For pill/medication tasks: Check if compartments are empty

Respond with:
- "complete" if the task appears done
- "not_complete" if clearly not done
- "unclear" if you cannot determine

Provide brief, encouraging feedback.`;
}

export const verifyTaskWithPhoto = async (
  taskTitle: string,
  base64Images: Array<{ data: string; mimetype: string }>,
  previousAttempts: any[] = [],
  userTimezone: string = "UTC",
): Promise<VerificationResult> => {
  try {
    // Get custom prompt from database
    const customPrompt = await getAIPrompt();
    
    // Replace {task_title} placeholder with actual task title
    const processedPrompt = customPrompt.replace(/\{task_title\}/g, taskTitle);
    // Prepare image content for the AI
    const imageContents = base64Images.map((image, index) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${image.mimetype};base64,${image.data}`,
        detail: "high", // Use high detail for better analysis
      },
    }));

    // Add text indicators for multiple images
    const imageTexts = base64Images.map(
      (_, index) => `Image ${index + 1} of ${base64Images.length}:`,
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${processedPrompt}

Current date: ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: userTimezone,
          })}

${
  previousAttempts.length > 0
    ? `
Previous verification attempts:
${previousAttempts
  .slice(0, 3)
  .map(
    (attempt, index) => `
Attempt ${previousAttempts.length - index}: ${attempt.ai_feedback}
Result: ${attempt.ai_verification_result}
`,
  )
  .join("")}
`
    : ""
}

${
  base64Images.length > 1
    ? `Multiple images provided (${base64Images.length} total):
• Analyze ALL images together as evidence
• Look for consistency between images
• Different angles might show different aspects of completion`
    : "Single image provided for verification"
}

Respond in JSON format with:
{
  "ai_verification_result": "complete" | "not_complete" | "unclear",
  "ai_feedback": "Your encouraging feedback here"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please verify if this task has been completed using these ${base64Images.length} images: "${taskTitle}"\n${imageTexts.join("\n")}`,
            },
            ...imageContents,
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400, // Increased for multiple image analysis
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate the response structure
    if (!result.ai_verification_result || !result.ai_feedback) {
      throw new Error("Invalid AI response format");
    }

    // Ensure result is one of the expected values
    if (
      !["complete", "not_complete", "unclear"].includes(
        result.ai_verification_result,
      )
    ) {
      throw new Error("Invalid verification result");
    }

    return {
      ai_verification_result: result.ai_verification_result,
      ai_feedback: result.ai_feedback,
    };
  } catch (error) {
    console.error("AI Vision verification error:", error);

    return {
      ai_verification_result: "unclear",
      ai_feedback: `Unable to analyze the ${base64Images.length > 1 ? "photos" : "photo"} at this time. Please try uploading again or mark the task as complete manually.`,
    };
  }
};
