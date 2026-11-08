# プロジェクト専用スキル

繰り返し使う作業手順をまとめた、プロジェクト専用Skillの保存先です。

実体は `.agents/skills/` にあり、`.codex/skills` はこのフォルダへのシンボリックリンクです。どちらから編集しても同じファイルを変更します。

## 登録済みSkill

| Skill | 用途 |
| --- | --- |
| [receipt-feature](receipt-feature/SKILL.md) | レシート機能の追加・修正で、DB・Go API・Next.js画面の変更箇所と必要な回帰検証を整理する |

呼び出し例: `$receipt-feature レシートの検索機能を追加して`。依頼に該当するときは自動選択の対象にもなります。

## 追加・更新の方針

- 再利用する具体的な手順が固まったら、`<skill-name>/SKILL.md` を作成してください。
- `SKILL.md` の先頭にはYAML front matterで `name` と `description` を記載し、どの作業で使うかを明確にしてください。
- 共通ルールは `.codex/AGENTS.md` を参照し、重複した規則を増やさないでください。
- 実装で手順やコマンドが変わったら、関係するスキルと補助資料も更新してください。
- 作成・更新後は形式と参照先を確認し、スクリプトがあれば必要な動作確認を行ってください。
- スキルが認識されない場合はCodexを再起動して確認してください。

公式資料: https://learn.chatgpt.com/docs/build-skills
