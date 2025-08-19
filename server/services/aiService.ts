import OpenAI from "openai";
import type { Item, TimeEstimate, DayPlan } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Estimates the time needed to complete a task
 * @param taskTitle The title of the task
 * @returns Time estimate in minutes and formatted string
 */
export const estimateTaskTime = async (taskTitle: string): Promise<TimeEstimate> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a productivity expert. Estimate how long it takes to complete tasks. Return JSON with 'minutes' (number) and 'formatted' (string like '30 min' or '2 hours')."
      },
      { role: "user", content: `How long does it take to: ${taskTitle}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return {
    minutes: result.minutes || 30,
    formatted: result.formatted || "30 min"
  };
};

/**
 * Plans the user's day based on mood and tasks
 * @param mood The user's current mood
 * @param tasks List of tasks for the day
 * @returns A prioritized plan with explanation
 */
export const planDay = async (mood: string, tasks: Item[]): Promise<DayPlan> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a wellness coach. Create a daily plan based on mood and tasks. Return JSON with 'prioritized_tasks' (array of task IDs in order) and 'explanation' (string)."
      },
      {
        role: "user",
        content: `Current mood: ${mood}\nTasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, time_frame: t.time_frame })))}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return {
    prioritized_tasks: result.prioritized_tasks || tasks.map(t => t.id),
    explanation: result.explanation || "Here's your optimized daily plan."
  };
};

/**
 * Generates a reflection on the user's mood
 * @param moodEmoji The emoji representing the user's mood
 * @returns A thoughtful reflection on the mood
 */
export const reflectOnMood = async (moodEmoji: string): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a compassionate wellness coach. Provide a brief, empathetic reflection on the user's mood."
      },
      { role: "user", content: `My current mood: ${moodEmoji}` }
    ],
    temperature: 0.7,
    max_tokens: 150
  });

  return response.choices[0].message.content || "Thank you for sharing how you're feeling today.";
};

/**
 * Parses natural language input and creates a structured task object
 * @param prompt Natural language input from user (e.g., voice-to-text)
 * @returns Structured task data ready for storage
 */
export const createItemFromPrompt = async (prompt: {input: string, client_date?: string}, userId: string): Promise<any> => {
  console.log('AI Service: Parsing prompt:', prompt.input);
  
  const currentDate = prompt.client_date ? new Date(prompt.client_date) : new Date();
  const todayStr = currentDate.toISOString().split('T')[0];
  const tomorrowStr = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Dynamic weekday date calculation
  const inputLower = prompt.input.toLowerCase();
  let calculatedDueDate = todayStr;

  if (inputLower.includes('tomorrow')) {
    calculatedDueDate = tomorrowStr;
  } else {
    // Map weekday names to numbers (Sunday = 0, Monday = 1, etc.)
    const weekdays = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    // Find which weekday is mentioned
    for (const [dayName, targetDay] of Object.entries(weekdays)) {
      if (inputLower.includes(dayName)) {
        const currentDay = currentDate.getDay();
        let daysToAdd = targetDay - currentDay;
        
        // If target day is today or has passed this week, go to next week
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        const resultDate = new Date(currentDate);
        resultDate.setDate(currentDate.getDate() + daysToAdd);
        calculatedDueDate = resultDate.toISOString().split('T')[0];
        break;
      }
    }
  }

  const systemPrompt = `Parse natural language into task JSON. Extract title and classify item type.

Return JSON with required fields:
- title: string (clean task title without date references)
- item_type: "task" | "habit" | "goal" | "project"
- time_frame: number (minutes estimate)
- verify_required: boolean (true if task needs photo verification)

Examples:
"Call mom tomorrow" -> {"title": "Call mom", "item_type": "task", "time_frame": 30, "verify_required": false}
"Clean my room" -> {"title": "Clean my room", "item_type": "task", "time_frame": 60, "verify_required": true}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt.input }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Use our calculated date, not AI's date
    return {
      title: result.title || prompt.input,
      item_type: result.item_type || 'task',
      due_date: calculatedDueDate,
      time_frame: result.time_frame || 30,
      verify_required: result.verify_required || false,
      created_by: userId,
      assigned_to: userId
    };
  } catch (error) {
    console.error('Error parsing prompt:', error);
    throw new Error('Failed to parse task from prompt');
  }
};