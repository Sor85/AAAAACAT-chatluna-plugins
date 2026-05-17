# koishi-plugin-chatluna-toolbox

为 ChatLuna 提供可组合的工具能力，当前包含三类功能：

- 原生工具（Native Tools）
- XML 工具（XML Actions）
- 变量扩展（Variables）

插件目标是把常用的群聊动作能力（如戳一戳、消息表情、撤回消息）和上下文变量能力拆分为可配置模块，便于在 Koishi + ChatLuna 场景中按需启用。

## 功能概览

### 1) 原生工具
- 戳一戳
- 设置自身资料
- 设置 QQ 头像
- 设置群名片
- 给消息添加表情
- 撤回消息
- 管理 Koishi 插件（重载/停用/移除，需管理员权限）

插件管理同时提供 ChatLuna 原生工具与 Koishi 指令：

- 原生工具名默认是 `koishi_plugin_manager`，参数为 `action` 和 `pluginKey`。`action` 可选 `reload`、`restart`、`unload`、`remove`，`pluginKey` 使用 `koishi.yml` 中的插件键名，例如 `chatluna-toolbox:r0sjxj`。
- Koishi 指令为 `toolbox.plugin <reload|restart|unload|remove> <pluginKey>`，也可使用别名 `ctoolbox.plugin`。该指令会先进入插件内部鉴权，再按 `commandAuthority` 或 `allowedUserIds` 判断是否允许执行，适合给少数管理员 QQ 号直接授权。

QQ 头像工具会把 HTTP/HTTPS 图片先转为 OneBot `base64://` 文件再提交，避免 OneBot 端无法访问 Koishi 临时图片地址。

### 2) XML 工具
支持从模型输出中解析 XML 动作标签并执行：

- `<poke id="..."/>`
- `<emoji message_id="..." emoji_id="..."/>`
- `<delete message_id="..."/>`

### 3) 变量扩展
- `userInfo`
- `botInfo`
- `groupInfo`
- `random`

确保你的 Koishi 环境已安装并启用：

- `koishi-plugin-chatluna`
- （可选）`koishi-plugin-chatluna-character`

## 快速上手

### 1. 在 Koishi 配置中启用插件
在 Koishi 控制台或配置文件中添加并启用 `chatluna-toolbox`。

### 2. 打开需要的能力开关
建议先最小化启用：

- 开启一个 OneBot 协议（NapCat 或 LLBot）
- 按需开启原生工具
- 按需开启 XML 工具
- 按需配置变量项

### 3. 配置 XML 参考提示词
在 `XML 工具` 分组中找到 `参考提示词`，可直接使用默认模板，或根据你的 Bot 规则进行调整。

### 4. 构建

```bash
npm run build
```

## 开发命令

```bash
npm run typecheck
npm run build
npm run test
```

## 仓库地址

- https://github.com/Sor85/koishi-plugin-chatluna-toolbox
