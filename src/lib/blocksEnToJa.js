// 英語で書かれた scratchblocks を、日本語のブロック表記へ機械的に翻訳する。
//
// なぜ英語で書かせるのか（この層が要る理由）：
// Scratchのブロックは英語で設計されているので、英語の語順＝ブロックの構造そのものになる。
// ところが日本語は語順が変わる。
//   英語  item (1) of [list v]        …「item → of」の順で構造どおり
//   日本語 ([list v] の (1) 番目)       … リストが先、番号が後
// AIは日本語として自然な語順（「(1) 番目の [list v]」）に引っ張られ、これを書くと
// 入力として解釈できず**その行がまるごと赤ブロック**になる。ゴールデンサンプルに
// 正しい形を載せて目の前に置いても防げなかった（2026-08-20 実機）。
// 語順を間違えうるブロックは209個中55個あり、1つずつ補正ルールを書くのは終わらない。
//
// そこで「AIは英語で書く／日本語への変換はこちらが機械でやる」に変える。
// 変換は scratchblocks 自身の translate()（言語ごとの書式表を引く実装）を使うので、
// 語順は**表引きの結果**であって判断の余地がない＝間違えようがない。
//
// 変換されないもの＝ドロップダウンの選択肢。ライブラリ側が未実装（model.js に
// "TODO translate dropdown value" とある）なので、固定の選択肢だけこちらで訳す。
// 変数名・リスト名・メッセージ名・コスチューム名・音の名前はユーザーの言葉なので触らない。

import { parse, allLanguages, loadLanguages } from 'scratchblocks/syntax/index.js';
import jaLocale from 'scratchblocks/locales/ja.json' with { type: 'json' };
import { stripBlockAnnotations } from './scratchBlocksCorrector.js';

loadLanguages({ ja: jaLocale });

// 固定の選択肢（enum）だけを訳す。ここに無い値は「ユーザーが付けた名前」とみなして素通しする。
// 素通ししてよいのは var / list / broadcast / costume / sound / backdrop / スプライト名。
const DROPDOWN_JA = {
  // キー
  space: 'スペース',
  'up arrow': '上向き矢印',
  'down arrow': '下向き矢印',
  'right arrow': '右向き矢印',
  'left arrow': '左向き矢印',
  any: 'どれかの',
  enter: 'enter',
  // 止める
  all: 'すべてを止める',
  'this script': 'このスクリプトを止める',
  'other scripts in sprite': 'スプライトの他のスクリプトを止める',
  // 前後（レイヤー）
  front: '最前面',
  back: '最背面',
  forward: '前',
  backward: '後ろ',
  // 回転方法
  'left-right': '左右のみ',
  "don't rotate": '回転しない',
  'all around': '自由に回転',
  // クローン・触れた・行く先
  // ※scratchblocks のテキストでは "_myself_" ではなく "myself" のように、
  //   Scratch の画面に出ている綴りをそのまま書く
  myself: '自分自身',
  'mouse-pointer': 'マウスのポインター',
  edge: '端',
  'random position': 'どこかの場所',
  Stage: 'ステージ',
  // リストの何番目か（「random」は背景の「random backdrop」と綴りが違うので衝突しない）
  last: '最後',
  random: 'どれか',
  // 「〇〇の△△」の属性
  'x position': 'x座標',
  'y position': 'y座標',
  direction: '向き',
  'costume #': 'コスチューム番号',
  'costume name': 'コスチューム名',
  'backdrop #': '背景番号',
  'backdrop name': '背景の名前',
  size: '大きさ',
  volume: '音量',
  // 演算の関数
  abs: '絶対値',
  floor: '切り下げ',
  ceiling: '切り上げ',
  sqrt: '平方根',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  ln: 'ln',
  log: 'log',
  'e ^': 'e ^',
  '10 ^': '10 ^',
  round: '四捨五入',
  // 見た目の効果
  color: '色',
  fisheye: '魚眼レンズ',
  whirl: '渦巻き',
  pixelate: 'ピクセル化',
  mosaic: 'モザイク',
  brightness: '明るさ',
  ghost: '幽霊',
  // 音の効果
  pitch: 'ピッチ',
  pan: '左右にパン',
  // 背景・コスチュームの送り（Scratchの選択肢は2語なので、リストの「random」と衝突しない）
  'next backdrop': '次の背景',
  'previous backdrop': '前の背景',
  'random backdrop': 'どれかの背景',
  'next costume': '次のコスチューム',
  // 日付
  year: '年',
  month: '月',
  date: '日',
  'day of week': '曜日',
  hour: '時',
  minute: '分',
  second: '秒',
  // その他のセンサー
  loudness: '音量',
  timer: 'タイマー',
};

const DROPDOWN_EN = Object.fromEntries(
  Object.entries(DROPDOWN_JA).map(([en, ja]) => [ja, en]),
);

// costume / backdrop の [number v] [name v] だけは、選択肢の名前が
// 「番号」「名前」という、変数名としてもよく使われる言葉になる。
// 前に costume / backdrop が付いている形でしか出てこないので、そこだけ切り出して訳す。
const PHRASE_PAIRS = [
  ['costume [number v]', 'costume [番号 v]'],
  ['costume [name v]', 'costume [名前 v]'],
  ['backdrop [number v]', 'backdrop [番号 v]'],
  ['backdrop [name v]', 'backdrop [名前 v]'],
];

