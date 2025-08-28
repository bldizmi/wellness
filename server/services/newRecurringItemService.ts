/**
 * Phase 1: New Recurring Item Architecture Service
 *
 * This service implements the dual-write system for the new recurring item architecture.
 * During Phase 1, all writes go to both old and new systems, but reads still use the old system.
 * This ensures zero breaking changes while establishing the foundation for migration.
 */

import { db } from "../db";
import { nanoid } from "nanoid";
import {
  recurring_templates,
  recurring_instances,
} from "../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { generateNextDisplayId } from "../utils/displayId.js";

// Environment-aware table selection
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Convert legacy item data to new recurring template format
 */
export function legacyItemToTemplate(legacyItem: any): any {
  // Use the new individual field schema for production compatibility
  return {
    title: legacyItem.title,
    description: legacyItem.why_it_matters || null,
    item_type: legacyItem.item_type,
    why_it_matters: legacyItem.why_it_matters || null,
    verify_required: legacyItem.verify_required || false,
    time_frame: legacyItem.time_frame || null,
    time_of_day: legacyItem.time_of_day || "anytime",

    // New individual recurrence fields
    is_recurring:
      legacyItem.recurrence_type !== "once" &&
      legacyItem.recurrence_type !== undefined,
    recurrence_type: legacyItem.recurrence_type || null,
    by_day: legacyItem.by_day || null,
    by_monthday: legacyItem.by_monthday || null,
    by_week: legacyItem.by_week || null,
    by_month: legacyItem.by_month || null,
    max_occurrences: legacyItem.recurrence_type === "once" ? 1 : null,

    // Metadata and ownership
    created_by: legacyItem.created_by,
    assigned_to: legacyItem.assigned_to || null,
    community_id: legacyItem.community_id || null,
    shared_with: legacyItem.shared_with || null,
    is_active: true,
    display_id: legacyItem.display_id || null,
  };
}

/**
 * Create a recurring template in the new system
 * This is used by the dual-write system when creating recurring items
 */
export async function createRecurringTemplate(
  legacyItem: any,
  tx?: any,
): Promise<string> {
  const id = nanoid();
  const now = new Date().toISOString();

  // FAANG-Level Fix: Generate display ID if not provided
  const displayId = legacyItem.display_id || (await generateNextDisplayId());

  const templateData = legacyItemToTemplate(legacyItem);

  const newTemplate = {
    id,
    ...templateData,
    display_id: displayId, // Ensure display_id is always set
    created_at: now,
    updated_at: now,
  };

  console.log(
    `📝 DUAL-WRITE: Creating recurring template ${id} with display_id ${displayId} in new system`,
  );

  // Use transaction if provided, otherwise use direct db
  const dbInstance = tx || db;
  await dbInstance.insert(recurring_templates).values(newTemplate);

  return id;
}

/**
 * Generate initial instances for a recurring template
 * Creates instances for the next 30 days for immediate use
 */
