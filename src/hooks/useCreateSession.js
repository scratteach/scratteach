import { useState, useEffect, useCallback } from 'react';
import { useIndexedDB } from './useIndexedDB.js';
import { updateConversation } from '../lib/db.js';

export const useCreateSession = () => {
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    startNewConversation,
    addMessage,
    switchConversation,
    removeConversation,
    clearCurrentConversation,
    loadAllConversations,
  } = useIndexedDB('create');

  const startNewSession = useCallback(async (firstMessage, model) => {
    return startNewConversation(firstMessage, model);
  }, [startNewConversation]);

  const updateSessionSpec = useCallback(async (conversationId, spec, gameStatus) => {
    try {
      const updated = await updateConversation(conversationId, { spec, gameStatus });
      setCurrentConversation(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update session spec:', err);
      return null;
    }
  }, [setCurrentConversation]);

  const updateSessionSprites = useCallback(async (conversationId, sprites) => {
    try {
      const updated = await updateConversation(conversationId, { sprites, gameStatus: 'generated' });
      setCurrentConversation(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update session sprites:', err);
      return null;
    }
  }, [setCurrentConversation]);

  const latestInProgressSession = conversations.find(
    c => c.gameStatus !== 'generated' && c.messages && c.messages.length > 0
  ) || null;

  return {
    sessions: conversations,
    currentSession: currentConversation,
    latestInProgressSession,
    startNewSession,
    addMessage,
    switchSession: switchConversation,
    deleteSession: removeConversation,
    clearCurrentSession: clearCurrentConversation,
    updateSessionSpec,
    updateSessionSprites,
    loadAllSessions: loadAllConversations,
  };
};
