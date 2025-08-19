import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import {
  User,
  InsertUser,
  users,
  Mood,
  InsertMood,
  moods,
  Item,
  InsertItem,
  items,
  recurring_instances,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { getVisibleItems } from "./services/itemVisibilityService";

// Data directory path
const DATA_DIR = path.join(process.cwd(), "data");

// File paths
const MOODS_FILE = path.join(DATA_DIR, "moods.json");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");

// MindDouble Storage Interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Mood methods
  saveMood(userId: string, mood: InsertMood): Promise<Mood>;
  getUserMoods(userId: string): Promise<Mood[]>;

  // Item methods
  saveItem(userId: string, item: InsertItem): Promise<Item>;
  getUserItems(userId: string): Promise<Item[]>;
  getUserItemsByDate(userId: string, date: string): Promise<Item[]>;
  markItemComplete(userId: string, itemId: string): Promise<Item | undefined>;
  verifyItem(
    userId: string,
    itemId: string,
    verifiedBy: string,
  ): Promise<Item | undefined>;
  verifyItemWithPhoto(
    userId: string,
    itemId: string,
    verifiedBy: string,
    status: string,
    verified: boolean,
  ): Promise<Item | undefined>;

  // New recurring system methods
  getRecurringTemplate(templateId: string): Promise<any>;
  createInstanceCompletion(completion: any): Promise<any>;
  deleteInstanceCompletion(completionId: string): Promise<void>;
  getInstanceCompletionHistory(
    templateId: string,
    instanceId: string,
  ): Promise<any[]>;
  generateRecurringInstances(
    templateId: string,
    options: { start_date: string; end_date: string },
  ): Promise<any[]>;
}

// Initialize storage system
export async function initializeStorage(): Promise<void> {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Initialize empty data files if they don't exist
    const files = [MOODS_FILE, ITEMS_FILE];

    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, "{}", "utf8");
      }
    }
  } catch (error) {
    console.error("Error initializing storage:", error);
    throw error;
  }
}

