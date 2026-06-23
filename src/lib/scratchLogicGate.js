// 決定論的ロジックゲート（意味の構文解析）。
// 赤ブロック（構文）ではなく「動かない構造」を、ブロックのテキストから機械的に検出する。
// LLMの自己レビューでは取りこぼす、実行順・ネストに起因する定番バグを対象にする：
//   1. グリッド初期化のループ内巻き込み（座標の絶対セットが繰り返しの中にあり毎回リセット
//      されて1列／1か所にしか並ばない）→ 安全なので自動でループ外へ追い出す（ホイスト）。
//   2. 当たり判定の競合（動く側が「触れた」で反射し、消える側が「触れた」で削除し、両者が
//      同じ接触を別々に判定している＝消滅が先に走ると反射が出ず貫通する）→ 自動修正は
//      方法を縛るので、壊れた形だけ検出して指摘を返し、再生成側に正しい方法を選ばせる。
//
// ネスト判定は字下げではなく `end` で行う。scratchblocks レンダラも end でネストを解釈し、
// コレクターが各行を trim 済みのため、ここでも end を唯一の根拠にする。

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── C型ブロックの開き／閉じ判定 ───────────────────────────
// ループ（繰り返し系）の開き：end が要る
function isLoopOpener(l) {
  return /回繰り返す$/.test(l) || l === 'ずっと' || /まで繰り返す$/.test(l);
}
// もし系の開き：end が要るが繰り返しではない
function isIfOpener(l) {
  return /^もし\s.*なら$/.test(l);
}
function isOpener(l) {
  return isLoopOpener(l) || isIfOpener(l);
}

// 行をネスト木にパースする。node.idx は元コード（rawLines）の行番号。
// 「でなければ」は then 本体と else 本体を分ける区切りで独自の end を持たないため、
// フレームを維持したままスキップする（then/else を同じ親の子として扱う）。
function parseTree(code) {
  const rawLines = code.split('\n');
  const roots = [];
  const stack = []; // 開いている C型ブロックのノード

  rawLines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (line === 'end') {
      if (stack.length) stack.pop();
      return;
    }
    if (line === 'でなければ') return; // 区切り：フレーム維持

    const node = { line, idx, isLoop: isLoopOpener(line), children: [] };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    if (isOpener(line)) stack.push(node);
  });

  return { roots, rawLines };
}

function walk(roots, fn) {
  for (const node of roots) {
    fn(node);
    walk(node.children, fn);
  }
}

// 部分木（子孫）のいずれかの行が pred を満たすか
function subtreeHas(node, pred) {
  for (const c of node.children) {
    if (pred(c.line)) return true;
    if (subtreeHas(c, pred)) return true;
  }
  return false;
}

// ── 検出1：グリッド初期化のループ内巻き込み ──────────────
// 座標の絶対セット（…にする）の軸
function axisOfSet(l) {
  // 連結：x座標を … 、y座標を … にする
  if (/^x座標を .*[、,].*y座標を .*にする$/.test(l)) return ['x', 'y'];
  const m = l.match(/^([xy])座標を .*にする$/);
  return m ? [m[1]] : [];
}
// 座標の相対変化（…ずつ変える）の軸
function axisOfChange(l) {
  const m = l.match(/^([xy])座標を .*ずつ変える$/);
  return m ? [m[1]] : [];
}

// 各ループの「直下の子」だけを見て、同じ軸に絶対セットと相対変化が同居していたらバグ。
// （別の階層にあるのは正しい：例＝外ループ直下で x をリセットし、内ループで x を変える）
// 返り値の hoist は「このループの外へ出すべき絶対セットのノード」。
function detectInitInLoop(tree) {
  const issues = [];
  const hoist = []; // { loop, setNode }
  walk(tree.roots, (node) => {
    if (!node.isLoop) return;
    const setNodes = new Map(); // axis -> [node...]
    const changeAxes = new Set();
    for (const c of node.children) {
      for (const a of axisOfSet(c.line)) {
        if (!setNodes.has(a)) setNodes.set(a, []);
        setNodes.get(a).push(c);
      }
      for (const a of axisOfChange(c.line)) changeAxes.add(a);
    }
    for (const [axis, nodes] of setNodes) {
      if (!changeAxes.has(axis)) continue;
      for (const sn of nodes) hoist.push({ loop: node, setNode: sn });
      issues.push(
        `${axis}座標の初期化（…にする）が繰り返しの中にあり、毎回リセットされて1列／1か所にしか並びません。初期化を繰り返しの外に出す必要があります。`
      );
    }
  });
  return { issues, hoist };
}

