import React from 'react';

// 「ブロックを作る」（定義ブロック）の作り方を、ブロック一覧の直前に差し込む案内。
//
// 定義ブロックは使う機会が少ないので、いきなり「定義 〇〇」というブロックが
// 現れても、どこから出せばいいのか分からない。パレットにも並んでいない
// （自分で作らないと存在しない）ので、他のブロックと違って探しても見つからない。
//
// 案内はAIに書かせず、生成されたブロックに「定義 」があるかどうかで機械的に出す。
// 手順そのものはゲームの内容と関係なく毎回同じなので、固定の文章で正確に書ける。

// 中身に「動き・待ち」があるかを見分ける形（日本語のブロック表記）。
// 「画面を再描画せずに実行する」に入れるべきかは、ブロックの中身で正反対になる：
//   ・計算だけ（盤面を調べる・リストを作る）→ 入れる。入れないと繰り返しの1周ごとに
//     画面を待つので、56マスを調べるだけで何秒もかかる（matchpuzzle 見本の必須条件）
//   ・動き・待ちがある → 入れない。入れると一瞬で終わってアニメーションが見えない
// 以前は「入れない」で固定していて、見本13個の定義（全部が計算だけ）と逆だった（2026-11-24）。
const MOTION_RE = new RegExp([
  '待つ', '秒で', '秒言う', '秒考える', '終わるまで', // 待つ・滑らかに動く・言う・音
  '歩動かす', '度回す', '度に向ける', 'へ行く',
  '^[xy]座標を', // 自分の座標を変える（変数「[x座標 v]」は [ で始まるので当たらない）
  '^大きさを', 'の効果を', 'コスチューム', '^表示する$', '^隠す$',
].join('|'));

// blocks から「定義 〇〇」の行を拾う。引数（丸や角のかっこ）が付いているか、
// 中身に動き・待ちがあるかも見る。中身＝次の空行か、次の「〜とき」「定義」まで。
export function findCustomBlocks(sprites) {
  const found = [];
  for (const sp of sprites || []) {
    const lines = String(sp.blocks || '').split('\n').map(l => l.trim());
    lines.forEach((line, i) => {
      const m = line.match(/^定義\s+(.+)$/);
      if (!m) return;
      const label = m[1].trim();
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j];
        if (!t || /^定義\s/.test(t) || /とき$/.test(t)) break;
        body.push(t);
      }
      found.push({
        spriteName: sp.name,
        label,
        // 「定義 ジャンプする (高さ)」「定義 出す <条件>」のように引数が付いている形かどうか
        // 丸=数値/テキスト、角=同じ扱い、山=真偽値。どれか1つでも付いていれば引数あり
        hasArgs: /[([<]/.test(label),
        animates: body.some(t => MOTION_RE.test(t)),
      });
    });
  }
  return found;
}

const Step = ({ n, children }) => (
  <li className="flex gap-2">
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-400 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
      {n}
    </span>
    <span className="flex-1">{children}</span>
  </li>
);

const CustomBlockGuide = ({ sprites }) => {
  const customBlocks = findCustomBlocks(sprites);
  if (!customBlocks.length) return null;

  const anyArgs = customBlocks.some(b => b.hasArgs);
  const animating = customBlocks.filter(b => b.animates).length;
  const warpAll = animating === 0;
  const warpNone = animating === customBlocks.length;

  return (
    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🧩</span>
        <span className="text-sm font-semibold text-rose-700">
          先に「ブロックを作る」で自分のブロックを作ってください
        </span>
      </div>

      <p className="text-xs text-rose-800 leading-relaxed mb-2">
        このゲームには <span className="font-semibold">「定義」から始まるブロック</span>が出てきます。
        これは<span className="font-semibold">自分で作るブロック</span>で、
        パレットを探しても見つかりません。先に作っておかないと組めません。
      </p>

      <div className="rounded-lg bg-white/70 border border-rose-100 px-3 py-2 mb-2">
        <p className="text-xs font-medium text-rose-700 mb-1">作るブロック</p>
        <ul className="text-xs text-gray-700 space-y-0.5">
          {customBlocks.map((b, i) => (
            <li key={i}>
              <span className="font-mono font-medium">{b.label}</span>
              <span className="text-gray-500">　…「{b.spriteName}」スプライトの中で作る</span>
              {!warpAll && !warpNone && (
                <span className={b.animates ? 'text-gray-500' : 'text-rose-700 font-medium'}>
                  {b.animates ? '　⬜ 再描画のチェックは入れない' : '　✅ 再描画のチェックを入れる'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <ol className="text-xs text-gray-700 space-y-1.5">
        <Step n={1}>
          ブロックパレットの一番下にある <span className="font-medium">「ブロック定義」</span> を選び、
          <span className="font-medium">「ブロックを作る」</span> を押す
        </Step>
        <Step n={2}>
          出てきた画面の <span className="font-medium">「ブロック名」</span> のところに、上の名前を入力する
          （名前は1文字でも違うと別のブロックになります）
        </Step>
        {anyArgs ? (
          <Step n={3}>
            <span className="font-medium">「引数を追加（数値またはテキスト）」</span> を押して、
            名前のうしろのかっこの数だけ入れ物を足す
          </Step>
        ) : (
          <Step n={3}>
            <span className="font-medium">「引数を追加」は押さない</span>。
            このゲームのブロックには入れ物（かっこ）が付いていません
          </Step>
        )}
        <Step n={4}>
          {warpAll ? (
            <>
              <span className="font-medium">「画面を再描画せずに実行する」にチェックを入れる</span>。
              中は計算だけなので一瞬で終わります。入れないと繰り返しのたびに画面の書きかえを待つので、
              とても遅くなります
            </>
          ) : warpNone ? (
            <>
              <span className="font-medium">「画面を再描画せずに実行する」にはチェックを入れない</span>。
              入れると中の動きが一瞬で終わってしまい、アニメーションが見えなくなります
            </>
          ) : (
            <>
              <span className="font-medium">「画面を再描画せずに実行する」は、ブロックによって違います</span>。
              上の一覧の ✅（入れる）／⬜（入れない）のとおりにしてください。
              計算だけのブロックは入れると速くなり、動きのあるブロックは入れると動きが見えなくなります
            </>
          )}
        </Step>
        <Step n={5}>
          <span className="font-medium">OK</span> を押すと、
          <span className="font-mono">定義 〜</span> のブロックが置かれ、
          同時に<span className="font-medium">呼び出す用のブロックがパレットに追加</span>されます。
          あとは下のとおりに中身をつなげてください
        </Step>
      </ol>

      <p className="text-xs text-rose-700 mt-2 leading-relaxed">
        作るブロックは<span className="font-semibold">スプライトごと</span>です。
        他のスプライトからは呼べないので、上に書いてあるスプライトの中で作ってください。
      </p>
    </div>
  );
};

export default CustomBlockGuide;
