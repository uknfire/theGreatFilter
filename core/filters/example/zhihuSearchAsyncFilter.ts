function logger(...args: any[]) {
    console.log("%c TGF[searchAsync]:", 'color: blue', ...args)
}

async function getUserDetail(urlToken: string) {
    if (urlToken === '0') {
        return {
            isAnonymous: true,
            isAvailable: true,
            name: '匿名用户',
            followerCount: 0,
            answerCount: 0,
            articlesCount: 0
        }
    }
    const url = `https://www.zhihu.com/api/v4/members/${urlToken}?include=answer_count%2Cfollower_count%2Carticles_count%2Cbadge[%3F(type%3Dbest_answerer)].topics`
    const res = await fetch(url)
    const json = await res.json()
    return {
        isAnonymous: false,
        isAvailable: json.error !== undefined, // 已停用用户或者已注销用户
        name: json.name as string | undefined,
        answerCount: (json.answer_count ?? 0) as number,
        articlesCount: (json.articles_count ?? 0) as number,
        followerCount: (json.follower_count ?? 0) as number,
    }
}


async function isUserGood(urlToken: string) {
    const user = await getUserDetail(urlToken)
    if (!user.isAvailable || user.isAnonymous) {
        return true
    }

    const activitiesCount = user.answerCount + user.articlesCount
    if (activitiesCount > 2000) {
        logger('太高产', user.name, '回答和文章总和', activitiesCount)
        return false
    }
    // if (activitiesCount < 10) {
    //     logger('太不活跃', user.name, '回答和文章总和', activitiesCount)
    //     return false
    // }
    if (user.followerCount / activitiesCount < 10) {
        logger('转化率太低',
            user.name, '回答和文章总和',
            activitiesCount, '关注数', user.followerCount
        )
        return false
    }
    return true
}

async function asyncFilter<T>(items: T[], asyncPredicate: (item: T) => Promise<boolean>): Promise<T[]> {
    const ps = await Promise.allSettled(items.map(asyncPredicate))
    return items.filter((_, index) => {
        const p = ps[index]
        return p.status === "rejected" || p.value
    })
}

export const zhihuSearchAsyncFilter: AsyncFilter = {
    name: 'zhihuSearchAsyncFilter',
    isMatch: url => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),

    intercept: async (json: any) => {
        const predicate = async (item: any) => {
            if (!item.object?.author?.url_token) {
                return true
            }
            return isUserGood(item.object.author.url_token)
        }

        json.data = await asyncFilter(json.data, predicate)
    },
}