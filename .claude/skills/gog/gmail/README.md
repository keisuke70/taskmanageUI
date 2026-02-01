# gog gmail — Gmail

## コマンド構文

```
gog gmail search '<query>' --max N            # スレッド検索（Gmail検索構文）
gog gmail get <messageId>                     # メッセージ取得
gog gmail send --to "x@example.com" --subject "件名" --body "本文"  # メール送信
gog gmail send --reply-to-message-id <messageId> --reply-all --subject "Re: 元の件名" --body "本文"  # 返信
gog gmail labels list                         # ラベル一覧
gog gmail drafts list                         # 下書き一覧
gog gmail attachment <messageId> <attachmentId> --out ./file  # 添付ダウンロード
gog gmail url <threadId>                      # Gmail WebのURL取得
```

## よく使う検索クエリ

```
'is:unread'                    # 未読
'is:unread newer_than:7d'      # 過去7日の未読
'from:someone@example.com'     # 特定の送信者
'has:attachment'               # 添付付き
'subject:keyword'              # 件名で検索
```

## 返信のポイント

- `--reply-all` を使うと `--to` は不要（元のメールから自動設定）
- `--subject` は必須。`Re: 元の件名` の形式で指定する
- `--force` を付けると確認スキップ

## エイリアス

- `gog mail` / `gog email` でも動作する
