import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const systemPrompt = `Parse natural language into task JSON. Today is ${todayStr}, tomorrow is ${tomorrowStr}.

CRITICAL: For "tomorrow" use exactly "${tomorrowStr}", not ${todayStr}.

Return JSON with required fields:
- title: string
- item_type: "task" | "habit" | "goal" | "chore" 
- due_date: string (YYYY-MM-DD)
- time_frame: number (minutes)
- is_chore: boolean

Examples:
"Call mom tomorrow" -> {"title": "Call mom", "item_type": "task", "due_date": "${tomorrowStr}", "time_frame": 30, "is_chore": false}
"Take out trash Monday" -> {"title": "Take out trash", "item_type": "chore", "due_date": "2025-05-26", "time_frame": 15, "is_chore": true}`;

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
    
    // Ensure required fields are present
    return {
      title: result.title || prompt.input,
      item_type: result.item_type || 'task',
      due_date: result.due_date || todayStr,
      time_frame: result.time_frame || 30,
      is_chore: result.is_chore || false,
      created_by: userId,
      assigned_to: userId
    };
  } catch (error) {
    console.error('Error parsing prompt:', error);
    throw new Error('Failed to parse task from prompt');
  }
};