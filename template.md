<!-- ============================================================
  AnvilWiki apply-template 配置模板（template.md）

  用法：
    pnpm apply-template --config template.md --dry-run   ← 先预览，不写任何文件
    pnpm apply-template --config template.md             ← 确认无误后真正执行

  规则：
  - 字段写法：key: value（行尾 <!-- --> 是注释，会被忽略）
  - 带【必填】的 7 项缺省会警告；其余留空 = 使用站点当前默认值
  - 只改 value，不要改字段名；不需要的字段可整行删除
============================================================ -->

## 基本信息

gameName: My Awesome Game            <!-- 【必填】游戏名，站点标题主词 -->
shortName: MAG                       <!-- 【可选】短名，超长标题时用 -->
domain: mygame.example.com           <!-- 【必填】正式域名（不带 https://），决定 SITE_URL / sitemap / IndexNow -->
tagline: 一句话介绍你的游戏          <!-- 【可选】落地页副标题 -->
description: 用两三句话说明游戏玩法、特色和本 wiki 覆盖的内容，150 字符左右，会进 SEO 描述。 <!-- 【必填】SEO 描述 -->
legalNotice:                         <!-- 【可选】页脚免责声明，留空用默认 -->
officialUrl: https://store.steampowered.com/app/000 <!-- 【可选】官网/商店链接，页脚 Play Game 指向这里 -->

## 主题

themeHex: #7c3aed                    <!-- 【必填】品牌主色（hex），自动换算 HSL 写入 globals.css，并影响封面生成 -->

## 游戏元数据

platform: PC                         <!-- 【必填】平台，如 PC / Mobile / Console / PC, Mobile -->
developer: Studio Name               <!-- 【必填】开发商名 -->
genre: RPG                           <!-- 【必填】类型，如 RPG / Survival / Tower Defense -->
releaseDate: 2025-06-01              <!-- 【可选】发行日期 -->

## 语言与栏目

locales: en, zh                      <!-- 【可选】站点语言，逗号分隔（en/ja/zh/zh-tw/pt-br…），留空 = en -->
categories: codes, guides, tier-list, characters <!-- 【可选】导航栏目，逗号分隔；留空 = codes, guides -->

## 执行选项

clearContent: n                      <!-- 【可选】y=删除 demo 文章（默认 n；重跑时你的文章会保留） -->
homePreset: codes                    <!-- 【可选】首页预设：codes / guides / keep（默认 codes） -->
clearLanding: y                      <!-- 【可选】y=删除模板营销页 /landing（默认 y，正式站应删） -->
confirm: y                           <!-- 【可选】执行确认，非交互默认 y；写 n 会在最后一步退出 -->
