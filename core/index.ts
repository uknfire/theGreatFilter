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
    /**
     * experimental
     */
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
     * experimental
     */
    public buildXHR(originalXHR: typeof XMLHttpRequest): typeof XMLHttpRequest {
        const buildIntercept = this.buildIntercept.bind(this)
        const buildAsyncIntercept = this.buildAsyncIntercept.bind(this)
        const xhrRes = Symbol('xhrRes')
        const xhrResText = Symbol('xhrResText')

        async function onResponseTextComplete(responseURL: string, responseText: string): Promise<string> {
            const intercept = buildIntercept(responseURL)
            const asyncIntercept = buildAsyncIntercept(responseURL)
            if (!intercept && !asyncIntercept) return responseText

            const json = JSON.parse(responseText)
            intercept?.(json)
            await asyncIntercept?.(json)

            return JSON.stringify(json)
        }

        // this function is used to initialize the xhr object
        return function (this: XMLHttpRequest) {
            const xhr = new originalXHR()
            const tryAsyncModifyResponse = async () => {
                const newResponseText = await onResponseTextComplete(xhr.responseURL, xhr.responseText);

                (this as any).response = newResponseText;
                (this as any).responseText = newResponseText
            }

            xhr.onload = (...args) => {
                if (!this.onload) return

                tryAsyncModifyResponse().finally(() => {
                    this.onload!.apply(this, args)
                })
            }

            xhr.onreadystatechange = (...args) => {
                if (!this.onreadystatechange) return

                if (this.readyState === XMLHttpRequest.DONE) {
                    tryAsyncModifyResponse().finally(() => {
                        this.onreadystatechange!.apply(this, args)
                    })
                } else {
                    this.onreadystatechange.apply(this, args)
                }
            }

            for (const key in xhr) {
                const attr = key as keyof XMLHttpRequest
                if (attr === 'onreadystatechange' || attr === 'onload') continue

                if (typeof xhr[attr] === 'function') {
                    (this as any)[attr] = xhr[attr].bind(xhr)
                } else if (attr === "response" || attr === "responseText") {
                    const symbol = attr === "response" ? xhrRes : xhrResText
                    Object.defineProperty(this, attr, {
                        get: () => (this as any)[symbol] ?? xhr[attr],
                        set: (val) => (this as any)[symbol] = val,
                        enumerable: true,
                    })
                } else {
                    Object.defineProperty(this, attr, {
                        get: () => xhr[attr],
                        set: (val) => (xhr as any)[attr] = val,
                        enumerable: true,
                    })
                }
            }
        } as any
    };
}