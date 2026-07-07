/**
 * 插件入口
 * 导出插件元信息和 apply 函数
 */

export { name, inject, ConfigSchema as Config } from "./schema";
export { apply } from "./plugin";

export * from "./types";
export * from "./constants";
export * from "./utils";
export * from "./helpers";
export * from "./models";
export * from "./services";
export * from "./renders";
export * from "./commands";
export * from "./integrations";
export {
  ConfigSchema,
  AffinitySchema,
  BlacklistSchema,
  RelationshipSchema,
  NativeToolSettingsSchema,
  OtherSettingsSchema,
} from "./schema";
export const usage = `
## 使用说明

首次使用前请先阅读 [readme.md](https://github.com/Sor85/AAAAACAT-chatluna-plugins/blob/main/plugins/chatluna-affinity/readme.md)，按文档完成依赖安装、\`scopeId\` 配置、变量注入和 XML 工具接入。

按你的使用入口选择对应指南：

- 使用 ChatLuna Character：查看 [ChatLuna Character 接入指南](https://github.com/Sor85/AAAAACAT-chatluna-plugins/blob/main/plugins/chatluna-affinity/docs/character-prompt-guide.md)
- 使用 ChatLuna 主插件：查看 [ChatLuna 主插件接入指南](https://github.com/Sor85/AAAAACAT-chatluna-plugins/blob/main/plugins/chatluna-affinity/docs/chatluna-plugin-guide.md)
`;
