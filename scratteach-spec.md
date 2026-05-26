# Scratteach（スクラッティーチ）完全仕様書
> Claude Code向け実装指示書  
> バージョン: 1.0  
> 作成日: 2026-05-13

---

## 1. プロジェクト概要

### アプリ名
- 日本語：スクラッティーチ
- 英語：Scratteach

### コンセプト
「Scratchプログラミング専用AIチャット」  
子供にScratchを教える親をサポートするアプリ。親がScratchの質問に即座に答えられるよう、AIがscratchblocksブロック表示付きで解説する。

### ターゲットユーザー
- **主ユーザー**：子供にScratchを教える親（プログラミング未経験）
- **間接ユーザー**：小学生（親を通じて恩恵を受ける）
- **親の知識レベル**：Scratchをほぼ知らない初心者

### 教育指針
計算論的思考（Computational Thinking）を養うことが目標。
- 物事を細分化して考える習慣
- 「なぜそう書くのか」の理由まで説明する
- ブロックの提示だけでなく、思考プロセスごと教える

---

## 2. 技術スタック

### フロントエンド
- **フレームワーク**：React（Vite）
- **スタイリング**：Tailwind CSS
- **PWA**：vite-plugin-pwa（Workbox）
- **ブロック表示**：scratchblocks（CDN または npm）
- **DB**：IndexedDB（idb ライブラリ推奨）