// その行のテキストで「変数・リストとして使われている名前」を集める。
// 選択肢の名前とたまたま同じ日本語の変数（例：変数「番号」と コスチューム番号の「番号」）を、
// 勝手に別の言葉へ書き換えてしまわないための除外リスト。
const USER_NAME_RE = [
  /set \[([^[\]]+?) v\] to/g,
  /change \[([^[\]]+?) v\] by/g,
  /(?:show|hide) variable \[([^[\]]+?) v\]/g,
  /(?:add|insert)[^[\]]*?to \[([^[\]]+?) v\]/g,
  /(?:delete|delete all|replace item)[^[\]]*?of \[([^[\]]+?) v\]/g,
  /\[([^[\]]+?) v\] を [^\n]*?(?:にする|ずつ変える)/g,
  /変数 \[([^[\]]+?) v\] を/g,
  /\[([^[\]]+?) v\] (?:のすべてを削除する|に追加する)/g,
  /\[([^[\]]+?) v\] の [^\n]*?番目/g,
];

function collectUserNames(text) {
  const names = new Set();
  for (const re of USER_NAME_RE) {
    for (const m of text.matchAll(re)) names.add(m[1].trim());
  }
  return names;
}

// [〇〇 v] / (〇〇 v) の中身だけを差し替える。名前に空白を含む値（"up arrow" など）も拾う。
function replaceDropdowns(line, table, userNames) {
  let out = line;
  for (const [en, ja] of PHRASE_PAIRS) {
    const [from, to] = table === DROPDOWN_JA ? [en, ja] : [ja, en];
    out = out.split(from).join(to);
  }
  return out.replace(/([[(])\s*([^[\]()]+?)\s+v\s*([\])])/g, (all, open, value, close) => {
    if (userNames?.has(value)) return all; // 利用者が付けた変数・リスト名は触らない
    const hit = table[value];
    return hit ? `${open}${hit} v${close}` : all;
  });
}

// stringify() の癖を落とす：行末の空白と、カスタムブロック呼び出しに付く「:: custom」。
function tidy(text) {
  return text
    .split('\n')
    .map(l => l.replace(/\s*::\s*custom(?:-arg)?\s*$/, '').replace(/\s+$/, ''))
    .join('\n');
}

/**
 * 英語の scratchblocks を日本語に翻訳する。
 * 変数名・メッセージ名などユーザーの言葉はそのまま残る。
 */
export function translateBlocksToJa(englishText) {
  if (!englishText || !englishText.trim()) return englishText ?? '';
  const doc = parse(englishText, { languages: ['en'] });
  doc.translate(allLanguages.ja);
  const text = tidy(doc.stringify());
  const userNames = collectUserNames(englishText + '\n' + text);
  return text
    .split('\n')
    .map(l => replaceDropdowns(l, DROPDOWN_JA, userNames))
    .join('\n');
}

/**
 * 英語で書かれていれば日本語に翻訳し、すでに日本語なら何もしない。
 *
 * 移行期のAIの出力や、ユーザーが日本語で貼り込む素通し経路が混ざっても壊れないようにする。
 * 判定は「括弧の中身（名前・文章・ドロップダウン）を取り除いた骨組みに かな が残るか」で行う。
 * 英語のブロックの骨組みは必ず半角英字だけになり、日本語のブロックには必ず かな が残る。
 * say [ずっと] のように名前や文章に日本語が入っていても、骨組みには出てこないので誤判定しない。
 */
export function translateBlocksToJaIfEnglish(text) {
  if (!text || !text.trim()) return text ?? '';
  // 注釈が1行でも残っていると、その行の かな のせいでスプライト全体が
  // 「日本語で書かれている」と誤判定され、まるごと翻訳されなくなる。先に落とす。
  const clean = stripBlockAnnotations(text);
  const skeleton = clean.replace(/\[[^[\]]*\]|\([^()]*\)|<[^<>]*>/g, ' ');
  if (/[ぁ-んァ-ヶ]/.test(skeleton)) return clean; // すでに日本語のブロック文
  return translateBlocksToJa(clean);
}

// C系ブロックの開き・閉じは1行だけでは解釈できないので、素通しする語として持っておく。
// （日本語→英語は見本の移行にしか使わないが、ライブラリの stringify は入れ子を崩すため
//   1行ずつ変換して、字下げと end はこちらの元テキストのものを保つ）
const JA_PASSTHROUGH = { end: 'end', でなければ: 'else' };

/**
 * 日本語の scratchblocks を英語に翻訳する（見本の移行用）。
 * 1行ずつ変換し、字下げと end の位置は元のテキストのものをそのまま使う。
 */
export function translateBlocksToEn(japaneseText) {
  if (!japaneseText || !japaneseText.trim()) return japaneseText ?? '';
  const userNames = collectUserNames(japaneseText);
  return japaneseText
    .split('\n')
    .map(raw => {
      const indent = raw.match(/^\s*/)[0];
      const body = raw.trim();
      if (!body) return '';
      if (JA_PASSTHROUGH[body]) return indent + JA_PASSTHROUGH[body];

      const doc = parse(replaceDropdowns(body, DROPDOWN_EN, userNames), { languages: ['ja'] });
      doc.translate(allLanguages.en);
      const out = tidy(doc.stringify())
        .split('\n')
        .filter(l => l.trim() && l.trim() !== 'end') // 未閉じのC系に自動で足される end を捨てる
        .join('\n')
        .trim();
      return indent + (out || body);
    })
    .join('\n');
}
