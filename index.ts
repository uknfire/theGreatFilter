import { zhihuSearchFilter } from "./core/filters/example/zhihuSearchFilter"
import { zhihuSearchAsyncFilter } from "./core/filters/example/zhihuSearchAsyncFilter"
import { TGF } from "./core"


if (window.location.href.startsWith('https://www.zhihu.com/search')) {
    const tgf = new TGF()
    tgf.use(zhihuSearchFilter)
    tgf.useAsync(zhihuSearchAsyncFilter)
    window.fetch = tgf.buildFetch(window.fetch)
    window.XMLHttpRequest = tgf.buildXHR(window.XMLHttpRequest)
}