### AI API
- **プロバイダー**：Google Gemini API
- **エンドポイント**：`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **モデル1**：`gemini-3.1-flash-lite`（メイン）
- **モデル2**：`gemma-4-27b-it`（サブ／切替用）
- **APIキー**：ユーザーが設定画面で入力・localStorage保存

### PWA設定
- manifest.json：アイコン・テーマカラー設定
- Service Worker：オフラインキャッシュ（チャット履歴はIndexedDB）
- インストール可能：ホーム画面追加対応

---

## 3. ファイル構成

```
scratteach/
├── public/
│   ├── manifest.json
│   ├── icons/           # PWAアイコン各サイズ
│   └── favicon.ico
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatWindow.jsx       # メインチャット画面
│   │   │   ├── MessageBubble.jsx    # メッセージ表示（テキスト＋ブロック）
│   │   │   ├── InputBar.jsx         # 入力欄
│   │   │   └── ScratchBlockPanel.jsx # ブロック表示パネル
│   │   ├── Settings/
│   │   │   └── SettingsModal.jsx    # APIキー・モデル設定
│   │   ├── History/
│   │   │   ├── HistoryList.jsx      # 過去の会話一覧
│   │   │   └── ExportButton.jsx     # HTML/PDF出力
│   │   └── Layout/
│   │       ├── Header.jsx
│   │       └── Sidebar.jsx
│   ├── hooks/
│   │   ├── useGeminiChat.js         # Gemini API呼び出し
│   │   ├── useIndexedDB.js          # 履歴保存・取得
│   │   └── useScratchBlocks.js      # scratchblocksレンダリング
│   ├── lib/
│   │   ├── gemini.js                # API クライアント
│   │   ├── db.js                    # IndexedDB操作
│   │   ├── export.js                # HTML/PDF出力
│   │   └── systemPrompt.js          # システムプロンプト（ブロックリスト含む）
│   └── styles/
│       └── index.css
├── vite.config.js
├── package.json
└── README.md
```

---

## 4. UI・レイアウト仕様

### 基本デザイン
- Claudeライクなシンプルな縦型チャット
- カラーテーマ：Scratchのオレンジ（#FF6600）をアクセントカラーに
- フォント：読みやすさ優先（Noto Sans JP推奨）

### レスポンシブレイアウト

#### デスクトップ（768px以上）
```
┌─────────────────────────────────────────────────┐
│  Header: Scratteach ロゴ  ＋ 設定ボタン         │
├──────────┬──────────────────────┬───────────────┤
│          │                      │               │
│ 履歴     │   チャット・説明     │ ブロック表示  │
│ サイド   │   （スクロール）     │ パネル        │
│ バー     │                      │ （scratchblocks）│
│          │                      │               │
│          ├──────────────────────┤               │
│          │   入力欄             │               │
└──────────┴──────────────────────┴───────────────┘
```

#### スマホ（768px未満）
```
┌────────────────────────┐
│ Header                 │
├────────────────────────┤
│ AIの説明テキスト       │
│                        │
│ ▼ ブロックを見る       │ ← アコーディオン
│ ┌────────────────────┐ │
│ │  scratchblocks SVG │ │
│ └────────────────────┘ │
│                        │
│ ▼ なぜこう書くの？     │ ← アコーディオン
│ ┌────────────────────┐ │
│ │  理由の説明テキスト│ │
│ └────────────────────┘ │
├────────────────────────┤
│ 入力欄 ＋ 送信ボタン   │
└────────────────────────┘
```

### AIメッセージのデータ構造
AIの回答はJSON形式でパースして表示する（後述のシステムプロンプト参照）：

```javascript
{
  explanation: "説明テキスト（必須）",
  blocks: "scratchblocks記法の文字列（任意、不要な場合はnull）",
  reason: "なぜこう書くのかの説明（blocksがある場合は必須）",
  hint: "子供への伝え方ヒント（任意）"
}
```

---

## 5. 設定画面仕様

### SettingsModal の項目
1. **Gemini APIキー**
   - テキスト入力（password type）
   - 保存先：localStorage（キー名：`scratteach_api_key`）
   - 「APIキーを取得する」リンク → https://aistudio.google.com/

2. **使用モデル**
   - ラジオボタン or セレクトボックス
   - 選択肢：
     - `gemini-3.1-flash-lite`（推奨・高速）
     - `gemma-4-27b-it`（高精度）
   - 保存先：localStorage（キー名：`scratteach_model`）

3. **言語設定**（将来拡張用、現時点は日本語固定）

---

## 6. Gemini API呼び出し仕様

### リクエスト形式

```javascript
// lib/gemini.js
const callGemini = async (messages, apiKey, model) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    }
  );
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};
```

### レスポンスのパース
AIは必ずJSON形式で返答するよう指示する。
パース失敗時はテキストをそのままexplanationとして扱うフォールバック処理を実装。

```javascript
const parseAIResponse = (text) => {
  try {
    // ```json ... ``` のコードブロックを除去
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { explanation: text, blocks: null, reason: null, hint: null };
  }
};
```

---

## 7. IndexedDB仕様

### DB名：`scratteach-db`
### ストア名：`conversations`

```javascript
// 会話オブジェクト
{
  id: "uuid-v4",           // 会話ID
  title: "最初のメッセージの先頭30文字",
  createdAt: "ISO8601",
  updatedAt: "ISO8601",
  model: "gemini-3.1-flash-lite",
  messages: [
    {
      role: "user" | "assistant",
      content: "テキスト",
      parsed: { explanation, blocks, reason, hint }, // AIのみ
      timestamp: "ISO8601"
    }
  ]
}
```

---

## 8. エクスポート仕様

### HTMLエクスポート
- scratchblocksのSVGをインライン埋め込み
- スタイルもインラインで完結（外部CSSなし）
- ファイル名：`scratteach-{会話タイトル}-{日付}.html`

### PDFエクスポート
- `window.print()` ＋ print用CSSで対応（ライブラリ不要）
- または `jspdf` ＋ `html2canvas` を使用

### 共有（Web Share API）
```javascript
const share = async (htmlContent) => {
  if (navigator.share) {
    await navigator.share({
      title: 'Scratteach 会話履歴',
      text: htmlContent,
    });
  } else {
    // フォールバック：クリップボードコピー or ダウンロード
    downloadAsHTML(htmlContent);
  }
};
```

---

## 9. scratchblocks実装仕様

### 読み込み
```html
<!-- CDN（推奨） -->
<script src="https://scratchblocks.github.io/cdn/scratchblocks-v3.6-min.js"></script>
```

### レンダリング
```javascript
// useScratchBlocks.js
import { useEffect, useRef } from 'react';

export const useScratchBlocks = (code) => {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!code || !ref.current || !window.scratchblocks) return;
    
    ref.current.innerHTML = '';
    const doc = window.scratchblocks.parse(code, { languages: ['ja', 'en'] });
    const svg = window.scratchblocks.render(doc, { style: 'scratch3', scale: 1 });
    ref.current.appendChild(svg);
  }, [code]);
  
  return ref;
};
```

---

## 10. システムプロンプト（完全版）

```
src/lib/systemPrompt.js に定義すること
```

````javascript
export const SYSTEM_PROMPT = `
あなたは「スクラッティーチ」というアプリのScratchプログラミング講師です。
子供にScratchを教える親（プログラミング未経験）をサポートします。

