---
"koishi-plugin-chatluna-meme-generator": patch
---

修复 meme.list 图片模式在 QQ 等客户端里模糊的问题：按设备像素比高密度出图（布局宽度 1200 CSS px、2 倍渲染），避免整图被客户端缩放后文字挤成 0.67% 宽而糊成一团。新增 `memeListImageMode` 配置：默认合成单张长图，可切换为按页高拆成多张图片；多张图片在开启 `sendMemeListAsForward` 时以 OneBot 合并转发发送，转发失败或关闭时在同一条消息里发送全部图片。
