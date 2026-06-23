import React, { useState, useEffect, useRef, useCallback } from 'react';
import InputBar from '../Chat/InputBar.jsx';
import SpecSummary from './SpecSummary.jsx';
import BlockDisplay from './BlockDisplay.jsx';
import { callGemini, parseCreateModeResponse, GeminiAPIError, runGameQACheck } from '../../lib/gemini.js';
import { CREATE_MODE_SYSTEM_PROMPT } from '../../prompts/createModePrompt.js';
import { detectGenre, buildGenreGenerationAddendum, buildGenreQARubric } from '../../prompts/genreTemplates.js';
import { useCreateSession } from '../../hooks/useCreateSession.js';
import { exportSessionToPDF } from '../../lib/pdfExport.js';
import { correctScratchBlocks } from '../../lib/scratchBlocksCorrector.js';

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
      <div className="w-full max-w-[90%] min-w-0">
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
  const qaFiredRef = useRef(false);
  const didAutoRestoreRef = useRef(false);
  const messagesRef = useRef(messages);

  const {
    sessions,
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

  // 直近の作るモードセッションを起動時に自動復元する。
  // iOSのPDFビューア（「完了」で戻る）等でPWAがリロードされても、チャットが消えず復帰する。
  // 復元は初回1度だけ。以降の「＋新しく作る」やメッセージ更新では開き直さない。
  useEffect(() => {
    if (didAutoRestoreRef.current) return;
    // すでに画面に会話があれば復元不要（進行中の状態を上書きしない）
    if (sessionId || messages.length > 0) {
      didAutoRestoreRef.current = true;
      return;
    }
    const latest = sessions?.[0]; // updatedAt降順なので先頭が最新セッション
    if (latest && latest.messages?.length) {
      didAutoRestoreRef.current = true;
      setSessionId(latest.id);
      setMessages(latest.messages);
    }
  }, [sessions, sessionId, messages.length]);

  // 現在の完成形：全generatingメッセージをスプライト名でまとめた1枚
  const generatingMessages = messages.filter(
    m => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length
  );
  const latestGenerating = generatingMessages.at(-1) || null;
  const mergedSprites = mergeGeneratingSprites(generatingMessages);
  const mergedSpec = latestGenerating?.parsed?.spec || null;

  const handleResume = useCallback(() => {
    // 進行中が無ければ完成済みでも最新セッションを開けるようにする
    const target = latestInProgressSession || sessions?.[0];
    if (!target) return;
    didAutoRestoreRef.current = true;
    setSessionId(target.id);
    setMessages(target.messages || []);
  }, [latestInProgressSession, sessions]);

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

    // ジャンルを検出できたら、核（必須メカニクス＋手本イディオム）をプロンプトに注入し、
    // 質問せず必ず実装させる。未対応ジャンルは従来どおり（フォールバック）。
    const convoText = [...history.map(m => m.content || ''), userText].join('\n');
    const genre = detectGenre(convoText);
    const systemPrompt = genre
      ? `${CREATE_MODE_SYSTEM_PROMPT}\n\n${buildGenreGenerationAddendum(genre)}`
      : CREATE_MODE_SYSTEM_PROMPT;

    try {
      const raw = await callGemini(historyForAPI, apiKey, model, 'ja', systemPrompt);
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

  // まとめ直しの「保証ステップ」：AI再生成を待たず・AIに頼らず、決定論コレクターを
  // 現在の全スプライトのブロックに直接かけて、赤ブロックを正しいデフォルトブロックに
  // その場で置き換える。AIが同じ記法ミスを繰り返しても、ここで確実に直った形を残せる。
  // 最新のgeneratingメッセージを corrected な全スプライト＋replaceAll で上書きする。
  const applyCorrectorLocally = useCallback(() => {
    const current = mergeGeneratingSprites(
      messagesRef.current.filter(
        m => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length
      )
    );
    if (!current.length) return;
    const corrected = current.map(s => ({ ...s, blocks: correctScratchBlocks(s.blocks || '') }));

    setMessages(prev => {
      const idx = [...prev].map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === 'assistant' && m.parsed?.phase === 'generating')
        .at(-1)?.i;
      if (idx == null) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        parsed: { ...updated[idx].parsed, sprites: corrected, replaceAll: true },
      };
      return updated;
    });
  }, []);

  // 手動再構築（「ブロックをまとめ直す」＝赤ブロック修正＋古い残骸の整理を兼ねるクリーン再構築）
  // 現在のゲームに必要なスプライト一式をフル生成し、結果でまるごと置き換える（replaceAll）。
  const handleManualRebuild = useCallback(async () => {
    if (isAutoFixing || isLoading) return;
    // 手動なので自動修正の試行カウンターをリセットして必ず実行する
    autoFixAttemptsRef.current = 0;
    autoFixFiredRef.current = true;
    setIsAutoFixing(true);

    // まずAIに頼らず決定論補正をかけて赤ブロックを確実に直す（AIが失敗してもこの結果が残る）。
    applyCorrectorLocally();

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
  }, [callAPI, applyRebuildResult, applyCorrectorLocally, isAutoFixing, isLoading]);

  // 動作QAゲート（意味ゲート）：generating結果が出たあとに別パスのQA AIで採点し、
  // ジャンルの必須メカニクスが欠落していたら1回だけ自動補完して作り直す。
  // 赤ブロック検出（構文ゲート）とは独立。1ユーザーターンにつき最大1回（qaFiredRefで制御）。
  // newGenMessage: 直前にappendしたgenerating結果（messagesRefにはまだ反映されていないため明示的に渡す）
  const runQAGate = useCallback(async (newGenMessage) => {
    if (qaFiredRef.current) return;

    const genreText = [...messagesRef.current.map(m => m.content || ''), newGenMessage?.content || ''].join('\n');
    const genre = detectGenre(genreText);
    if (!genre) return; // 未対応ジャンルはQAしない（フォールバック）

    const apiKey = localStorage.getItem('scratteach_api_key');
    const model = localStorage.getItem('scratteach_model') || 'gemini-3.1-flash-lite';
    if (!apiKey) return;

    // 現在の完成形＝過去のgenerating（ref）＋今回の新メッセージ をスプライト名で畳み込む
    const priorGen = messagesRef.current.filter(
      m => m.role === 'assistant' && m.parsed?.phase === 'generating' && m.parsed?.sprites?.length
    );
    const merged = mergeGeneratingSprites(
      newGenMessage ? [...priorGen, newGenMessage] : priorGen
    );
    if (!merged.length) return;

    qaFiredRef.current = true;

    try {
      const qa = await runGameQACheck(buildGenreQARubric(genre), merged, apiKey, model);
      const problems = [...(qa.missing || []), ...(qa.issues || [])];
      if (qa.ok || !problems.length) return; // 合格ならそのまま表示

      // 欠落を指摘して1回だけ作り直し
      setIsAutoFixing(true);
      try {
        const names = merged.map(s => s.name);
        const namesLine = names.length
          ? `\n現在のスプライト：${names.join('、')}。\nこれらを同じ名前のままsprites[]に入れて返してください（修正のないスプライトも省略せず含める）。`
          : '';
        const detail = problems.map(p => `・${p}`).join('\n');
        const correctionText =
          `【動作チェックの指摘】\nこのゲームには次の不足・問題があり、まだゲームとして成立していません：\n${detail}${namesLine}\n\n` +
          `これらをすべて満たすよう、generatingフェーズで全スプライトのブロックを作り直してください。` +
          `特に上で指摘された必須メカニクスは必ずブロックとして実装すること。` +
          `message には【Scratchで先に準備してください】ガイド（STEP5の形式）を必ず含めること。`;
        const result = await callAPI(correctionText, null, messagesRef.current);
        if (result?.parsed?.phase === 'generating' && result.parsed.sprites) {
          applyRebuildResult(result);
        }
      } finally {
        setIsAutoFixing(false);
      }
    } catch (err) {
      console.error('QA gate failed:', err);
    }
  }, [callAPI, applyRebuildResult]);

  const handleSend = useCallback(async (text, imageData) => {
    if ((!text && !imageData) || isLoading) return;

    // ユーザーが新しいメッセージを送ったら自動修正・QAカウンターをリセット
    autoFixAttemptsRef.current = 0;
    autoFixFiredRef.current = false;
    qaFiredRef.current = false;

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

        // 動作QAゲート：ブロック生成時のみ、別パスで成立性を採点し欠落を自動補完する
        if (result.parsed.phase === 'generating' && result.parsed.sprites?.length) {
          await runQAGate(aiMessage);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, sessionId, startNewSession, addMessageToDB, callAPI, updateSessionSpec, updateSessionSprites, runQAGate]);

  const handleApprove = useCallback(() => {
    handleSend('はい、作って！', null);
  }, [handleSend]);

  const handleModify = useCallback(() => {
    handleSend('仕様を修正したいです。どの項目を変更できますか？', null);
  }, [handleSend]);

  const handleNewSession = useCallback(() => {
    // 進行中の会話があるときは誤タップ防止に確認する
    if (messages.length > 0 && !window.confirm('今のチャットを閉じて新しく作りますか？')) return;
    didAutoRestoreRef.current = true; // 直後の自動復元で前回を開き直さないようにする
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, [messages.length]);

  const handleExportAll = useCallback(async () => {
    const title = messages[0]?.content?.slice(0, 40) || 'ゲーム';
    // 折りたたみ状態に関係なく、現在の完成形（mergedSprites）をソースから描き直してPDF化。
    // 会話＝1ページ、各スプライト＝1ページの「セクション別長尺ページ」で出力する。
    await exportSessionToPDF({
      chatElementId: 'create-mode-messages',
      sprites: mergedSprites,
      spec: mergedSpec || latestGenerating?.parsed?.spec,
      gameTitle: title,
      filename: `scratteach-${title}.pdf`,
    });
  }, [messages, mergedSprites, mergedSpec, latestGenerating]);

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
              hasInProgress={!!(latestInProgressSession || sessions?.[0]?.messages?.length)}
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
