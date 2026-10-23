<!--
  AnvilWiki 换皮配置（--config 模式）
  用法 / usage:
    pnpm apply-template --config apply-template.config.md              # 按此文件执行
    pnpm apply-template --config apply-template.config.md --dry-run   # 只打印计划，不写文件
    pnpm apply-template --init-config [path]                          # 重新生成本模板

  规则 / rules:
    - 字段格式: - **字段名**: 值 （冒号可用中文；值可加引号；行尾可写 <!-- 注释 -->）
    - 未填写的字段 = 回车 = 使用默认值（重跑时默认值 = 当前站点现值）
    - 必填字段缺失会警告但不阻塞；未知字段名会警告（防拼写错误）
    - 布尔值可用: y / yes / true / 1 / 是 或 n / no / false / 0 / 否
-->

## 基本信息

- **gameName**: Sword of Legends  <!-- 【必填】游戏全名（站点标题、SEO、manifest 都用它） -->
- **shortName**: SOL Wiki  <!-- 【可选】站点短名（PWA/浏览器标签；留空 = 自动取首字母缩写 + " Wiki"） -->
- **domain**: swordoflegends.com  <!-- 【必填】生产域名（写进 site.ts 和 wrangler.toml；没有自定义域名就填 pages.dev 子域） -->

## 文案

- **tagline**: Your home for everything Sword of Legends  <!-- 【可选】首页口号（留空 = 自动生成） -->
- **description**: Complete Sword of Legends wiki with guides, codes, tier lists, and tips. Every page carries a last-verified date.  <!-- 【必填】SEO 描述（manifest + 元数据；建议 40-165 字符） -->
- **legalNotice**: Sword of Legends Wiki is a fan-made community site. Not affiliated with or endorsed by the game developer.  <!-- 【可选】页脚法律声明（留空 = 默认 fan-made 声明） -->
- **officialUrl**: https://play.example.com  <!-- 【可选】游戏官网链接（留空 = https://example.com，建议改成真实地址） -->

## 游戏元数据

- **themeHex**: #3b82f6  <!-- 【必填】主题色 hex（网站主色 + PWA theme_color；也接受别名 themeColor） -->
- **platform**: Roblox  <!-- 【必填】游戏平台（Roblox / Steam / Mobile…） -->
- **developer**: Astral Games  <!-- 【必填】开发商 -->
- **genre**: Anime RPG  <!-- 【必填】游戏类型 -->
- **releaseDate**: 2026-05-01  <!-- 【可选】发布日期（留空 = 不写） -->

## 语言与栏目

- **locales**: en, zh  <!-- 【可选】语言列表，逗号分隔（en 必须在内，会被自动补上；支持 zh-tw / pt-br 等连字符代码） -->
- **categories**: codes, guides, tier-list, characters  <!-- 【可选】栏目列表，逗号分隔（会自动 slugify；已知栏目自动配图标，其余用通用图标） -->

## 执行选项

- **clearContent**: no  <!-- 【可选】是否清空 demo 文章内容（内容感知删除，只删 demo 身份的文件；重跑且有自己文章时慎开） -->
- **homePreset**: codes  <!-- 【可选】首页预设：codes（兑换码优先）/ guides（攻略优先）/ keep（保持现状） -->
- **clearLanding**: yes  <!-- 【可选】是否移除模板自带的 /landing 演示页（fork 用户一般移除） -->
- **confirm**: yes  <!-- 【可选】确认执行写入；no = 只打印计划不写任何文件（等价 --dry-run） -->

<!--
  执行选项默认值: clearContent=no, homePreset=codes, clearLanding=yes, confirm=yes。
  confirm=yes 时脚本会在打印计划后直接写入；想先预览用 --dry-run 或把 confirm 写成 no。
-->
