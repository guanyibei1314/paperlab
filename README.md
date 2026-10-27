# 纸上实验室 · 物理第一册《运动的理由》

**在线访问：https://guanyibei1314.github.io/paperlab/**（每一课可以直接用 `#l1` … `#l8` 打开，例如 `…/paperlab/#l3`）

一本摊在书桌上的 3D 立体物理书。左页是课文（预测 → 掀开"为什么" → 页边挑战 → 盖章），右页的铅笔排线插图会从纸上立起来，变成可以动手的实验。8 课讲完牛顿三大定律，最后用一个牛顿摆收尾。

| 课 | 实验 | 对应教材 |
|---|---|---|
| 1 力有多大 | 弹簧测力计、钩码，可切换到月球 | 人教版八下 第七章《力》 |
| 2 越滑越远 | 斜面小车：毛巾 / 棉布 / 木板 / 无阻力 | 八下 8.1、必修一 4.1 |
| 3 惯性 | 硬币、卡片和杯子（真实摩擦耦合，慢镜头） | 八下 8.1 |
| 4 二力平衡 | 两侧滑轮钩码，推一下看匀速运动 | 八下 8.2、必修一 3.5 |
| 5 力改变运动 | 打点计时器纸带，自动生成 a–F 图 | 必修一 4.2、4.3 |
| 6 同时落地 | 牛顿管（有空气 / 真空）+ 阿波罗 15 号锤子羽毛实验 | 必修一 2.4、4.3 |
| 7 互相推 | 冰面上两人互推，推力–时间曲线 | 必修一 3.3 |
| 8 水火箭 | F = 2AΔp + 绝热膨胀 + 空气阻力，找最佳水量 | 必修一 3.3 |

## 目录结构

```
src/               源代码
  core/            引擎：铅笔排线材质、书页排版、翻页、镜头、界面、音效
  scenes/          每一课的 3D 场景与物理模拟（l1.js … l8.js、end.js）
  content.js       全书文字：课文、预测、答案、挑战、教师笔记、测验、资料来源
fonts.py           按实际用字从 fontsource 截取中文字体子集
build-site.mjs     生产构建 → site/
icons.mjs          生成网站图标和分享卡片图
build.mjs          单文件版（用于 Claude 的 Artifact 预览）
site/              构建好的网站，直接上传这个文件夹即可
```

## 构建

需要 Node.js 18+ 和 Python 3（`pip install fonttools brotli`）。

```bash
npm install
npm run build      # 生成 site/
npm run preview    # 本地预览 http://localhost:8080
```

改了文字内容（`src/content.js` 等）以后要重新 `npm run build`，字体子集会按新用到的字重新生成。

## 部署

推送到 `main` 分支、且 `site/` 有改动时，GitHub Actions 会自动把 `site/` 发布到 GitHub Pages。

`site/` 是纯静态文件：three.js 和字体都打包在里面，不访问任何外部 CDN。上传到任意静态托管即可，详见 `部署说明.md`。

- 页面需要浏览器开启 WebGL（硬件加速）。
- 离线缓存（Service Worker）只在 HTTPS 下生效。

## 数据与模型

所有读数由页面内的物理模型实时计算。真实数据的出处在网站"资料来源"面板里列出；为了让模型能运行而设定的参数（如阻力系数、羽毛的空气阻力）在每页图注中标为示意值。

## 第三方许可

- three.js — MIT License
- Noto Serif SC、Long Cang、Caveat、EB Garamond — SIL Open Font License 1.1（见 `site/assets/fonts/LICENSE-fonts.txt`）
