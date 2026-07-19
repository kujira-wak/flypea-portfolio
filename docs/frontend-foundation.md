# Framed Signal frontend foundation

flypea.techは、趣味と制作を同じ目録で辿る静的な個人アーカイブです。Projectsは重要な一部ですが、サイト全体の主役にはしません。

## 公開ルート

- `/`: 現在のSignal、Featured Project、最近の項目、Topic/Shelf/Technologyへの入口
- `/index/`: Projects、Notes、Shelfの横断目録と複合フィルター
- `/index/{type|topic|technology|status}/{slug}/`: JavaScriptなしで使える分類別目録
- `/projects/` と `/projects/{id}/`: 制作、OSS、Webサイト、実験
- `/notes/` と `/notes/{id}/`: 技術と趣味を含む記録、リアクション
- `/shelf/` と `/shelf/{id}/`: 好きなものと使用中のもの
- `/about/`: 興味、活動、技術、外部リンク
- `/admin/reactions/`: noindexのリアクション集計画面

旧 `/works/`、`/log/`、`/profile/` はAstro fallbackとCloudflare Bulk Redirectで新URLへ301転送します。

## データと責務

- Projects: `src/content/projects/*.md`
- Notes: `src/content/notes/*.md`
- Shelf: `src/content/shelf/*.md`
- taxonomyの編集元: `src/data/taxonomy.json`（`src/data/taxonomy.ts` が型付きで公開）
- Current Signal: `src/data/signals.ts`
- Aboutの編集元: `src/data/about.json`（`src/data/about.ts` が検証して公開）
- 共通Index型: `src/lib/content-index.ts`
- デザイントークン: `src/styles/global.css` の `@theme static`

各コンテンツは `type`、`topics`、`technologies`、`status` を分離します。技術名はプロフィール用バッジではなく、関連Projects/Notesへ移動する索引です。

## Progressive enhancement

ページ本文、一覧、分類リンク、ナビゲーションは静的HTMLです。ブラウザJavaScriptはIndex/NotesフィルターとNotesリアクションだけに限定します。API障害時も本文は閲覧できます。

## Privacy

Aboutやコンテンツには、居住地、年齢、学校、学年、住所、生年月日など本人の特定につながる情報を掲載しません。

公開前は `npm run verify` を実行します。
