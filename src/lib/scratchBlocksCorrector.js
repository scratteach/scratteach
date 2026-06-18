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

// キー押下ブロックのドロップダウン境界ミスを補正する。
// 正しい ja 表記は「%1 キーが押された(とき)」＝ ドロップダウンは向き等の値だけ、
// 「キー」は固定文字列側。AIは「キー」を値に巻き込み「(右向き矢印キー v) が押された」
// のように出しがちで、これはハッシュ不一致で赤ブロックになる。
// (○○[キー] v) が押された(とき) → (○○ v) キーが押された(とき) に正規化する。
// 正しい形「(○○ v) キーが押された」は ") が押された" を含まないので誤補正しない。
function fixKeyPressedBlock(line) {
  return line.replace(/\(([^()]+?) v\) が押された(とき)?/g, (_m, val, toki) => {
    const key = val.replace(/\s*キー$/, '').trim();
    return `(${key} v) キーが押された${toki || ''}`;
  });
}

// 「クローンを作る」のドロップダウン抜けを補正する。
// 正しい ja 表記は「(自分自身 v) のクローンを作る」。AIは「クローンを作る」だけ、または
// 「自分自身のクローンを作る」「(自分自身) のクローンを作る」のようにドロップダウンを
// 落として出しがちで、いずれも赤ブロックになる。ターゲット名を (名前 v) の形に正規化する。
// 「このクローンを削除する」は別ブロックなので対象外。
function fixCloneBlock(line) {
  const t = line.trim();
  if (!t.endsWith('クローンを作る')) return line;
  // すでに正しい「(X v) のクローンを作る」はそのまま
  if (/^\([^()]+ v\) のクローンを作る$/.test(t)) return line;

  // 「…のクローンを作る」からターゲット名を取り出す（無ければ自分自身）
  const m = t.match(/^(.*?)\s*のクローンを作る$/);
  let target = m ? m[1].trim() : '';
  // 装飾を外して名前だけにする： (X v) / (X) / [X v] / [X] / X
  target = target
    .replace(/^\((.+?)\s+v\)$/, '$1')
    .replace(/^\((.+?)\)$/, '$1')
    .replace(/^\[(.+?)\s+v\]$/, '$1')
    .replace(/^\[(.+?)\]$/, '$1')
    .trim();
  if (!target) target = '自分自身';

  return `(${target} v) のクローンを作る`;
}

// 「もし <条件> ではないなら」という存在しない記法を修正する。
// Scratchに「もし〜ではないなら」ブロックは無く、赤ブロックになる。
// 正しくは【演算】の「ではない」で条件全体を包む：もし <<条件> ではない> なら
// 「〜まで待つ」「〜まで繰り返す」の否定形も同様に補正する。
function fixNegatedCondition(line) {
  // 「もし <...>」で始まる行のみを対象にする（誤検出を避ける）
  const head = line.match(/^もし\s+(<.*)$/);
  if (!head) return line;
  const rest = head[1];

  // 先頭の <...> の対応する閉じ括弧を、入れ子を数えて探す
  let depth = 0;
  let end = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '<') depth++;
    else if (rest[i] === '>') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return line;

  const cond = rest.slice(0, end + 1);          // <...>（バランスの取れた条件）
  const after = rest.slice(end + 1).trim();      // 条件の後ろの残り

  // 残りが「ではないなら」「ではない なら」「でないなら」「でない なら」なら否定形と判定
  if (!/^(では|で)ない\s*なら$/.test(after)) return line;

  // 条件全体を「ではない」演算子で包み、正しい「もし〜なら」にする
  return `もし <${cond} ではない> なら`;
}

// 条件式の中で変数をドロップダウン記法で書いてしまった誤りを補正する。
// 比較の項に入る変数はレポーター (変数) が正しい。AIは変数変更ブロックと同じ感覚で
// [ライフ v] や (ライフ v) と書きがちで、これは赤ブロックにはならないが「緑のメニュー」
// として描画され、オレンジの変数レポーターに見えない（見た目バグ）。
// 対象は条件文（もし／〜まで）の中の比較演算子 < = > の左右の項のみ。
// 「(音量 v) > (10) のとき」等のイベント帽子や「(マウスポインター v) に触れた」の
// 正規ドロップダウンを誤変換しないため、条件文に限定し、演算子隣接の項だけを変換する。
function fixVariableDropdownInCondition(line) {
  const t = line.trim();
  const isCondition = /^もし[\s　]/.test(t) || /まで(待つ|繰り返す)$/.test(t);
  if (!isCondition) return line;

  let l = line;
  // 左辺： [名前 v] OP  /  (名前 v) OP  →  (名前) OP
  l = l.replace(/\[([^[\]]+?) v\] ([<=>]) /g, '($1) $2 ');
  l = l.replace(/\(([^()]+?) v\) ([<=>]) /g, '($1) $2 ');
  // 右辺： OP [名前 v]  /  OP (名前 v)  →  OP (名前)
  l = l.replace(/ ([<=>]) \[([^[\]]+?) v\]/g, ' $1 ($2)');
  l = l.replace(/ ([<=>]) \(([^()]+?) v\)/g, ' $1 ($2)');
  return l;
}

