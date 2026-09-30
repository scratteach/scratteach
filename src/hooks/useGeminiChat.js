import { useState, useCallback } from 'react';
import { parseAIResponse, GeminiAPIError } from '../lib/gemini.js';
import { callWithFallback } from '../lib/modelFallback.js';

export const useGeminiChat = (onOpenSettings) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (userText, conversationHistory = [], imageData = null) => {
    const apiKey = localStorage.getItem('scratteach_api_key');
    const blockLang = localStorage.getItem('scratteach_block_lang') || 'ja';

    if (!apiKey) {
      setError('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
      if (onOpenSettings) onOpenSettings();
      return null;
    }

    setError(null);
    setIsLoading(true);

    const newUserMessage = { role: 'user', content: userText };
    if (imageData) newUserMessage.image = imageData;

    const historyForAPI = [
      ...conversationHistory,
      newUserMessage,
    ];

    try {
      // 質問モードは lite 層でよい（人間が打つ速度なので 15/分 には当たらない）。
      const { text: rawResponse, model: usedModel } = await callWithFallback(
        historyForAPI, apiKey, { job: 'ask', blockLang }
      );
      const parsed = parseAIResponse(rawResponse);

      return {
        role: 'assistant',
        content: rawResponse,
        parsed,
        model: usedModel,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof GeminiAPIError) {
        setError(err.message);
      } else {
        setError(`予期しないエラーが発生しました: ${err.message}`);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onOpenSettings]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    setMessages,
    isLoading,
    error,
    sendMessage,
    clearError,
    resetMessages,
  };
};
