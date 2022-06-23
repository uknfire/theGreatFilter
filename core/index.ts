export class TGF {
    private filters: Filter[] = []
    private asyncFilters: AsyncFilter[] = []

    public use(filter: Filter) {
        this.filters.push(filter)
    }

    public useAsync(filter: AsyncFilter) {
        this.asyncFilters.push(filter)
    }

    private buildIntercept(url: string) {
        const matchedFilters = this.filters.filter(filter => filter.isMatch(url))
        if (matchedFilters.length === 0) {
            return undefined
        }
        return function (json: any) {
            matchedFilters.forEach(filter => {
                try {
                    filter.intercept(json)
                } catch {
                    console.error(`TGF: ${filter.name} error`)
                }
            })
        }
    }

    private buildAsyncIntercept(url: string) {
        const matchedFilters = this.asyncFilters.filter(filter => filter.isMatch(url))
        if (matchedFilters.length === 0) {
            return undefined
        }
        return async function (json: any) {
            for (const filter of matchedFilters) {
                try {
                    await filter.intercept(json)
                } catch {
                    console.warn(`TGF: ${filter.name} error`)
                }
            }
        }
    }

    /**
     * intercept only if response.ok && response is json
     */
    public buildFetch(originalFetch: typeof fetch): typeof fetch {
        return async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await originalFetch(input, init)
            if (!response.ok) {
                return response
            }

            const url = response.url
            const intercept = this.buildIntercept(url)
            const asyncIntercept = this.buildAsyncIntercept(url)
            if (!intercept && !asyncIntercept) {
                return response
            }

            const json = await response.json()
            intercept?.(json)
            await asyncIntercept?.(json)

            return new Response(JSON.stringify(json), {
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
            })
        }
    }

    /**
     * intercept only if status === 200 && response is json
     */
    public buildXHR(originalXHR: typeof XMLHttpRequest): typeof XMLHttpRequest {
        const tryAsyncModifyResponse = async (xhr: XMLHttpRequest) => {
            const intercept = this.buildIntercept(xhr.responseURL)
            const asyncIntercept = this.buildAsyncIntercept(xhr.responseURL)
            if (!intercept && !asyncIntercept) return

            // note: responseText can only be accessed
            // if its responseType is "text" or ''
            const json = JSON.parse(xhr.responseText)
            intercept?.(json)
            await asyncIntercept?.(json)

            return JSON.stringify(json)
        }

        const xhrRes = Symbol('xhrRes')
        const xhrResText = Symbol('xhrResText')

        // this function is used to initialize the xhr object
        return function (this: XMLHttpRequest) {
            const xhr = new originalXHR()
            const xhrProxy = this as XMLHttpRequest & {
                response: any
                responseText: string
            }
            // onreadystatechange comes before onload
            xhr.onreadystatechange = (ev) => {
                if (xhr.readyState === originalXHR.DONE && xhr.status === 200) {
                    tryAsyncModifyResponse(xhr)
                        .then((newResponseText) => {
                            if (newResponseText === undefined) return

                            xhrProxy.response = newResponseText
                            xhrProxy.responseText = newResponseText
                        })
                        .finally(() => {
                            xhrProxy.onreadystatechange?.(ev)
                        })
                } else {
                    xhrProxy.onreadystatechange?.(ev)
                }
            }

            for (const key in xhr) {
                const attr = key as keyof XMLHttpRequest
                if (attr === 'onreadystatechange') continue

                if (attr === "response" || attr === "responseText") {
                    // use symbol to avoid recursion
                    const symbol = attr === "response" ? xhrRes : xhrResText
                    Object.defineProperty(xhrProxy, attr, {
                        get: () => (xhrProxy as any)[symbol] ?? xhr[attr],
                        // can't write to xhr, so save it to xhrProxy
                        set: (val) => (xhrProxy as any)[symbol] = val,
                        enumerable: true,
                    })
                    continue
                }

                if (typeof xhr[attr] === 'function') {
                    (xhrProxy as any)[attr] = (xhr[attr] as Function).bind(xhr)
                    continue
                }

                Object.defineProperty(xhrProxy, attr, {
                    get: () => xhr[attr],
                    set: (val) => (xhr as any)[attr] = val,
                    enumerable: true,
                })
            }
        } as any
    };
}