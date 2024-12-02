
export interface ChatBotConfiguration {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;  
}

export interface ChatInputState {
  value: string;  
}

export enum ChatBotMessageType {
  AI = "ai",
  Human = "human",
}

export interface ChatBotHistoryItem {
  messageId: string;
  type: ChatBotMessageType;
  content: string;
  metadata: Record<
    string,
    | string
    | boolean
    | number
    | null
    | undefined    
    | string[]
    | string[][]
  >;
}

// Renaming variables and changing types to match new feedback schema
// feedback (1 || 0) -> feedbackType ("positive" || "negative")
// topic -> feedbackCategory
// problem (string) -> feedbackRank (number)
// comment -> feedbackMessage
export interface FeedbackData {
  sessionId: string;  
  feedbackType: string;
  prompt: string;
  completion: string;    
  feedbackCategory: string;
  feedbackRank: number;
  feedbackMessage: string;
  sources: string;
}
