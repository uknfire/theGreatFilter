function logger(...args: any[]) {
    console.log("%c TGF[search]:", 'color: red', ...args)
}

function normalizeSearchItem(searchItem: any) {
    let title: string | undefined = searchItem.object?.title ?? searchItem.object?.question?.name
    title = title?.replaceAll("<em>", '').replaceAll("</em>", '')
    const author = searchItem.object?.author?.name === undefined ? undefined : {
        name: searchItem.object.author.name as string,
        isAnonymous: searchItem.object?.author?.url_token === "0",
        isVerified: searchItem.object?.author?.badge_v2?.title === '已认证帐号',
        followerCount: (searchItem.object?.author?.follower_count ?? 0) as number,
        voteupCount: (searchItem.object?.author?.voteup_count ?? 0) as number,
    }
    return {
        title,
        type: searchItem.type as string | undefined,
        subtype: searchItem.object?.type as string | undefined,   //  "answer", "article" etc.
        isSearchResult: searchItem.type === "search_result",
        hasVideo: searchItem.object?.attachment?.type === "video",
        author,
    }
}

function predicate(searchItem: any) {
    const item = normalizeSearchItem(searchItem)
    if (!item.isSearchResult) {
        logger(`移除非搜索结果：${item.title} ${item.type}`)
        return false
    }
    if (item.hasVideo) {
        logger(`移除视频回答：${item.title}`)
        return false
    }
    if (item.author && !item.author.isAnonymous && item.author.followerCount < 100) {
        logger(`移除低关注用户：${item.title} ${item.author} 关注数`, item.author.followerCount)
        return false
    }
    if (item.author && ['九章算法'].includes(item.author.name)) {
        logger(`移除营销号：${item.title} ${item.author}`)
        return false
    }
    if (["question", "roundtable", "special"].includes(item.subtype!)) {
        logger(`移除非回答结果：${item.title} ${item.subtype}`)
        return false
    }
    if (item.title?.endsWith("!") || item.title?.endsWith("！")) {
        logger(`移除标题党：${item.title} ${item.subtype}`)
        return false
    }
    // logger(`保留结果：${item.title}`, obj)
    return true
}

/**
 * https://www.zhihu.com/search?q=keyword&type=content
 */
export const zhihuSearchFilter: Filter = {
    name: 'zhihuSearchFilter',
    isMatch: url => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),
    intercept: json => {
        json.data = json.data.filter(predicate)
    },
}
