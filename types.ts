
export interface QuestionData {
  id: string;
  timestamp: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  category?: string;
  sourceImage?: string;
}

export interface GeminiResponse {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}
