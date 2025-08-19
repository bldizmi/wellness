// MindDouble Type Definitions

// Mood type
export interface Mood {
  id: string;
  mood_emoji: string;
  timestamp: string; // ISO date string
  created_at: string; // ISO date string
}

// Item types (tasks, habits, goals, projects)
export type ItemType = "task" | "habit" | "goal" | "project";
export type RecurrenceType = "once" | "daily" | "weekly" | "monthly" | "yearly";

export interface Item {
  id: string;
  title: string;
  item_type: ItemType;
  recurrence_type?: RecurrenceType;
  due_date?: string; // ISO date string
  time_frame?: number; // minutes
  is_chore?: boolean;
  why_it_matters?: string;
  created_at: string; // ISO date string
  completed_at?: string; // ISO date string
}

// AI Time Estimate
export interface TimeEstimate {
  minutes: number;
  formatted: string;
}

// AI Day Plan
export interface DayPlan {
  explanation: string;
  prioritized_tasks: Item[];
}

// Today's items grouped by type
export interface TodayItems {
  date: string;
  tasks: Item[];
  habits: Item[];
  goals: Item[];
  projects: Item[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  details?: any;
  [key: string]: any;
}

export interface MoodResponse extends ApiResponse<Mood> {
  mood: Mood;
  reflection?: string;
}

export interface MoodsResponse extends ApiResponse<Mood[]> {
  moods: Mood[];
}

export interface ItemResponse extends ApiResponse<Item> {
  item: Item;
}

export interface ItemsResponse extends ApiResponse<Item[]> {
  items: Item[];
}

export interface TodayResponse extends ApiResponse<TodayItems> {
  today: TodayItems;
}

export interface TimeEstimateResponse extends ApiResponse<TimeEstimate> {
  estimate: TimeEstimate;
}

export interface DayPlanResponse extends ApiResponse<DayPlan> {
  plan: DayPlan;
}
