// ルールベースのscratchblocks自動補正
// AIが生成した記法の誤りを、AI再生成に頼らず直接修正する

// 単純な引数パターン: (数値) または (変数名) — 入れ子なし
const SIMPLE_ARG = String.raw`\([^()[\]]+\)`;

// 値がすでに単一の () で正しく囲まれているか確認
function isAlreadyWrapped(value) {
  if (!value.startsWith('(') || !value.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < value.length - 1; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    if (depth === 0) return false; // 末尾より前で閉じている
  }
  return true;
}

// 変数セットブロックの中で外側の () が必要な複合レポーターパターン
const COMPOUND_REPORTER_PATTERNS = [
  // 四則演算
  new RegExp(`^(${SIMPLE_ARG}) \\+ (${SIMPLE_ARG})$`),
  new RegExp(`^(${SIMPLE_ARG}) - (${SIMPLE_ARG})$`),
  new RegExp(`^(${SIMPLE_ARG}) \\* (${SIMPLE_ARG})$`),
  new RegExp(`^(${SIMPLE_ARG}) / (${SIMPLE_ARG})$`),
  // 乱数: (a) から (b) までの乱数
  new RegExp(`^(${SIMPLE_ARG}) から (${SIMPLE_ARG}) までの乱数$`),
  // 余り: (a) を (b) で割った余り
  new RegExp(`^(${SIMPLE_ARG}) を (${SIMPLE_ARG}) で割った余り$`),
  // 四捨五入: (a) を四捨五入
  new RegExp(`^(${SIMPLE_ARG}) を四捨五入$`),
  // 数学関数: [abs v] の (a)
  /^\[.+? v\] の \([^()]+\)$/,
  // 文字列結合: (a) と (b)
  new RegExp(`^(${SIMPLE_ARG}) と (${SIMPLE_ARG})$`),
  // 文字列長さ: (a) の長さ
  new RegExp(`^(${SIMPLE_ARG}) の長さ$`),
  // 文字: (a) の (b) 番目の文字
  new RegExp(`^(${SIMPLE_ARG}) の (${SIMPLE_ARG}) 番目の文字$`),
  // 含む: (a) に (b) が含まれる
  new RegExp(`^(${SIMPLE_ARG}) に (${SIMPLE_ARG}) が含まれる$`),
  // コスチューム名レポーター
  /^\(コスチュームの \[.+? v\]\)$/,
];

// メッセージ名トークンを正しいドロップダウン記法 [名前 v] に正規化する
// 例： 判定開始 → [判定開始 v] / (判定開始 v) → [判定開始 v] / [判定開始] → [判定開始 v]
function toMessageDropdown(token) {
  const t = token.trim();
  let m = t.match(/^\[(.+?)\s+v\]$/);   // [x v]
  if (m) return `[${m[1]} v]`;
  m = t.match(/^\((.+?)\s+v\)$/);        // (x v)
  if (m) return `[${m[1]} v]`;
  m = t.match(/^\[(.+?)\]$/);            // [x]
  if (m) return `[${m[1]} v]`;
  return `[${t} v]`;                     // プレーンテキスト
}

// メッセージブロック（送る／送って待つ／受け取ったとき）のメッセージ名が
// ドロップダウン記法 [名前 v] になっていない場合に補正する。
// 記法のないプレーンテキスト名（例：「判定開始 を送る」）は赤ブロックになるため。
// 長い接尾辞から順に判定すること（「を送って待つ」を「を送る」より先に）
const MESSAGE_SUFFIXES = ['を送って待つ', 'を送る', 'を受け取ったとき'];

function fixMessageBlock(line) {
  for (const kw of MESSAGE_SUFFIXES) {
    const re = new RegExp(`^(.+?)\\s*${kw}$`);
    const match = line.match(re);
    if (match) {
      return `${toMessageDropdown(match[1])} ${kw}`;
    }
  }
  return line;
}

// [変数 v] を VALUE にする  /  [変数 v] を VALUE ずつ変える
// の VALUE が複合レポーターなら外側に () を追加
function fixReporterInVariableBlock(line) {
  const match = line.match(/^(\[.+? v\] を) (.+?) (にする|ずつ変える)$/);
  if (!match) return line;

  const [, prefix, value, suffix] = match;
  if (isAlreadyWrapped(value)) return line;

  for (const pattern of COMPOUND_REPORTER_PATTERNS) {
    if (pattern.test(value)) {
      return `${prefix} (${value}) ${suffix}`;
    }
  }
  return line;
}

// 既知の誤ったブロック名 → 正しい記法への直接置換
const KNOWN_WRONG_BLOCKS = [
  // stopブロックの誤った書き方
  {
    wrong: /他のスプライトの他のスクリプトを止める/g,
    right: '[このスプライトの他のスクリプト v] を止める',
  },
  // コスチューム名プレースホルダー
  {
    wrong: /コスチューム名(?!\s*v\])/g,
    right: '(コスチュームの [名前 v])',
  },
  // よくある音ブロックの誤り
  {
    wrong: /すべてのサウンドを止める/g,
    right: 'すべての音を止める',
  },
  // "スプライトを隠す" パターン
  {
    wrong: /スプライトを隠す/g,
    right: '隠す',
  },
  // 「と言う」「と考える」の引数順序が逆 (duration 秒 [text] と言う → [text] と (duration) 秒言う)
  {
    wrong: /\(([^()]+)\) 秒 \[([^\]]*)\] と言う/g,
    right: '[$2] と ($1) 秒言う',
  },
  {
    wrong: /\(([^()]+)\) 秒 \[([^\]]*)\] と考える/g,
    right: '[$2] と ($1) 秒考える',
  },
];

export function correctScratchBlocks(code) {
  if (!code) return code;

  let corrected = code;

  // Step 1: 既知の誤ったブロック名を修正
  for (const { wrong, right } of KNOWN_WRONG_BLOCKS) {
    corrected = corrected.replace(wrong, right);
  }

  // Step 2: 行ごとの補正（メッセージ記法・変数ブロックのレポーター囲み忘れ）
  const lines = corrected.split('\n');
  const fixedLines = lines.map(line => {
    let l = line.trim();
    l = fixMessageBlock(l);
    l = fixReporterInVariableBlock(l);
    return l;
  });
  corrected = fixedLines.join('\n');

  return corrected;
}
