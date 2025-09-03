import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { PromptService } from "../../services/promptService";
import { db } from "../../db";
import { users, ai_prompts, type AiPrompt } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Middleware to check admin role
const adminMiddleware = async (req: any, res: any, next: any) => {
  try {
    const { user_id } = req;
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebase_uid, user_id));

    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
};

// Apply auth and admin middleware to all routes
router.use(authMiddleware, adminMiddleware);

/**
 * GET /api/admin/prompts - List all prompts
 */
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;

    let prompts: AiPrompt[];
    if (type) {
      prompts = await PromptService.getPromptsByType(type as string);
    } else {
      // Get all prompts grouped by type
      const allPrompts = await db.select().from(ai_prompts);
      prompts = allPrompts;
    }

    res.json({
      success: true,
      prompts,
      total: prompts.length
    });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
});

/**
 * GET /api/admin/prompts/types - Get all prompt types
 */
router.get("/types", async (req, res) => {
  try {
    const types = await PromptService.getPromptTypes();
    res.json({
      success: true,
      types
    });
  } catch (error) {
    console.error("Error fetching prompt types:", error);
    res.status(500).json({ error: "Failed to fetch prompt types" });
  }
});

/**
 * GET /api/admin/prompts/:type/active - Get active prompt for type
 */
router.get("/:type/active", async (req, res) => {
  try {
    const { type } = req.params;
    const activePromptContent = await PromptService.getActivePrompt(type);
    
    // Get the full prompt record
    const [activePrompt] = await db
      .select()
      .from(ai_prompts)
      .where(eq(ai_prompts.type, type))
      .limit(1);

    res.json({
      success: true,
      content: activePromptContent,
      prompt: activePrompt || null
    });
  } catch (error) {
    console.error("Error fetching active prompt:", error);
    res.status(500).json({ error: "Failed to fetch active prompt" });
  }
});

/**
 * POST /api/admin/prompts - Create new prompt
 */
router.post("/", async (req, res) => {
  try {
    const { user_id } = req;
    
    const createSchema = z.object({
      name: z.string().min(1, "Name is required"),
      type: z.string().min(1, "Type is required"),
      content: z.string().min(10, "Content must be at least 10 characters"),
      variables: z.record(z.string()).optional(),
      is_active: z.boolean().default(false),
      is_default: z.boolean().default(false),
      metadata: z.record(z.any()).optional(),
    });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.errors
      });
    }

    // Validate prompt content
    const validation = PromptService.validatePrompt(parsed.data.content);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid prompt content",
        details: validation.errors
      });
    }

    const newPrompt = await PromptService.createPrompt({
      ...parsed.data,
      created_by: user_id,
    });

    // If marked as active, activate it
    if (parsed.data.is_active) {
      await PromptService.activatePrompt(newPrompt.id);
    }

    res.status(201).json({
      success: true,
      prompt: newPrompt,
      message: "Prompt created successfully"
    });

  } catch (error) {
    console.error("Error creating prompt:", error);
    res.status(500).json({ error: "Failed to create prompt" });
  }
});

/**
 * PUT /api/admin/prompts/:id - Update prompt
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req;

    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      content: z.string().min(10).optional(),
      variables: z.record(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.errors
      });
    }

    // Validate prompt content if provided
    if (parsed.data.content) {
      const validation = PromptService.validatePrompt(parsed.data.content);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Invalid prompt content",
          details: validation.errors
        });
      }
    }

    const [updatedPrompt] = await db
      .update(ai_prompts)
      .set({
        ...parsed.data,
        updated_at: new Date().toISOString()
      })
      .where(eq(ai_prompts.id, id))
      .returning();

    if (!updatedPrompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    res.json({
      success: true,
      prompt: updatedPrompt,
      message: "Prompt updated successfully"
    });

  } catch (error) {
    console.error("Error updating prompt:", error);
    res.status(500).json({ error: "Failed to update prompt" });
  }
});

/**
 * POST /api/admin/prompts/:id/activate - Activate prompt
 */
router.post("/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    
    await PromptService.activatePrompt(id);

    res.json({
      success: true,
      message: "Prompt activated successfully"
    });

  } catch (error) {
    console.error("Error activating prompt:", error);
    
    if (error instanceof Error && error.message === "Prompt not found") {
      return res.status(404).json({ error: "Prompt not found" });
    }
    
    res.status(500).json({ error: "Failed to activate prompt" });
  }
});

/**
 * POST /api/admin/prompts/test - Test prompt with sample data
 */
router.post("/test", async (req, res) => {
  try {
    const testSchema = z.object({
      content: z.string().min(1, "Content is required"),
      variables: z.record(z.any()).optional().default({}),
      sampleData: z.object({
        taskTitle: z.string().default("Sample Task"),
        userTimezone: z.string().default("UTC"),
        imageCount: z.number().default(1)
      }).optional()
    });

    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid test data",
        details: parsed.error.errors
      });
    }

    // Validate prompt
    const validation = PromptService.validatePrompt(parsed.data.content);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid prompt content",
        details: validation.errors
      });
    }

    // Render prompt with sample data
    const sampleVariables = {
      taskTitle: parsed.data.sampleData?.taskTitle || "Sample Task",
      currentDate: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric", 
        month: "long",
        day: "numeric",
        timeZone: parsed.data.sampleData?.userTimezone || "UTC"
      }),
      previousAttemptsSection: "",
      imageCount: parsed.data.sampleData?.imageCount || 1,
      ...parsed.data.variables
    };

    const renderedPrompt = PromptService.renderPrompt(parsed.data.content, sampleVariables);

    res.json({
      success: true,
      renderedPrompt,
      sampleVariables,
      validation
    });

  } catch (error) {
    console.error("Error testing prompt:", error);
    res.status(500).json({ error: "Failed to test prompt" });
  }
});

/**
 * DELETE /api/admin/prompts/:id - Delete prompt
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    await PromptService.deletePrompt(id);

    res.json({
      success: true,
      message: "Prompt deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting prompt:", error);
    
    if (error instanceof Error) {
      if (error.message === "Prompt not found") {
        return res.status(404).json({ error: "Prompt not found" });
      }
      if (error.message.includes("Cannot delete")) {
        return res.status(400).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

export default router;