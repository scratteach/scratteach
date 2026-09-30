// 「決めることリスト（plan）」＝その子のゲームで何を決めるべきかの一覧。
//
// なぜ要るか：
// 質問フェーズの仕事は本当は2つに分かれている。①そのゲームに必要な仕様を考え抜いて
// 一覧にする（難しい）と、②一覧から1つ選んで子どもに分かる言葉で聞く（やさしい）。
// これまで①の結果を置く場所が無く、返答のJSONにも入らなかったので、AIは毎ターン
// 履歴を読み直して一覧を作り直していた＝「考え抜いてメモ」ではなく「毎回その場で組み直し」。
// 同じ一覧が再現される保証がなく、いちばん大事な「その子の作品になる部分」ほど揺れた。
//
// planをアシスタントの返答に持たせると、specと同じように履歴＝セッションに残る。
// 以後のターンは、この一覧のどこまで決まったかを**アプリ側が機械的に数えて**渡せるので、
// AIは「次の1つを聞く」だけでよくなる（＝小さいモデルでも務まる仕事に落ちる）。

/** 履歴に現れた plan をすべて取り込む（初出の順を保った和集合）。
 *  作り直しではなく積み増しにするのは、後半で項目が増えたとき（「敵は4匹で性格を変えたい」等）に
 *  前半の項目を落とさないため。 */
export function collectPlan(messages = []) {
  const seen = [];
  for (const m of messages) {
    if (m?.role !== 'assistant') continue;
    const plan = m?.parsed?.plan;
    if (!Array.isArray(plan)) continue;
    for (const raw of plan) {
      const item = String(raw || '').trim();
      if (item && !seen.includes(item)) seen.push(item);
    }
  }
  return seen;
}

/** 最後に返ってきた spec（決まったことの集まり）。 */
export function latestSpec(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const spec = messages[i]?.parsed?.spec;
    if (spec && typeof spec === 'object' && Object.keys(spec).length) return spec;
  }
  return {};
}

/** plan の各項目に、対応する spec のキーを割り当てる。
 *  完全一致が最優先。次に「specのキーが項目名を含む」（planの『主人公』をspecで
 *  『主人公キャラクター』と書いた場合）、最後に「項目名がspecのキーを含む」。
 *  優先順位を付けないと、plan に『敵』と『敵の数』が並んだとき、spec の『敵』が
 *  『敵の数』の方に吸われて、聞いていない項目を決まったことにしてしまう。
 *  @returns {Map<string,string>} 項目名 → specのキー
 */
export function matchPlanToSpec(plan = [], spec = {}) {
  const keys = Object.keys(spec || {});
  const map = new Map();
  for (const key of keys) {
    let best = null, bestScore = 0;
    for (const item of plan) {
      const score = item === key ? 3 : key.includes(item) ? 2 : item.includes(key) ? 1 : 0;
      if (score > bestScore) { best = item; bestScore = score; }
    }
    if (best && !map.has(best)) map.set(best, key);
  }
  return map;
}

/** まだ決まっていない項目（plan の順のまま）。 */
export function remainingPlan(plan = [], spec = {}) {
  const matched = matchPlanToSpec(plan, spec);
  return plan.filter(item => !matched.has(item));
}

/** プロンプトに差し込む「決めることリスト」の本文。
 *  AIに一覧を作り直させないため、決まった／まだ を数えた状態で毎回渡す。 */
export function buildPlanSection(plan = [], spec = {}) {
  if (!plan.length) return '';
  const matched = matchPlanToSpec(plan, spec);
  const rest = plan.filter(item => !matched.has(item));
  const lines = plan.map((item, i) => {
    const key = matched.get(item);
    return `${i + 1}. ${item} … ${key ? `✅ ${spec[key]}` : '❓まだ決まっていない'}`;
  });

  return [
    '## 【この子のための「決めること」リスト】',
    '最初の返答で作った一覧を、アプリが覚えている。**作り直さないこと**。',
    ...lines,
    '',
    ...(rest.length
      ? [
        `次に聞くのは「${rest[0]}」。この1つだけを、その子に分かる言い方に直して聞くこと（考え直さない）。`,
        `答えが返ってきたら、spec に **「${rest[0]}」というキーのまま** 入れること（キー名を変えると決まったか判別できず、同じことを何度も聞くことになる）。`,
        `残り${rest.length}項目。`,
        'この一覧に無いことを思いつきで聞かないこと。逆に、話の流れで新しく決めるべきことが本当に増えたときだけ、増やした一覧全体を plan に入れて返すこと。',
      ]
      : [
        'すべて決まった。planning での質問は終わり。reviewing で足りないところを1〜3問だけ確認し、無ければ summary へ進むこと。',
      ]),
  ].join('\n');
}
