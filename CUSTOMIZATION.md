# カスタマイズガイド

Claude Code を使ってこのアプリを簡単にカスタマイズできます。

## UI カスタマイズ

### 配色変更

Tailwind CSS を使用。カラースキームの変更例:

```
「メインカラーを青から紫に変えて」
「ヘッダーをダークモードにして」
「もっと暖かい色調にして」
```

### 新しいビュー追加

```
「週次レビューのサマリービューを追加して」
「今日のトップ3タスクだけ表示するフォーカスモードを作って」
「ポモドーロタイマーパネルを追加して」
```

### タスク表示の変更

```
「タスクのメモをデフォルトで展開表示して」
「タスクに優先度レベルを追加して」
「ドラッグ&ドロップでタスクを並べ替えられるようにして」
```

## 機能追加

### 新しいデータソース

`server/services/` に新しいサービスを追加:

```
「Todoist も Google Tasks と一緒に使えるようにして」
「Notion データベースと連携して」
「GitHub Issues をタスクとして取り込んで」
```

### AI 機能強化

`server/services/claude.ts` や `server/services/suggestions.ts` を変更:

```
「締め切りに基づいてタスクの優先度を提案して」
「週間計画を AI で自動生成して」
「提案の精度を上げて」
```

### 新機能

```
「繰り返しタスクに対応して」
「タスクテンプレートを実装して」
「タスクに時間トラッキングを追加して」
「タスクの依存関係を作れるようにして」
```

## Claude Code スキル

`~/.claude/skills/today-tasks/SKILL.md` を編集:

```
「/today-tasks でカレンダーイベントも表示するようにして」
「完了タスクを非表示にする /focus-mode スキルを追加して」
「/weekly-review スキルを作って」
```

## アーキテクチャ変更

### バックエンド

```
「Redis キャッシュを追加して」
「WebSocket でリアルタイム更新を実装して」
「認証ミドルウェアを追加して」
```

### フロントエンド

```
「Service Worker でオフライン対応して」
「キーボードショートカットを追加して」
「PWA として使えるようにして」
```

## 効果的なカスタマイズのコツ

1. **具体的に**: 「改善して」ではなく「今日のタスクを全部完了にするボタンを追加して」

2. **ファイルを指定**: 「TaskItem.tsx に優先度ドロップダウンを追加して」

3. **動作を説明**: 「タスクをクリックしたら詳細と編集オプションのモーダルを表示して」

4. **小さく始める**: 小さな変更から始めて、テストしてから追加

## ファイルクイックリファレンス

| 変更したいもの | 編集ファイル |
|--------------|-------------|
| タスクリスト表示 | `src/components/TaskPanel.tsx` |
| 個別リスト列 | `src/components/TaskListColumn.tsx` |
| 単一タスク項目 | `src/components/TaskItem.tsx` |
| カレンダー表示 | `src/components/CalendarView.tsx` |
| イベント作成モーダル | `src/components/EventCreateModal.tsx` |
| AIチャットUI | `src/components/AiChatSidebar.tsx` |
| AI入力欄 | `src/components/AiInput.tsx` |
| 提案パネル | `src/components/SuggestionsPanel.tsx` |
| 複数リスト管理 | `src/hooks/useMultiListTasks.ts` |
| カレンダー管理 | `src/hooks/useCalendar.ts` |
| AIチャット状態 | `src/hooks/useAiChat.ts` |
| 提案管理 | `src/hooks/useSuggestions.ts` |
| タスクAPI | `server/routes/tasks.ts` |
| カレンダーAPI | `server/routes/calendar.ts` |
| AIチャットAPI | `server/routes/ai.ts` |
| 提案API | `server/routes/suggestions.ts` |
| Google連携 | `server/services/gog.ts` |
| Claude連携 | `server/services/claude.ts` |
| AI提案エンジン | `server/services/suggestions.ts` |
| Claude Codeスキル | `~/.claude/skills/today-tasks/SKILL.md` |
