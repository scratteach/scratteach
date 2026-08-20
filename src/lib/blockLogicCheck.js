// ブロックを表示する前の静的ロジック検査。
//
// 赤ブロック検査（記法）とAIの自己チェック（仕様）では捕まらない層を埋める。
// 実機で踏んだ症状のうち「ブロック単体はどれも正しいのに、組み合わせが噛み合っていない」
// ものを、元テキストと比べずに機械だけで判定する。
//
//  - 選択肢リストに2個しか入れていないのに、ボタンCが3番目を読む
//    → クイズの3択が2択になる。Scratchは空文字を返すだけでエラーを出さない。
//  - 項目が2個のリストの「3番目に挿入する」
//    → 範囲外なのでScratchは黙って何もしない。乱数で3が出たときだけ選択肢が減る。
//  - 送っているのに受け取る人がいないメッセージ／受け取っているのに誰も送らないメッセージ
//    → その機能が丸ごと動かない。
//  - リストの「n番目」に使う変数が、定数を入れたきり一度も変わらない
//    → 毎回まったく同じ要素しか読まない。0のままなら「0番目」＝空文字が返り、
//      画面には何も出ないのに、赤ブロックも警告も出ない（実機で30分溶かした形）。
//
// 誤検知は「動いていたものをAIに作り直させる」事故につながるため、
// 静的に確定できるときだけ報告する（ループの中で追加しているリストは対象外にする）。

const RE = {
  loopStart: /(回繰り返す|ずっと|まで繰り返す)\s*$/,
  end: /^end$/,
  deleteAll: /^\[(.+?) v\] のすべてを削除する$/,
  addTo: / を \[(.+?) v\] に追加する$/,
  insertAt: /^\[(.+?) v\] の \((.+?)\) 番目に .+ を挿入する$/,
  itemOf: /\[(.+?) v\] の \((\d+)\) 番目/g,
  replaceAt: /^\[(.+?) v\] の \((\d+)\) 番目を /,
  setRandom: /^\[(.+?) v\] を \(\((\d+)\) から \((\d+)\) までの乱数\) にする$/,
  broadcast: /^\((.+?) v\) を送(る|って待つ)$/,
  onBroadcast: /^[[(](.+?) v[\])] を受け取ったとき$/,
};

