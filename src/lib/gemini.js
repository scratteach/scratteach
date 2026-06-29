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
- ブロックの代わりに「説明文・擬似コード」（例：「xを-180から180まで6列…でループ生成」のような文章を1行で書いたもの）が
  混ざっていたら、それは実在ブロックではなく動かないので欠陥として issues に必ず挙げる。実ブロック（繰り返し＋クローン等）への展開が必要。

重要：「ブロックが存在するか」だけでなく「その通りに動くか」を頭の中で実行（トレース）して確認すること。
存在チェックだけでは、構造・実行順に起因する“動かないバグ”を見逃す。次の2つは必ずトレースする：
- 【グリッド/整列のトレース】クローンを格子状に並べる繰り返しを1段ずつ追う。座標の絶対セット
  （「y座標を○にする」等）が繰り返しの“中”にあると、毎周回でリセットされ、相対変化（「○ずつ変える」）
  が積み上がらず、1列／1か所にしか並ばない。初期化が繰り返しの外にあるか確認し、中にあれば issues に挙げる。
- 【当たり判定のトレース】「当たって消える＋別の反応（反射・加算）」がある場合、1フレーム内の実行順を追う。
  動く側（ボール・弾）が自分の「○○に触れた」で反射し、消える側（ブロック・敵）が自分の「○○に触れた」で
  削除している“二重判定”は、消滅が先に走ると反射が発火せず貫通する（実行順依存の競合）。反射が
  「メッセージを受け取ったとき」で分離されているか、または消滅側が「送って待つ」で反応を待ってから削除して
  いるかを確認する。二重判定のまま繋がっていなければ issues に挙げる。

必ず次の手順で進めること（順番を守る）：
手順1【実行トレースを書く】緑の旗から順に「実際に動かしたら何が起きるか」を1行ずつ "trace" に書き出す。
  初期化→操作→移動→当たり判定→終了/クリアまでなぞる。特に上の2点は具体的に：
  - グリッド生成は「1段目: y=○でN個並ぶ／2段目: yは○のまま？下がる？」と段ごとに書く。
  - 当たり判定は「フレーム内で誰のスクリプトが先に走るか→消滅が先なら相手は触れ判定で何を見るか→反射は出るか」と書く。
手順2【トレースに基づき判定】"trace" に書いた内容だけを根拠に ok / missing / issues を決める。
  「ブロックがあるから大丈夫」ではなく「トレースの結果どう動くか」で判断する。トレースで
  貫通・1列・端の震え・終わらない等が見えたら、それを issues に具体的に書く。

出力は次のJSONオブジェクトだけ（前後に余計な文章や\`\`\`を付けない）。必ず "trace" を最初に書いてから結論を出す：
{"trace": ["1行ずつの実行トレース"], "ok": true/false, "missing": ["欠落している必須メカニクスと根拠"], "issues": ["該当する失敗と、どのスプライトの問題か"]}

- 必須メカニクスが全て実装され、トレース上も問題なく、よくある失敗にも該当しなければ ok:true、missingとissuesは空配列。
- 1つでも欠落・該当・トレースで判明した不具合があれば ok:false にし、該当項目を具体的に列挙する（あいまいな指摘ではなく、何がどう足りない／どう壊れるかを書く）。`;

const parseQAResponse = (text) => {
  try {
    let clean = text.replace(/```json\n?|\n?```/g, '').trim();
    // トレース等の文章が前後に付いても拾えるよう、最初の { から最後の } までを取り出す。
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end > start) clean = clean.slice(start, end + 1);
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
