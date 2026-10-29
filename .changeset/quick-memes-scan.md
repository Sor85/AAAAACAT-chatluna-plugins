---
"koishi-plugin-chatluna-meme-generator": patch
---

修复 meme.list 图片模式在 QQ 等客户端里模糊的问题：按设备像素比高密度出图（布局宽度 1200 CSS px、2 倍渲染），超长列表按页高自动分页并逐张发送，避免整图被客户端缩放后文字挤成 0.67% 宽而糊成一团。
