import { SYSTEM_PROMPT, SYSTEM_PROMPT_EN } from './systemPrompt.js';
import { correctScratchBlocks } from './scratchBlocksCorrector.js';

export const getSystemPrompt = (blockLang) =>
  blockLang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT;

// 生成ブロックから実際に使っている変数名・メッセージ名を機械抽出する。
// 変数はセット系ブロック（を〜にする／ずつ変える／表示・隠す）の左辺だけを拾う
// （読み取りの (変数) は組み込みレポーターと区別できないため対象にしない。
//   生成コードで使う変数はほぼ必ずどこかでセットされるので実用上これで拾える）。
// あわせて「クローンされたとき」の中でセットされる変数は各クローン固有＝必ず
// 「このスプライトのみ」にすべき（全体用にすると全クローンで共有されゲームが壊れる）
// ため、その変数名→スプライト名を cloneLocal に記録して準備リストを振り分ける。
const extractUsedNames = (sprites) => {
  const vars = new Set();
  const msgs = new Set();
  // 変数名 -> Set<スプライト名>。「このスプライトのみ」で作る必要がある変数は、
  // クローン文脈で使うスプライトだけでなく、その名前をセットしている**全ての**
  // スプライトに1つずつ要る。スプライト専用変数は他スプライトから見えないため、
  // 1か所にしか案内しないと、残りのスプライトでブロックを組めなくなる。
  const cloneLocal = new Map();
  const cloneSetBy = new Map();  // 変数名 -> Set<「クローンされたとき」の中でセットしたスプライト名>
  const accumulated = new Set();  // どこかで「ずつ変える」された名前＝共有カウンタ
  const setBy = new Map();       // 変数名 -> Set<セットしているスプライト名>
  for (const s of sprites || []) {
    const code = correctScratchBlocks(s.blocks || '');
    let inClone = false;
    for (const raw of code.split('\n')) {
      const line = raw.trim();
      if (line === '') { inClone = false; continue; }
      // ハット（「〜とき」で始まるスクリプトの起点）でクローン文脈か判定し直す
      if (line.endsWith('とき')) {
        inClone = line === 'クローンされたとき';
        const hm = line.match(/^[[(](.+?) v[\])] を受け取ったとき$/);
        if (hm) msgs.add(hm[1]);
        continue;
      }
      let m = line.match(/^\[(.+?) v\] を .+(にする|ずつ変える)$/);
      if (m) {
        vars.add(m[1]);
        if (!setBy.has(m[1])) setBy.set(m[1], new Set());
        setBy.get(m[1]).add(s.name);
        // 「ずつ変える」は積み上げ＝スコア・ライフ等の共有カウンタの印。
        // クローンの中から加算される全体変数がここに大量に該当するため、
        // 「クローンの中でセットされる」だけでローカルと決めつけてはいけない。
        if (/ずつ変える$/.test(line)) accumulated.add(m[1]);
        if (inClone) {
          if (!cloneSetBy.has(m[1])) cloneSetBy.set(m[1], new Set());
          cloneSetBy.get(m[1]).add(s.name);
        }
      }
      m = line.match(/^変数 \[(.+?) v\] を(表示する|隠す)$/);
      if (m) vars.add(m[1]);
      for (const mm of line.matchAll(/\((.+?) v\) を送(?:る|って待つ)/g)) msgs.add(mm[1]);
    }
  }
  // 読み取り側も数える。セットだけ見ると、あるスプライトが計算して別のスプライトが
  // 読む全体変数（例：ブロックが決めてボールが読む「反射軸」）を専用と誤判定する。
  // 変数名は上のセット解析で確定しているので、その名前の (名前) / [名前 v] を探せば
  // 組み込みレポーターと取り違えずに読み取りを拾える。
  const usedBy = new Map();
  for (const s2 of sprites || []) {
    const code = correctScratchBlocks(s2.blocks || '');
    for (const name of vars) {
      if (code.includes(`(${name})`) || code.includes(`[${name} v]`)) {
        if (!usedBy.has(name)) usedBy.set(name, new Set());
        usedBy.get(name).add(s2.name);
      }
    }
  }

  // 「このスプライトのみ」で作るべき＝次の3つを満たす名前。
  //  ① クローンの中でセットされる（クローンごとに別の値を持つ）
  //  ② 一度も「ずつ変える」されない（＝スコア等の共有カウンタではない）
  //  ③ その名前を使う全スプライトが、自分のクローン処理の中でセットしている
  //     （1つでも「読むだけ」のスプライトがあれば、それは共有＝全体変数）
  for (const [name, clonedIn] of cloneSetBy) {
    if (accumulated.has(name)) continue;
    const users = usedBy.get(name) || new Set();
    if ([...users].some((sp) => !clonedIn.has(sp))) continue;
    cloneLocal.set(name, setBy.get(name) || new Set());
  }
  return { vars, msgs, cloneLocal };
};

