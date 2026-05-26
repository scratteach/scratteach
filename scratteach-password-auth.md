# Scratteach パスワード認証機能 実装指示書（詳細版）

> 対象：Claude Code  
> 作成日：2026-05-22

---

## 概要

ScratchteachのPWAトップページにパスワード認証画面を追加する。

- NOTEの月額メンバーシップ加入者に毎月パスワードを配布
- 12ヶ月分のパスワードをSHA-256ハッシュ値としてアプリ内に事前登録済み
- 毎月1日に自動でパスワードが切り替わる
- コード内に生のパスワードは含めない（ハッシュ値のみ保持）
- 同月中は再認証不要（localStorageでセッション管理）

---

## パスワード管理仕様

### passwords.js（新規作成）

以下のファイルをそのまま `src/data/passwords.js` として作成すること。

```javascript
// src/data/passwords.js
// パスワードはSHA-256でハッシュ化済み。生のパスワードはここに含まれない。
// 月番号（1〜12）をキーとしたハッシュ値のマップ

const MONTHLY_PASSWORD_HASHES = {
  1:  "2dd4d531075a096efaa5eb2020e05d33eee7703fc7e86832d899e81071d3d4ed",
  2:  "52bf2ecb1398153e51f0662eb59ae7fb97cfd70245637db87612fa4f94c8bd3c",
  3:  "0b1fd34a233b4eb14f1c41f984e838a8aa1b256c3398ae528c464d13ac7d4794",
  4:  "cc80fdd37595a320fca01c1c4001faf81d0b8d9ea359656f26034f857c7e609e",
  5:  "11a235e499652aff609e7b3d9322937b78b2f7364658ac4c0ba2c2ca8df6b3b7",
  6:  "8e9dbc6bd5e683d0460b19d0d12f40e6e8a88f6cffc76f520ccf031eba0b3592",
  7:  "07733ab374daa50a97f501a7bc86df0e7ca558a76c3bd6b9cf4a789e691261c3",
  8:  "235d4a00371b0d860ac47ab7710de7f919ee3c97794df3d776c9c5aaa7d4cc87",
  9:  "c5f7882abd1f738e5e976f74f81552b216d302fd417e4b8707e348f91df0afd3",
  10: "39ec4c111c59e4f19203a197b662aa0d7a83306bce4e007b5874f213038736c5",
  11: "eea9979ea39456c3b37213a349a032fd553c23b321cac4cdd18c302db16d4c62",
  12: "123fa80868d5a5fc3a1b15af42b323fd6e373e1a053c1bfcadaed1c94241f899",
};

export default MONTHLY_PASSWORD_HASHES;
```

---

## 認証フロー

```
アプリ起動
　↓
localStorageに当月の認証情報があるか確認
　↓
【ある場合】→ アプリ本体を表示（パスワード入力スキップ）
【ない場合】→ パスワード入力画面を表示
　↓
ユーザーがパスワードを入力して「はじめる」をタップ
　↓
入力値をSHA-256でハッシュ化（Web Crypto API使用）
　↓
当月のハッシュ値と照合
　↓
【一致】→ localStorageに認証情報を保存 → アプリ本体へ遷移
【不一致】→ エラーメッセージ表示 → NOTEへの誘導リンクを表示
```

---

## セッション管理仕様

### localStorageに保存する値

```json
{
  "scratteach_auth": {
    "authenticated": true,
    "month": "2026-05"
  }
}
```

### セッションの確認ロジック

```javascript
const checkSession = () => {
  const stored = localStorage.getItem('scratteach_auth');
  if (!stored) return false;
  const { authenticated, month } = JSON.parse(stored);
  const currentMonth = new Date().toISOString().slice(0, 7);
  return authenticated && month === currentMonth;
};
```

### セッションの保存ロジック

```javascript
const saveSession = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  localStorage.setItem('scratteach_auth', JSON.stringify({
    authenticated: true,
    month: currentMonth
  }));
};
```

---

## パスワード照合ロジック

