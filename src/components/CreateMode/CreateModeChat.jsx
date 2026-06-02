import React, { useState, useEffect, useRef, useCallback } from 'react';
import InputBar from '../Chat/InputBar.jsx';
import SpecSummary from './SpecSummary.jsx';
import BlockDisplay from './BlockDisplay.jsx';
import { callGemini, parseCreateModeResponse, GeminiAPIError } from '../../lib/gemini.js';
import { CREATE_MODE_SYSTEM_PROMPT } from '../../prompts/createModePrompt.js';
import { useCreateSession } from '../../hooks/useCreateSession.js';
import { exportChatAndBlocksToPDF } from '../../lib/pdfExport.js';

const formatText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i, arr) => (
    <React.Fragment key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
};

const LoadingDots = ({ isChecking }) => (
  <div className="flex justify-start mb-4">
    <div className="max-w-[90%]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="text-xs font-medium text-gray-500">スクラッティーチ</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
        {isChecking ? (
          <div className="flex items-center gap-2 text-sm text-sky-600">
            <span>🔍</span>
            <span>仕様を確認中です...</span>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <span className="loading-dot-blue" />
            <span className="loading-dot-blue" />
            <span className="loading-dot-blue" />
          </div>
        )}
      </div>
    </div>
  </div>
);

const UserBubble = ({ message }) => (
  <div className="flex justify-end mb-4">
    <div className="max-w-[80%]">
      {message.image && (
        <div className="flex justify-end mb-1">
          <img
            src={message.image.preview || `data:${message.image.mimeType};base64,${message.image.data}`}
            alt="添付画像"
            className="max-h-48 rounded-xl object-contain border border-gray-200"
          />
        </div>
      )}
      {message.content && (
        <div className="bg-sky-400 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          {message.content}
        </div>
      )}
    </div>
  </div>
);

const AIBubble = ({ message, isLatest, isLastGenerating, onApprove, onModify, gameTitle, isDesktop, onInvalidBlocks, onRebuild, onExportAll, isRebuilding, mergedSprites, mergedSpec }) => {
  const parsed = message.parsed || {};
  const { phase, message: msg, question, spec } = parsed;

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[90%]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-xs font-medium text-gray-500">スクラッティーチ</span>
        </div>

        {(phase === 'planning' || phase === 'reviewing') && (
          <>
            {msg && (
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-gray-800 mb-2">
                {formatText(msg)}
              </div>
            )}
            {question && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-sky-800 font-medium">
                {formatText(question)}
              </div>
            )}
          </>
        )}

        {phase === 'summary' && (
          <SpecSummary
            spec={spec}
            onApprove={onApprove}
            onModify={onModify}
            isLatest={isLatest}
          />
        )}

        {phase === 'generating' && (
          <>
            {msg && (
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-gray-800 mb-3">
                {formatText(msg)}
              </div>
            )}
            {/* ブロックは「現在の完成形（全スプライトを名前でまとめた1枚）」として
                最新のgeneratingメッセージにだけ表示する。過去のgeneratingは案内文のみ。 */}
            {isLastGenerating && (
              isDesktop ? (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-700 flex items-center gap-2">
                  <span>📐</span>
                  <span>ブロックを右パネルに表示しています</span>
                </div>
              ) : (
                <BlockDisplay
                  sprites={mergedSprites}
                  spec={mergedSpec}
                  gameTitle={gameTitle}
                  onModifySpec={onModify}
                  onInvalidBlocks={onInvalidBlocks}
                  onRebuild={onRebuild}
                  onExportAll={onExportAll}
                  isRebuilding={isRebuilding}
                />
              )
            )}
          </>
        )}

        {!phase && (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-gray-800">
            {formatText(message.content)}
          </div>
        )}
      </div>
    </div>
  );
};

