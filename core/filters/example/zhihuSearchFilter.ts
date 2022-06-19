const logger = (...args: any[]) => {
    console.log("%c TGF[search]:", 'color: red', ...args)
}

interface Item {
    title: string | undefined
    hasAuthor: boolean
    isAuthorAnonymous: boolean
    author: string | undefined
    type: string | undefined
    isSearchResult: boolean
    hasVideo: boolean
    authorFollowerCount: number
    authorVoteupCount: number
    subtype: string | undefined
    isVerified: boolean
}

/**
 * normalize the result of zhihu search
 * @param result the result of zhihu search
 */
function getItemFromSearchResult(result: any): Item {
    let title: string | undefined = result.object?.title ?? result.object?.question?.name
    title = title?.replaceAll("<em>", '').replaceAll("</em>", '')
    return {
        title,
        type: result.type,
        subtype: result.object?.type,   //  "answer", "article" etc.
        hasAuthor: result.object?.author !== undefined,
        isAuthorAnonymous: result.object?.author?.url_token === "0",
        author: result.object?.author?.name,
        authorFollowerCount: result.object?.author?.follower_count ?? 0,
        authorVoteupCount: result.object?.author?.voteup_count ?? 0,
        isSearchResult: result.type === "search_result",
        hasVideo: result.object?.attachment?.type === "video",
        isVerified: result.object?.author?.badge_v2?.title === '已认证帐号',
    }
}

function predicate(obj: any) {
    const item = getItemFromSearchResult(obj)
    if (!item.isSearchResult) {
        logger(`移除非搜索结果：${item.title} ${item.type}`)
        return false
    }
    if (item.hasVideo) {
        logger(`移除视频回答：${item.title}`)
        return false
    }
    if (item.hasAuthor && !item.isAuthorAnonymous && item.authorFollowerCount < 100) {
        logger(`移除低关注用户：${item.title} ${item.author} 关注数${item.authorFollowerCount}`)
        return false
    }
    if (['九章算法'].includes(item.author!)) {
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

export const zhihuSearchFilter: Filter = {
    name: 'zhihuSearchFilter',
    isMatch: url => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),
    intercept: json => {
        json.data = json.data.filter(predicate)
    },
}
