# Scratteach「いっしょにつくるモード」追加仕様書 v2.1

> 対象：Claude Code  
> 作成日：2026-05-22  
> 前提：scratteach-create-mode-spec.md（v2.0）の実装が完了していること

---

## 概要

以下の3点を既存の「いっしょにつくるモード」に追加実装する。

1. 「貼り付けてください」表現の修正
2. ブロック表示前のAI内部チェック機能
3. PDF保存機能

---

## 追加1：「貼り付けてください」表現の修正

### 対象箇所
ブロック表示時にAIが出力するコメント・案内文すべて。

### 修正内容

Scratchはブロックを手動で組み立てるため、コピペを前提とした表現は不適切。
以下の対応表に従って表現を統一すること。

| ❌ 使用禁止 | ✅ 使用する表現 |
|------|------|
| 貼り付けてください | 参考に組み立ててください |
| コピーしてください | このブロックをScratchで再現してください |
| ペーストしてください | 下記を見ながらブロックを組んでください |
| 下記のブロックを貼り付けて | 下記のブロックを参考に組み立てて |

### 修正対象ファイル
- `createModePrompt.js`（システムプロンプト内の表現）
- `BlockDisplay.jsx`（ブロック表示時の案内文）

---

## 追加2：ブロック表示前のAI内部チェック機能

### 概要

ユーザーが仕様を承認した後、ブロックを表示する前にAIが自己チェックを実行する。
仕様漏れ・ロジックミス・Scratch制約違反を事前に検出して修正してからブロックを表示する。

### チェックフロー

```
ユーザー承認（「はい、作って！」）
　↓
AI内部チェック実行
（UIには「仕様を確認中です...」とローディング表示）
　↓
チェック結果をユーザーに報告
　↓
ブロック表示
```

### AI内部チェックリスト

システムプロンプトに以下を追加すること：

```
ブロック生成前に必ず以下を順番に実行すること：

■ STEP1：仕様の網羅性チェック
・決定した全仕様項目がブロックに反映されているか？
・ゲームオーバー処理は実装されているか？
・スコア計算は仕様通りか？
・初期化処理（ゲームスタート時のリセット）はあるか？
・ポーズ・再スタート処理は仕様に含まれていたか？
・不足している処理は自動補完する

■ STEP2：Scratchの制約チェック
・存在しないブロックを使っていないか？
・リスト以外のデータ構造を使っていないか？
・戻り値のある関数を使っていないか？
・Scratch 3.0の公式ブロック一覧に存在するものだけか？

■ STEP3：ロジックの整合性チェック
・無限ループになる箇所はないか？
・変数の初期化漏れはないか？
・条件分岐に抜け漏れはないか？
・スプライト間のメッセージ送受信は対応しているか？

■ STEP4：チェック結果を以下の形式でユーザーに報告してからブロックを表示する

✅ 仕様チェック完了
・全〇項目の仕様を確認しました
・（自動補完した項目があれば）〇〇を追加しました（仕様に含まれていなかったため自動補完）

では、ブロックを表示します👇
```

**重要**：AIが自動補完した項目は必ずユーザーに明示すること。

### UIの変更

`CreateModeChat.jsx` に以下を追加：

```jsx
// 承認後・ブロック表示前にローディング表示
{isChecking && (
  <div className="checking-message">
    🔍 仕様を確認中です...
  </div>
)}
```

---

## 追加3：PDF保存機能

### 概要

完成したブロックプログラムをPDF形式で保存できる。
チャット全体ではなく**ブロック表示エリアのみ**をPDF化する。

### インストール

```bash
npm install jspdf html2canvas
```

### PDF保存ボタンの配置

```
┌─────────────────────────────────┐
│  ■ フィールド管理スプライト  📄↓ │
│                                 │
│  （ブロック表示）                │
│                                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ■ プレイヤー操作スプライト  📄↓ │
│                                 │
│  （ブロック表示）                │
│                                 │
└─────────────────────────────────┘

        ［ 📄 全部まとめてPDF保存 ］
```

| ボタン | 場所 | 動作 |
|------|------|------|
| 📄↓ | 各スプライトブロックの右上 | そのスプライトのブロックのみPNG画像として保存 |
| 📄 全部まとめてPDF保存 | 全ブロックの下 | 仕様サマリー＋全スプライトをA4・複数ページのPDFで保存 |

### 実装コード

```javascript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 特定スプライトのブロックのみPNG画像として保存
const exportBlockToPNG = async (spriteId, spriteName) => {
  const element = document.getElementById(`block-display-${spriteId}`);
  const canvas = await html2canvas(element, { scale: 0.6 });
  const link = document.createElement('a');
  link.download = `scratteach-${spriteName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// 全スプライトまとめてPDF化（A4・25行前後が収まるスケール）
const exportAllToPDF = async (gameTitle) => {
  const element = document.getElementById('block-display-all');

  const canvas = await html2canvas(element, {
    scale: 0.6, // A4に25行前後が収まる縮小率
  });

  const pdf = new jsPDF('p', 'mm', 'a4'); // A4縦
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth - 20; // 左右10mmずつ余白
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 複数ページに自動分割
  let yPosition = 10;
  let remainingHeight = imgHeight;

  while (remainingHeight > 0) {
    pdf.addImage(canvas, 'PNG', 10, yPosition, imgWidth, imgHeight, '', 'FAST');
    remainingHeight -= (pageHeight - 20);
    if (remainingHeight > 0) pdf.addPage();
  }

  pdf.save(`scratteach-${gameTitle}.pdf`);
};
```

**scaleの目安**

| scale値 | A4に収まる行数（目安） |
|------|------|
| 1.0 | 約10行（大きすぎる） |
| 0.6 | 約25行 ← 採用 |
| 0.4 | 約35行（やや小さい） |

※実際のブロックサイズによって多少前後するため、実装後に実際のPDFを確認してscale値を微調整すること。

### PDFの構成内容

```
【1ページ目】
ゲーム名：〇〇ゲーム
作成日：YYYY-MM-DD
─────────────────
【決定した仕様】
・仕様項目1
・仕様項目2
...

【2ページ目以降】
■ 〇〇スプライト
　（ブロック表示）
　※このブロックを参考に組み立ててください
```

### 修正対象ファイル

- `BlockDisplay.jsx`：各スプライトブロックに📄↓ボタンを追加
- `CreateModeChat.jsx`：全体まとめPDF保存ボタンを追加

---

## 動作確認チェックリスト（追加分）

- [ ] 「貼り付けてください」という表現がどこにも表示されない
- [ ] ユーザー承認後に「仕様を確認中です...」が表示される
- [ ] チェック完了後にチェック結果が表示される
- [ ] 自動補完した項目がチェック結果に明示される
- [ ] チェック結果の後にブロックが表示される
- [ ] 各スプライトブロックの右上に📄↓ボタンが表示される
- [ ] 全体まとめPDF保存ボタンが全ブロックの下に表示される
- [ ] スプライト単体のPDF保存が正常に動作する
- [ ] 全体まとめPDF保存が正常に動作する
- [ ] PDFにゲーム名・仕様サマリー・ブロックが含まれる