## あなたの役割
- 親しみやすく、わかりやすい説明をする
- 中学生が理解できるレベルで説明する（親向け）
- 計算論的思考（物事を細分化して考える）を意識した説明をする
- ブロックが必要な場合は必ずscratchblocks記法で示す
- 「なぜそう書くのか」の理由まで必ず説明する

## 計算論的思考の例
「歩く」という動作を考えるとき：
- 普通の思考：足を交互に出せばいい
- プログラミング思考：右足を前に30cm踏み出す→体重を右足に乗せる→左足を60cm前に移動する...
このように細分化して考えることを教える。

## 回答フォーマット（必須）
必ず以下のJSON形式のみで回答すること。マークダウンや説明文を前後に付けないこと。

\`\`\`json
{
  "explanation": "説明テキスト。親しみやすい言葉で。改行は\\nを使う。",
  "blocks": "scratchblocks記法のコード（不要な場合はnull）",
  "reason": "なぜこのブロックを使うのか、どう考えるのかの説明（blocksがnull以外の場合は必須）",
  "hint": "子供への伝え方のヒント（任意、あると良い場合のみ）"
}
\`\`\`

## scratchblocks記法のルール
- ブロックは必ず正確な記法で書くこと
- 存在しないブロックは絶対に作らないこと
- わからない場合は blocks を null にして、その旨をexplanationで伝えること

## Scratch 3.0 正式ブロック一覧（このリストにないブロックは使用禁止）

### 【動き】18ブロック
\`\`\`
move (10) steps
turn cw (15) degrees
turn ccw (15) degrees
go to (random position v)
go to x: (0) y: (0)
glide (1) secs to (random position v)
glide (1) secs to x: (0) y: (0)
point in direction (90)
point towards (mouse-pointer v)
change x by (10)
set x to (0)
change y by (10)
set y to (0)
if on edge, bounce
set rotation style [left-right v]
(x position)
(y position)
(direction)
\`\`\`

### 【見た目】20ブロック
\`\`\`
say [Hello!] for (2) seconds
say [Hello!]
think [Hmm...] for (2) seconds
think [Hmm...]
switch costume to (costume1 v)
next costume
switch backdrop to (backdrop1 v)
next backdrop
change size by (10)
set size to (100) %
change [color v] effect by (25)
set [color v] effect to (0)
clear graphic effects
show
hide
go to [front v] layer
go [forward v] (1) layers
(costume [number v])
(backdrop [number v])
(size)
\`\`\`

### 【音】9ブロック
\`\`\`
play sound (Meow v) until done
start sound (Meow v)
stop all sounds
change [pitch v] effect by (10)
set [pitch v] effect to (100)
clear sound effects
change volume by (-10)
set volume to (100) %
(volume)
\`\`\`

### 【イベント】8ブロック
\`\`\`
when green flag clicked
when [space v] key pressed
when this sprite clicked
when backdrop switches to (backdrop1 v)
when [loudness v] > (10)
when I receive [message1 v]
broadcast (message1 v)
broadcast (message1 v) and wait
\`\`\`

### 【制御】11ブロック
\`\`\`
wait (1) seconds
repeat (10)
end
forever
if <> then
if <> then
else
end
wait until <>
repeat until <>
end
stop [all v]
when I start as a clone
create clone of (myself v)
delete this clone
\`\`\`

### 【調べる】18ブロック
\`\`\`
touching (mouse-pointer v) ?
touching color [#ff0000] ?
color [#ff0000] is touching [#0000ff] ?
(distance to (mouse-pointer v))
ask [What's your name?] and wait
(answer)
key (space v) pressed?
mouse down?
(mouse x)
(mouse y)
set drag mode [draggable v]
(loudness)
(timer)
reset timer
(current [year v])
(days since 2000)
(username)
\`\`\`

### 【演算】18ブロック
\`\`\`
(() + ())
(() - ())
(() * ())
(() / ())
(pick random (1) to (10))
(() < ())
(() = ())
(() > ())
<() and ()>
<() or ()>
<not ()>
(join [hello ] [world])
(letter (1) of [world])
(length of [world])
(() contains [a]?)
(() mod ())
(round ())
([abs v] of (0))
\`\`\`

### 【変数】12ブロック
\`\`\`
set [my variable v] to (0)
change [my variable v] by (1)
show variable [my variable v]
hide variable [my variable v]
add [thing] to [my list v]
delete (1) of [my list v]
delete all of [my list v]
insert [thing] at (1) of [my list v]
replace item (1) of [my list v] with [thing]
(item (1) of [my list v])
(item # of [thing] in [my list v])
(length of [my list v])
[my list v] contains [thing] ?
show list [my list v]
hide list [my list v]
\`\`\`

### 【ブロック定義（My Blocks）】
\`\`\`
define ブロック名
\`\`\`

## 回答例

ユーザー：「ネコを動かすにはどうすればいい？」

回答：
\`\`\`json
{
  "explanation": "ネコ（スプライト）を動かすには「動き」カテゴリのブロックを使います。\\nまず「緑の旗が押されたとき」からスタートして、「〇歩動かす」ブロックをつなげるのが基本です。",
  "blocks": "when green flag clicked\\nmove (10) steps",
  "reason": "プログラムは「いつ動くか（きっかけ）」と「何をするか（命令）」の2つがセットで必要です。\\n緑の旗クリック→10歩動かす、という順番で細分化して考えましょう。",
  "hint": "「ロボットに指示を出すとき、『スタート！』という合図と『右に歩け』という命令をセットで言うよね？それと同じだよ」と伝えると伝わりやすいです。"
}
\`\`\`
`;
````

