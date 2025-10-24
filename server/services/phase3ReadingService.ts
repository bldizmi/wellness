/**
 * Phase 3: Reading Service for New Architecture
 *
 * This service reads from the new recurring_instances table instead of legacy items table.
 * Supports both one-time and recurring items through unified instance-based queries.
 */

import { db } from "../db";
import { sql, eq, and, or } from "drizzle-orm";
import {
  recurring_instances,
  recurring_templates,
} from "../../shared/schema.js";
import { nanoid } from "nanoid";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Ensure instances exist for requested dates by generating them on-demand
 * This solves the issue where instances only exist for 30 days ahead
 */
async function ensureInstancesExistForDates(userId: string, dates: string[]) {

  // Get all active templates for the user
  const templatesTable = isDevelopment
    ? "dev_recurring_templates"
    : "recurring_templates";
  const instancesTable = isDevelopment
    ? "dev_recurring_instances"
    : "recurring_instances";

  // Get all active recurring templates assigned to user
  const templatesQuery = sql`
    SELECT * FROM ${sql.raw(templatesTable)}
    WHERE assigned_to = ${userId}
      AND is_active = true
      AND is_recurring = true
  `;

  const templatesResult = await db.execute(templatesQuery);
  const templates = templatesResult.rows || [];

  if (templates.length === 0) {
    return;
  }

  // For each date, check and create missing instances
  for (const date of dates) {
    // Check which templates already have instances for this date
    const existingQuery = sql`
      SELECT template_id FROM ${sql.raw(instancesTable)}
      WHERE occurrence_date = ${date}
        AND template_id = ANY(${sql`ARRAY[${sql.join(
          templates.map((t) => sql`${t.id}`),
          sql`, `,
        )}]`})
    `;

    const existingResult = await db.execute(existingQuery);
    const existingTemplateIds = new Set(
      existingResult.rows.map((row: any) => row.template_id),
    );

    // Create instances for templates that don't have them
    const missingTemplates = templates.filter(
      (t) => !existingTemplateIds.has(t.id),
    );

    if (missingTemplates.length > 0) {

      for (const template of missingTemplates) {
        // Check if this template should appear on this date based on recurrence pattern
        if (shouldTemplateAppearOnDate(template, date)) {
          const instanceData = {
            id: nanoid(),
            template_id: template.id,
            occurrence_date: date,
            status: "pending" as const,
            assigned_to: template.assigned_to,
            shared_with: template.shared_with,
            display_id: template.display_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await db.insert(recurring_instances).values(instanceData);
        }
      }
    }
  }
}

/**
 * Check if a template should appear on a specific date based on recurrence rules
 */
function shouldTemplateAppearOnDate(
  template: any,
  targetDate: string,
): boolean {
  const date = new Date(targetDate + "T23:59:59");

  // FIX: Parse template creation date correctly and compare only the date part
  const templateCreatedDate = new Date(template.created_at);
  const templateCreatedDateOnly = new Date(
    templateCreatedDate.toISOString().split("T")[0] + "T00:00:00",
  );
  const targetDateOnly = new Date(targetDate + "T00:00:00");

  // Only show templates created before or on the target date (date-only comparison)
  if (templateCreatedDateOnly > targetDateOnly) {
    return false;
  }

  // Daily recurrence
  if (template.recurrence_type === "daily") {
    return true;
  }

  // Weekly recurrence
  if (template.recurrence_type === "weekly") {
    if (
      template.by_day &&
      Array.isArray(template.by_day) &&
      template.by_day.length > 0
    ) {
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const currentDayName = dayNames[date.getDay()];

      // FIX: Only show on target days AND only on/after creation date
      // This ensures items created "starting today" appear on the correct schedule
      return (
        template.by_day.includes(currentDayName) &&
        targetDateOnly >= templateCreatedDateOnly
      );
    }
    // Fallback: use creation day, but only on/after creation date
    return (
      date.getDay() === templateCreatedDate.getDay() &&
      targetDateOnly >= templateCreatedDateOnly
    );
  }

  // Monthly recurrence
  if (template.recurrence_type === "monthly") {
    if (template.by_monthday) {
      return (
        date.getDate() === template.by_monthday &&
        targetDateOnly >= templateCreatedDateOnly
      );
    }
    // Fallback: use creation date
    return (
      date.getDate() === templateCreatedDate.getDate() &&
      targetDateOnly >= templateCreatedDateOnly
    );
  }

  // Yearly recurrence
  if (template.recurrence_type === "yearly") {
    if (template.by_month && template.by_monthday) {
      const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      const currentMonthName = months[date.getMonth()];
      return (
        currentMonthName === template.by_month &&
        date.getDate() === template.by_monthday &&
        targetDateOnly >= templateCreatedDateOnly
      );
    }
    // Fallback: same month and day as creation
    return (
      date.getMonth() === templateCreatedDate.getMonth() &&
      date.getDate() === templateCreatedDate.getDate() &&
      targetDateOnly >= templateCreatedDateOnly
    );
  }

  return false;
}

/**
 * Get personal progress items for a specific date from new architecture
 * Reads from recurring_instances table for both one-time and recurring items
 */
export async function getPersonalProgressItemsNew(
  userId: string,
  targetDate: string,
) {

  // First, ensure instances exist for the requested date
  await ensureInstancesExistForDates(userId, [targetDate]);

  // Query recurring_instances for the target date - using raw table names to match completion endpoint
  const instancesTable = isDevelopment
    ? "dev_recurring_instances"
    : "recurring_instances";
  const templatesTable = isDevelopment
    ? "dev_recurring_templates"
    : "recurring_templates";
  const verificationsTable = isDevelopment
    ? "dev_item_verification_attempts"
    : "item_verification_attempts";

  const instancesQuery = sql`
    SELECT
      ri.id,
      ri.template_id,
      ri.occurrence_date,
      ri.due_time,
      ri.status,
      ri.assigned_to,
      ri.completed_at,
      ri.completed_by,
      ri.verified,
      ri.verified_by,
      ri.verified_at,
      ri.ai_verification_result,
      ri.ai_feedback,
      ri.verification_image_url,
      ri.notes,
      ri.created_at,
      ri.updated_at,
      ri.shared_with,
      COALESCE(ri.display_id, rt.display_id) as display_id,
      rt.title,
      rt.description,
      rt.item_type,
      rt.why_it_matters,
      rt.verify_required,
      rt.time_frame,
      rt.time_of_day,
      rt.is_recurring,
      rt.recurrence_type,
      iva.image_urls,
      CASE
        WHEN ri.status = 'complete' THEN true
        ELSE false
      END as completed,
      CASE
        WHEN ri.status = 'skipped' THEN true
        ELSE false
      END as skipped
    FROM ${sql.raw(instancesTable)} ri
    INNER JOIN ${sql.raw(templatesTable)} rt
      ON ri.template_id = rt.id
    LEFT JOIN LATERAL (
      SELECT image_urls
      FROM ${sql.raw(verificationsTable)}
      WHERE item_id = ri.id
      ORDER BY created_at DESC
      LIMIT 1
    ) iva ON true
    WHERE ri.occurrence_date = ${targetDate}
      AND ri.assigned_to = ${userId}
      AND rt.is_active = true
  `;

  const result = await db.execute(instancesQuery);
  const instances = result.rows || [];
  
  // DEBUG: Check time_of_day field in raw database results
  console.log(`🕒 TIME_OF_DAY DEBUG: Raw DB instances for ${targetDate}:`);
  instances.forEach(instance => {
    console.log(`  - ${instance.title}: time_of_day="${instance.time_of_day}" (type: ${typeof instance.time_of_day})`);
  });

  console.log(
    `✅ PHASE 3: Found ${instances.length} instances for ${targetDate}`,
  );

  // Map instances to include is_completed_for_date field for frontend compatibility
  const mapInstance = (instance: any) => {
    // Parse image_urls from JSON string to array
    let imageUrlsArray = [];
    if (instance.image_urls) {
      try {
        imageUrlsArray = typeof instance.image_urls === 'string'
          ? JSON.parse(instance.image_urls)
          : instance.image_urls;
      } catch (e) {
        console.error('Failed to parse image_urls:', e);
        imageUrlsArray = [];
      }
    }

    const mappedInstance = {
      ...instance,
      // CRITICAL: Frontend expects is_completed_for_date, not just status
      // FIX: Database stores 'complete' not 'completed'!
      is_completed_for_date:
        instance.status === "complete" || instance.status === "completed",
      // CRITICAL FIX: For one-time items (is_recurring = false), use "once", not "daily"
      recurrence_type: instance.is_recurring === false ? "once" : (instance.recurrence_type || "daily"),
      // Parse image_urls JSON string to array for frontend
      image_urls: imageUrlsArray,
    };

    // DEBUG: Check time_of_day field after mapping
    console.log(`🕒 TIME_OF_DAY DEBUG: After mapping "${instance.title}": time_of_day="${mappedInstance.time_of_day}" (type: ${typeof mappedInstance.time_of_day})`);

    return mappedInstance;
  };

  // Group by item type with proper field mapping
  const groupedItems = {
    tasks: instances.filter((i) => i.item_type === "task").map(mapInstance),
    habits: instances.filter((i) => i.item_type === "habit").map(mapInstance),
    goals: instances.filter((i) => i.item_type === "goal").map(mapInstance),
    projects: instances
      .filter((i) => i.item_type === "project")
      .map(mapInstance),
  };

  // DEBUG: Check time_of_day field in final grouped items
  console.log(`🕒 TIME_OF_DAY DEBUG: Final grouped items time_of_day values:`);
  ['tasks', 'habits', 'goals', 'projects'].forEach(type => {
    groupedItems[type].forEach(item => {
      console.log(`  - ${type}[${item.title}]: time_of_day="${item.time_of_day}" (type: ${typeof item.time_of_day})`);
    });
  });

  console.log(
    `📊 PHASE 3: Items breakdown - Tasks: ${groupedItems.tasks.length}, Habits: ${groupedItems.habits.length}, Goals: ${groupedItems.goals.length}, Projects: ${groupedItems.projects.length}`,
  );

  return groupedItems;
}

/**
 * Ensure shared instances exist for a specific date
 * This handles items shared with the user or created by user but assigned to others
 */
async function ensureSharedInstancesExistForDate(
  userId: string,
  targetDate: string,
) {
  console.log(
    `🔄 ENSURING SHARED INSTANCES: Checking shared instances for ${targetDate}`,
  );

  const templatesTable = isDevelopment
    ? "dev_recurring_templates"
    : "recurring_templates";
  const instancesTable = isDevelopment
    ? "dev_recurring_instances"
    : "recurring_instances";

  // Get all active recurring templates that are shared with user or created by user for others
  const sharedTemplatesQuery = sql`
    SELECT * FROM ${sql.raw(templatesTable)}
    WHERE is_active = true
      AND is_recurring = true
      AND (
        (created_by = ${userId} AND assigned_to != ${userId})
        OR (assigned_to = ${userId} AND created_by != ${userId})
        OR (${userId} = ANY(shared_with))
      )
  `;

  const templatesResult = await db.execute(sharedTemplatesQuery);
  const templates = templatesResult.rows || [];

  if (templates.length === 0) {
    console.log(
      `✅ NO SHARED TEMPLATES: No shared recurring templates for user ${userId}`,
    );
    return;
  }

  console.log(
    `📋 SHARED TEMPLATES FOUND: ${templates.length} shared recurring templates`,
  );

  // Check which templates already have instances for this date
  const existingQuery = sql`
    SELECT template_id FROM ${sql.raw(instancesTable)}
    WHERE occurrence_date = ${targetDate}
      AND template_id = ANY(${sql`ARRAY[${sql.join(
        templates.map((t) => sql`${t.id}`),
        sql`, `,
      )}]`})
  `;

  const existingResult = await db.execute(existingQuery);
  const existingTemplateIds = new Set(
    existingResult.rows.map((row: any) => row.template_id),
  );

  // Create instances for templates that don't have them
  const missingTemplates = templates.filter(
    (t) => !existingTemplateIds.has(t.id),
  );

  if (missingTemplates.length > 0) {
    console.log(
      `🔧 GENERATING SHARED: Creating ${missingTemplates.length} missing shared instances for ${targetDate}`,
    );

    for (const template of missingTemplates) {
      if (shouldTemplateAppearOnDate(template, targetDate)) {
        const instanceData = {
          id: nanoid(),
          template_id: template.id,
          occurrence_date: targetDate,
          status: "pending" as const,
          assigned_to: template.assigned_to,
          shared_with: template.shared_with,
          display_id: template.display_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.insert(recurring_instances).values(instanceData);
        console.log(
          `✅ CREATED SHARED: Instance for template ${template.id} on ${targetDate}`,
        );
      }
    }
  }
}

/**
 * Get shared items for a specific date from new architecture
 * Reads from recurring_instances with shared_with containing the user
 */
export async function getSharedItemsNew(userId: string, targetDate: string) {
  console.log(
    `🔄 PHASE 3: Reading shared items from new architecture for ${targetDate}`,
  );

  // First, ensure instances exist for the requested date for shared items
  await ensureSharedInstancesExistForDate(userId, targetDate);

  // Use raw table names to match completion endpoint pattern
  const instancesTable = isDevelopment
    ? "dev_recurring_instances"
    : "recurring_instances";
  const templatesTable = isDevelopment
    ? "dev_recurring_templates"
    : "recurring_templates";

  // Get verification attempts table name
  const verificationsTable = isDevelopment
    ? "dev_item_verification_attempts"
    : "item_verification_attempts";

  const sharedInstancesQuery = sql`
    SELECT
      ri.id,
      ri.template_id,
      ri.occurrence_date,
      ri.due_time,
      ri.status,
      ri.assigned_to,
      ri.completed_at,
      ri.completed_by,
      ri.verified,
      ri.verified_by,
      ri.verified_at,
      ri.ai_verification_result,
      ri.ai_feedback,
      ri.verification_image_url,
      ri.notes,
      ri.created_at,
      ri.updated_at,
      ri.shared_with,
      COALESCE(ri.display_id, rt.display_id) as display_id,
      rt.title,
      rt.description,
      rt.item_type,
      rt.why_it_matters,
      rt.verify_required,
      rt.time_frame,
      rt.time_of_day,
      rt.created_by,
      rt.is_recurring,
      rt.recurrence_type,
      iva.image_urls,
      CASE
        WHEN ri.status = 'complete' THEN true
        ELSE false
      END as completed,
      CASE
        WHEN ri.status = 'skipped' THEN true
        ELSE false
      END as skipped
    FROM ${sql.raw(instancesTable)} ri
    LEFT JOIN ${sql.raw(templatesTable)} rt
      ON ri.template_id = rt.id
    LEFT JOIN LATERAL (
      SELECT image_urls
      FROM ${sql.raw(verificationsTable)}
      WHERE item_id = ri.id
      ORDER BY created_at DESC
      LIMIT 1
    ) iva ON true
    WHERE ri.occurrence_date = ${targetDate}
      AND (rt.is_active = true OR rt.is_active IS NULL)
      AND (ri.assigned_to != ${userId} OR ri.assigned_to IS NULL)
      AND (
        (rt.created_by = ${userId})
        OR (${userId} = ANY(COALESCE(ri.shared_with, rt.shared_with)))
      )
  `;

  const sharedResult = await db.execute(sharedInstancesQuery);
  const sharedInstances = sharedResult.rows || [];

  console.log(
    `✅ PHASE 3: Found ${sharedInstances.length} shared instances for ${targetDate}`,
  );

  // Map instances to include is_completed_for_date field for frontend compatibility
  const mapSharedInstance = (instance: any) => {
    // Parse image_urls from JSON string to array
    let imageUrlsArray = [];
    if (instance.image_urls) {
      try {
        imageUrlsArray = typeof instance.image_urls === 'string'
          ? JSON.parse(instance.image_urls)
          : instance.image_urls;
      } catch (e) {
        console.error('Failed to parse image_urls:', e);
        imageUrlsArray = [];
      }
    }

    return {
      ...instance,
      // CRITICAL: Frontend expects is_completed_for_date, not just status
      // FIX: Database stores 'complete' not 'completed'!
      is_completed_for_date:
        instance.status === "complete" || instance.status === "completed",
      // CRITICAL FIX: For one-time items (is_recurring = false), use "once", not "daily"
      recurrence_type: instance.is_recurring === false ? "once" : (instance.recurrence_type || "daily"),
      // Parse image_urls JSON string to array for frontend
      image_urls: imageUrlsArray,
    };
  };

  // Group by item type (exclude habits from shared as per existing logic)
  const groupedSharedItems = {
    tasks: sharedInstances
      .filter((i) => i.item_type === "task")
      .map(mapSharedInstance),
    habits: [], // Exclude habits from shared items
    goals: sharedInstances
      .filter((i) => i.item_type === "goal")
      .map(mapSharedInstance),
    projects: sharedInstances
      .filter((i) => i.item_type === "project")
      .map(mapSharedInstance),
  };

  return groupedSharedItems;
}

/**
 * Get week progress data from new architecture
 * Efficient batch query for multiple dates
 */
export async function getWeekProgressNew(userId: string, weekDates: string[]) {
  console.log(
    `🔄 PHASE 3: Reading week progress from new architecture for ${weekDates.length} dates`,
  );

  // First, ensure instances exist for all requested dates
  await ensureInstancesExistForDates(userId, weekDates);

  // Use raw table names to match completion endpoint pattern
  const instancesTable = isDevelopment
    ? "dev_recurring_instances"
    : "recurring_instances";
  const templatesTable = isDevelopment
    ? "dev_recurring_templates"
    : "recurring_templates";

  // Debug the dates being queried
  console.log(
    `🔍 WEEK QUERY DATES: Querying for dates: ${weekDates.join(", ")}`,
  );

  // FIXED: Changed to INNER JOIN and removed NULL check to match single-day endpoint
  const weekProgressQuery = sql`
    SELECT 
      ri.id,
      ri.template_id,
      ri.occurrence_date,
      ri.status,
      ri.assigned_to,
      rt.item_type,
      rt.title
    FROM ${sql.raw(instancesTable)} ri
    INNER JOIN ${sql.raw(templatesTable)} rt 
      ON ri.template_id = rt.id
    WHERE ri.occurrence_date = ANY(${sql`ARRAY[${sql.join(
      weekDates.map((date) => sql`${date}`),
      sql`, `,
    )}]`})
      AND ri.assigned_to = ${userId}
      AND rt.is_active = true
    ORDER BY ri.occurrence_date, rt.item_type
  `;

  console.log(`🔍 EXECUTING WEEK QUERY for user ${userId}`);

  const weekResult = await db.execute(weekProgressQuery);
  const allInstances = weekResult.rows || [];

  // Debug log to see what we're getting
  console.log(
    `📊 WEEK QUERY RESULTS: Found ${allInstances.length} total instances`,
  );
  console.log(`📊 WEEK DATES REQUESTED: ${weekDates.join(", ")}`);

  // Group by date for debugging
  const instancesByDate: { [key: string]: any[] } = {};
  for (const date of weekDates) {
    instancesByDate[date] = allInstances.filter(
      (i) => i.occurrence_date === date,
    );
  }

  for (const [date, instances] of Object.entries(instancesByDate)) {
    console.log(`📅 DATE ${date}: ${instances.length} instances`);
    for (const inst of instances) {
      console.log(`  - ${inst.title}: id=${inst.id}, status=${inst.status}`);
    }
  }

  // Transform to expected format with proper item counting (not broken COUNT aggregation)
  const weekProgress: {
    [key: string]: {
      tasks: any[];
      habits: any[];
      goals: any[];
      projects: any[];
    };
  } = {};

  for (const date of weekDates) {
    const dateInstances = allInstances.filter(
      (i) => i.occurrence_date === date,
    );

    // Map instances to include is_completed_for_date field for frontend compatibility
    const mapInstance = (instance: any) => {
      const isCompleted =
        instance.status === "complete" || instance.status === "completed";

      // Debug log for today's items
      if (
        date === new Date().toISOString().split("T")[0] &&
        instance.item_type === "task"
      ) {
        console.log(`🔍 MAPPING INSTANCE for ${date}: ${instance.title}`, {
          id: instance.id,
          status: instance.status,
          is_completed_for_date: isCompleted,
          item_type: instance.item_type,
        });
      }

      return {
        ...instance,
        // CRITICAL: Frontend expects is_completed_for_date, not just status
        // FIX: Database stores 'complete' not 'completed'!
        is_completed_for_date: isCompleted,
        // CRITICAL FIX: For one-time items (is_recurring = false), use "once", not "daily"
        recurrence_type: instance.is_recurring === false ? "once" : (instance.recurrence_type || "daily"),
      };
    };

    weekProgress[date] = {
      tasks: dateInstances
        .filter((i) => i.item_type === "task")
        .map(mapInstance),
      habits: dateInstances
        .filter((i) => i.item_type === "habit")
        .map(mapInstance),
      goals: dateInstances
        .filter((i) => i.item_type === "goal")
        .map(mapInstance),
      projects: dateInstances
        .filter((i) => i.item_type === "project")
        .map(mapInstance),
    };
  }

  console.log(
    `✅ PHASE 3: Week progress data prepared for ${weekDates.length} dates`,
  );

  return weekProgress;
}

/**
 * Feature flag check for Phase 3 new reading system
 * Returns true if user should use new architecture for reads
 */
export function shouldUseNewReading(userId: string): boolean {
  // For now, enable for all users since we have a clean slate
  return true;
}