// ホイスト適用：対象の絶対セット行を、対応するループ開始行の直前へ移す。
function applyHoist(rawLines, hoist) {
  const insertBefore = new Map(); // loop.idx -> [行テキスト]
  const remove = new Set();
  const seen = new Set();
  for (const { loop, setNode } of hoist) {
    if (seen.has(setNode.idx)) continue;
    seen.add(setNode.idx);
    remove.add(setNode.idx);
    const indent = (rawLines[loop.idx].match(/^\s*/) || [''])[0];
    if (!insertBefore.has(loop.idx)) insertBefore.set(loop.idx, []);
    insertBefore.get(loop.idx).push(indent + rawLines[setNode.idx].trim());
  }
  const out = [];
  rawLines.forEach((line, idx) => {
    if (insertBefore.has(idx)) out.push(...insertBefore.get(idx));
    if (remove.has(idx)) return;
    out.push(line);
  });
  return out.join('\n');
}

// 単一スプライトのコードに対し、グリッド初期化のループ内巻き込みを自動修正する。
// 修正が無ければ元のコードをそのまま返す（冪等：一度外へ出すと再検出されない）。
export function hoistLoopInit(code) {
  if (!code) return code;
  if (!/繰り返す|ずっと/.test(code)) return code;
  const tree = parseTree(code);
  const { hoist } = detectInitInLoop(tree);
  if (!hoist.length) return code;
  return applyHoist(tree.rawLines, hoist);
}

// ── 検出2：当たり判定の競合（スプライト横断） ───────────────
function isReflect(l) {
  // ブロック反射：向きを変える。端での跳ね返り（端に着いたら）は壁反射なので除外。
  if (/度に向ける/.test(l)) return true;
  return /跳ね返/.test(l) && !/端に着いたら/.test(l);
}
function isRemove(l) {
  return /このクローンを削除する/.test(l) || l === '隠す';
}
// 「もし <(NAME v) に触れた> なら」か（記法ゆれを許容）
function makeTouchIf(name) {
  const re = new RegExp(`^もし\\s*<\\(\\s*${escapeRegExp(name)}\\s*v\\)\\s*に触れた>\\s*なら$`);
  return (line) => re.test(line.trim());
}
// sprite の木から「NAME に触れた」もし節を集め、その本体が pred を含むか調べる
function touchIfContains(tree, name, pred) {
  const isTouch = makeTouchIf(name);
  let found = false;
  walk(tree.roots, (node) => {
    if (found) return;
    if (isTouch(node.line) && subtreeHas(node, pred)) found = true;
  });
  return found;
}

// sprites: [{name, blocks}] を受け取り、競合形の指摘を配列で返す。
// 反射がメッセージ（受け取ったとき）側にある正しい形や、消滅側が「送って待つ」してから
// 削除する形は、動く側の「触れた→反射」が無いので検出されない（方法を縛らない）。
export function detectCollisionRace(sprites) {
  const issues = [];
  const trees = (sprites || [])
    .filter((s) => s && s.blocks)
    .map((s) => ({ name: s.name, tree: parseTree(s.blocks) }));

  for (const A of trees) {
    for (const B of trees) {
      if (A.name === B.name) continue;
      const aReflectsB = touchIfContains(A.tree, B.name, isReflect);
      const bRemovesA = touchIfContains(B.tree, A.name, isRemove);
      if (aReflectsB && bRemovesA) {
        issues.push(
          `「${A.name}」が自分の「${B.name}に触れた」判定で反射し、「${B.name}」が自分の「${A.name}に触れた」判定で消滅しています。` +
            `同じ接触を両者が別々に判定しているため、消滅が先に走ると反射が発火せず貫通します（実行順依存の競合）。` +
            `反射を「${B.name}が消える前にメッセージを送る → ${A.name}が『（メッセージ）を受け取ったとき』で向きを変える」へ分離するか、` +
            `消滅側で「（メッセージ）を送って待つ」で反射の完了を待ってから「このクローンを削除する」へ並べ替えてください。`
        );
      }
    }
  }
  return issues;
}
