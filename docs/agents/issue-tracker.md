# Issue tracker: GitHub

本仓库的 issues 和 PRD 存放在 GitHub Issues 中。所有 issue 操作默认使用 `gh` CLI。

## 仓库

`Sor85/AAAAACAT-chatluna-plugins`

在仓库 clone 内运行 `gh` 时，优先从 `git remote -v` 推断目标仓库。

## 约定

- 创建 issue：`gh issue create --title "..." --body "..."`
- 读取 issue：`gh issue view <number> --comments`
- 列出 issue：`gh issue list --state open --json number,title,body,labels,comments`
- 评论 issue：`gh issue comment <number> --body "..."`
- 添加或移除标签：`gh issue edit <number> --add-label "..."` / `gh issue edit <number> --remove-label "..."`
- 关闭 issue：`gh issue close <number> --comment "..."`

多行正文使用 heredoc，避免 shell 转义破坏内容。

## 当 skill 说“发布到 issue tracker”

创建一个 GitHub issue。

## 当 skill 说“读取相关 ticket”

运行 `gh issue view <number> --comments`，并结合 labels 判断当前状态。
