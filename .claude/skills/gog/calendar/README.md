# gog calendar — Google Calendar

## コマンド構文

```
gog calendar calendars                                    # カレンダー一覧
gog calendar events [<calendarId>] --max N                # イベント一覧
gog calendar event <calendarId> <eventId>                 # イベント詳細
gog calendar create <calendarId> --title "..." --start "2026-01-30T10:00" --end "2026-01-30T11:00"
gog calendar update <calendarId> <eventId>                # イベント更新
gog calendar delete <calendarId> <eventId>                # イベント削除
gog calendar search <query>                               # イベント検索
gog calendar freebusy <calendarIds>                       # 空き状況
gog calendar conflicts                                    # 競合検出
gog calendar respond <calendarId> <eventId>               # 招待に応答
gog calendar focus-time --from=STRING --to=STRING          # フォーカスタイム作成
gog calendar out-of-office --from=STRING --to=STRING       # 不在イベント作成
```

## 注意

- `events` でカレンダーIDを省略すると全カレンダーから取得
- エイリアス: `event` = `get`、`events` = `list`
