import { zhihuSearchFilter } from "./core/filters/example/zhihuSearchFilter"
import { TGF } from "./core"


const tgf = new TGF()

if (window.location.origin === 'https://www.zhihu.com') {
    tgf.use(zhihuSearchFilter)
}

window.fetch = tgf.buildFetch(window.fetch)
window.XMLHttpRequest = tgf.buildXHR(window.XMLHttpRequest)
