import { zhihuSearchFilter } from "./core/filters/example/zhihuSearchFilter"
import { zhihuSearchAsyncFilter } from "./core/filters/example/zhihuSearchAsyncFilter"
import { TGF } from "./core"


const tgf = new TGF()

if (window.location.origin === 'https://www.zhihu.com') {
    tgf.use(zhihuSearchFilter)
    tgf.useAsync(zhihuSearchAsyncFilter)
}

window.fetch = tgf.buildFetch(window.fetch)
window.XMLHttpRequest = tgf.buildXHR(window.XMLHttpRequest)
