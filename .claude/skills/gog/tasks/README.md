# gog tasks — Google Tasks

## コマンド構文

```
gog tasks lists                              # タスクリスト一覧
gog tasks list <tasklistId>                  # タスク一覧（位置引数）
gog tasks get <tasklistId> <taskId>          # タスク詳細
gog tasks add <tasklistId> --title "..."     # タスク追加
gog tasks update <tasklistId> <taskId>       # タスク更新
gog tasks done <tasklistId> <taskId>         # 完了にする
gog tasks undo <tasklistId> <taskId>         # 未完了に戻す
gog tasks delete <tasklistId> <taskId>       # 削除
gog tasks clear <tasklistId>                 # 完了済みを一括削除
```

## 既知のタスクリスト

| 名前 | ID |
|---|---|
| マイタスク | `MTQyODQ0MzQ4NDExNTQwMTczODQ6MDow` |
| 日付指定 単発タスク | `SVZnZDFxX09CR19jVFl1Ng` |

## デフォルト動作

- **通常のタスク追加** → `マイタスク` (ID: `MTQyODQ0MzQ4NDExNTQwMTczODQ6MDow`) に追加。タスクリストの確認は不要。
- **「単発」と言われた場合** → `日付指定 単発タスク` (ID: `SVZnZDFxX09CR19jVFl1Ng`) に追加し、`--due` で日時を指定する。日時が不明な場合はユーザーに確認する。

## 注意

- `lists` = タスクリスト一覧、`list` = タスク一覧（紛らわしいので注意）
- タスクリストIDは位置引数。`--list` フラグではない
- タスクリスト一覧の取得は不要。上記「既知のタスクリスト」と「デフォルト動作」に従うこと
