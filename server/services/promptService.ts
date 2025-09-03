import { db } from "../db";
import { ai_prompts, type AiPrompt, type InsertAiPrompt } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Service for managing AI prompts with versioning, templating, and fallbacks
 */
export class PromptService {
  /**
   * Get the currently active prompt for a given type
   */
  static async getActivePrompt(type: string): Promise<string> {
    try {
      const [activePrompt] = await db
        .select()
        .from(ai_prompts)
        .where(and(eq(ai_prompts.type, type), eq(ai_prompts.is_active, true)))
        .limit(1);

      if (activePrompt) {
        return activePrompt.content;
      }

      // Fallback to default prompt if no active prompt found
      return await this.getFallbackPrompt(type);
    } catch (error) {
      console.error(`Error getting active prompt for type ${type}:`, error);
      return await this.getFallbackPrompt(type);
    }
  }

  /**
   * Get the fallback/default prompt for a given type
   */
  static async getFallbackPrompt(type: string): Promise<string> {
    try {
      const [defaultPrompt] = await db
        .select()
        .from(ai_prompts)
        .where(and(eq(ai_prompts.type, type), eq(ai_prompts.is_default, true)))
        .limit(1);

      if (defaultPrompt) {
        return defaultPrompt.content;
      }

      // Ultimate fallback - return hardcoded basic prompt
      return this.getHardcodedFallback(type);
    } catch (error) {
      console.error(`Error getting fallback prompt for type ${type}:`, error);
      return this.getHardcodedFallback(type);
    }
  }

  /**
   * Render a prompt template with variables
   */
  static renderPrompt(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Replace template variables with actual values
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      let replacement = '';

      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          replacement = value;
        } else if (typeof value === 'object') {
          replacement = JSON.stringify(value);
        } else {
          replacement = String(value);
        }
      }

      rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return rendered;
  }

  /**
   * Validate prompt content for basic structure and safety
   */
  static validatePrompt(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic length check
    if (content.length < 10) {
      errors.push("Prompt must be at least 10 characters long");
    }

    if (content.length > 10000) {
      errors.push("Prompt must be less than 10,000 characters");
    }

    // Check for required JSON response format for image verification
    if (!content.includes('ai_verification_result') && !content.includes('JSON')) {
      errors.push("Image verification prompts should specify JSON response format");
    }

    // Check for potentially harmful instructions
    const harmfulPatterns = [
      /ignore\s+(previous|above|system)\s+instructions/i,
      /jailbreak/i,
      /roleplay|role.play/i,
    ];

    harmfulPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push("Prompt contains potentially harmful instructions");
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new prompt version
   */
  static async createPrompt(promptData: Omit<InsertAiPrompt, 'id' | 'version'>): Promise<AiPrompt> {
    // Get the next version number for this type
    const [latestVersion] = await db
      .select()
      .from(ai_prompts)
      .where(eq(ai_prompts.type, promptData.type))
      .orderBy(desc(ai_prompts.version))
      .limit(1);

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
    const promptId = `${promptData.type}_v${nextVersion}_${nanoid(8)}`;

    const newPrompt: InsertAiPrompt = {
      ...promptData,
      id: promptId,
      version: nextVersion,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const [created] = await db
      .insert(ai_prompts)
      .values(newPrompt)
      .returning();

    return created;
  }

  /**
   * Activate a specific prompt (deactivates others of the same type)
   */
  static async activatePrompt(promptId: string): Promise<void> {
    const [prompt] = await db
      .select()
      .from(ai_prompts)
      .where(eq(ai_prompts.id, promptId))
      .limit(1);

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Deactivate all prompts of the same type
    await db
      .update(ai_prompts)
      .set({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .where(eq(ai_prompts.type, prompt.type));

    // Activate the selected prompt
    await db
      .update(ai_prompts)
      .set({ 
        is_active: true, 
        updated_at: new Date().toISOString() 
      })
      .where(eq(ai_prompts.id, promptId));
  }

  /**
   * Get all prompts for a given type
   */
  static async getPromptsByType(type: string): Promise<AiPrompt[]> {
    return await db
      .select()
      .from(ai_prompts)
      .where(eq(ai_prompts.type, type))
      .orderBy(desc(ai_prompts.version));
  }

  /**
   * Get all prompt types
   */
  static async getPromptTypes(): Promise<string[]> {
    const results = await db
      .selectDistinct({ type: ai_prompts.type })
      .from(ai_prompts);

    return results.map(r => r.type);
  }

  /**
   * Hardcoded fallback prompts as last resort
   */
  private static getHardcodedFallback(type: string): string {
    switch (type) {
      case 'image_verification':
        return `You are an AI assistant helping users verify task completion through photos. 
        
Task to verify: "{{taskTitle}}"

Analyze the provided images and determine if the task has been completed.

Respond in JSON format with:
{
  "ai_verification_result": "complete" | "not_complete" | "unclear",
  "ai_feedback": "Your analysis of the images"
}`;
      
      default:
        return `You are an AI assistant. Please analyze the provided input and respond appropriately for task type: ${type}`;
    }
  }

  /**
   * Delete a prompt (only if not active or default)
   */
  static async deletePrompt(promptId: string): Promise<void> {
    const [prompt] = await db
      .select()
      .from(ai_prompts)
      .where(eq(ai_prompts.id, promptId))
      .limit(1);

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    if (prompt.is_active) {
      throw new Error("Cannot delete active prompt");
    }

    if (prompt.is_default) {
      throw new Error("Cannot delete default prompt");
    }

    await db
      .delete(ai_prompts)
      .where(eq(ai_prompts.id, promptId));
  }
}