---

## 11. 実装の優先順位（Phase 1）

### Must（必須）
1. Gemini APIとの接続・チャット送受信
2. systemPrompt.jsのブロックリスト込みプロンプト
3. AIレスポンスのJSONパース
4. scratchblocksレンダリング（ブロック表示）
5. デスクトップ2カラム / スマホアコーディオンレイアウト
6. 設定画面（APIキー・モデル切替）
7. IndexedDBへの履歴保存・一覧表示

### Should（できれば）
8. HTMLエクスポート ＋ Web Share API
9. PDFエクスポート（print CSS）
10. PWAマニフェスト ＋ Service Worker

### Could（余裕があれば）
11. よくある質問ボタン（定型質問をワンタップ送信）
12. 会話タイトルの自動生成
13. ダークモード

---

## 12. 注意事項・実装上のポイント

### scratchblocks
- CDNで読み込む場合、`window.scratchblocks`が使えるようになるまで待つこと
- Reactのuseeffect内でレンダリングすること
- SVGは横幅いっぱいに表示されるようスタイル調整すること

### Gemini API
- APIキーが未設定の場合、チャット送信前に設定画面を促すこと
- エラーハンドリング：401（APIキー不正）、429（レート制限）を個別にハンドル
- レート制限に達した場合、もう一方のモデルへの切替を提案するメッセージを表示

### IndexedDB
- idbライブラリ（`npm install idb`）を使うと実装が楽
- 会話IDはcrypto.randomUUID()で生成

### PWA
- iOSのSafariは7日間未使用でIndexedDBが削除されるリスクあり
- 設定画面に「会話履歴をバックアップ（JSON）」機能を追加推奨

---

## 13. package.json（参考）

```json
{
  "name": "scratteach",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "idb": "^8.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "vite": "^5.x",
    "vite-plugin-pwa": "^0.20.x",
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

---

## 14. Claude Codeへの指示

上記仕様に従い、以下の順番で実装してください：

1. `npm create vite@latest scratteach -- --template react` でプロジェクト作成
2. 必要パッケージのインストール
3. `src/lib/systemPrompt.js` を最初に作成（ブロックリスト込み）
4. `src/lib/gemini.js` でAPI呼び出し実装
5. `src/lib/db.js` でIndexedDB操作実装
6. コンポーネントを上から順に実装
7. レスポンシブレイアウトの確認
8. PWA設定
9. 動作確認・エラーハンドリング確認

**デザイン方針**：
- Scratchのオレンジ（#FF6600）をアクセントカラーに使用
- 清潔感のある白ベース
- 子供っぽすぎず、親が安心して使えるプロフェッショナルな印象
- scratchblocksのSVGが映えるよう、背景は薄いグレー（#F5F5F5）
