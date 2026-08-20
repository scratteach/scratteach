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

// [〇〇 v] / (〇〇 v) の中身だけを差し替える。名前に空白を含む値（"up arrow" など）も拾う。
function replaceDropdowns(line, table) {
  return line.replace(/([[(])\s*([^[\]()]+?)\s+v\s*([\])])/g, (all, open, value, close) => {
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
  return tidy(doc.stringify())
    .split('\n')
    .map(l => replaceDropdowns(l, DROPDOWN_JA))
    .join('\n');
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
  return japaneseText
    .split('\n')
    .map(raw => {
      const indent = raw.match(/^\s*/)[0];
      const body = raw.trim();
      if (!body) return '';
      if (JA_PASSTHROUGH[body]) return indent + JA_PASSTHROUGH[body];

      const doc = parse(replaceDropdowns(body, DROPDOWN_EN), { languages: ['ja'] });
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
