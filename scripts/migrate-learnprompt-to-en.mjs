// 学ぶモード（質問モード）の日本語プロンプトのブロック一覧を英語表記へ移行する（1回きり）。
// 作るモードと同じく、AIには英語で書かせ、日本語への変換はこちらが機械で行う。
import fs from 'fs';
import { translateBlocksToEn, translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
const PATH = new URL('../src/lib/systemPrompt.js', import.meta.url);
const src = fs.readFileSync(PATH, 'utf8');
const start = src.indexOf('## Scratch 3.0 正式ブロック一覧（日本語記法');
const end = src.indexOf('## 回答例', start);
if (start < 0 || end < 0) throw new Error('一覧の範囲が見つからない');
const head = src.slice(0, start), body = src.slice(start, end), tail = src.slice(end);
const norm = t => t.split('\n')[0].trim().replace(/^[<(](.*)[>)]$/, '$1').trim();
let n = 0, ng = 0;
const out = body.split('\n').map(l => {
  const t = l.trim();
  if (!t || t.startsWith('#') || t.startsWith('※') || t.startsWith('```') || t.startsWith('・') || t.startsWith('-')) return l;
  if (/^[A-Za-z(<\[]/.test(t) && !/[ぁ-んァ-ヶ]/.test(t.replace(/\[[^\]]*\]|\([^)]*\)/g, ''))) return l; // すでに英語
  const en = translateBlocksToEn(l).trim();
  n++;
  if (norm(translateBlocksToJa(en)) !== norm(t)) { ng++; return l; }
  return en;
}).join('\n');
console.log(`変換した行: ${n} ／ 戻らず日本語のまま: ${ng}`);
fs.writeFileSync(PATH, head + out.replace('（日本語記法・このリストにないブロックは使用禁止）', '（英語記法・このリストにないブロックは使用禁止）') + tail);
console.log('✅ 書き込みました');
