import OpenAI from "openai";

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping users verify task completion through multiple photos. Analyze all images carefully together to determine completion status.

Task to verify: "${taskTitle}"
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

Critical instructions for multiple images:
• Analyze ALL images together as evidence
• Look for consistency or contradictions between images
• Different angles might show different aspects of completion
• Some images might show setup while others show results
• For pill organizers: Check if ALL images show empty compartments for today
• For cleaning tasks: Look for before/after evidence across images
• For exercise: Multiple angles might better show completion
• If any image clearly shows incompletion, the overall result should be "not_complete"
• Only mark "complete" if ALL images collectively show clear evidence

Analysis approach:
1. Examine each image individually first
2. Then look for relationships between images
3. Note any inconsistencies
4. Determine if images collectively prove completion
5. Consider if additional angles would help verification

Respond in JSON format with:
{
  "ai_verification_result": "complete" | "not_complete" | "unclear",
  "ai_feedback": "• Image 1 shows...\n• Image 2 shows...\n• Combined they show..."
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
