
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function solveQuestion(input: { text?: string; imageBase64?: string }): Promise<GeminiResponse> {
  const model = "gemini-3-flash-preview";

  const prompt = `Você é um assistente de estudos especializado em concursos e certificações.
  O usuário fornecerá uma imagem ou um texto de uma questão de simulado.
  O input pode ser:
  - Uma questão completa com enunciado e opções.
  - Apenas o feedback de erro/acerto do simulador (ex: "Incorrect. The correct answer is...").
  
  Sua tarefa:
  1. Identificar o enunciado (se não houver, deduza-o a partir da explicação do gabarito).
  2. Listar as opções (se houver).
  3. Identificar a alternativa correta de forma clara.
  4. Gerar uma explicação didática e detalhada em PORTUGUÊS.
  
  IMPORTANTE: Se o input for apenas uma frase de gabarito, reconstrua a pergunta original no campo "question" para que o registro fique completo.
  
  Retorne EXCLUSIVAMENTE um objeto JSON.`;

  const contents: any[] = [{ text: prompt }];

  if (input.text) {
    contents.push({ text: `Input do Usuário: ${input.text}` });
  }

  if (input.imageBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: input.imageBase64.split(",")[1] || input.imageBase64,
      },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "O enunciado da questão" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Opções de resposta" 
          },
          correctAnswer: { type: Type.STRING, description: "A resposta correta" },
          explanation: { type: Type.STRING, description: "Explicação em português" },
        },
        required: ["question", "options", "correctAnswer", "explanation"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Sem resposta da IA");

  return JSON.parse(text);
}