// プレイヤーに見せる定番変数（スコア・時間・ライフ等）はチェックONで「表示」にする。
// 内部処理用（番号・間隔・フラグ等）は既定で「非表示」。「出ている時間」を表示に
// しないよう、あいまいな「時間」単独ではなく具体語（残り時間 等）で判定する。
const DISPLAY_VAR_KEYWORDS = [
  'スコア', '得点', '点数', 'ポイント', 'ライフ', '残機', 'レベル',
  'ハイスコア', 'コンボ', '残り時間', 'のこり時間', 'タイム', 'タイマー', '記録',
];
const varDisplayLabel = (name) =>
  DISPLAY_VAR_KEYWORDS.some(k => name.includes(k))
    ? 'ゲーム画面に表示：✅（表示）'
    : 'ゲーム画面に表示：□（非表示）';

// 「大きさを○%にする」の数値は見本の絵に紐づいた値でしかない。利用者が自分で
// 用意した画像は元のピクセル数が違うので、同じ%では大きすぎたり小さすぎたりする。
// AIはこの案内を準備リストに書き忘れるため、サイズ指定があるときは必ず添える。
const SIZE_BLOCK_RE = /大きさを\s*\(\s*-?[\d.]+\s*\)\s*%にする/;
const SIZE_NOTE_MARKER = '用意した画像に合わせて';

const buildCostumeSizeNote = (sprites, message) => {
  if (message.includes(SIZE_NOTE_MARKER)) return null;   // AIが自分で書いていれば重ねない
  const sized = sprites.filter(s => SIZE_BLOCK_RE.test(s?.blocks || '')).map(s => s.name);
  if (sized.length === 0) return null;
  return [
    `■ コスチュームの大きさ（${SIZE_NOTE_MARKER}調整してください）`,
    `・「大きさを○%にする」が入っているスプライト：${sized.join('・')}`,
    '　※この%は見本の絵に合わせた数値です。自分で用意した画像は元の大きさが違うので、',
    '　　同じ%だと大きすぎたり小さすぎたりします。ステージ（480×360）で見ながら数値を変えてください。',
    '　※取り込んだ画像は「ビットマップ解像度2」になることが多く、その場合は元のピクセル数の',
    '　　半分がステージ上の実寸です（例：756pxの絵を20%にすると 756÷2×0.20＝約76px）。',
  ].join('\n');
};

// 同じ名前の「このスプライトのみ」変数が複数のスプライトに現れたら、スプライト名を
// 冠して別名に分ける。Scratch的には同名ローカルも合法だが、変数一覧に同じ名前が
// 並ぶとどれがどれか見分けられず、うっかり「全体用」で1個だけ作ってしまう事故が起きる。
// （クローン用フラグを全体用にすると全クローンで値が共有され、ゲームが起動しない）
// 名前を機械的にユニークにすれば、その事故ごと消える。
// 1スプライトしか使っていない名前はそのまま（不要に長くしない）。
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const disambiguateLocalVars = (parsed) => {
  if (!parsed || !Array.isArray(parsed.sprites) || parsed.sprites.length === 0) return parsed;
  const { cloneLocal } = extractUsedNames(parsed.sprites);
  const dup = [...cloneLocal.entries()].filter(([, sps]) => sps.size > 1);
  if (dup.length === 0) return parsed;

  const sprites = parsed.sprites.map((s) => {
    let blocks = s.blocks || '';
    for (const [name, sps] of dup) {
      if (!sps.has(s.name)) continue;
      const renamed = `${s.name}の${name}`;
      const n = escapeRe(name);
      blocks = blocks
        .replace(new RegExp(`\\[${n} v\\]`, 'g'), `[${renamed} v]`)
        .replace(new RegExp(`\\(${n}\\)`, 'g'), `(${renamed})`);
    }
    return { ...s, blocks };
  });
  return { ...parsed, sprites };
};

