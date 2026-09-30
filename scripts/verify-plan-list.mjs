// 「決めることリスト」の受け渡しが壊れていないかを確かめる。
//   実行: node scripts/verify-plan-list.mjs
//
// ここが壊れると、症状は「同じことを何度も聞く」か「聞き残したまま summary へ進む」。
// どちらも画面にはエラーが出ず、会話を最後まで読まないと気づけない。
import { collectPlan, latestSpec, matchPlanToSpec, remainingPlan, buildPlanSection } from '../src/lib/planList.js';

let bad = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { console.log(`✅ ${label}`); return; }
  bad++; console.log(`❌ ${label}${extra ? '  ' + extra : ''}`);
};

const ai = (plan, spec) => ({ role: 'assistant', parsed: { phase: 'planning', plan, spec } });
const me = text => ({ role: 'user', content: text });

// ① 履歴に散らばった plan を初出順で1本にまとめる（後から増えた項目を足せる）
const msgs = [
  me('パックマン作りたい'),
  ai(['主人公', '集めるもの', '敵'], { 'ゲームの種類': 'パックマン' }),
  me('パックマン'),
  ai(null, { 'ゲームの種類': 'パックマン', '主人公': 'パックマン' }),
  me('ゴーストは4匹で性格を変えたい'),
  ai(['主人公', '集めるもの', '敵', '敵の数', '敵の性格'], { 'ゲームの種類': 'パックマン', '主人公': 'パックマン' }),
];
ok('planを初出順でまとめる',
  JSON.stringify(collectPlan(msgs)) === JSON.stringify(['主人公', '集めるもの', '敵', '敵の数', '敵の性格']),
  JSON.stringify(collectPlan(msgs)));

// ② 途中で plan が null でも消えない（アプリが覚えている側の担保）
ok('planがnullのターンでも落ちない', collectPlan([ai(['A', 'B'], {}), ai(null, {})]).length === 2);

// ③ 最新の spec を拾う
ok('最新のspecを拾う', latestSpec(msgs)['主人公'] === 'パックマン');

// ④ キー名がずれても「決まった」と分かる（ここを落とすと同じ質問を繰り返す）
const answered = (plan, spec) => [...matchPlanToSpec(plan, spec).keys()];
ok('キーの完全一致', answered(['主人公'], { '主人公': 'パックマン' }).includes('主人公'));
ok('キーがずれても拾う（spec側が長い）',
  answered(['主人公'], { '主人公キャラクター': 'パックマン' }).includes('主人公'));
ok('キーがずれても拾う（plan側が長い）', answered(['敵の数'], { '敵': '4匹' }).includes('敵の数'));
ok('関係ないキーは拾わない', !answered(['集めるもの'], { '主人公': 'パックマン' }).includes('集めるもの'));
// 似た項目が並んだとき、完全一致の方に付く（『敵の数』を聞かずに飛ばさない）
ok('似た項目は完全一致が勝つ',
  JSON.stringify(remainingPlan(['敵', '敵の数'], { '敵': 'ゴースト' })) === JSON.stringify(['敵の数']),
  JSON.stringify(remainingPlan(['敵', '敵の数'], { '敵': 'ゴースト' })));

// ⑤ 残りは plan の順のまま
ok('残りはplanの順',
  JSON.stringify(remainingPlan(collectPlan(msgs), latestSpec(msgs))) ===
  JSON.stringify(['集めるもの', '敵', '敵の数', '敵の性格']));

// ⑥ 差し込む本文が「次の1つ」を名指しする
const section = buildPlanSection(collectPlan(msgs), latestSpec(msgs));
ok('次に聞く1項目を名指しする', section.includes('次に聞くのは「集めるもの」'));
ok('残り数を伝える', section.includes('残り4項目'));
ok('決まった項目には答えが載る', section.includes('主人公 … ✅ パックマン'));

// ⑦ 全部埋まったら質問を止めて reviewing へ送る
const done = buildPlanSection(['A', 'B'], { A: '1', B: '2' });
ok('全部決まったら次の質問を指示しない', !done.includes('次に聞くのは') && done.includes('すべて決まった'));

// ⑧ planがまだ無いターンは何も差し込まない（最初の1回を邪魔しない）
ok('planが無ければ空文字', buildPlanSection([], {}) === '');

console.log(bad ? `\n${bad}件 NG` : '\n✅ 決めることリストの受け渡しは健全');
if (bad) process.exit(1);
