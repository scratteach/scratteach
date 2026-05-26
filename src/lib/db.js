import { openDB } from 'idb';

const DB_NAME = 'scratteach-db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

const getDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('updatedAt', 'updatedAt');
      }
    },
  });
};

export const createConversation = async (firstMessage, model, mode = 'question') => {
  const db = await getDB();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const title = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');

  const conversation = {
    id,
    title,
    mode,
    createdAt: now,
    updatedAt: now,
    model: model || 'gemini-3.1-flash-lite',
    messages: [],
    ...(mode === 'create' ? { gameStatus: 'planning', spec: {} } : {}),
  };

  await db.put(STORE_NAME, conversation);
  return conversation;
};

export const getConversation = async (id) => {
  const db = await getDB();
  return db.get(STORE_NAME, id);
};

export const getAllConversations = async (mode = null) => {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const filtered = mode
    ? all.filter(c => (c.mode || 'question') === mode)
    : all;
  return filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

export const updateConversation = async (id, updates) => {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) throw new Error(`Conversation ${id} not found`);

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.put(STORE_NAME, updated);
  return updated;
};

export const addMessageToConversation = async (conversationId, message) => {
  const db = await getDB();
  const conversation = await db.get(STORE_NAME, conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const messageWithTimestamp = {
    ...message,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...conversation.messages, messageWithTimestamp];
  const updated = {
    ...conversation,
    messages: updatedMessages,
    updatedAt: new Date().toISOString(),
  };

  await db.put(STORE_NAME, updated);
  return updated;
};

export const deleteConversation = async (id) => {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};