```javascript
// SHA-256ハッシュ化関数（Web Crypto API使用・ブラウザネイティブ）
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 認証処理
const authenticate = async (inputPassword) => {
  const currentMonth = new Date().getMonth() + 1; // 1〜12
  const expectedHash = MONTHLY_PASSWORD_HASHES[currentMonth];
  const inputHash = await hashPassword(inputPassword);
  return inputHash === expectedHash;
};
```

---

## UI仕様

### パスワード入力画面（PasswordGate.jsx）

**レイアウト**
- 全画面表示（アプリ本体は背後に表示しない）
- 背景：オレンジ→薄いピーチへのグラデーション（アイコンと同じカラー）
- 中央にカード型のフォームを配置（白・角丸・影あり）

**カード内の構成（上から順に）**

```
① スクラ＋テチのアイコン画像
② "Scratteach"（大きめタイトル・オレンジ）
③ "スクラッティーチ"（小さめ・グレー）
④ "今月のパスワードを入力してください"（ラベル）
⑤ パスワード入力フィールド（type="password"）
⑥ "はじめる"ボタン（オレンジ・角丸・全幅）
⑦ エラーメッセージ（不正解時のみ表示・赤字）
⑧ NOTEへの誘導リンク（不正解時のみ表示）
```

**カラー定義**

| 要素 | カラー |
|------|------|
| 背景グラデーション開始色 | #FF8C00 |
| 背景グラデーション終了色 | #FFCBA4 |
| ボタン背景 | #FF8C00 |
| ボタンテキスト | #FFFFFF |
| タイトル | #FF8C00 |
| エラーメッセージ | #E53E3E |
| カード背景 | #FFFFFF |

**表示テキスト**

| 要素 | テキスト |
|------|------|
| タイトル | Scratteach |
| サブタイトル | スクラッティーチ |
| 入力ラベル | 今月のパスワードを入力してください |
| ボタン | はじめる |
| エラー文 | パスワードが違います |
| 誘導文 | NOTEメンバーシップに加入するとパスワードを受け取れます |
| NOTEリンクテキスト | NOTEメンバーシップはこちら → |

**インタラクション**
- 入力フィールドはtype="password"（文字を隠す）
- Enterキーでも認証実行できるようにする
- 認証中はボタンを非活性にしてローディング表示
- 不正解時は入力フィールドをクリアしてフォーカスを戻す
- 正解時はフェードアウトでアプリ本体へ遷移

---

## 実装ファイル構成

```
src/
├── components/
│   └── PasswordGate.jsx     # 新規作成：パスワード入力画面
├── data/
│   └── passwords.js         # 新規作成：月次ハッシュ値配列（上記をそのまま使用）
├── App.jsx                  # 修正：PasswordGateを最初に表示
└── App.css                  # 修正：グラデーション背景を追加
```

---

## App.jsx の修正要件

```javascript
import { useState, useEffect } from 'react';
import PasswordGate from './components/PasswordGate';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('scratteach_auth');
    if (stored) {
      const { authenticated, month } = JSON.parse(stored);
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (authenticated && month === currentMonth) {
        setIsAuthenticated(true);
      }
    }
    setIsChecking(false);
  }, []);

  if (isChecking) return null;

  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    // 既存のアプリ本体をここに配置
  );
}
```

---

## NOTE誘導リンク

```
https://note.com/scratteach/membership
```

※URLが確定次第差し替える

---

## 動作確認チェックリスト

- [ ] アプリ起動時にパスワード入力画面が表示される
- [ ] 正しいパスワードを入力するとアプリ本体に遷移する
- [ ] 間違ったパスワードを入力するとエラーメッセージが表示される
- [ ] 正解後にリロードしてもパスワード入力画面が表示されない（同月中）
- [ ] 月が変わると再度パスワード入力画面が表示される
- [ ] Enterキーで認証が実行される
- [ ] スマホ・タブレット・PCで表示が崩れない
- [ ] PWAとしてホーム画面に追加した状態でも正常に動作する
