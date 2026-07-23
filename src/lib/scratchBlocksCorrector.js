// ルールベースのscratchblocks自動補正
// AIが生成した記法の誤りを、AI再生成に頼らず直接修正する

import { hoistLoopInit } from './scratchLogicGate.js';

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
  // 「〇 の 〇」型（値が入れ子でもよい）：
  // 数学関数（後置き）: (a) の [絶対値 v] ／ 他スプライトの値: (スプライト v) の [x座標 v]
  /^\(.+\) の \[.+? v\]$/,
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

// メッセージ名トークンを正しいドロップダウン記法 (名前 v) に正規化する。
// メッセージのメニューは Scratch では「丸い（楕円）プルダウン」＝scratchblocksでは (名前 v)。
// 四角の [名前 v] でも broadcast 自体は成立するが形が四角になり本物と食い違うため、丸 () に統一する。
// 例： 判定開始 → (判定開始 v) / [判定開始 v] → (判定開始 v) / [判定開始] → (判定開始 v)
function toMessageDropdown(token) {
  const t = token.trim();
  const m =
    t.match(/^\[(.+?)\s+v\]$/) ||  // [x v]
    t.match(/^\((.+?)\s+v\)$/) ||  // (x v)
    t.match(/^\[(.+?)\]$/) ||      // [x]
    t.match(/^\((.+?)\)$/);        // (x)
  const name = (m ? m[1] : t).trim();
  return `(${name} v)`;
}

