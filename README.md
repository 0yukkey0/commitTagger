# CommitTagger

GitHub の `/commits/` ページに、各コミットに紐づくタグをバッジとして表示する Chrome 拡張機能。

## 機能

- コミット一覧ページにタグバッジをインライン表示
- バッジクリックでリリースページに遷移
- SPA ナビゲーション（ページ送り）に対応
- ダークモード対応
- タグデータを 1 時間キャッシュして API 呼び出しを最小化

## セットアップ

### 必要なもの

- Node.js 18+
- npm

### インストール

```bash
npm install
```

### 開発

HMR 付きの開発サーバーを起動し、Chrome に拡張機能を自動ロードします。

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

ビルド成果物は `.output/chrome-mv3/` に出力されます。

### zip パッケージ

```bash
npm run zip
```

## Chrome へのインストール（手動）

1. `npm run build` を実行
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `.output/chrome-mv3/` ディレクトリを選択

## 使い方

1. GitHub の任意のリポジトリで `/commits/main/` (または他のブランチ) ページを開く
2. タグが付いたコミットの横にバッジが表示される

### GitHub Personal Access Token の設定（任意）

トークンなしでもパブリックリポジトリに対して動作しますが、API レートリミットが 60 回/時間に制限されます。

- トークンを設定すると **5,000 回/時間** に引き上げられます
- **プライベートリポジトリ**にアクセスするにはトークンが必須です

#### トークンの発行方法

1. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. 「Generate new token (classic)」をクリック
3. スコープ:
   - パブリックリポジトリのみ: **スコープなし**で OK
   - プライベートリポジトリ: **`repo`** を選択
4. Organization が SSO/SAML を有効にしている場合は、発行後に **「Configure SSO」→「Authorize」** で対象 Organization を認可する

#### トークンの登録

1. ツールバーの CommitTagger アイコンをクリック
2. トークンを入力して「Save」をクリック

### キャッシュ

タグデータは chrome.storage.local に 1 時間キャッシュされます。即座に最新のタグを反映したい場合は、Popup の「Clear All Cache」ボタンでキャッシュをクリアしてください。

## 技術スタック

- [WXT](https://wxt.dev) - Chrome 拡張フレームワーク (Manifest V3)
- TypeScript (vanilla DOM)
- [@webext-core/messaging](https://webext-core.aklinker1.io/guide/messaging/) - 型安全なメッセージング

## プロジェクト構成

```
CommitTagger/
├── wxt.config.ts                          # WXT 設定
├── entrypoints/
│   ├── background.ts                      # Service Worker: API・キャッシュ管理
│   ├── github-commits.content.ts          # Content Script: DOM 操作・バッジ注入
│   ├── github-commits.content/
│   │   └── style.css                      # バッジスタイル (ダークモード対応)
│   └── popup/
│       ├── index.html                     # Popup UI
│       ├── main.ts                        # トークン管理
│       └── style.css                      # Popup スタイル
└── utils/
    ├── constants.ts                       # 定数定義
    ├── messaging.ts                       # メッセージプロトコル
    ├── cache.ts                           # TTL キャッシュ
    └── github-api.ts                      # GitHub Tags API クライアント
```
