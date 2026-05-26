import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Layout/Header.jsx';
import Sidebar from './components/Layout/Sidebar.jsx';
import ChatWindow from './components/Chat/ChatWindow.jsx';
import ModeSelector from './components/ModeSelector.jsx';
import CreateModeChat from './components/CreateMode/CreateModeChat.jsx';
import SettingsModal from './components/Settings/SettingsModal.jsx';
import ExportButton from './components/History/ExportButton.jsx';
import PasswordGate from './components/PasswordGate.jsx';
import { useGeminiChat } from './hooks/useGeminiChat.js';
import { useIndexedDB } from './hooks/useIndexedDB.js';

const checkSession = () => {
  try {
    const stored = localStorage.getItem('scratteach_auth');
    if (!stored) return false;
    const { authenticated, month } = JSON.parse(stored);
    const currentMonth = new Date().toISOString().slice(0, 7);
    return authenticated && month === currentMonth;
  } catch {
    localStorage.removeItem('scratteach_auth');
    return false;
  }
};

// 認証済み画面 — フックを無条件で呼べる独立コンポーネント
const AuthenticatedApp = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState(
    () => localStorage.getItem('scratteach_mode') || 'question'
  );

  const {
    conversations,
    currentConversation,
    startNewConversation,
    addMessage,
    switchConversation,
    removeConversation,
    clearCurrentConversation,
  } = useIndexedDB('question');

  const {
    isLoading,
    error,
    sendMessage,
    clearError,
    resetMessages,
  } = useGeminiChat(() => setIsSettingsOpen(true));

  useEffect(() => {
    const apiKey = localStorage.getItem('scratteach_api_key');
    if (!apiKey) setIsSettingsOpen(true);
  }, []);

  const handleModeChange = useCallback((mode) => {
    setCurrentMode(mode);
    localStorage.setItem('scratteach_mode', mode);
    setIsSidebarOpen(false);
  }, []);

  const messages = currentConversation?.messages || [];

  const handleSendMessage = useCallback(async (text, imageData) => {
    const apiKey = localStorage.getItem('scratteach_api_key');
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const model = localStorage.getItem('scratteach_model') || 'gemini-3.1-flash-lite';

    const userMessage = {
      role: 'user',
      content: text,
      ...(imageData ? { image: imageData } : {}),
      timestamp: new Date().toISOString(),
    };

    let conversationId = currentConversation?.id;

    if (!conversationId) {
      const newConv = await startNewConversation(text || '画像を送信', model);
      if (!newConv) return;
      conversationId = newConv.id;
      await addMessage(conversationId, userMessage);
    } else {
      await addMessage(conversationId, userMessage);
    }

    const previousMessages = (currentConversation?.messages || [])
      .map(m => ({ role: m.role, content: m.content, ...(m.image ? { image: m.image } : {}) }));

    const aiMessage = await sendMessage(text, previousMessages, imageData);
    if (aiMessage) {
      await addMessage(conversationId, aiMessage);
    }
  }, [currentConversation, startNewConversation, addMessage, sendMessage]);

  const handleNewChat = useCallback(() => {
    clearCurrentConversation();
    resetMessages();
    setIsSidebarOpen(false);
  }, [clearCurrentConversation, resetMessages]);

  const handleSelectConversation = useCallback(async (id) => {
    await switchConversation(id);
    setIsSidebarOpen(false);
  }, [switchConversation]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(v => !v)}
        isSidebarOpen={isSidebarOpen}
        currentMode={currentMode}
      />

      <ModeSelector currentMode={currentMode} onModeChange={handleModeChange} />

      <div className="flex flex-1 overflow-hidden">
        {currentMode === 'question' && (
          <Sidebar
            conversations={conversations}
            currentConversationId={currentConversation?.id}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={removeConversation}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {currentMode === 'question' ? (
            <>
              {currentConversation && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white no-print">
                  <h2 className="text-sm font-medium text-gray-600 truncate max-w-xs">
                    {currentConversation.title || '無題の会話'}
                  </h2>
                  <ExportButton conversation={currentConversation} />
                </div>
              )}
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                error={error}
                onSendMessage={handleSendMessage}
                onClearError={clearError}
              />
            </>
          ) : (
            <CreateModeChat onOpenSettings={() => setIsSettingsOpen(true)} />
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

// 認証ゲート — フックを最小限に抑えたルートコンポーネント
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsAuthenticated(checkSession());
    setIsChecking(false);
  }, []);

  if (isChecking) return null;

  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return <AuthenticatedApp />;
};

export default App;
