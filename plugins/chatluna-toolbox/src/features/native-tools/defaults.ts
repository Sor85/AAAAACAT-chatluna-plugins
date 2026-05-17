/**
 * 原生工具默认元信息
 * 定义各原生工具的默认描述文案
 */

export const DEFAULT_POKE_TOOL_DESCRIPTION = "对指定用户执行戳一戳。";

export const DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION =
  "修改自己的 QQ 资料，可设置昵称、签名和性别。";

export const DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION =
  "修改机器人 QQ 头像。提供 imageUrl；HTTP/HTTPS 图片会先由 Koishi 读取并转为 OneBot base64 文件，避免临时 URL 过期或 OneBot 端无法访问。";

export const DEFAULT_SET_KOISHI_PLUGIN_MANAGER_TOOL_DESCRIPTION =
  "管理 Koishi 插件。使用方法：action 填 reload/restart/unload/remove；pluginKey 填 koishi.yml 中的插件键名，可包含实例后缀，例如 chatluna-toolbox 或 chatluna-toolbox:r0sjxj。示例：{ \"action\": \"reload\", \"pluginKey\": \"chatluna-toolbox:r0sjxj\" } 重启插件；{ \"action\": \"unload\", \"pluginKey\": \"foo\" } 关闭插件；{ \"action\": \"remove\", \"pluginKey\": \"foo\" } 移除插件配置。也可让用户直接执行 Koishi 指令 toolbox.plugin <reload|restart|unload|remove> <pluginKey>；该指令由插件内部按 commandAuthority 和 allowedUserIds 鉴权。";

export const DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION = "修改群成员的群昵称。";

export const DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION =
  "用于管理群成员禁言状态，可设置禁言时长或解除禁言。";

export const DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION =
  "对指定消息添加表情回应。";

export const DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION =
  "根据消息 ID 撤回指定消息。";