export async function generateInitialInstances(
  templateId: string,
  legacyItem: any,
  tx?: any,
): Promise<number> {
  // CLIENT DATE CONTEXT: Use client_date if provided, otherwise fall back to server time
  let startDate: Date;
  let startDateStr: string;
  
  if (legacyItem.client_date) {
    // Use client's local calendar date as the starting point
    startDate = new Date(legacyItem.client_date + "T00:00:00"); // Client's "today" at midnight
    startDateStr = legacyItem.client_date;
    console.log(`🌍 CLIENT DATE: Using client's date "${startDateStr}" (timezone: ${legacyItem.client_timezone || 'unknown'}) for occurrence generation`);
  } else {
    // Fallback to server time (legacy behavior)
    startDate = new Date();
    startDateStr = startDate.toISOString().split("T")[0];
    console.log(`⚠️ FALLBACK: No client_date provided, using server date "${startDateStr}"`);
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 30); // Generate 30 days ahead

  let instancesCreated = 0;
  const dbInstance = tx || db;

  console.log(
    `🔍 GENERATING INSTANCES: Starting from ${startDateStr} for template ${templateId}`,
  );

  // Generate instances based on recurrence pattern using client date context
  const occurrences = generateOccurrences(legacyItem, startDate, endDate);

  console.log(
    `📅 OCCURRENCES GENERATED: ${occurrences.length} occurrences: ${occurrences.slice(0, 5).join(", ")}${occurrences.length > 5 ? "..." : ""}`,
  );
  
  // DEBUG: Check if client's "today" is included in occurrences  
  const includesClientToday = occurrences.includes(startDateStr);
  console.log(`🌙 CLIENT DATE DEBUG: Does occurrences include client's today (${startDateStr})? ${includesClientToday}`);
  if (!includesClientToday && occurrences.length > 0) {
    console.log(`🌙 CLIENT DATE DEBUG: First occurrence is: ${occurrences[0]} (should be ${startDateStr} for same-day creation)`);
  }

  for (const occurrenceDate of occurrences) {
    const instanceData = {
      id: nanoid(),
      template_id: templateId,
      occurrence_date: occurrenceDate,
      status: "pending" as const,
      assigned_to: legacyItem.assigned_to,
      shared_with: legacyItem.shared_with,
      display_id: legacyItem.display_id, // Use template's display_id for instances
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await dbInstance.insert(recurring_instances).values(instanceData);
    instancesCreated++;
  }

  return instancesCreated;
}

/**
 * Create a single instance for one-time items
 * FAANG-Level Implementation: Always create a template for architectural consistency
 */
export async function createSingleInstance(
  legacyItem: any,
  tx?: any,
): Promise<string> {
  const templateId = nanoid();
  const instanceId = nanoid();
  const now = new Date().toISOString();

  // FAANG-Level Fix: Generate display ID if not provided
  const displayId = legacyItem.display_id || (await generateNextDisplayId());
  console.log(
    `🔍 DEBUG: Creating single instance with display_id: ${displayId}`,
  );
  console.log(`🔍 DEBUG: legacyItem.display_id: ${legacyItem.display_id}`);

  // CLIENT DATE CONTEXT: Get target date with priority: due_date > client_date > server today
  let targetDate: string;
  if (legacyItem.due_date) {
    targetDate = legacyItem.due_date;
    console.log(`📅 SINGLE INSTANCE: Using due_date "${targetDate}"`);
  } else if (legacyItem.client_date) {
    targetDate = legacyItem.client_date;
    console.log(`🌍 SINGLE INSTANCE: Using client_date "${targetDate}" (timezone: ${legacyItem.client_timezone || 'unknown'})`);
  } else {
    targetDate = new Date().toISOString().split("T")[0];
    console.log(`⚠️ SINGLE INSTANCE: Fallback to server date "${targetDate}"`);
  }

  const dbInstance = tx || db;

  // Step 1: Create template for one-time item (FAANG-level architectural consistency)
  const templateData = {
    id: templateId,
    title: legacyItem.title,
    description: legacyItem.description || null,
    item_type: legacyItem.item_type,
    why_it_matters: legacyItem.why_it_matters || null,
    verify_required: legacyItem.verify_required || false,
    time_frame: legacyItem.time_frame || null,
    time_of_day: legacyItem.time_of_day || "anytime",

    // FAANG-Level Architecture: Individual recurrence fields
    is_recurring: false, // One-time items are non-recurring
    recurrence_type: null,
    by_day: null,
    by_monthday: null,
    by_week: null,
    by_month: null,
    max_occurrences: 1, // One-time items have exactly 1 occurrence

    // Backward compatibility: Empty recurrence_pattern for legacy system
    recurrence_pattern: {},

    // FAANG-Level Fix: Always set display_id
    display_id: displayId,

    // Metadata and ownership
    created_by: legacyItem.created_by || legacyItem.user_id,
    assigned_to: legacyItem.assigned_to || legacyItem.user_id,
    shared_with: legacyItem.shared_with || null,
    community_id: legacyItem.community_id || null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await dbInstance.insert(recurring_templates).values(templateData);

  // Step 2: Create single instance linked to template
  const instanceData = {
    id: instanceId,
    template_id: templateId, // Always linked to template for consistency
    occurrence_date: targetDate,
    due_time: legacyItem.due_time || null,
    status: "pending" as const,
    assigned_to: legacyItem.assigned_to,
    completed_at: null,
    completed_by: null,
    verified: false,
    verified_by: null,
    verified_at: null,
    ai_verification_result: null,
    ai_feedback: null,
    verification_image_url: null,
    notes: null,
    display_id: displayId, // FAANG-Level Fix: Use generated display_id
    created_at: now,
    updated_at: now,
    shared_with: legacyItem.shared_with || null,
  };

  await dbInstance.insert(recurring_instances).values(instanceData);

  console.log(
    `📝 FAANG-LEVEL: Created template ${templateId} and instance ${instanceId} for one-time item`,
  );

  return instanceId;
}

/**
 * Generate occurrence dates based on recurrence pattern
 */
function generateOccurrences(
  legacyItem: any,
  startDate: Date,
  endDate: Date,
): string[] {
  const occurrences: string[] = [];
  const current = new Date(startDate);

  if (legacyItem.recurrence_type === "daily") {
    // Generate daily occurrences
    while (current <= endDate) {
      occurrences.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
  } else if (legacyItem.recurrence_type === "weekly") {
    // Generate weekly occurrences based on by_day
    const targetDays = legacyItem.by_day || [];
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    console.log(
      `🗓️ WEEKLY GENERATION: Target days: ${JSON.stringify(targetDays)}, Start date: ${startDate.toISOString().split("T")[0]}`,
    );

    // FIX: For "starting today" logic, check if today matches the target day and include it
    const startDayName = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][startDate.getDay()];
    console.log(`📅 START DAY: ${startDayName} (day ${startDate.getDay()})`);

    // If today is one of the target days, include it in the occurrences (don't skip)
    if (targetDays.length > 0 && targetDays.includes(startDayName)) {
      const todayOccurrence = startDate.toISOString().split("T")[0];
      occurrences.push(todayOccurrence);
      console.log(
        `✅ INCLUDING TODAY: Added ${todayOccurrence} because today is ${startDayName}`,
      );
      current.setDate(current.getDate() + 1); // Start checking from tomorrow
    } else {
      console.log(
        `⏭️ SKIPPING TODAY: ${startDayName} is not in target days ${JSON.stringify(targetDays)}`,
      );
    }

    while (current <= endDate) {
      const dayName = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][current.getDay()];
      if (targetDays.length === 0 || targetDays.includes(dayName)) {
        const occurrenceDate = current.toISOString().split("T")[0];
        occurrences.push(occurrenceDate);
        console.log(`✅ ADDED OCCURRENCE: ${occurrenceDate} (${dayName})`);
      }
      current.setDate(current.getDate() + 1);
    }
  } else {
    // Default: single occurrence for the start date
    occurrences.push(startDate.toISOString().split("T")[0]);
  }

  return occurrences;
}

/**
 * Generate instances for a recurring template within a date range
 * This will be used in future phases to pre-generate instances
 */
export async function generateInstancesForTemplate(
  templateId: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  console.log(
    `🔄 Generating instances for template ${templateId} from ${startDate} to ${endDate}`,
  );

  // For Phase 1, we're not auto-generating instances yet
  // This is a placeholder for future implementation
  // In Phase 3, this will contain the logic to generate instances based on recurrence pattern

  return [];
}

/**
 * Create a specific instance for a template and date
 * Used when completing items to ensure instance exists
 */
export async function createRecurringInstance(instanceData: any): Promise<any> {
  const id = nanoid();
  const now = new Date().toISOString();

  const newInstance = {
    id,
    ...instanceData,
    created_at: now,
    updated_at: now,
  };

  console.log(
    `📝 DUAL-WRITE: Creating recurring instance ${id} for date ${instanceData.occurrence_date}`,
  );

  // Insert into new recurring_instances table
  const result = await db
    .insert(recurring_instances)
    .values(newInstance)
    .returning();

  return result[0] as any;
}

/**
 * Update an existing recurring instance
 */
export async function updateRecurringInstance(
  instanceId: string,
  updates: any,
): Promise<any> {
  const now = new Date().toISOString();

  console.log(`📝 DUAL-WRITE: Updating recurring instance ${instanceId}`);

  const result = await db
    .update(recurring_instances)
    .set({ ...updates, updated_at: now })
    .where(eq(recurring_instances.id, instanceId))
    .returning();

  if (result.length === 0) {
    throw new Error(`Recurring instance ${instanceId} not found`);
  }

  return result[0] as any;
}

/**
 * Find or create an instance for a specific template and date
 * This ensures we have an instance to work with when completing items
 */
export async function findOrCreateInstance(
  templateId: string,
  occurrenceDate: string,
  defaultData: any = {},
): Promise<any> {
  // Try to find existing instance
  const existing = await db
    .select()
    .from(recurring_instances)
    .where(
      and(
        eq(recurring_instances.template_id, templateId),
        eq(recurring_instances.occurrence_date, occurrenceDate),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0] as any;
  }

  // Create new instance if not found
  const instanceData: any = {
    template_id: templateId,
    occurrence_date: occurrenceDate,
    status: "pending",
    verified: false,
    ...defaultData,
  };

  return createRecurringInstance(instanceData);
}

/**
 * Get template by legacy item ID
 * Used to link legacy items to new templates during dual-write
 */
export async function getTemplateByLegacyItemId(
  legacyItemId: string,
): Promise<any | null> {
  // For Phase 1, we'll store the legacy item ID in the template title or use a mapping
  // This is a temporary solution until full migration

  const templates = await db
    .select()
    .from(recurring_templates)
    .where(eq(recurring_templates.id, legacyItemId)) // Temporary: use same ID
    .limit(1);

  return templates.length > 0 ? (templates[0] as any) : null;
}

/**
 * Get instances for a template within a date range
 */
export async function getInstancesForTemplate(
  templateId: string,
  startDate?: string,
  endDate?: string,
): Promise<any[]> {
  let query = db.select().from(recurring_instances);

  if (templateId) {
    query = query.where(eq(recurring_instances.template_id, templateId));
  }

  // Add date filtering if provided
  if (startDate && endDate) {
    query = query.where(
      and(
        sql`occurrence_date >= ${startDate}`,
        sql`occurrence_date <= ${endDate}`,
      ),
    );
  }

  const instances = await query.orderBy(recurring_instances.occurrence_date);
  return instances as any[];
}

/**
 * Get recurring items for a specific date using the new system
 * This method reads from recurring_templates and recurring_instances tables
 */
export async function getRecurringItemsForDate(
  userId: string,
  targetDate: string,
): Promise<any[]> {
  const templateTable = isDevelopment
    ? sql.identifier("dev_recurring_templates")
    : sql.identifier("recurring_templates");
  const instanceTable = isDevelopment
    ? sql.identifier("dev_recurring_instances")
    : sql.identifier("recurring_instances");

  console.log(
    `🆕 NEW SYSTEM: Querying recurring items for user ${userId} on ${targetDate} using ${isDevelopment ? "development" : "production"} tables`,
  );

  // Get templates that belong to or are assigned to the user
  const templatesQuery = sql`
    SELECT * FROM ${templateTable} 
    WHERE (
      created_by = ${userId}
      OR assigned_to = ${userId}
      OR (shared_with IS NOT NULL AND shared_with ? ${userId})
    )
  `;

  const templatesResult = await db.execute(templatesQuery);
  const templates = templatesResult.rows;

  console.log(
    `🆕 NEW SYSTEM: Found ${templates.length} templates for user ${userId}`,
  );

  if (templates.length === 0) {
    return [];
  }

  // Get instances for the target date
  const templateIds = templates.map((t: any) => t.id);
  const instancesQuery = sql`
    SELECT * FROM ${instanceTable} 
    WHERE template_id IN (${sql.join(
      templateIds.map((id: string) => sql`${id}`),
      sql`, `,
    )})
    AND occurrence_date = ${targetDate}
  `;

  const instancesResult = await db.execute(instancesQuery);
  const instances = instancesResult.rows;

  console.log(
    `🆕 NEW SYSTEM: Found ${instances.length} instances for ${targetDate}`,
  );

  // Convert to legacy format for compatibility
  const recurringItems = templates.map((template: any) => {
    const instance = instances.find((i: any) => i.template_id === template.id);

    return {
      id: template.id,
      display_id: template.display_id || undefined,
      title: template.title,
      item_type: template.item_type,
      recurrence_type: template.recurrence_pattern?.type || "daily",
      verify_required: template.verify_required || false,
      verified: instance?.verified || undefined,
      ai_verification_result: instance?.ai_verification_result || undefined,
      ai_feedback: instance?.ai_feedback || undefined,
      why_it_matters: template.why_it_matters || undefined,
      created_at: template.created_at,
      status: instance?.status || "open",
      is_completed_for_date: instance?.status === "completed",
      is_skipped_for_date: instance?.status === "skipped",
      completion_date: targetDate,
      created_by: template.created_by,
      assigned_to: template.assigned_to || undefined,
      shared_with: template.shared_with || undefined,
      community_id: template.community_id || undefined,
      time_frame: template.time_frame || undefined,
      due_date: undefined, // New system doesn't use due_date for recurring items
      by_day: template.recurrence_pattern?.by_day || undefined,
      by_monthday: template.recurrence_pattern?.by_monthday || undefined,
      by_week: template.recurrence_pattern?.by_week || undefined,
      by_month: template.recurrence_pattern?.by_month || undefined,
    };
  });

  console.log(
    `🆕 NEW SYSTEM: Returning ${recurringItems.length} recurring items for ${targetDate}`,
  );
  return recurringItems;
}

/**
 * Dual-write completion: Update both old and new systems
 * This ensures both systems stay in sync during Phase 1
 */
export async function dualWriteCompletion(
  legacyItemId: string,
  occurrenceDate: string,
  userId: string,
  completionData: any = {},
): Promise<{ legacySuccess: boolean; newSuccess: boolean }> {
  let legacySuccess = true;
  let newSuccess = true;

  try {
    // First, try to find or create corresponding template and instance
    const template = await getTemplateByLegacyItemId(legacyItemId);

    if (template) {
      const instance = await findOrCreateInstance(template.id, occurrenceDate, {
        assigned_to: userId,
      });

      // Update the instance to completed status
      await updateRecurringInstance(instance.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userId,
        ...completionData,
      });

      console.log(
        `✅ DUAL-WRITE: Successfully updated new system for ${legacyItemId} on ${occurrenceDate}`,
      );
    } else {
      console.log(
        `⚠️ DUAL-WRITE: No template found for legacy item ${legacyItemId}, skipping new system update`,
      );
      newSuccess = false;
    }
  } catch (error) {
    console.error(
      `❌ DUAL-WRITE: Failed to update new system for ${legacyItemId}:`,
      error,
    );
    newSuccess = false;
  }

  return { legacySuccess, newSuccess };
}

/**
 * PHASE 1 ONLY: This service maintains dual-write capabilities
 *
 * Key principles:
 * 1. All writes go to both old and new systems
 * 2. Reads still use the old system (no breaking changes)
 * 3. New system is populated but not yet used for application logic
 * 4. Rollback is possible by simply disabling dual-write calls
 */