// Memory Storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private moods: Map<string, Mood[]>;
  private items: Map<string, Item[]>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.moods = new Map();
    this.items = new Map();
    this.currentId = 1;
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await initializeStorage();

      // Load data from files if they exist
      try {
        const moodsData = await fs.readFile(MOODS_FILE, "utf8");
        const parsedMoods = JSON.parse(moodsData);

        for (const [userId, userMoods] of Object.entries(parsedMoods)) {
          this.moods.set(userId, userMoods as Mood[]);
        }
      } catch (error) {
        console.error("Error loading moods data:", error);
      }

      try {
        const itemsData = await fs.readFile(ITEMS_FILE, "utf8");
        const parsedItems = JSON.parse(itemsData);

        for (const [userId, userItems] of Object.entries(parsedItems)) {
          this.items.set(userId, userItems as Item[]);
        }
      } catch (error) {
        console.error("Error loading items data:", error);
      }
    } catch (error) {
      console.error("Error in storage initialization:", error);
    }
  }

  private async saveToFile(
    filePath: string,
    data: Map<string, any>,
  ): Promise<void> {
    try {
      const jsonData: Record<string, any> = {};

      // Convert Map to object in a way compatible with older JS engines
      Array.from(data.entries()).forEach(([key, value]) => {
        jsonData[key] = value;
      });

      await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), "utf8");
    } catch (error) {
      console.error(`Error saving to ${filePath}:`, error);
      throw error;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Mood methods
  async saveMood(userId: string, mood: InsertMood): Promise<Mood> {
    if (!this.moods.has(userId)) {
      this.moods.set(userId, []);
    }

    const newMood: Mood = {
      ...mood,
      id: `mood_${nanoid()}`,
      created_at: new Date().toISOString(),
    };

    this.moods.get(userId)!.push(newMood);
    await this.saveToFile(MOODS_FILE, this.moods);

    return newMood;
  }

  async getUserMoods(userId: string): Promise<Mood[]> {
    return this.moods.get(userId) || [];
  }

  // Item methods
  async saveItem(userId: string, item: InsertItem): Promise<Item> {
    if (!this.items.has(userId)) {
      this.items.set(userId, []);
    }

    const newItem: Item = {
      ...item,
      id: `item_${nanoid()}`,
      created_at: new Date().toISOString(),
    };

    this.items.get(userId)!.push(newItem);
    await this.saveToFile(ITEMS_FILE, this.items);

    return newItem;
  }

  async getUserItems(userId: string): Promise<Item[]> {
    return this.items.get(userId) || [];
  }

  async getUserItemsByDate(userId: string, dateStr: string): Promise<Item[]> {
    const items = this.items.get(userId) || [];
    const date = new Date(dateStr);
    const dateString = date.toISOString().split("T")[0];

    return items.filter((item) => {
      // For items with a due date
      if (item.due_date) {
        const itemDate = new Date(item.due_date);
        const itemDateString = itemDate.toISOString().split("T")[0];
        return itemDateString === dateString;
      }

      // For recurring items
      if (item.recurrence_type === "daily") {
        return true;
      }

      if (item.recurrence_type === "weekly") {
        const itemDate = new Date(item.created_at);
        return date.getDay() === itemDate.getDay();
      }

      if (item.recurrence_type === "monthly") {
        const itemDate = new Date(item.created_at);
        return date.getDate() === itemDate.getDate();
      }

      // Default case
      return false;
    });
  }

  async markItemComplete(
    userId: string,
    itemId: string,
  ): Promise<Item | undefined> {
    const userItems = this.items.get(userId) || [];
    const itemIndex = userItems.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return undefined;
    }

    const item = userItems[itemIndex];
    const updatedItem: Item = {
      ...item,
      completed_at: new Date().toISOString(),
    };

    userItems[itemIndex] = updatedItem;
    await this.saveToFile(ITEMS_FILE, this.items);

    return updatedItem;
  }

  async verifyItem(
    userId: string,
    itemId: string,
    verifiedBy: string,
  ): Promise<Item | undefined> {
    const userItems = this.items.get(userId) || [];
    const itemIndex = userItems.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return undefined;
    }

    const item = userItems[itemIndex];
    const updatedItem: Item = {
      ...item,
      completed_at: new Date().toISOString(),
      verified: true,
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    };

    userItems[itemIndex] = updatedItem;
    await this.saveToFile(ITEMS_FILE, this.items);

    return updatedItem;
  }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async saveMood(userId: string, mood: InsertMood): Promise<Mood> {
    const newMood = {
      id: nanoid(),
      user_id: userId,
      mood_emoji: mood.mood_emoji,
      timestamp: mood.timestamp,
      created_at: new Date().toISOString(),
    };

    const [insertedMood] = await db.insert(moods).values(newMood).returning();
    return insertedMood;
  }

  async getUserMoods(userId: string): Promise<Mood[]> {
    const userMoods = await db
      .select()
      .from(moods)
      .where(eq(moods.user_id, userId));
    return userMoods.map((mood) => ({
      id: mood.id,
      user_id: mood.user_id,
      mood_emoji: mood.mood_emoji,
      timestamp: mood.timestamp,
      created_at: mood.created_at,
    }));
  }

  async saveItem(userId: string, item: InsertItem): Promise<Item> {
    // Force fix any outdated AI-generated dates
    let correctedDueDate = item.due_date;
    if (item.due_date) {
      const dateStr = String(item.due_date);
      // Replace any date from 2023 or earlier with today
      if (
        dateStr.match(/202[0-3]/) ||
        dateStr.includes("2023") ||
        dateStr.includes("2022") ||
        dateStr.includes("2021") ||
        dateStr.includes("2020")
      ) {
        correctedDueDate = new Date().toISOString().slice(0, 10); // Today's date in YYYY-MM-DD format
      }
    }

    const newItem = {
      id: nanoid(),
      user_id: userId,
      created_by: userId,
      title: item.title,
      item_type: item.item_type,
      recurrence_type: item.recurrence_type,
      custom_recurrence: item.custom_recurrence,
      due_date: correctedDueDate,
      time_frame: item.time_frame,
      verify_required: item.verify_required,
      why_it_matters: item.why_it_matters,
      created_at: new Date().toISOString(),
      completed_at: undefined,
      verified: undefined,
      verified_by: undefined,
      verified_at: undefined,
    };

    const [insertedItem] = await db
      .insert(items)
      .values({
        id: newItem.id,
        user_id: userId,
        created_by: userId,
        title: newItem.title,
        item_type: newItem.item_type,
        recurrence_type: newItem.recurrence_type,
        due_date: newItem.due_date,
        time_frame: newItem.time_frame,
        verify_required: newItem.verify_required,
        why_it_matters: newItem.why_it_matters,
        created_at: newItem.created_at,
        completed_at: newItem.completed_at,
        verified: newItem.verified,
        verified_by: newItem.verified_by,
        verified_at: newItem.verified_at,
      })
      .returning();

    // Legacy dual-write code removed in Phase 5 - items now created directly in new architecture via routes

    return insertedItem;
  }

  async getUserItems(userId: string): Promise<Item[]> {
    const visibleItems = await getVisibleItems(userId);
    return visibleItems.map((item) => ({
      id: item.id,
      display_id: item.display_id || undefined,
      user_id: item.user_id,
      created_by: item.created_by,
      assigned_to: item.assigned_to,
      shared_with: item.shared_with,
      title: item.title,
      item_type: item.item_type as "task" | "habit" | "goal" | "project",
      recurrence_type: item.recurrence_type as
        | "once"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
        | undefined,
      custom_recurrence: item.custom_recurrence || undefined,
      by_day: item.by_day,
      by_monthday: item.by_monthday || undefined,
      by_week: item.by_week || undefined,
      by_month: item.by_month || undefined,
      due_date: item.due_date || undefined,
      time_frame: item.time_frame || undefined,
      verify_required: item.verify_required,
      why_it_matters: item.why_it_matters || undefined,
      created_at: item.created_at,
      completed_at: item.completed_at || undefined,
      status: item.status as "open" | "complete" | "pending_review" | undefined,
      image_url: item.image_url || undefined,
      ai_verification_result: item.ai_verification_result as
        | "complete"
        | "not_complete"
        | "unclear"
        | undefined,
      ai_feedback: item.ai_feedback || undefined,
      verified: item.verified || undefined,
      verified_by: item.verified_by || undefined,
      verified_at: item.verified_at || undefined,
      community_id: item.community_id || undefined,
    }));
  }

  async getUserItemsByDate(userId: string, dateStr: string): Promise<Item[]> {
    const visibleItems = await getVisibleItems(userId);
    const date = new Date(dateStr);
    const dateString = date.toISOString().split("T")[0];

    return visibleItems
      .filter((item) => {
        // Skip completed items
        if (item.completed_at) {
          return false;
        }

        // For recurring items (check recurrence first, not due_date)
        if (item.recurrence_type === "daily") {
          return true;
        }

        if (item.recurrence_type === "weekly") {
          // Use by_day array if available, otherwise fall back to creation day
          if (item.by_day && Array.isArray(item.by_day)) {
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
            return item.by_day.includes(currentDayName);
          } else {
            // Fallback to original logic
            const itemDate = new Date(item.created_at);
            return date.getDay() === itemDate.getDay();
          }
        }

        if (item.recurrence_type === "monthly") {
          // Check for day of month pattern
          if (item.by_monthday) {
            return date.getDate() === item.by_monthday;
          }
          // Check for "Nth weekday" pattern
          if (item.by_week && item.by_day && Array.isArray(item.by_day)) {
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
            if (item.by_day.includes(currentDayName)) {
              // Calculate which week of the month this is (1-4)
              const weekOfMonth = Math.ceil(date.getDate() / 7);
              return weekOfMonth === item.by_week;
            }
          }
          // Fallback to original logic
          const itemDate = new Date(item.created_at);
          return date.getDate() === itemDate.getDate();
        }

        if (item.recurrence_type === "yearly") {
          // Use by_month and by_monthday if available
          if (item.by_month && item.by_monthday) {
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
              currentMonthName === item.by_month &&
              date.getDate() === item.by_monthday
            );
          }
          // Fallback: no implementation (yearly items won't appear)
          return false;
        }

        if (item.recurrence_type === "custom") {
          // Custom recurrence patterns are not implemented yet
          console.warn(
            `Custom recurrence pattern not implemented: ${item.custom_recurrence}`,
          );
          return false;
        }

        // For non-recurring items with a due date
        if (item.due_date) {
          const itemDate = new Date(item.due_date);
          const itemDateString = itemDate.toISOString().split("T")[0];
          return itemDateString === dateString;
        }

        // Default case
        return false;
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        item_type: item.item_type as "task" | "habit" | "goal" | "project",
        recurrence_type: item.recurrence_type as
          | "once"
          | "daily"
          | "weekly"
          | "monthly"
          | "yearly"
          | undefined,
        custom_recurrence: item.custom_recurrence || undefined,
        by_day: (item.by_day as string[]) || undefined,
        by_monthday: item.by_monthday || undefined,
        by_week: item.by_week || undefined,
        by_month: item.by_month || undefined,
        due_date: item.due_date || undefined,
        time_frame: item.time_frame || undefined,
        verify_required: item.verify_required || undefined,
        why_it_matters: item.why_it_matters || undefined,
        created_at: item.created_at,
        completed_at: item.completed_at || undefined,
        verified: item.verified || undefined,
        verified_by: item.verified_by || undefined,
        verified_at: item.verified_at || undefined,
      }));
  }

  async markItemComplete(
    userId: string,
    itemId: string,
    completionDate?: string,
  ): Promise<Item | undefined> {
    const targetDate = completionDate || new Date().toISOString().split("T")[0];
    // 1. Get the full item details first
    const [existingItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId));

    if (!existingItem) return undefined;

    await db
      .update(recurring_instances)
      .set({
        status: "complete",
        completed_at: completionDate || new Date().toISOString(),
        completed_by: userId,
      })
      .where(
        and(
          eq(recurring_instances.id, itemId),
          eq(recurring_instances.occurrence_date, targetDate),
        ),
      );

    // 2. Mark current instance complete
    const [updatedItem] = await db
      .update(items)
      .set({
        completed_at: completionDate || new Date().toISOString(),
        status: "complete",
      })
      .where(eq(items.id, itemId))
      .returning();

    if (!updatedItem) return undefined;

    // 3. Handle recurrence if needed
    if (
      existingItem.recurrence_type &&
      existingItem.recurrence_type !== "once"
    ) {
      const nextDate = this.calculateNextOccurrence(
        completionDate ? new Date(completionDate) : new Date(),
        existingItem.recurrence_type,
        existingItem.custom_recurrence,
        existingItem.by_day,
        existingItem.by_monthday,
        existingItem.by_week,
        existingItem.by_month,
      );

      // Create new instance using existing item as template
      const {
        id,
        completed_at,
        status,
        verified,
        verified_at,
        verified_by,
        ...recurringData
      } = existingItem;

      await db.insert(items).values({
        ...recurringData,
        id: undefined, // Auto-generate new ID
        created_at: new Date().toISOString(),
        completed_at: null,
        status: "open",
        due_date: nextDate,
        previous_instance_id: itemId, // Track recurrence chain
        // Reset verification fields for new instance
        verified: false,
        verified_at: null,
        verified_by: null,
        ai_verification_result: null,
        // Carry over important fields
        verify_required: existingItem.verify_required,
        why_it_matters: existingItem.why_it_matters,
        time_frame: existingItem.time_frame,
        is_chore: existingItem.is_chore,
        community_id: existingItem.community_id,
        shared_with: existingItem.shared_with,
      });
    }

    // Return the completed item in expected format
    return {
      id: updatedItem.id,
      display_id: updatedItem.display_id || undefined,
      user_id: updatedItem.user_id,
      created_by: updatedItem.created_by,
      assigned_to: updatedItem.assigned_to || undefined,
      shared_with: updatedItem.shared_with
        ? JSON.parse(updatedItem.shared_with as string)
        : undefined,
      title: updatedItem.title,
      item_type: updatedItem.item_type as ItemType,
      recurrence_type: updatedItem.recurrence_type as RecurrenceType,
      custom_recurrence: updatedItem.custom_recurrence || undefined,
      due_date: updatedItem.due_date || undefined,
      time_frame: updatedItem.time_frame || undefined,
      verify_required: updatedItem.verify_required || undefined,
      why_it_matters: updatedItem.why_it_matters || undefined,
      created_at: updatedItem.created_at,
      completed_at: updatedItem.completed_at || undefined,
      status: updatedItem.status as ItemStatus,
      ai_verification_result:
        updatedItem.ai_verification_result as VerificationResult,
      verified: updatedItem.verified || undefined,
      verified_by: updatedItem.verified_by || undefined,
      verified_at: updatedItem.verified_at || undefined,
      community_id: updatedItem.community_id || undefined,
    };
  }

  private calculateNextOccurrence(
    currentDate: Date,
    recurrenceType: RecurrenceType,
    customRecurrence?: string,
    byDay?: string[],
    byMonthday?: number,
    byWeek?: number,
    byMonth?: string,
  ): string {
    const nextDate = new Date(currentDate);

    switch (recurrenceType) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + 1);
        break;

      case "weekly":
        if (byDay?.length) {
          // Find next occurrence in the same week
          const currentDay = nextDate.getDay();
          const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];
          const targetDays = byDay.map((day) =>
            dayNames.indexOf(day.toLowerCase()),
          );

          let daysToAdd = 1;
          while (daysToAdd <= 7) {
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDay = nextDate.getDay();
            if (targetDays.includes(nextDay)) {
              break;
            }
            daysToAdd++;
          }
        } else {
          nextDate.setDate(nextDate.getDate() + 7);
        }
        break;

      case "monthly":
        if (byMonthday) {
          // Specific day of month (e.g., 15th)
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(byMonthday);
        } else if (byDay?.length && byWeek) {
          // Nth weekday of month (e.g., 2nd Tuesday)
          const dayName = byDay[0].toLowerCase();
          const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];
          const targetDay = dayNames.indexOf(dayName);

          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(1);

          let occurrences = 0;
          while (true) {
            if (nextDate.getDay() === targetDay) {
              occurrences++;
              if (occurrences === byWeek) break;
            }
            if (occurrences < byWeek) {
              nextDate.setDate(nextDate.getDate() + 1);
            }
          }
        } else {
          // Simple monthly (same date next month)
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;

      case "yearly":
        if (byMonth) {
          // Specific month (e.g., January)
          const monthNames = [
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
          const targetMonth = monthNames.indexOf(byMonth.toLowerCase());
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          nextDate.setMonth(targetMonth);

          if (byMonthday) {
            nextDate.setDate(byMonthday);
          }
        } else {
          // Simple yearly (same date next year)
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        break;

      case "custom":
        if (customRecurrence) {
          // Example: "3d" for every 3 days
          const match = customRecurrence.match(/^(\d+)([dwm])$/);
          if (match) {
            const [, num, unit] = match;
            const increment = parseInt(num);

            switch (unit) {
              case "d":
                nextDate.setDate(nextDate.getDate() + increment);
                break;
              case "w":
                nextDate.setDate(nextDate.getDate() + increment * 7);
                break;
              case "m":
                nextDate.setMonth(nextDate.getMonth() + increment);
                break;
            }
          }
        }
        break;
    }

    return nextDate.toISOString();
  }

  async verifyItem(
    userId: string,
    itemId: string,
    verifiedBy: string,
  ): Promise<Item | undefined> {
    const [updatedItem] = await db
      .update(items)
      .set({
        completed_at: new Date().toISOString(),
        verified: true,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
      })
      .where(eq(items.id, itemId))
      .returning();

    if (!updatedItem) return undefined;

    return {
      id: updatedItem.id,
      title: updatedItem.title,
      item_type: updatedItem.item_type as "task" | "habit" | "goal" | "project",
      recurrence_type: updatedItem.recurrence_type as
        | "once"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
        | undefined,
      due_date: updatedItem.due_date || undefined,
      time_frame: updatedItem.time_frame || undefined,
      is_chore: updatedItem.is_chore || undefined,
      why_it_matters: updatedItem.why_it_matters || undefined,
      created_at: updatedItem.created_at,
      completed_at: updatedItem.completed_at || undefined,
      status: updatedItem.status as
        | "open"
        | "complete"
        | "pending_review"
        | undefined,
      verified: updatedItem.verified || undefined,
      verified_by: updatedItem.verified_by || undefined,
      verified_at: updatedItem.verified_at || undefined,
    };
  }

  async verifyItemWithPhoto(
    userId: string,
    itemId: string,
    verifiedBy: string,
    status: string,
    verified: boolean,
  ): Promise<Item | undefined> {
    const updateData: any = {
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
      status: status,
      verified: verified,
    };

    // Only set completed_at if verified is true (AI confirmed completion)
    if (verified) {
      updateData.completed_at = new Date().toISOString();
    }

    const [updatedItem] = await db
      .update(items)
      .set(updateData)
      .where(eq(items.id, itemId))
      .returning();

    if (!updatedItem) return undefined;

    return {
      id: updatedItem.id,
      title: updatedItem.title,
      item_type: updatedItem.item_type as "task" | "habit" | "goal" | "project",
      recurrence_type: updatedItem.recurrence_type as
        | "once"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
        | undefined,
      due_date: updatedItem.due_date || undefined,
      time_frame: updatedItem.time_frame || undefined,
      is_chore: updatedItem.is_chore || undefined,
      why_it_matters: updatedItem.why_it_matters || undefined,
      created_at: updatedItem.created_at,
      completed_at: updatedItem.completed_at || undefined,
      status: updatedItem.status as
        | "open"
        | "complete"
        | "pending_review"
        | undefined,
      verified: updatedItem.verified || undefined,
      verified_by: updatedItem.verified_by || undefined,
      verified_at: updatedItem.verified_at || undefined,
    };
  }

  // New recurring system methods (Phase 2 stubs)
  async getRecurringTemplate(templateId: string): Promise<any> {
    const isDevelopment = process.env.NODE_ENV === "development";
    const tableName = isDevelopment ? "dev_items" : "items";

    const query = `
      SELECT * FROM ${tableName} 
      WHERE id = $1 
      AND recurrence_type IS NOT NULL 
      AND recurrence_type != 'once'
    `;

    const result = await db.execute(
      sql.raw(query.replace(/\$1/g, `'${templateId}'`)),
    );

    if (result.rows.length === 0) {
      console.log(
        "🔄 NEW RECURRING: Template not found or not recurring:",
        templateId,
      );
      return null;
    }

    console.log("🔄 NEW RECURRING: Found template:", templateId);
    return result.rows[0];
  }

  async createInstanceCompletion(completion: any): Promise<any> {
    const isDevelopment = process.env.NODE_ENV === "development";
    const tableName = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";

    const id = nanoid();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO ${tableName} (
        id, template_id, occurrence_date, status, 
        completed_at, completed_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      completion.template_id,
      completion.occurrence_date,
      "completed",
      now,
      completion.completed_by,
      now,
      now,
    ];

    let finalQuery = query;
    values.forEach((value, index) => {
      finalQuery = finalQuery.replace(`$${index + 1}`, `'${value}'`);
    });

    const result = await db.execute(sql.raw(finalQuery));

    console.log("🔄 NEW RECURRING: Created instance completion:", id);
    return result.rows[0];
  }

  async deleteInstanceCompletion(completionId: string): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";
    const tableName = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";

    const query = `DELETE FROM ${tableName} WHERE id = '${completionId}'`;

    await db.execute(sql.raw(query));

    console.log("🔄 NEW RECURRING: Deleted instance completion:", completionId);
  }

  async getInstanceCompletionHistory(
    templateId: string,
    instanceId: string,
  ): Promise<any[]> {
    const isDevelopment = process.env.NODE_ENV === "development";
    const tableName = isDevelopment
      ? "dev_recurring_instances"
      : "recurring_instances";

    const query = `
      SELECT * FROM ${tableName} 
      WHERE template_id = '${templateId}' 
      AND occurrence_date = '${instanceId}'
      ORDER BY created_at DESC
    `;

    const result = await db.execute(sql.raw(query));

    console.log(
      "🔄 NEW RECURRING: Found completion history:",
      result.rows.length,
      "records",
    );
    return result.rows;
  }

  async generateRecurringInstances(
    templateId: string,
    options: { start_date: string; end_date: string },
  ): Promise<any[]> {
    // This will use the newRecurringItemService to generate instances
    console.log(
      "🔄 NEW RECURRING: generateRecurringInstances called (using service)",
      templateId,
      options,
    );

    // Get the template
    const template = await this.getRecurringTemplate(templateId);
    if (!template) {
      return [];
    }

    // Import the service to use existing generation logic
    const { newRecurringItemService } = await import(
      "./services/newRecurringItemService"
    );

    // Generate instances using the service
    const instances =
      await newRecurringItemService.generateInstancesForDateRange(
        template,
        options.start_date,
        options.end_date,
      );

    return instances;
  }
}

// Export storage instance - switch to database storage
export const storage = new DatabaseStorage();
