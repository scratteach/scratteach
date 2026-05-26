import { useState, useEffect, useCallback } from 'react';
import {
  createConversation,
  getConversation,
  getAllConversations,
  updateConversation,
  addMessageToConversation,
  deleteConversation,
} from '../lib/db.js';

export const useIndexedDB = (mode = 'question') => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllConversations();
  }, [mode]);

  const loadAllConversations = useCallback(async () => {
    try {
      const all = await getAllConversations(mode);
      setConversations(all);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('会話履歴の読み込みに失敗しました');
    }
  }, [mode]);

  const startNewConversation = useCallback(async (firstMessage, model) => {
    setIsLoading(true);
    try {
      const conversation = await createConversation(firstMessage, model, mode);
      setCurrentConversation(conversation);
      await loadAllConversations();
      return conversation;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('会話の作成に失敗しました');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadAllConversations]);

  const addMessage = useCallback(async (conversationId, message) => {
    try {
      const updated = await addMessageToConversation(conversationId, message);
      setCurrentConversation(updated);
      await loadAllConversations();
      return updated;
    } catch (err) {
      console.error('Failed to add message:', err);
      setError('メッセージの保存に失敗しました');
      return null;
    }
  }, [loadAllConversations]);

  const switchConversation = useCallback(async (conversationId) => {
    setIsLoading(true);
    try {
      const conversation = await getConversation(conversationId);
      if (conversation) {
        setCurrentConversation(conversation);
      }
      return conversation;
    } catch (err) {
      console.error('Failed to switch conversation:', err);
      setError('会話の切り替えに失敗しました');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeConversation = useCallback(async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
      await loadAllConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('会話の削除に失敗しました');
    }
  }, [currentConversation, loadAllConversations]);

  const clearCurrentConversation = useCallback(() => {
    setCurrentConversation(null);
  }, []);

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    isLoading,
    error,
    startNewConversation,
    addMessage,
    switchConversation,
    removeConversation,
    clearCurrentConversation,
    loadAllConversations,
  };
};