// メッセージブロック（送る／送って待つ／受け取ったとき）のメッセージ名を
// 丸ドロップダウン (名前 v) に正規化する。プレーンテキスト名（例：「判定開始 を送る」）は
// 赤ブロックになり、四角 [名前 v] は形が本物（楕円）と食い違うため、どちらも丸 () に直す。
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
// キー押下ブロックを公式表記「(○○ v) キーが押された(とき)」へ正規化する。
// 正しい ja は SENSING_KEYPRESSED「%1 キーが押された」/ EVENT_WHENKEYPRESSED「%1 キーが押されたとき」＝
// ドロップダウンが先、続けて「キーが押された(とき)」。AIは語順や括弧を崩しやすく、
// 「キー (○○ v) が押された」「[○○ v] が押された」「(○○ v) が押された」等になって赤化する。
// 崩れ方（キーの前置き／キー抜け／丸・角括弧）を問わず canonical へ直す。
// 正しい「(○○ v) キーが押された」は ") が押された" を含まないので誤補正されない。
function fixKeyPressedBlock(line) {
  const toKey = (val, toki) =>
    `(${val.replace(/\s*キー$/, '').trim()} v) キーが押された${toki || ''}`;
  let l = line;
  // ① 「キー」が前に出た崩れ：キー (○○ v)/[○○ v] が押された(とき) → 先に処理する
  l = l.replace(/キー\s*[([]([^()[\]]+?)\s+v[)\]]\s*が押された(とき)?/g, (_m, val, toki) => toKey(val, toki));
  // ② キー抜け・括弧ゆれ：(○○ v)/[○○ v] が押された(とき) → (○○ v) キーが押された(とき)
  //    ※正しい「…) キーが押された」は ") が押された" を含まないので対象外
  l = l.replace(/[([]([^()[\]]+?)\s+v[)\]]\s*が押された(とき)?/g, (_m, val, toki) => toKey(val, toki));
  return l;
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

// 計算・比較の中で変数をドロップダウン記法で書いてしまった誤りを補正する。
// 演算（+ - * /）や比較（< = >）の項に入る変数はレポーター (変数) が正しい。AIは変数変更
// ブロックと同じ感覚で [列 v] や (列 v) と書きがちで、計算の中では赤ブロック（未定義）に、
// 条件の中では緑のメニュー表示になり、いずれも正しい変数レポーターにならない。
// 演算子に隣接する項だけを (変数) に直す。「[変数 v] を (0) にする」のような変数選択
// ブロックの正規ドロップダウンや、「(マウスポインター v) に触れた」「(自分自身 v) の…」は
// 演算子に隣接しないので対象外。「(音量 v) > (10) のとき」のイベント帽子だけは比較に隣接
// するため、行末が「のとき」のときは比較の変換をスキップして守る。
function fixVariableDropdownInOperator(line) {
  const t = line.trim();
  let l = line;

  // 算術演算子 + - * / の左右の項：演算の項にドロップダウン変数は入らないので常に変換
  l = l.replace(/\[([^[\]]+?) v\] ([-+*/]) /g, '($1) $2 ');
  l = l.replace(/\(([^()]+?) v\) ([-+*/]) /g, '($1) $2 ');
  l = l.replace(/ ([-+*/]) \[([^[\]]+?) v\]/g, ' $1 ($2)');
  l = l.replace(/ ([-+*/]) \(([^()]+?) v\)/g, ' $1 ($2)');

  // 比較演算子 < = > の左右の項：イベント帽子「… のとき」だけ除外
  if (!/のとき$/.test(t)) {
    l = l.replace(/\[([^[\]]+?) v\] ([<=>]) /g, '($1) $2 ');
    l = l.replace(/\(([^()]+?) v\) ([<=>]) /g, '($1) $2 ');
    l = l.replace(/ ([<=>]) \[([^[\]]+?) v\]/g, ' $1 ($2)');
    l = l.replace(/ ([<=>]) \(([^()]+?) v\)/g, ' $1 ($2)');
  }
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

// 値が複合レポーター（演算・乱数・文字列操作など）かどうか
function isCompoundReporter(value) {
  return COMPOUND_REPORTER_PATTERNS.some(pattern => pattern.test(value));
}

// 変数セットの動詞欠落を補正する。
// 「[差x v] を (((ボール v) の [x座標 v]) - (x座標))」のように、値が長い式のとき
// AIは行末の「にする」を落としがちで、DATA_SETVARIABLETO に一致せず赤ブロックになる
// （値の式は正しく緑で描かれるのに、外側のセットブロックだけ赤くなる形）。
// 「[〇〇 v] を 値」で行が終わり、値が括弧の釣り合った完結形のときだけ「にする」を補う。
// メッセージ（を送る）は fixMessageBlock で丸括弧化済み・リスト操作は語順が違うため誤爆しない。
function isBracketBalanced(s) {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function fixMissingSetVerb(line) {
  const m = line.match(/^(\[.+? v\]) を (.+)$/);
  if (!m) return line;
  const value = m[2].trim();
  if (/(にする|ずつ変える|変える|する)$/.test(value)) return line; // 動詞あり（言い換え含む）
  if (!value.endsWith(')') && !value.endsWith(']')) return line;    // 値で完結していない
  if (!isBracketBalanced(value)) return line;
  return `${m[1]} を ${value} にする`;
}

// 数値スロットを取る末尾キーワードで、引数の () が落ちた「裸のトークン/演算」を () で包む。
// AIは「(ポップ間隔) 秒待つ」の変数の括弧を落として「ポップ間隔 秒待つ」と書きがちで、
// これは control_wait 等に一致せず赤ブロックになる（数値スロットに裸のトークンが入るため）。
// 引数が既に () で包まれていれば触らない。演算の外側()落ち（例:「(1) から (3) までの乱数 秒待つ」）も救う。
const BARE_NUM_ARG_SUFFIXES = [' 秒待つ', ' 回繰り返す'];
function fixBareNumArg(line) {
  for (const suf of BARE_NUM_ARG_SUFFIXES) {
    if (line.endsWith(suf)) {
      const arg = line.slice(0, -suf.length).trim();
      if (!arg) return line;
      if (isAlreadyWrapped(arg)) return line;   // 既に () で包まれている
      if (arg.startsWith('[') && arg.endsWith(']')) return line; // 文字列/ドロップダウンは対象外
      return `(${arg})${suf}`;
    }
  }
  return line;
}

// [変数 v] を VALUE にする  /  [変数 v] を VALUE ずつ変える
// の VALUE が複合レポーターなら外側に () を追加
function fixReporterInVariableBlock(line) {
  const match = line.match(/^(\[.+? v\] を) (.+?) (にする|ずつ変える)$/);
  if (!match) return line;

  const prefix = match[1];
  const suffix = match[3];
  let value = match[2];

  // 二重の外側括弧を剥がす：((コスチュームの [名前 v])) のように、すでに自前の () を持つ
  // レポーターへさらに () を重ねるとハッシュ不一致で赤ブロックになる
  while (isAlreadyWrapped(value) && isAlreadyWrapped(value.slice(1, -1).trim())) {
    value = value.slice(1, -1).trim();
  }

  // トップレベルに演算子がある値は、項が入れ子でも必ず外側 () で包む。
  // COMPOUND_REPORTER_PATTERNS は単純な項（入れ子なし）しか見ないため、
  // 「((ボール v) の [x座標 v]) - (x座標)」のような入れ子の項を持つ演算が漏れて赤くなる
  const hasTopLevelArith = [' + ', ' - ', ' * ', ' / '].some(
    op => splitTopLevel(value, op).length > 1,
  );

  if (!isAlreadyWrapped(value) && (hasTopLevelArith || isCompoundReporter(value))) {
    value = `(${value})`;
  }
  return `${prefix} ${value} ${suffix}`;
}

// 「スプライトの他のスクリプトを止める」を、後ろにブロックを繋げられる stack 形にする。
// scratchblocks日本語版の「○○を止める」(CONTROL_STOP) は、ドロップダウンの値がロケールの
// osis（'スプライトの他のスクリプトを止める'）と完全一致したときだけ stack になり、それ以外
// （すべて／このスクリプト）は行き止まりの cap になる。判定は「値」そのものに対して行われ、
// 日本語版では選択肢に動詞「を止める」まで含む1語が入る。
// AIが出す「[このスプライトの他のスクリプト v] を止める」は、値が osis と一致せず（→ cap のまま）
// かつ「を止める」が独立ラベルになって繋げられない。値ごと正規化して stack に直す。
// 「すべての音を止める」(SOUND_STOPALLSOUNDS) は別ブロックなので除外する。
function fixStopOtherScripts(line) {
  const t = line.trim();
  if (!/止める$/.test(t)) return line;
  if (t.includes('音')) return line;            // 「すべての音を止める」は対象外
  if (!t.includes('他のスクリプト')) return line; // 「他のスクリプト」を含むものだけが stack
  return '[スプライトの他のスクリプトを止める v]';
}

// 「○○度に向ける」(MOTION_POINTINDIRECTION) の誤記を補正する。
// 日本語版の正しいブロックは「(値) 度に向ける」。AIは座標ブロック（x座標を○にする）や
// 変数ブロック（[変数 v] を ○ にする）に引きずられて、向きの先頭に「向き を」「[向き v] を」
// を余分に付けた「向き を (値) 度に向ける」を書きがちで、そのブロックは存在せず赤ブロックになる。
// 反射の定番「((180) - (向き)) 度に向ける」がこの誤りで赤くなるのが典型。
// また演算を引数にするとき「(180) - (向き) 度に向ける」のように外側の () を落とすと、
// 単一の引数として解釈されず赤ブロックになるため、演算全体を () で包む。
// さらに「向き」を変数扱いして「[向き v] を (値) にする」（度が無い・データブロック）と
// 書く誤りも、向きは変数ではないため赤ブロックになる。これも「(値) 度に向ける」へ直す。
function fixPointInDirection(line) {
  let t = line.trim();

  // 余分な「向き を」「[向き v] を」「(向き v) を」プレフィックス＋「度にする/向ける」を
  // 「(値) 度に向ける」へ言い換える（スペース有無・ドロップダウン記法のゆれを吸収）。
  const wrong = t.match(/^(?:\[\s*向き\s*v\]|\(\s*向き\s*v\)|向き)\s*を\s+(.+?) 度に(?:する|向ける)$/);
  if (wrong) t = `${wrong[1].trim()} 度に向ける`;

  // 「向き」を変数として「…にする」で書いた誤り（度が無い） → 「(値) 度に向ける」へ。
  // LHSが「向き」のときだけ対象。実在変数のセットには触れない。
  if (!wrong) {
    const wrongSet = t.match(/^(?:\[\s*向き\s*v\]|\(\s*向き\s*v\)|向き)\s*を\s+(.+?)\s*にする$/);
    if (wrongSet) t = `${wrongSet[1].trim()} 度に向ける`;
  }

  const m = t.match(/^(.+?) 度に向ける$/);
  if (!m) return line;

  const value = m[1].trim();
  if (!isAlreadyWrapped(value) && isCompoundReporter(value)) {
    return `(${value}) 度に向ける`;
  }
  return `${value} 度に向ける`;
}

// 「度回す」(MOTION_TURNRIGHT / MOTION_TURNLEFT) の方向欠落を補正する。
// 日本語版は右回り・左回りでラベルが同じ「度回す」のため、scratchblocks記法では先頭に
// 方向（右に／左に／時計回りに／反時計回りに）か回転アイコン(↻/↺)が必要。AIは「(180) 度回す」と
// 方向を落として出しがちで、どちらのブロックにも一致せず赤ブロックになる。
// 方向の無い「(値) 度回す」に既定で「右に」を補う（180°など左右同値の場面が多く、右で統一する）。
// EV3モーター等の「○秒間回す」、座標の「度に向ける」は別ブロックなので対象外。
function fixTurnBlock(line) {
  const t = line.trim();
  if (!/度回す$/.test(t)) return line;
  if (/秒間回す$/.test(t)) return line;                       // モーター系は対象外
  if (/^(右に|左に|時計回りに|反時計回りに)\s/.test(t)) return line; // すでに方向あり
  if (/^[↻↺]\s/.test(t)) return line;                        // 回転アイコンあり
  return `右に ${t}`;
}

// 数学関数ブロックを公式の後置き形「((値) の [絶対値 v])」に統一する。
// 日本語版 Scratch の OPERATORS_MATHOP は「%2 の %1」＝値が先・関数名のドロップダウンが後ろ
// （本物のエディタで「( ) の [絶対値 ▼]」）。AIが出す崩れは3種：
//   ① 前置き「[絶対値 v] の (値)」「(絶対値 v) の (値)」…英語の語順。scratchblocksでは
//      偶然緑に描かれてしまうが、本物のブロックと配置が逆で子どもが組めない。
//   ② 後置きだが丸ドロップダウン「(値) の (絶対値 v)」…角括弧に直すだけでよい。
//   ③ 関数名が裸「(値) の絶対値」…ハッシュ不一致で赤ブロックになる。
// ③は「〜の絶対値」の直前の () グループを、演算子（+ - * /）で繋がった連鎖ごと値として
// 巻き込む（日本語の「〜の絶対値」は直前の式全体に掛かる読みが自然）。
// 変数名に関数名を含むもの（例：[速さの絶対値 v]）は直前が ) でないため対象にならない。
const POSTFIX_MATH_FUNCS = ['絶対値', '切り下げ', '切り上げ', '平方根'];

// s[openIdx] の '(' に対応する閉じ括弧の位置を返す
function matchCloseParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function fixMathFuncForm(line) {
  let l = line;

  // ① 前置き形 [絶対値 v] の (値) / (絶対値 v) の (値) → (値) の [絶対値 v]
  const prefixRe = new RegExp(
    `[([](${POSTFIX_MATH_FUNCS.join('|')})\\s+v[)\\]]\\s*の\\s*\\(`,
  );
  for (let m; (m = l.match(prefixRe)); ) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchCloseParen(l, openIdx);
    if (closeIdx === -1) break;
    const group = l.slice(openIdx, closeIdx + 1);
    l = l.slice(0, m.index) + `${group} の [${m[1]} v]` + l.slice(closeIdx + 1);
  }

  // ② 後置きの丸ドロップダウン (値) の (絶対値 v) → (値) の [絶対値 v]
  l = l.replace(
    new RegExp(`の\\s*\\((${POSTFIX_MATH_FUNCS.join('|')})\\s+v\\)`, 'g'),
    'の [$1 v]',
  );

  // ③ 裸の関数名 (値) の絶対値 → (値) の [絶対値 v]
  let replaced = true;
  while (replaced) {
    replaced = false;
    for (const fn of POSTFIX_MATH_FUNCS) {
      let from = 0;
      let i;
      while ((i = l.indexOf(fn, from)) !== -1) {
        from = i + fn.length;
        // ドロップダウン形（[絶対値 v] / (絶対値 v)）はスキップ
        if (l.startsWith(' v]', i + fn.length) || l.startsWith(' v)', i + fn.length)) continue;
        // 直前が「の」で、その前が閉じ括弧 ) であること（後置き形の判定）
        let j = i - 1;
        while (j >= 0 && l[j] === ' ') j--;
        if (l[j] !== 'の') continue;
        j--;
        while (j >= 0 && l[j] === ' ') j--;
        if (l[j] !== ')') continue;

        // ) から対応する ( まで戻ってグループを取り、さらに前が「演算子 グループ」の
        // 並びなら連鎖ごと値に巻き込む（(A) - (B) の絶対値 → 差全体の絶対値）
        const matchOpen = (end) => {
          let depth = 0;
          for (let k = end; k >= 0; k--) {
            if (l[k] === ')') depth++;
            else if (l[k] === '(') {
              depth--;
              if (depth === 0) return k;
            }
          }
          return -1;
        };
        let start = matchOpen(j);
        if (start === -1) continue;
        let hasChain = false;
        for (;;) {
          let p = start - 1;
          while (p >= 0 && l[p] === ' ') p--;
          if (p < 0 || !'+-*/'.includes(l[p])) break;
          p--;
          while (p >= 0 && l[p] === ' ') p--;
          if (p < 0 || l[p] !== ')') break;
          const open = matchOpen(p);
          if (open === -1) break;
          start = open;
          hasChain = true;
        }
        const arg = l.slice(start, j + 1);
        const wrapped = hasChain ? `(${arg})` : arg;
        l = l.slice(0, start) + `${wrapped} の [${fn} v]` + l.slice(i + fn.length);
        replaced = true;
        break;
      }
      if (replaced) break;
    }
  }
  return l;
}

// 「他スプライトの値」レポーター（sensing_of）の自由記法を公式形に直す。
// 正しい ja 表記は「((ボール v) の [x座標 v])」。このブロックはAIが
// 「(ボールのx座標)」「(ボール v の x座標)」のように1つの丸括弧へ自由に書きがちで、
// 存在しない変数レポーター扱いになる（赤にはならないが、子どもが組めるブロックにならない）。
// プロパティ名が公式メニュー値（x座標／y座標／向き／大きさ／音量／コスチューム名／背景の名前）に
// 一致するものだけを対象にする。「(マウスのx座標)」は別の公式ブロックなので除外。
// 「(ボールのx座標)」形は、同名の実在変数（[ボールのx座標 v] が同コード内に出現）なら変換しない。
const SENSING_OF_PROPS = '(?:x座標|y座標|向き|大きさ|音量|コスチューム名|背景の名前)';

function fixSensingOfFreeform(code) {
  // (ボール v の x座標) / (ボール v のx座標) → ((ボール v) の [x座標 v])
  let out = code.replace(
    new RegExp(`\\(([^()[\\]]+?)\\s+v\\s*の\\s*(${SENSING_OF_PROPS})\\s*\\)`, 'g'),
    '(($1 v) の [$2 v])',
  );
  // (ボールのx座標) → ((ボール v) の [x座標 v])
  out = out.replace(
    new RegExp(`\\(([^()[\\]]+?)の(${SENSING_OF_PROPS})\\)`, 'g'),
    (m, name, prop) => {
      const n = name.trim();
      if (!n || n === 'マウス') return m;                 // (マウスのx座標) は別ブロック
      if (out.includes(`[${n}の${prop} v]`)) return m;    // 実在変数はそのまま
      return `((${n} v) の [${prop} v])`;
    },
  );
  return out;
}

// sensing_of（〇〇の値）レポーターのドロップダウン括弧形状を公式形に統一する。
// 正しくは「((ボール v) の [x座標 v])」＝スプライト名が丸・プロパティが角。
// AIは丸と角を混同して「((ボール v) の (x座標 v))」「([ボール v] の [x座標 v])」等と
// 書きがちで、外側括弧の欠落と重なると赤ブロックになる。メニュー値が既知のものだけ形を直す。
// 数学関数（絶対値等）の形は fixMathFuncForm が後置き形へ正規化するのでここでは扱わない。
function fixOfReporterDropdownShape(line) {
  let l = line;
  // (ボール v) の (x座標 v) → (ボール v) の [x座標 v] （プロパティは角括弧）
  l = l.replace(new RegExp(`( v\\))\\s*の\\s*\\((${SENSING_OF_PROPS})\\s+v\\)`, 'g'), '$1 の [$2 v]');
  // [ボール v] の [x座標 v] → (ボール v) の [x座標 v] （スプライト名は丸括弧）
  l = l.replace(new RegExp(`\\[([^[\\]]+?)\\s+v\\]\\s*の\\s*(\\[(?:${SENSING_OF_PROPS})\\s+v\\])`, 'g'), '($1 v) の $2');
  return l;
}

// 比較（< = >）の左右で演算レポーターの外側 () が抜けた形を補正する。
// 「もし <([絶対値 v] の (差x)) * (15) > ([絶対値 v] の (差y)) * (24)> なら」のように
// 比較の項が「グループ 演算子 グループ」の裸の連鎖だと、行全体が1つの未知ブロックと
// 解釈されて赤ブロックになる。トップレベルの <...> の中身を比較演算子で分割し、
// 演算子連鎖になっている側を () で包む。
function wrapArithChain(side) {
  const s = side.trim();
  if (!s) return side;
  if (isAlreadyWrapped(s)) return s;
  for (const op of [' + ', ' - ', ' * ', ' / ']) {
    if (splitTopLevel(s, op).length > 1) return `(${s})`;
  }
  if (isCompoundReporter(s)) return `(${s})`; // 裸の複合レポーター（[絶対値 v] の (x) 等）
  return s;
}

function fixArithChainInComparison(line) {
  if (!/[<=>]/.test(line)) return line;
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '<' && bracketKind(line, i) === 'open') {
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
        const inner = line.slice(i + 1, j);
        let fixedInner = inner;
        for (const op of [' = ', ' > ', ' < ']) {
          const parts = splitTopLevel(inner, op);
          if (parts.length === 2) {
            fixedInner = `${wrapArithChain(parts[0])}${op}${wrapArithChain(parts[1])}`;
            break;
          }
        }
        out += `<${fixedInner}>`;
        i = j + 1;
        continue;
      }
    }
    out += line[i];
    i++;
  }
  return out;
}

