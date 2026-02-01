# AI Tasks

Google Workspace (Tasks / Calendar / Gmail) と Claude Code を統合した、AIネイティブなタスク管理アプリ。

## 機能

- **タスク管理**: Google Tasks と同期。複数リストをKanban風に並列表示
- **カレンダー統合**: Google Calendar のイベントを日/週ビューで表示
  - ドラッグで時間範囲を選択 → イベント作成
  - イベントをドラッグ&ドロップで時間変更
  - イベントをワンクリックでタスクに変換
  - カレンダーパネルの折りたたみ
- **AIチャット**: 自然言語でタスク作成（「明日レポート提出」→ 自動でタスク化）
- **AI提案**: Gmail未読・今後の予定を分析し、タスクを提案
- **Claude Code連携**: `/today-tasks` スキルでCLIから直接起動

## クイックスタート

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く。

## アーキテクチャ

```
React (localhost:5173)
    ↓
Express (localhost:3001)
    ↓
┌─────────────────┐
│ gog CLI         │ → Google Tasks / Calendar / Gmail
│ claude CLI      │ → AI タスク抽出・提案
└─────────────────┘
```

## 必要環境

- Node.js 18+
- gog CLI（`~/.gog_env` 設定済み）
- claude CLI（Claude Code）

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | フロント + バックエンド同時起動 |
| `npm run dev:frontend` | Vite のみ起動 |
| `npm run dev:backend` | Express のみ起動 |
| `npm run build` | 本番ビルド |

## プロジェクト構成

```
src/
├── components/           # React コンポーネント
│   ├── TaskPanel.tsx        # タスク列コンテナ
│   ├── TaskListColumn.tsx   # 個別リスト列
│   ├── TaskItem.tsx         # タスク1件
│   ├── CalendarView.tsx     # カレンダー表示
│   ├── EventCreateModal.tsx # イベント作成モーダル
│   ├── AiChatSidebar.tsx    # AIチャットモーダル
│   ├── AiInput.tsx          # AI入力
│   └── SuggestionsPanel.tsx # 提案パネル
├── hooks/                # カスタムフック
│   ├── useMultiListTasks.ts # 複数リスト管理
│   ├── useCalendar.ts       # カレンダー管理
│   ├── useAiChat.ts         # AIチャット状態
│   └── useSuggestions.ts    # 提案管理
├── api/
│   └── client.ts         # Express API クライアント
└── types/
    └── index.ts          # 型定義

server/
├── routes/               # API エンドポイント
│   ├── tasks.ts             # /api/tasks/*
│   ├── calendar.ts          # /api/calendar/*
│   ├── ai.ts                # /api/ai/*
│   └── suggestions.ts       # /api/suggestions/*
└── services/             # ビジネスロジック
    ├── gog.ts               # gog CLI ラッパー
    ├── claude.ts            # Claude CLI ラッパー
    └── suggestions.ts       # AI提案エンジン
```

## Claude Code 連携

CLIから起動:
```
/today-tasks
```

AIチャットでタスク作成:
- 「明日レポート提出」
- 「今週中に会議資料作成」
- 「来週の月曜までにレビュー」

## License

MIT

# test


