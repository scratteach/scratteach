// モデルの梯子（工程別の振り分け・枯れたモデルの記録・エラーの見分け）を確かめる。
//   実行: node scripts/verify-model-router.mjs
//
// ここが壊れたときの症状は、どれも画面に出ない：
//  ・混雑しただけの429を「枯れた」と記録して、良いモデルを一日中飛ばす
//  ・枯れたモデルに毎回投げて、1回ぶんの待ち時間を捨て続ける
//  ・QAが生成と同じモデルになり、同じ盲点を見落とす

const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const { planModels, quotaDay, nextResetLabel, markExhausted, clearExhausted, listExhausted, MODEL_LADDER, liteMustNotOverwrite }
  = await import('../src/lib/modelRouter.js');
const { classifyGeminiError } = await import('../src/lib/modelFallback.js');
const { GeminiAPIError } = await import('../src/lib/gemini.js');

let bad = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { console.log(`✅ ${label}`); return; }
  bad++; console.log(`❌ ${label}${extra ? '  ' + extra : ''}`);
};

// ── 枠の1日は日本時間17時で切り替わる ──────────────────────
const before = new Date('2026-09-30T07:59:00Z'); // JST 16:59
const after  = new Date('2026-09-30T08:01:00Z'); // JST 17:01
ok('17時前はまだ前日の枠', quotaDay(before) === '2026-09-29', quotaDay(before));
ok('17時を過ぎたら次の枠へ', quotaDay(after) === '2026-09-30', quotaDay(after));
ok('次に戻る日時を日本時間で示す', nextResetLabel(before) === '9/30 17:00', nextResetLabel(before));

// ── 工程ごとの振り分け ──────────────────────────────────
const gen = planModels('generate');
const qa = planModels('qa');
const ask = planModels('ask');
ok('生成は賢い層の先頭から', gen.primary[0] === MODEL_LADDER.smart[0], gen.primary[0]);
ok('QAは生成と別のモデルから始める（盲点とRPMの食い合いを避ける）',
  qa.primary[0] !== gen.primary[0], `${qa.primary[0]} vs ${gen.primary[0]}`);
ok('質問はlite層だけ',
  ask.primary.every(m => MODEL_LADDER.lite.includes(m)) && ask.demotion.length === 0);
ok('賢い層は全滅時にliteへ降りられる',
  gen.demotion.every(m => MODEL_LADDER.lite.includes(m)) && gen.demotion.length > 0);

// ── 枯れたモデルは全工程で飛ばす ────────────────────────────
markExhausted(MODEL_LADDER.smart[0], after);
const gen2 = planModels('generate', after);
const qa2 = planModels('qa', after);
ok('枯れたモデルは生成から外れる', !gen2.primary.includes(MODEL_LADDER.smart[0]));
ok('枯れたモデルは他の工程からも外れる（記録は共通）', !qa2.primary.includes(MODEL_LADDER.smart[0]));
ok('枯れた記録は一覧に出る', listExhausted(after).includes(MODEL_LADDER.smart[0]));
ok('17時をまたぐと記録は自然に消える',
  !listExhausted(new Date('2026-10-01T08:01:00Z')).includes(MODEL_LADDER.smart[0]));

// 賢い層が全滅したらliteへ
MODEL_LADDER.smart.forEach(m => markExhausted(m, after));
const gen3 = planModels('generate', after);
ok('賢い層が全滅したらliteが候補になる',
  gen3.primary.length === 0 && gen3.demotion.length > 0,
  JSON.stringify(gen3));

// 全部枯れた記録になったら、記録のほうを疑って素の梯子を返す（候補ゼロで詰まない）
[...MODEL_LADDER.smart, ...MODEL_LADDER.lite].forEach(m => markExhausted(m, after));
const gen4 = planModels('generate', after);
ok('全滅しても候補をゼロにしない', gen4.primary.length > 0, JSON.stringify(gen4));
clearExhausted();

// ── 設定の固定指定は「自分で選んだ印」があるときだけ効く ──────────
store['scratteach_model'] = 'gemini-3.5-flash-lite';
ok('印が無い保存値は昔の既定なので無視する', planModels('generate').primary[0] === MODEL_LADDER.smart[0]);
store['scratteach_model_chosen'] = '1';
ok('自分で選んだ指定は最優先になる', planModels('generate').primary[0] === 'gemini-3.5-flash-lite');
delete store['scratteach_model'];
delete store['scratteach_model_chosen'];

// ── エラーの見分け ────────────────────────────────────
const mk = (status, details) => new GeminiAPIError('x', status, 'c', details ? { details } : null);
const quota = id => [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: id }] }];
ok('429（分あたり）は枯れ扱いにしない',
  classifyGeminiError(mk(429, quota('GenerateRequestsPerMinutePerProjectPerModel'))) === 'rpm');
ok('429（日あたり）は枯れ扱い',
  classifyGeminiError(mk(429, quota('GenerateRequestsPerDayPerProjectPerModel'))) === 'rpd');
ok('429で待ち時間が短ければ分あたりとみなす',
  classifyGeminiError(mk(429, [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '24s' }])) === 'rpm');
ok('429で手がかりが無ければ日あたりとみなす（既定）', classifyGeminiError(mk(429, null)) === 'rpd');
ok('503は同じモデルで投げ直す', classifyGeminiError(mk(503)) === 'busy');
ok('500は梯子を降りない（要求側が原因のことがある）', classifyGeminiError(mk(500)) === 'internal');
ok('404はモデルIDが無い', classifyGeminiError(mk(404)) === 'missing-model');
ok('401/400は諦める',
  classifyGeminiError(mk(401)) === 'fatal' && classifyGeminiError(mk(400)) === 'fatal');

// ── 自動の作り直しで、lite が賢い層の結果を上書きしない ─────────
const [smart0] = MODEL_LADDER.smart, [lite0] = MODEL_LADDER.lite;
ok('lite の作り直しは賢い層の結果を上書きしない', liteMustNotOverwrite(lite0, smart0) === true);
ok('賢い層どうしの作り直しは受け取る', liteMustNotOverwrite(MODEL_LADDER.smart[1], smart0) === false);
ok('元も lite なら lite の作り直しを受け取る', liteMustNotOverwrite(lite0, MODEL_LADDER.lite[1]) === false);
ok('元のモデルが分からない古い会話は受け取る', liteMustNotOverwrite(lite0, undefined) === false);

console.log(bad ? `\n${bad}件 NG` : '\n✅ 梯子の振り分け・記録・エラーの見分けは健全');
if (bad) process.exit(1);