const WelcomeScreen = ({ onResume, hasInProgress }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
    <div className="w-16 h-16 rounded-2xl bg-sky-400 flex items-center justify-center mb-4 shadow-lg">
      <span className="text-white text-2xl">🛠</span>
    </div>
    <h2 className="text-xl font-bold text-gray-800 mb-2">
      いっしょにつくるモード
    </h2>
    <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
      作りたいゲームを教えてください。<br />
      一緒に仕様を決めて、Scratchブロックを生成します！
    </p>
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
      {[
        { emoji: '🧩', text: 'テトリスを作りたい' },
        { emoji: '🚀', text: 'シューティングゲーム' },
        { emoji: '🏃', text: 'アクションゲーム' },
        { emoji: '🔢', text: 'パズルゲーム' },
      ].map(({ emoji, text }) => (
        <div
          key={text}
          className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-700"
        >
          <span>{emoji}</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
    {hasInProgress && (
      <button
        onClick={onResume}
        className="flex items-center gap-2 px-5 py-2.5 bg-sky-400 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
      >
        <span>↩</span>
        前回の続きから再開する
      </button>
    )}
  </div>
);

const ErrorBanner = ({ error, onDismiss }) => {
  if (!error) return null;
  return (
    <div className="mx-4 my-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-red-500 flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-sm text-red-700 flex-1 whitespace-pre-wrap">{error}</p>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label="閉じる">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};

// 右パネル：現在の完成形（全スプライトを名前でまとめた1枚）を表示する。
// スプライトごとに常に1つだけ表示され、修正は各スプライト内で上書きされる。
const BlockPanel = ({ sprites, spec, gameTitle, onModifySpec, onInvalidBlocks, onExportAll, isAutoFixing, onRebuild }) => {
  if (!sprites || sprites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-400">
        <div className="text-4xl mb-3">📐</div>
        <p className="text-sm">ゲームのブロックが生成されると<br />ここに表示されます</p>
      </div>
    );
  }
  return (
    <div className="relative">
      {isAutoFixing && (
        <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center rounded-xl gap-2">
          <div className="flex gap-1.5">
            <span className="loading-dot-blue" />
            <span className="loading-dot-blue" />
            <span className="loading-dot-blue" />
          </div>
          <p className="text-sm text-sky-600 font-medium">🔧 ブロックを作り直しています...</p>
        </div>
      )}
      <BlockDisplay
        sprites={sprites}
        spec={spec}
        gameTitle={gameTitle}
        onModifySpec={onModifySpec}
        onInvalidBlocks={onInvalidBlocks}
        onExportAll={onExportAll}
        onRebuild={onRebuild}
        isRebuilding={isAutoFixing}
      />
    </div>
  );
};

// generatingメッセージ群を「スプライト名をキーにした現在の完成形」へ畳み込む。
// ・後の生成が同名スプライトを上書き（位置は初出順を維持）
// ・新しい名前は末尾に追加
// ・replaceAll フラグ付きの生成（クリーン再構築）はそこで一旦全消去してから積み直す
const mergeGeneratingSprites = (genMsgs) => {
  const map = new Map();
  for (const m of genMsgs) {
    if (m.parsed?.replaceAll) map.clear();
    for (const s of (m.parsed?.sprites || [])) {
      if (s && s.name) map.set(s.name, s);
    }
  }
  return [...map.values()];
};

const MAX_AUTO_FIX_ATTEMPTS = 3;

const CreateModeChat = ({ onOpenSettings }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const messagesEndRef = useRef(null);
  const autoFixAttemptsRef = useRef(0);
  const autoFixFiredRef = useRef(false);
  const messagesRef = useRef(messages);

  const {
    latestInProgressSession,
    startNewSession,
    addMessage: addMessageToDB,
    updateSessionSpec,
    updateSessionSprites,
  } = useCreateSession();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // messagesRefを常に最新に同期
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 現在の完成形：全generatingメッセージをスプライト名でまとめた1枚
  const generatingMessages = messages.filter(
    m => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length
  );
  const latestGenerating = generatingMessages.at(-1) || null;
  const mergedSprites = mergeGeneratingSprites(generatingMessages);
  const mergedSpec = latestGenerating?.parsed?.spec || null;

  const handleResume = useCallback(() => {
    if (!latestInProgressSession) return;
    setSessionId(latestInProgressSession.id);
    setMessages(latestInProgressSession.messages || []);
  }, [latestInProgressSession]);

  const callAPI = useCallback(async (userText, imageData, history) => {
    const apiKey = localStorage.getItem('scratteach_api_key');
    const model = localStorage.getItem('scratteach_model') || 'gemini-3.1-flash-lite';

    if (!apiKey) {
      setError('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
      if (onOpenSettings) onOpenSettings();
      return null;
    }

    const historyForAPI = [
      ...history.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.image ? { image: m.image } : {}),
      })),
      {
        role: 'user',
        content: userText,
        ...(imageData ? { image: imageData } : {}),
      },
    ];

    try {
      const raw = await callGemini(historyForAPI, apiKey, model, 'ja', CREATE_MODE_SYSTEM_PROMPT);
      const parsed = parseCreateModeResponse(raw);
      return { raw, parsed };
    } catch (err) {
      if (err instanceof GeminiAPIError) {
        setError(err.message);
      } else {
        setError(`予期しないエラーが発生しました: ${err.message}`);
      }
      return null;
    }
  }, [onOpenSettings]);

  // 再構築結果を最新のgeneratingメッセージに反映（準備ガイドmessageとspecは保持）
  // replaceAll=true のときは、それ以前の生成分を破棄して結果だけを残す（クリーン再構築）
  const applyRebuildResult = useCallback((result, { replaceAll = false } = {}) => {
    const lastGenerating = [...messagesRef.current]
      .reverse()
      .find(m => m.role === 'assistant' && m.parsed?.phase === 'generating');
    const originalMessage = lastGenerating?.parsed?.message;
    const originalSpec = lastGenerating?.parsed?.spec;

    setMessages(prev => {
      const idx = [...prev].map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === 'assistant' && m.parsed?.phase === 'generating')
        .at(-1)?.i;
      if (idx == null) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        content: result.raw,
        parsed: {
          ...result.parsed,
          message: originalMessage || result.parsed.message,
          spec: result.parsed.spec || originalSpec,
          ...(replaceAll ? { replaceAll: true } : {}),
        },
      };
      return updated;
    });
  }, []);

  // 現在の完成形に含まれるスプライト名（再構築リクエストでAIに全件返させるため）
  const currentSpriteNames = () =>
    mergeGeneratingSprites(
      messagesRef.current.filter(
        m => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length
      )
    ).map(s => s.name);

  const REBUILD_INSTRUCTION =
    `赤ブロックの最も多い原因は「かつ」「または」を横に連鎖させた条件式と、メッセージ名のブラケット記法漏れです。\n` +
    `条件式で「かつ」「または」を2回以上横につなげている箇所は、必ず「もし〜なら／でなければ」の入れ子に分解してください。\n` +
    `特にじゃんけんの勝敗判定は「または」を一切使わず、入れ子のif-elseだけで全9パターンを表現してください。\n` +
    `メッセージ名は必ず [名前 v] のドロップダウン記法で書いてください。\n\n` +
    `Scratch 3.0の公式デフォルトブロックのみを使い、generatingフェーズで全スプライトのブロックを作り直してください。message には【Scratchで先に準備してください】ガイドを必ず含めること。`;

  const handleAutoFix = useCallback(async (invalidList) => {
    if (autoFixFiredRef.current) return;
    if (autoFixAttemptsRef.current >= MAX_AUTO_FIX_ATTEMPTS) return;

    autoFixFiredRef.current = true;
    autoFixAttemptsRef.current++;
    setIsAutoFixing(true);

    const details = invalidList
      .map(({ spriteName, blocks }) =>
        `・「${spriteName}」スプライト：${blocks.map(b => `「${b}」`).join('、')}`)
      .join('\n');

    const names = currentSpriteNames();
    const namesLine = names.length
      ? `\n現在のスプライト：${names.join('、')}。\nこれらを同じ名前のままsprites[]に入れて返してください（修正のないスプライトも省略せず含める）。`
      : '';
    const correctionText =
      `【自動修正リクエスト】\n以下のスプライトにScratchに存在しないブロック（赤いブロック）が含まれていました：\n${details}${namesLine}\n\n${REBUILD_INSTRUCTION}`;

    try {
      const result = await callAPI(correctionText, null, messagesRef.current);
      if (result?.parsed?.phase === 'generating' && result.parsed.sprites) {
        applyRebuildResult(result);
        // 次のレンダリングで再チェックできるようfireフラグをリセット
        autoFixFiredRef.current = false;
      }
    } catch (err) {
      console.error('Auto-fix failed:', err);
    } finally {
      setIsAutoFixing(false);
    }
  }, [callAPI, applyRebuildResult]);

  // 手動再構築（「ブロックをまとめ直す」＝赤ブロック修正＋古い残骸の整理を兼ねるクリーン再構築）
  // 現在のゲームに必要なスプライト一式をフル生成し、結果でまるごと置き換える（replaceAll）。
  const handleManualRebuild = useCallback(async () => {
    if (isAutoFixing || isLoading) return;
    // 手動なので自動修正の試行カウンターをリセットして必ず実行する
    autoFixAttemptsRef.current = 0;
    autoFixFiredRef.current = true;
    setIsAutoFixing(true);

    const names = currentSpriteNames();
    const namesLine = names.length
      ? `\n現在のスプライト：${names.join('、')}。\nこのゲームに今必要なスプライトだけを過不足なくsprites[]に含めてください（不要になったスプライトは含めない、新しく必要なら追加してよい）。`
      : '';
    const correctionText =
      `【まとめ直しリクエスト】\n現在のブロックを最新の仕様できれいに作り直してください。赤いブロックや、古くなった・重複したスプライトがあれば整理してください。${namesLine}\n\n${REBUILD_INSTRUCTION}`;

    try {
      const result = await callAPI(correctionText, null, messagesRef.current);
      if (result?.parsed?.phase === 'generating' && result.parsed.sprites) {
        applyRebuildResult(result, { replaceAll: true });
      }
    } catch (err) {
      console.error('Manual rebuild failed:', err);
    } finally {
      autoFixFiredRef.current = false;
      setIsAutoFixing(false);
    }
  }, [callAPI, applyRebuildResult, isAutoFixing, isLoading]);

  const handleSend = useCallback(async (text, imageData) => {
    if ((!text && !imageData) || isLoading) return;

    // ユーザーが新しいメッセージを送ったら自動修正カウンターをリセット
    autoFixAttemptsRef.current = 0;
    autoFixFiredRef.current = false;

    const userMessage = {
      role: 'user',
      content: text,
      ...(imageData ? { image: imageData } : {}),
      timestamp: new Date().toISOString(),
    };

    const currentMessages = [...messages];
    const newMessages = [...currentMessages, userMessage];
    setMessages(newMessages);
    setError(null);
    setIsLoading(true);

    let currentSessionId = sessionId;

    try {
      if (!currentSessionId) {
        const model = localStorage.getItem('scratteach_model') || 'gemini-3.1-flash-lite';
        const newSession = await startNewSession(text, model);
        if (newSession) {
          currentSessionId = newSession.id;
          setSessionId(currentSessionId);
        }
      }

      if (currentSessionId) {
        await addMessageToDB(currentSessionId, userMessage);
      }

      const result = await callAPI(text, imageData, currentMessages);

      if (result) {
        const aiMessage = {
          role: 'assistant',
          content: result.raw,
          parsed: result.parsed,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, aiMessage]);

        if (currentSessionId) {
          await addMessageToDB(currentSessionId, aiMessage);

          if (result.parsed.phase === 'summary' && result.parsed.spec) {
            await updateSessionSpec(currentSessionId, result.parsed.spec, 'confirmed');
          } else if (result.parsed.phase === 'generating' && result.parsed.sprites) {
            await updateSessionSprites(currentSessionId, result.parsed.sprites);
          } else if (result.parsed.spec) {
            await updateSessionSpec(currentSessionId, result.parsed.spec, 'planning');
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, sessionId, startNewSession, addMessageToDB, callAPI, updateSessionSpec, updateSessionSprites]);

  const handleApprove = useCallback(() => {
    handleSend('はい、作って！', null);
  }, [handleSend]);

  const handleModify = useCallback(() => {
    handleSend('仕様を修正したいです。どの項目を変更できますか？', null);
  }, [handleSend]);

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  const handleExportAll = useCallback(async () => {
    const title = messages[0]?.content?.slice(0, 40) || 'ゲーム';
    await exportChatAndBlocksToPDF({
      chatElementId: 'create-mode-messages',
      blocksElementId: 'block-display-all',
      filename: `scratteach-${title}.pdf`,
      gameTitle: title,
      spec: latestGenerating?.parsed?.spec,
    });
  }, [messages, latestGenerating]);

  const lastAIIndex = messages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant').at(-1)?.i ?? -1;
  const lastGeneratingIndex = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length)
    .at(-1)?.i ?? -1;
  const lastAIPhase = messages.filter(m => m.role === 'assistant').at(-1)?.parsed?.phase;
  const isChecking = isLoading && lastAIPhase === 'summary';
  const gameTitle = messages[0]?.content?.slice(0, 40) || 'ゲーム';
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* チャットカラム */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!isEmpty && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-sky-100 bg-sky-50 no-print">
            <span className="text-sm font-medium text-sky-700 truncate max-w-xs">
              {messages[0]?.content?.slice(0, 40) || 'いっしょにつくるモード'}
            </span>
            <button
              onClick={handleNewSession}
              className="text-xs px-3 py-1.5 rounded-lg text-sky-600 hover:bg-sky-100 border border-sky-200 transition-colors"
            >
              + 新しく作る
            </button>
          </div>
        )}

        <div id="create-mode-messages" className="flex-1 overflow-y-auto px-4 py-4">
          {isEmpty && !isLoading ? (
            <WelcomeScreen
              onResume={handleResume}
              hasInProgress={!!latestInProgressSession}
            />
          ) : (
            <>
              {messages.map((message, index) => (
                message.role === 'user'
                  ? <UserBubble key={index} message={message} />
                  : <AIBubble
                      key={index}
                      message={message}
                      isLatest={index === lastAIIndex}
                      isLastGenerating={index === lastGeneratingIndex}
                      mergedSprites={mergedSprites}
                      mergedSpec={mergedSpec}
                      onApprove={handleApprove}
                      onModify={handleModify}
                      gameTitle={gameTitle}
                      isDesktop={isDesktop}
                      onInvalidBlocks={handleAutoFix}
                      onRebuild={handleManualRebuild}
                      onExportAll={handleExportAll}
                      isRebuilding={isAutoFixing}
                    />
              ))}
              {isLoading && <LoadingDots isChecking={isChecking} />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <InputBar
          onSend={handleSend}
          isLoading={isLoading}
          isEmpty={isEmpty}
          mode="create"
        />
      </div>

      {/* ブロックパネル（デスクトップのみ） */}
      {isDesktop && (
        <div className="w-80 lg:w-96 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              ブロック表示
              {isAutoFixing && (
                <span className="ml-2 text-xs font-normal text-sky-500">🔧 作り直し中...</span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {mergedSprites.length ? 'Scratchブロックプレビュー' : 'ブロック生成後に表示されます'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <BlockPanel
              sprites={mergedSprites}
              spec={mergedSpec}
              gameTitle={gameTitle}
              onModifySpec={handleModify}
              onInvalidBlocks={handleAutoFix}
              onExportAll={handleExportAll}
              isAutoFixing={isAutoFixing}
              onRebuild={handleManualRebuild}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateModeChat;