// scratchblocksの比較演算子 < > は閉じ括弧 < > と紛らわしい。
// 前後が空白の「 < 」「 > 」は比較演算子、それ以外は括弧として扱う。
function bracketKind(s, i) {
  const c = s[i];
  if (c === '(' || c === '[') return 'open';
  if (c === ')' || c === ']') return 'close';
  if (c === '<') return (s[i - 1] === ' ' && s[i + 1] === ' ') ? null : 'open';
  if (c === '>') return (s[i - 1] === ' ' && s[i + 1] === ' ') ? null : 'close';
  return null;
}

// 括弧（()[]<>）の入れ子を考慮し、深さ0の位置にある区切り文字 sep で分割する
function splitTopLevel(s, sep) {
  const parts = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const k = bracketKind(s, i);
    if (k === 'open') depth++;
    else if (k === 'close') depth--;
    else if (depth === 0 && s.startsWith(sep, i)) {
      parts.push(s.slice(last, i));
      i += sep.length - 1;
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  return parts;
}

// 文字列全体がちょうど1組の <...> で包まれているか
function isWrappedGroup(s) {
  if (bracketKind(s, 0) !== 'open' || s[0] !== '<') return false;
  if (bracketKind(s, s.length - 1) !== 'close' || s[s.length - 1] !== '>') return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const k = bracketKind(s, i);
    if (k === 'open') depth++;
    else if (k === 'close') {
      depth--;
      if (depth === 0 && i < s.length - 1) return false; // 末尾より前で閉じた
    }
  }
  return depth === 0;
}

// ブール条件式を正規化する。
// Scratchの「かつ」「または」は2入力ブロックなので、3つ以上を横に並べた
// <A または B または C> は赤ブロックになる。これを左結合の入れ子
// <<A または B> または C> に組み直す（「または」を優先度低として先に分解）。
// 比較に <> が付いていない場合（A かつ B）は各項を <> で包む。
function normalizeBool(expr) {
  expr = expr.trim();

  // 全体が1組の <> で包まれている場合、中身に演算子があれば剥がして処理
  if (isWrappedGroup(expr)) {
    const inner = expr.slice(1, -1);
    const innerHasOp =
      splitTopLevel(inner, ' または ').length > 1 ||
      splitTopLevel(inner, ' かつ ').length > 1;
    if (!innerHasOp) return expr; // <(a) = [b]> や <(a) ではない> などの単体はそのまま
    expr = inner;
  }

  // 「または」（優先度低）→「かつ」の順で上位の演算子から分解し、左結合で入れ子化
  for (const op of [' または ', ' かつ ']) {
    const parts = splitTopLevel(expr, op);
    if (parts.length > 1) {
      let acc = normalizeBool(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        acc = `<${acc}${op}${normalizeBool(parts[i])}>`;
      }
      return acc;
    }
  }

  // 演算子なしの単体条件。<> で包まれていなければ包む
  return isWrappedGroup(expr) ? expr : `<${expr}>`;
}

// 1行内のトップレベルの <...> ブール条件をすべて正規化する。
// 「かつ」「または」を3つ以上横連鎖させた赤ブロックを、デフォルトの
// かつ／または ブロックの入れ子に組み直して赤ブロックを防ぐ。
function fixChainedBoolean(line) {
  if (!line.includes(' かつ ') && !line.includes(' または ')) return line;

  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '<' && bracketKind(line, i) === 'open') {
      // 対応する閉じ < > を入れ子を数えて探す
      let depth = 0;
      let j = i;
      for (; j < line.length; j++) {
        const k = bracketKind(line, j);
        if (k === 'open') depth++;
        else if (k === 'close') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (j < line.length && depth === 0) {
        out += normalizeBool(line.slice(i, j + 1));
        i = j + 1;
        continue;
      }
    }
    out += line[i];
    i++;
  }
  return out;
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
    l = fixKeyPressedBlock(l);
    l = fixCloneBlock(l);
    l = fixVariableDropdownInCondition(l);
    l = fixNegatedCondition(l);
    l = fixChainedBoolean(l);
    l = fixReporterInVariableBlock(l);
    return l;
  });
  corrected = fixedLines.join('\n');

  return corrected;
}