// 事前準備リスト（message内の■変数／■メッセージ）の漏れを決定論で補完する。
// AIは生成の途中で導入した作業用変数（差x・差y等）を、先に書いた準備リストへ
// 載せ忘れることがある。ブロックから抽出した名前が message に見当たらなければ、
// 「準備ができたら〜」の案内行の前に追記する（プロンプト任せにしない）。
export const completePreparationList = (parsed) => {
  if (!parsed || parsed.phase !== 'generating') return parsed;
  if (!Array.isArray(parsed.sprites) || parsed.sprites.length === 0) return parsed;
  const message = parsed.message || '';
  const { vars, msgs, cloneLocal } = extractUsedNames(parsed.sprites);
  const missingMsgs = [...msgs].filter(v => !message.includes(v));
  const sizeNote = buildCostumeSizeNote(parsed.sprites, message);

  // 全体用は「名前がどこかに書かれていれば足りている」と見なせる。
  const globalVars = [...vars].filter(v => !cloneLocal.has(v) && !message.includes(v));

  // スプライト専用は同じ判定が使えない。同じ名前でもスプライトごとに別の変数なので、
  // 「テトラポット … 自分はクローンか」と1か所書いてあるだけで文字列一致してしまい、
  // 貝がら用が抜けていても「もうある」と誤判定される（実際にそれで組めなくなった）。
  // そのためスプライト専用はブロックから数えた全量を常に出し、機械側を確定版とする。
  const localVars = [...cloneLocal.keys()];
  const localBySprite = new Map();
  const sharedNames = new Set();   // 複数スプライトが同名で必要とするもの
  for (const v of localVars) {
    const sps = cloneLocal.get(v) || new Set();
    if (sps.size > 1) sharedNames.add(v);
    for (const sp of sps) {
      if (!localBySprite.has(sp)) localBySprite.set(sp, []);
      localBySprite.get(sp).push(v);
    }
  }

  // 一目で分かるように「全体用は1行にまとめ／スプライト専用はスプライトごとに1行」。
  // 変数ごとに行を割いて注釈を繰り返すと、準備リストが読み下せない長さになる。
  const mark = (v) => `${v}${DISPLAY_VAR_KEYWORDS.some(k => v.includes(k)) ? '✅' : ''}`;
  if (globalVars.length === 0 && localVars.length === 0 && missingMsgs.length === 0 && !sizeNote) return parsed;

  const lines = [];
  if (globalVars.length || localVars.length || missingMsgs.length) {
    lines.push('', '⚠️ 自動チェック：ブロックから数えた変数・メッセージです。これが確定版なので、上の一覧と違っていたらこちらに合わせてください。');
  }
  if (globalVars.length) {
    lines.push('【全体用に追加】（変数を作る →「すべてのスプライト用」）');
    lines.push(`　${globalVars.map(mark).join('、')}`);
  }
  if (localBySprite.size) {
    lines.push('【スプライト専用】（そのスプライトを選んでから「このスプライトのみ」）');
    for (const [sp, vs] of localBySprite) {
      lines.push(`　${sp} … ${vs.map(v => `${mark(v)}${sharedNames.has(v) ? '（※）' : ''}`).join('、')}`);
    }
    lines.push('　※「全体用」で作るとクローン全部で値が共有され、ゲームが動きません。');
    if (sharedNames.size) {
      lines.push('　※（※）は他のスプライトにも同じ名前が必要です。スプライト専用の変数は他のスプライトからは見えないので、それぞれのスプライトで1つずつ作ってください。');
    }
  }
  if (globalVars.length || localVars.length) {
    lines.push('　※✅は画面に表示する変数です（変数ブロック左のチェックを入れる）。他は非表示。');
  }
  if (missingMsgs.length) {
    lines.push(`【メッセージに追加】${missingMsgs.join('、')}`);
  }
  if (sizeNote) lines.push('', sizeNote);
  const section = lines.join('\n');

  const marker = message.lastIndexOf('準備ができたら');
  let newMessage;
  if (marker !== -1) {
    const lineStart = message.lastIndexOf('\n', marker);
    const pos = lineStart === -1 ? marker : lineStart;
    newMessage = `${message.slice(0, pos)}\n${section}\n${message.slice(pos)}`;
  } else {
    newMessage = `${message}\n${section}`;
  }
  return { ...parsed, message: newMessage };
};

export const parseCreateModeResponse = (text) => {
  try {
    const clean = text.replace(/^```json\s*|\s*```$/g, '').trim();
    return completePreparationList(disambiguateLocalVars(JSON.parse(clean)));
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
