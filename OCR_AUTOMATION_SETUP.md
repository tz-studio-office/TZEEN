# OCR automation setup

Cloudflare Pages > Settings > Variables and Secrets に以下を追加してください。

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- 任意: `OPENAI_OCR_MODEL` (`gpt-4.1-mini` 推奨)

## 必須の前提

- Bindings に `MATERIAL_BUCKET -> tzeen-materials`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 使い方

1. Coach が `/materials` で教材を追加
2. 画像をアップロード
3. 各ファイルの `OCRを実行` を押す
4. `vocabulary_entries` に抽出結果が保存される

## 注意

- この版は画像ページ向けです。PDF はまだ未対応です。
- OCR 抽出結果は自動保存されますが、Coach 確認画面を次に追加するのが安全です。
