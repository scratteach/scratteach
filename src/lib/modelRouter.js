// 工程ごとにモデルを選び、枯れたら次へ降りる「梯子」。
//
// なぜ要るか：
// 無料枠は **モデルごと** に RPM / RPD が積まれる（Flash＝5/分・20/日、Flash Lite＝15/分・500/日）。
// だから梯子は「待ち時間を避ける仕掛け」ではなく「枠を積み上げる仕掛け」で、
// 賢い層を6段持てば1日の合計は 20×6＝120回になる。
//
// 工程の重みが違うので、全部を同じモデルで回すのは無駄が大きい。
//  ・考える仕事（最初のリスト作成・ブロック生成・QA採点）＝賢い層
//  ・リストから1つ聞くだけの仕事（質問・仕様整理）＝lite層（RPD 500 なので実質無限）
// 質問フェーズは子どもが答えを打つ人間の速度なので、lite の 15/分に当たることはまず無い。

const EXHAUSTED_KEY = 'scratteach_exhausted_models';
const MISSING_KEY = 'scratteach_missing_models';

// 梯子。上から順に試す。数字が新しいものほど上。
export const MODEL_LADDER = {
  smart: [
    'gemini-4-hydrogen', // 2026-11-23 無料枠に追加（RPD 20）。最も賢いので先頭
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash',
  ],
  lite: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ],
};

// 工程 → どの層を使うか
export const JOB_LAYER = {
  plan: 'smart',      // 最初の1回。要望の分析＋ジャンル判定＋「決めること」リスト作成
  generate: 'smart',  // ブロック生成
  fix: 'smart',       // 赤ブロック修正・作り直し
  qa: 'smart',        // 採点（生成とは別モデルにしたい。下の rotate 参照）
  ask: 'lite',        // リストから1つ聞くだけ
  summary: 'lite',    // 仕様の整理・網羅チェック
};

// 賢い層が全滅したとき、待ってでもやり直す価値がある工程。
// liteで出すとQAゲートが作り直しを呼び、かえってRPDを食う。
export const WAIT_BEFORE_DEMOTION = new Set(['generate', 'fix']);

// ── 枠の1日（日本時間17時で切り替わる）────────────────────────
// 無料枠の日次リセットは太平洋時間の深夜0時＝日本時間の16時（夏時間）／17時（冬）。
// 17時固定にしてあるのは、ずれる方向が安全側だから：実際のリセットより「遅い」側にずれるので、
// まだ枯れているモデルに投げて429を食うことは起きない。夏時間の間だけ1時間ぶん使わずに待つ。
function jstNow(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now).filter(p => p.type !== 'literal');
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24 };
}

/** いまが「どの枠の日」か。17時より前なら前日の枠が続いている。 */
export function quotaDay(now = new Date()) {
  const { y, m, d, h } = jstNow(now);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (h < 17) t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** 次に枠が戻る日時（日本時間）を人に見せる文字列にする。 */
export function nextResetLabel(now = new Date()) {
  const { y, m, d, h } = jstNow(now);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (h >= 17) t.setUTCDate(t.getUTCDate() + 1);
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} 17:00`;
}

// ── 使えないモデルの記録 ────────────────────────────────────
function readMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}
function writeMap(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* 保存できなくても動作は続ける */ }
}

/** RPDを使い切ったモデル。記録は枠の1日ぶんで、17時をまたぐと自然に無効になる。 */
export function listExhausted(now = new Date()) {
  const today = quotaDay(now);
  const map = readMap(EXHAUSTED_KEY);
  return Object.keys(map).filter(model => map[model] === today);
}
export function markExhausted(model, now = new Date()) {
  const map = readMap(EXHAUSTED_KEY);
  map[model] = quotaDay(now);
  writeMap(EXHAUSTED_KEY, map);
}
export function clearExhausted(model = null) {
  if (!model) { writeMap(EXHAUSTED_KEY, {}); return; }
  const map = readMap(EXHAUSTED_KEY);
  delete map[model];
  writeMap(EXHAUSTED_KEY, map);
}

/** 存在しないモデルID（404）。枠とは無関係なので日付を持たず、恒久的に飛ばす。 */
export function listMissing() {
  return Object.keys(readMap(MISSING_KEY));
}
export function markMissing(model) {
  const map = readMap(MISSING_KEY);
  map[model] = true;
  writeMap(MISSING_KEY, map);
}
export function clearMissing() {
  writeMap(MISSING_KEY, {});
}

// ── 工程 → 試すモデルの並び ─────────────────────────────────
/**
 * @param {string} job  JOB_LAYER のキー
 * @returns {{layer:string, primary:string[], demotion:string[]}}
 *   primary＝その工程の本来の層／demotion＝賢い層が全滅したときに降りる先。
 *   2つに分けてあるのは、層をまたぐ降格の前だけ「少し待ってやり直す」を挟みたいため。
 */
export function planModels(job, now = new Date()) {
  const layer = JOB_LAYER[job] || 'lite';
  let base = [...(MODEL_LADDER[layer] || [])];

  // QAは生成と別のモデルから始める。同じモデルで採点すると同じ盲点を見落とすうえ、
  // 生成直後に投げるので RPM のバケツも食い合う。1段ずらすだけで両方避けられる。
  if (job === 'qa' && base.length > 1) base = [...base.slice(1), base[0]];

  // 設定画面でモデルを明示指定していたら、それを最優先にする（おまかせなら指定なし）。
  // 「自分で選んだ印」が無い保存値は、昔の既定が残っているだけなので指定として扱わない。
  let override = null;
  try {
    if (localStorage.getItem('scratteach_model_chosen') === '1') {
      override = localStorage.getItem('scratteach_model');
    }
  } catch { /* 読めなければ指定なし扱い */ }
  if (override && override !== 'auto') base = [override, ...base.filter(m => m !== override)];

  const unusable = new Set([...listExhausted(now), ...listMissing()]);
  const primary = base.filter(m => !unusable.has(m));
  const demotion = layer === 'smart'
    ? MODEL_LADDER.lite.filter(m => !unusable.has(m) && !primary.includes(m))
    : [];

  // 記録がすべて「使えない」になったときは、記録のほうを疑って素の梯子を試す。
  if (!primary.length && !demotion.length) return { layer, primary: base, demotion: [] };
  return { layer, primary, demotion };
}

/** 単純に上から並べたいときの薄い包み。 */
export function pickModels(job, now = new Date()) {
  const { primary, demotion } = planModels(job, now);
  return [...primary, ...demotion];
}
