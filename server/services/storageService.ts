import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { Mood, InsertMood, Item, InsertItem } from '@shared/schema';

// Data directory path
const DATA_DIR = path.join(process.cwd(), 'data');

// File paths
const MOODS_FILE = path.join(DATA_DIR, 'moods.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');

// Make sure data directory exists
export const initializeStorage = async (): Promise<void> => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize empty data files if they don't exist
    const files = [MOODS_FILE, ITEMS_FILE];
    
    for (const file of files) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, '{}', 'utf8');
      }
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
};

// Read data for a specific user from a file
export const readUserData = async <T>(filePath: string, userId: string): Promise<T[]> => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data || '{}');
    return parsed[userId] || [];
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
};

// Write user data to a file
export const writeUserData = async <T>(filePath: string, userId: string, data: T[]): Promise<void> => {
  try {
    // Read existing file
    let fileData: Record<string, T[]> = {};
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      fileData = JSON.parse(existing || '{}');
    } catch (error) {
      // If file doesn't exist, we'll create it
    }
    
    // Update with new data
    fileData[userId] = data;
    
    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    throw error;
  }
};

// Mood operations
export const saveMood = async (userId: string, mood: InsertMood): Promise<Mood> => {
  // Read existing moods
  const moods = await readUserData<Mood>(MOODS_FILE, userId);
  
  // Create new mood
  const newMood: Mood = {
    ...mood,
    id: `mood_${nanoid()}`,
    created_at: new Date().toISOString()
  };
  
  // Add to list and save
  moods.push(newMood);
  await writeUserData(MOODS_FILE, userId, moods);
  
  return newMood;
};

export const getUserMoods = async (userId: string): Promise<Mood[]> => {
  return readUserData<Mood>(MOODS_FILE, userId);
};

// Item operations
export const saveItem = async (userId: string, item: InsertItem): Promise<Item> => {
  // Read existing items
  const items = await readUserData<Item>(ITEMS_FILE, userId);
  
  // Create new item
  const newItem: Item = {
    ...item,
    id: `item_${nanoid()}`,
    created_at: new Date().toISOString()
  };
  
  // Add to list and save
  items.push(newItem);
  await writeUserData(ITEMS_FILE, userId, items);
  
  return newItem;
};

export const getUserItems = async (userId: string): Promise<Item[]> => {
  return readUserData<Item>(ITEMS_FILE, userId);
};

export const getUserItemsByDate = async (userId: string, dateStr: string): Promise<Item[]> => {
  const items = await readUserData<Item>(ITEMS_FILE, userId);
  const date = new Date(dateStr);
  const dateString = date.toISOString().split('T')[0];
  
  return items.filter(item => {
    // Handle completed items
    if (item.completed_at) {
      return false;
    }
    
    // For items with a due date
    if (item.due_date) {
      const itemDate = new Date(item.due_date);
      const itemDateString = itemDate.toISOString().split('T')[0];
      return itemDateString === dateString;
    }
    
    // For recurring items
    if (item.recurrence_type === 'daily') {
      return true;
    }
    
    if (item.recurrence_type === 'weekly') {
      const itemDate = new Date(item.created_at);
      return date.getDay() === itemDate.getDay();
    }
    
    if (item.recurrence_type === 'monthly') {
      const itemDate = new Date(item.created_at);
      return date.getDate() === itemDate.getDate();
    }
    
    // Default case
    return false;
  });
};

export const markItemComplete = async (userId: string, itemId: string): Promise<Item | undefined> => {
  const items = await readUserData<Item>(ITEMS_FILE, userId);
  const itemIndex = items.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) {
    return undefined;
  }
  
  const item = items[itemIndex];
  items[itemIndex] = {
    ...item,
    completed_at: new Date().toISOString()
  };
  
  await writeUserData(ITEMS_FILE, userId, items);
  return items[itemIndex];
};