function eachLine(sprites, fn) {
  for (const sp of sprites) {
    let depth = 0;
    for (const raw of String(sp.blocks || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (RE.end.test(line)) { depth = Math.max(0, depth - 1); continue; }
      fn(line, depth, sp.name);
      if (RE.loopStart.test(line)) depth++;
    }
  }
}

// メッセージの送信・受信が噛み合っているか
function checkMessages(sprites) {
  const sent = new Map();
  const received = new Map();
  eachLine(sprites, (line, _d, name) => {
    const s = line.match(RE.broadcast);
    if (s) { if (!sent.has(s[1])) sent.set(s[1], name); }
    const r = line.match(RE.onBroadcast);
    if (r) { if (!received.has(r[1])) received.set(r[1], name); }
  });

  const issues = [];
  for (const [msg, where] of sent) {
    if (!received.has(msg)) {
      issues.push({
        kind: 'message-no-receiver',
        spriteName: where,
        message: `メッセージ「${msg}」を送っているのに、受け取る「[${msg} v] を受け取ったとき」がどのスプライトにもありません。送っても何も起きません。`,
      });
    }
  }
  for (const [msg, where] of received) {
    if (!sent.has(msg)) {
      issues.push({
        kind: 'message-no-sender',
        spriteName: where,
        message: `メッセージ「${msg}」を受け取るブロックがあるのに、送る「(${msg} v) を送る」がどこにもありません。この処理は一度も動きません。`,
      });
    }
  }
  return issues;
}

// リストの項目数と、読み書きする番目の食い違い
function checkListIndexes(sprites) {
  const size = new Map();      // リスト名 → 静的に数えられた項目数
  const dynamic = new Set();   // ループの中で増減していて静的に数えられないリスト
  const maxRead = new Map();   // リスト名 → 読んでいる最大の番目
  const randomVar = new Map(); // 変数名 → 直前に入れた乱数の上限
  const issues = [];

  eachLine(sprites, (line, depth, name) => {
    const rnd = line.match(RE.setRandom);
    if (rnd) randomVar.set(rnd[1], Number(rnd[3]));

    const del = line.match(RE.deleteAll);
    if (del) { size.set(del[1], 0); return; }

    const add = line.match(RE.addTo);
    if (add) {
      if (depth > 0) dynamic.add(add[1]);
      else size.set(add[1], (size.get(add[1]) || 0) + 1);
      return;
    }

    const ins = line.match(RE.insertAt);
    if (ins) {
      const list = ins[1];
      const idx = ins[2].trim();
      if (depth > 0) { dynamic.add(list); return; }
      const count = size.get(list) || 0;
      const limit = /^\d+$/.test(idx) ? Number(idx)
        : (randomVar.has(idx) ? randomVar.get(idx) : null);
      if (limit !== null && limit > count + 1 && !dynamic.has(list)) {
        issues.push({
          kind: 'insert-out-of-range',
          spriteName: name,
          message: `「${list}」に入っているのは ${count} 個なのに、${limit} 番目に挿入しようとしています。`
            + `Scratchは範囲外の挿入をエラーも出さずに無視するので、入れたつもりの項目が入りません。`
            + `挿入できるのは「いまの項目数＋1」番目までです。`,
        });
      }
      size.set(list, count + 1);
      return;
    }

    for (const m of line.matchAll(RE.itemOf)) {
      const [, list, n] = m;
      maxRead.set(list, Math.max(maxRead.get(list) || 0, Number(n)));
    }
    const rep = line.match(RE.replaceAt);
    if (rep) maxRead.set(rep[1], Math.max(maxRead.get(rep[1]) || 0, Number(rep[2])));
  });

  for (const [list, want] of maxRead) {
    if (dynamic.has(list)) continue;      // ループで増えるリストは静的に数えられない
    if (!size.has(list)) continue;        // どこにも作られていないリストは対象外
    const have = size.get(list);
    if (want > have) {
      issues.push({
        kind: 'list-index-overflow',
        spriteName: '',
        message: `「${list}」に入れているのは ${have} 個なのに、${want} 番目を読み出しています。`
          + `Scratchは何も返さないので、その場所は空っぽになります（例：3択のはずが選択肢が1つ足りない）。`
          + `追加するブロックが足りていないか、読み出す番目が多すぎます。`,
      });
    }
  }
  return issues;
}

// 表示前の静的ロジック検査。問題が無ければ空配列。
// 「リストの何番目か」に使う変数が、一度も変わらないまま使われていないか。
//
// 実機で踏んだ形（タイピング）：定義ブロックの1行目が「[問題番号 v] を (1) ずつ変える」の
// はずが「[スコア v] を (1) ずつ変える」になっていた（複製すると前の変数を引き継ぐため）。
// 問題番号は (0) のまま増えず、「出題順リストの 0番目」を読み続けた。
// **0番目は存在しないので空文字が返る。**その空文字でさらに別のリストを引くのでまた空。
// 画面には何も出ないが、赤ブロックもエラーも出ず、タイマーだけ元気に減っていく。
//
// 誤検知を避けるため、報告するのは**代入がすべて定数**（または一度も代入が無い）で、
// かつ「ずつ変える」が1つも無いときだけにする。乱数や式を入れているものは毎回変わるので触らない。
const INDEX_USE_RE = /\[[^[\]]+ v\] の \(([^()]+)\) 番目/g;
const VAR_SET_RE = /^\[([^[\]]+) v\] を (.+?) にする$/;
const VAR_CHANGE_RE = /^\[([^[\]]+) v\] を (.+?) ずつ変える$/;
const CONSTANT_RE = /^[([]-?\d+(?:\.\d+)?[)\]]$/;

function checkFrozenListIndex(sprites) {
  const code = sprites.map(sp => String(sp.blocks || '')).join('\n');
  const lines = code.split('\n').map(l => l.trim());

  const indexVars = new Set();
  for (const m of code.matchAll(INDEX_USE_RE)) {
    const v = m[1].trim();
    // 数字そのもの（(1) 番目）と、入れ子の式は対象外
    if (!/^-?\d+(?:\.\d+)?$/.test(v) && !/[[\]()<>]/.test(v)) indexVars.add(v);
  }
  if (!indexVars.size) return [];

  const sets = new Map();
  const changed = new Set();
  for (const line of lines) {
    const sm = line.match(VAR_SET_RE);
    if (sm) { if (!sets.has(sm[1])) sets.set(sm[1], []); sets.get(sm[1]).push(sm[2]); }
    const cm = line.match(VAR_CHANGE_RE);
    if (cm) changed.add(cm[1]);
  }

  const issues = [];
  for (const v of indexVars) {
    if (changed.has(v)) continue;
    const assigned = sets.get(v) || [];
    if (assigned.length && !assigned.every(x => CONSTANT_RE.test(x))) continue;
    const owner = sprites.find(sp => String(sp.blocks || '').includes(`(${v}) 番目`));
    issues.push({
      spriteName: owner?.name,
      message: assigned.length
        ? `変数「${v}」をリストの「〜番目」に使っていますが、${assigned.join('・')} を入れたきり一度も変わりません。`
          + `毎回まったく同じ要素しか読まないので、リストを使う意味がなくなっています。`
          + `${assigned.includes('(0)') ? 'とくに0番目は存在しないため、空っぽが返って画面に何も出ません。' : ''}`
          + `「[${v} v] を (1) ずつ変える」で進めるか、乱数で選ぶようにしてください。`
        : `変数「${v}」をリストの「〜番目」に使っていますが、どこにも値を入れていません。`
          + `空のまま使うと存在しない番目を読むことになり、空っぽが返って画面に何も出ません。`,
    });
  }
  return issues;
}

export function checkBlockLogic(sprites) {
  if (!Array.isArray(sprites) || !sprites.length) return [];
  return [...checkListIndexes(sprites), ...checkMessages(sprites), ...checkFrozenListIndex(sprites)];
}

// 検査結果をAIへの修正依頼文に整形する。
export function buildLogicFixRequest(issues, spriteNames = []) {
  const details = issues
    .map(i => `・${i.spriteName ? `「${i.spriteName}」スプライト：` : ''}${i.message}`)
    .join('\n');
  const namesLine = spriteNames.length
    ? `\n現在のスプライト：${spriteNames.join('、')}。これらを同じ名前のままsprites[]に入れて返してください（修正のないスプライトも省略せず含める）。`
    : '';
  return `【自動修正リクエスト】\nブロックは赤くなっていませんが、組み合わせが噛み合っていない箇所が見つかりました：\n${details}${namesLine}\n\n`
    + `指摘された箇所だけを直し、それ以外は1ブロックも変えずに前回と同じ内容で返してください。`;
}
