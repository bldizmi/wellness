import OpenAI from "openai";
import { PromptService } from "./promptService";

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
export const verifyTaskWithPhoto = async (
  taskTitle: string,
  base64Images: Array<{ data: string; mimetype: string }>,
  previousAttempts: any[] = [],
  userTimezone: string = "UTC",
): Promise<VerificationResult> => {
  try {
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

    // Get the dynamic prompt from database
    const promptTemplate = await PromptService.getActivePrompt('image_verification');
    
    // Prepare variables for prompt rendering
    const promptVariables = {
      taskTitle,
      currentDate: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: userTimezone,
      }),
      previousAttemptsSection: previousAttempts.length > 0
        ? `Previous verification attempts:
${previousAttempts
  .slice(0, 3)
  .map(
    (attempt, index) => `Attempt ${previousAttempts.length - index}: ${attempt.ai_feedback}
Result: ${attempt.ai_verification_result}`
  )
  .join("\n\n")}`
        : "",
      imageCount: base64Images.length
    };

    // Render the prompt with variables
    const systemPrompt = PromptService.renderPrompt(promptTemplate, promptVariables);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
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

    // If error occurred during prompt rendering or AI call, try with fallback
    if (error.message && error.message.includes("prompt")) {
      console.warn("Prompt service failed, attempting with fallback prompt");
      try {
        const fallbackPrompt = await PromptService.getFallbackPrompt('image_verification');
        const fallbackVariables = {
          taskTitle,
          currentDate: new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric", 
            month: "long",
            day: "numeric",
            timeZone: userTimezone,
          }),
          previousAttemptsSection: "",
          imageCount: base64Images.length
        };
        
        const fallbackSystemPrompt = PromptService.renderPrompt(fallbackPrompt, fallbackVariables);
        
        const fallbackResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: fallbackSystemPrompt },
            { role: "user", content: [
              { type: "text", text: `Please verify if this task has been completed: "${taskTitle}"` },
              ...imageContents,
            ]}
          ],
          response_format: { type: "json_object" },
          max_tokens: 400,
        });
        
        const fallbackResult = JSON.parse(fallbackResponse.choices[0].message.content || "{}");
        if (fallbackResult.ai_verification_result && fallbackResult.ai_feedback) {
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.error("Fallback prompt also failed:", fallbackError);
      }
    }

    return {
      ai_verification_result: "unclear",
      ai_feedback: `Unable to analyze the ${base64Images.length > 1 ? "photos" : "photo"} at this time. Please try uploading again or mark the task as complete manually.`,
    };
  }
};
