# The Great Filter（预览）

一个简单的 Web 过滤器框架，可以过滤网页中 API 返回的请求。请搭配 Chrome Extension 或者油猴插件使用

## 原理

在 document 开头注入 script，替换全局的 `fetch` 和 `XMLHttpRequest` 函数，从而实现对响应的过滤
用户可通过编写插件来实现自定义过滤功能

## 举个例子

```typescript
import { TGF } from "./core"

const zhihuSearchFilter = {
  name: "zhihuSearchFilter",
  isMatch: (url) => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),
  intercept: (json) => {
    json.data = [] // 拦截所有结果
  },
}

const tgf = new TGF()
tgf.use(zhihuSearchFilter)
window.fetch = tgf.buildFetch(window.fetch)
```

## 使用方法

### 选项一(推荐)：通过 Chrome 开发者模式加载

```bash
git clone https://github.com/uknfire/theGreatFilter.git
cd theGreatFilter
npm install
npm run build:watch
```

在 [扩展设置页面](chrome://extensions/)打开开发者模式后，选择 Load unpacked extension，导入项目文件夹

### 选项二：使用油猴插件

点击油猴插件的按钮，选择添加新脚本后，将 build/monkey.js 内的文本粘贴到油猴编辑器中

### 注意事项

目前本项目还处于探索阶段，因此

- 暂时只支持修改 json 响应
- 没有设计 UI 和配置文件
- 请使用最新版浏览器，以保证兼容性

## 致谢

感谢 [ajax-interceptor](https://github.com/YGYOOO/ajax-interceptor) 提供的源码参考
