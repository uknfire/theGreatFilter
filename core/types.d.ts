declare interface Filter {
    name?: string
    isMatch: (url: string) => boolean
    intercept: (json: any) => void
}

declare interface AsyncFilter {
    name?: string
    isMatch: (url: string) => boolean
    intercept: (json: any) => Promise<void>
}

declare interface Interceptor {
    baseUrl: string
    filters: Filter[]
    asyncFilters: AsyncFilter[]
}