import { SYSTEM_PROMPT, SYSTEM_PROMPT_EN } from './systemPrompt.js';

export const getSystemPrompt = (blockLang) =>
  blockLang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT;

export const parseCreateModeResponse = (text) => {
  try {
    const clean = text.replace(/^```json\s*|\s*```$/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { phase: 'planning', message: text, question: null, spec: {}, sprites: null };
  }
};

export class GeminiAPIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GeminiAPIError';
    this.status = status;
    this.code = code;
  }
}

export const parseAIResponse = (text) => {
  try {
    // ```json ... ``` のコードブロックを除去
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { explanation: text, blocks: null, reason: null, hint: null };
  }
};

export const callGemini = async (messages, apiKey, model, blockLang = 'ja', systemPromptOverride = null) => {
  if (!apiKey) {
    throw new GeminiAPIError('APIキーが設定されていません', 0, 'NO_API_KEY');
  }

  const systemPrompt = systemPromptOverride || getSystemPrompt(blockLang);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: m.image
            ? [
                { text: m.content || '' },
                { inline_data: { mime_type: m.image.mimeType, data: m.image.data } },
              ]
            : [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || 'APIエラーが発生しました';

    if (response.status === 401) {
      throw new GeminiAPIError(
        `APIキーが無効です。設定画面でAPIキーを確認してください。\n詳細: ${errorMessage}`,
        401,
        'INVALID_API_KEY'
      );
    }

    if (response.status === 429) {
      throw new GeminiAPIError(
        `リクエスト制限に達しました（レート制限）。しばらく待ってから再試行するか、設定画面でモデルを切り替えてください。\n詳細: ${errorMessage}`,
        429,
        'RATE_LIMIT'
      );
    }

    if (response.status === 400) {
      throw new GeminiAPIError(
        `リクエストが不正です。${errorMessage}`,
        400,
        'BAD_REQUEST'
      );
    }

    throw new GeminiAPIError(
      `APIエラー (${response.status}): ${errorMessage}`,
      response.status,
      'API_ERROR'
    );
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new GeminiAPIError(
      '応答が空でした。もう一度お試しください。',
      0,
      'EMPTY_RESPONSE'
    );
  }

  const rawText = data.candidates[0].content.parts[0].text;
  return rawText;
};