// 既知の誤ったブロック名 → 正しい記法への直接置換
const KNOWN_WRONG_BLOCKS = [
  // stopブロックの「他のスクリプト」系は行ごとに fixStopOtherScripts で正規化するため
  // ここでは扱わない（cap ではなく stack にする必要があるため）。
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

  // Step 1.5: 「他スプライトの値」の自由記法をコード全体で正規化
  // （実在変数の判定にコード全体が要るため、行ループの前に行う）
  corrected = fixSensingOfFreeform(corrected);

  // Step 2: 行ごとの補正（メッセージ記法・変数ブロックのレポーター囲み忘れ）
  const lines = corrected.split('\n');
  const fixedLines = lines.map(line => {
    let l = line.trim();
    l = fixMessageBlock(l);
    l = fixKeyPressedBlock(l);
    l = fixCloneBlock(l);
    l = fixStopOtherScripts(l);
    l = fixVariableDropdownInOperator(l);
    l = fixPointInDirection(l);
    l = fixTurnBlock(l);
    l = fixOfReporterDropdownShape(l);
    l = fixMathFuncForm(l);
    l = fixNegatedCondition(l);
    l = fixChainedBoolean(l);
    l = fixArithChainInComparison(l);
    l = fixMissingSetVerb(l);
    l = fixBareNumArg(l);
    l = fixReporterInVariableBlock(l);
    return l;
  });
  corrected = fixedLines.join('\n');

  // Step 3: 構造の決定論補正（赤ブロックではなく「動かない構造」）。
  // グリッド初期化（座標の絶対セット）が繰り返しの中にあって毎回リセットされ、
  // 1列／1か所にしか並ばないバグを、初期化を繰り返しの外へ追い出して直す。
  // 描画・PDF・まとめ直しの全経路に常時かかり、再生成で再発しても確実に直る。
  corrected = hoistLoopInit(corrected);

  return corrected;
}
