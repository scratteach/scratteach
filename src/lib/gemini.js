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

// ── ゲーム動作QA（意味ゲート）─────────────────────────────
// 生成パスとは独立した「厳格なQAレビュアー」。自分の作文を弁護させないため別呼び出しにする。
// ジャンル別ルーブリック（必須メカニクス＋よくある失敗）を採点基準に、生成済みブロックが
// 本当に遊べるかを判定し、欠落・問題を列挙させる。
const GAME_QA_SYSTEM_PROMPT = `あなたはScratchゲームの厳格なQA（品質保証）レビュアーです。
与えられた「必須メカニクス」と「よくある失敗」を採点基準として、生成済みのScratchブロックが
そのゲームとして最低限成立しているか（実際に遊べるか）を判定します。

採点ルール：
- 必須メカニクスの1つ1つについて、それを実装しているブロックが本当に存在するか確認する。
- 「あるはず」で判断しない。該当するブロックを実際に引用できる場合のみ「実装済み」とみなす。引用できなければ「欠落」。
- あなたはこのブロックの作者ではない。甘く採点せず、重箱の隅をつつくつもりで欠落・矛盾・貫通・終わらない等の欠陥を探す。
- 「よくある失敗」のいずれかに該当していないかも1つずつ確認する。

出力は必ず次のJSONのみ（前後にテキストや\`\`\`を一切付けない）：
{"ok": true/false, "missing": ["欠落している必須メカニクスと、なぜそう判断したかを具体的に"], "issues": ["該当する失敗と、どのスプライトの問題かを具体的に"]}

- 必須メカニクスが全て実装され、よくある失敗にも該当しなければ ok:true、missingとissuesは空配列。
- 1つでも欠落・該当があれば ok:false にし、該当項目をmissing/issuesに具体的に列挙する（あいまいな指摘ではなく、何がどう足りないかを書く）。`;

const parseQAResponse = (text) => {
  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    const obj = JSON.parse(clean);
    return {
      ok: !!obj.ok,
      missing: Array.isArray(obj.missing) ? obj.missing : [],
      issues: Array.isArray(obj.issues) ? obj.issues : [],
    };
  } catch {
    // パース失敗時はfail-open（表示をブロックしない）。構文の赤ブロックゲートは別途走る。
    return { ok: true, missing: [], issues: [] };
  }
};

// rubric: buildGenreQARubric() の出力 / sprites: [{name, blocks}]
export const runGameQACheck = async (rubric, sprites, apiKey, model) => {
  const blocksText = (sprites || [])
    .map(s => `■ スプライト「${s.name}」\n${s.blocks}`)
    .join('\n\n');
  const userContent = `${rubric}\n\n=== 生成されたブロック ===\n${blocksText}`;
  const raw = await callGemini(
    [{ role: 'user', content: userContent }],
    apiKey,
    model,
    'ja',
    GAME_QA_SYSTEM_PROMPT
  );
  return parseQAResponse(raw);
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
        `AIサーバーが混み合っています。\n数分置いてから、メッセージ欄に「続き」と入力して送信してください。`,
        429,
        'RATE_LIMIT'
      );
    }

    if (response.status === 503 || response.status === 500) {
      throw new GeminiAPIError(
        `AIサーバーが混み合っています。\n数分置いてから、メッセージ欄に「続き」と入力して送信してください。`,
        response.status,
        'SERVER_BUSY'
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
      `AIサーバーが混み合っているか、一時的なエラーが発生しました。\n数分置いてから、メッセージ欄に「続き」と入力して送信してください。`,
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
