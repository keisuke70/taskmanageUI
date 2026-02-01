# gog drive — Google Drive

## コマンド構文

```
gog drive ls                                  # ルートのファイル一覧
gog drive ls --parent <folderId>              # 特定フォルダの中身
gog drive search '<query>'                    # 全文検索
gog drive get <fileId>                        # ファイルメタデータ
gog drive download <fileId> --out ./file      # ダウンロード
gog drive upload <localPath>                  # アップロード
gog drive mkdir <name>                        # フォルダ作成
gog drive delete <fileId>                     # ゴミ箱へ
gog drive move <fileId> --to <folderId>       # 移動
gog drive rename <fileId> <newName>           # リネーム
gog drive share <fileId>                      # 共有設定
gog drive permissions <fileId>                # 権限一覧
gog drive url <fileId>                        # Web URL取得
```

## 検索クエリ例

```
"mimeType='application/pdf'"              # PDFのみ
"name contains 'report'"                  # 名前に含む
"modifiedTime > '2026-01-01'"             # 更新日で絞る
```
