export interface AiCompletionRequest {
  prompt: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AiCompletionResponse {
  text: string;
}

export interface IAiProvider {
  getAvailableModels(): Promise<string[]>;
  getCompletion(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}
