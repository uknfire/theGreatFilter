(() => {
  // core/filters/example/zhihuSearchFilter.ts
  function logger(...args) {
    console.log("%c TGF[search]:", "color: red", ...args);
  }
  function normalizeSearchItem(searchItem) {
    let title = searchItem.object?.title ?? searchItem.object?.question?.name;
    title = title?.replaceAll("<em>", "").replaceAll("</em>", "");
    const author = searchItem.object?.author?.name === void 0 ? void 0 : {
      name: searchItem.object.author.name,
      isAnonymous: searchItem.object?.author?.url_token === "0",
      isVerified: searchItem.object?.author?.badge_v2?.title === "\u5DF2\u8BA4\u8BC1\u5E10\u53F7",
      followerCount: searchItem.object?.author?.follower_count ?? 0,
      voteupCount: searchItem.object?.author?.voteup_count ?? 0
    };
    return {
      title,
      type: searchItem.type,
      subtype: searchItem.object?.type,
      isSearchResult: searchItem.type === "search_result",
      hasVideo: searchItem.object?.attachment?.type === "video",
      author
    };
  }
  function predicate(searchItem) {
    const item = normalizeSearchItem(searchItem);
    if (!item.isSearchResult) {
      logger(`\u79FB\u9664\u975E\u641C\u7D22\u7ED3\u679C\uFF1A${item.title} ${item.type}`);
      return false;
    }
    if (item.hasVideo) {
      logger(`\u79FB\u9664\u89C6\u9891\u56DE\u7B54\uFF1A${item.title}`);
      return false;
    }
    if (item.author && !item.author.isAnonymous && item.author.followerCount < 100) {
      logger(`\u79FB\u9664\u4F4E\u5173\u6CE8\u7528\u6237\uFF1A${item.title} ${item.author} \u5173\u6CE8\u6570`, item.author.followerCount);
      return false;
    }
    if (item.author && ["\u4E5D\u7AE0\u7B97\u6CD5"].includes(item.author.name)) {
      logger(`\u79FB\u9664\u8425\u9500\u53F7\uFF1A${item.title} ${item.author}`);
      return false;
    }
    if (["question", "roundtable", "special"].includes(item.subtype)) {
      logger(`\u79FB\u9664\u975E\u56DE\u7B54\u7ED3\u679C\uFF1A${item.title} ${item.subtype}`);
      return false;
    }
    if (item.title?.endsWith("!") || item.title?.endsWith("\uFF01")) {
      logger(`\u79FB\u9664\u6807\u9898\u515A\uFF1A${item.title} ${item.subtype}`);
      return false;
    }
    return true;
  }
  var zhihuSearchFilter = {
    name: "zhihuSearchFilter",
    isMatch: (url) => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),
    intercept: (json) => {
      json.data = json.data.filter(predicate);
    }
  };

  // core/filters/example/zhihuSearchAsyncFilter.ts
  function logger2(...args) {
    console.log("%c TGF[searchAsync]:", "color: blue", ...args);
  }
  async function getUserDetail(urlToken) {
    if (urlToken === "0") {
      return {
        isAnonymous: true,
        isAvailable: true,
        name: "\u533F\u540D\u7528\u6237",
        followerCount: 0,
        answerCount: 0,
        articlesCount: 0
      };
    }
    const url = `https://www.zhihu.com/api/v4/members/${urlToken}?include=answer_count%2Cfollower_count%2Carticles_count%2Cbadge[%3F(type%3Dbest_answerer)].topics`;
    const res = await fetch(url);
    const json = await res.json();
    return {
      isAnonymous: false,
      isAvailable: json.error !== void 0,
      name: json.name,
      answerCount: json.answer_count ?? 0,
      articlesCount: json.articles_count ?? 0,
      followerCount: json.follower_count ?? 0
    };
  }
  async function isUserGood(urlToken) {
    const user = await getUserDetail(urlToken);
    if (!user.isAvailable || user.isAnonymous) {
      return true;
    }
    const activitiesCount = user.answerCount + user.articlesCount;
    if (activitiesCount > 2e3) {
      logger2("\u592A\u9AD8\u4EA7", user.name, "\u56DE\u7B54\u548C\u6587\u7AE0\u603B\u548C", activitiesCount);
      return false;
    }
    if (user.followerCount / activitiesCount < 10) {
      logger2("\u8F6C\u5316\u7387\u592A\u4F4E", user.name, "\u56DE\u7B54\u548C\u6587\u7AE0\u603B\u548C", activitiesCount, "\u5173\u6CE8\u6570", user.followerCount);
      return false;
    }
    return true;
  }
  async function asyncFilter(items, asyncPredicate) {
    const ps = await Promise.allSettled(items.map(asyncPredicate));
    return items.filter((_, index) => {
      const p = ps[index];
      return p.status === "rejected" || p.value;
    });
  }
  var zhihuSearchAsyncFilter = {
    name: "zhihuSearchAsyncFilter",
    isMatch: (url) => url.startsWith("https://www.zhihu.com/api/v4/search_v3"),
    intercept: async (json) => {
      const predicate2 = async (item) => {
        if (!item.object?.author?.url_token) {
          return true;
        }
        return isUserGood(item.object.author.url_token);
      };
      json.data = await asyncFilter(json.data, predicate2);
    }
  };

  // core/index.ts
  var TGF = class {
    constructor() {
      this.filters = [];
      this.asyncFilters = [];
    }
    use(filter) {
      this.filters.push(filter);
    }
    useAsync(filter) {
      this.asyncFilters.push(filter);
    }
    buildIntercept(url) {
      const matchedFilters = this.filters.filter((filter) => filter.isMatch(url));
      if (matchedFilters.length === 0) {
        return void 0;
      }
      return function(json) {
        matchedFilters.forEach((filter) => {
          try {
            filter.intercept(json);
          } catch {
            console.error(`TGF: ${filter.name} error`);
          }
        });
      };
    }
    buildAsyncIntercept(url) {
      const matchedFilters = this.asyncFilters.filter((filter) => filter.isMatch(url));
      if (matchedFilters.length === 0) {
        return void 0;
      }
      return async function(json) {
        for (const filter of matchedFilters) {
          try {
            await filter.intercept(json);
          } catch {
            console.warn(`TGF: ${filter.name} error`);
          }
        }
      };
    }
    buildFetch(originalFetch) {
      return async (input, init) => {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          return response;
        }
        const url = response.url;
        const intercept = this.buildIntercept(url);
        const asyncIntercept = this.buildAsyncIntercept(url);
        if (!intercept && !asyncIntercept) {
          return response;
        }
        const json = await response.json();
        intercept?.(json);
        await asyncIntercept?.(json);
        return new Response(JSON.stringify(json), {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText
        });
      };
    }
    buildXHR(originalXHR) {
      const buildIntercept = this.buildIntercept.bind(this);
      const buildAsyncIntercept = this.buildAsyncIntercept.bind(this);
      const xhrRes = Symbol("xhrRes");
      const xhrResText = Symbol("xhrResText");
      return function() {
        const xhr = new originalXHR();
        const tryModifyResponse = () => {
          const intercept = buildIntercept(xhr.responseURL);
          if (intercept) {
            const json = JSON.parse(xhr.responseText);
            intercept(json);
            const newResponseText = JSON.stringify(json);
            this.response = newResponseText;
            this.responseText = newResponseText;
          }
        };
        const tryAsyncModifyResponse = async () => {
          const asyncIntercept = buildAsyncIntercept(xhr.responseURL);
          if (asyncIntercept) {
            const json = JSON.parse(xhr.responseText);
            await asyncIntercept(json);
            const newResponseText = JSON.stringify(json);
            this.response = newResponseText;
            this.responseText = newResponseText;
          }
        };
        xhr.onload = (...args) => {
          if (!this.onload)
            return;
          tryModifyResponse();
          tryAsyncModifyResponse().finally(() => {
            this.onload.apply(this, args);
          });
        };
        xhr.onreadystatechange = (...args) => {
          if (!this.onreadystatechange)
            return;
          if (this.readyState === 4) {
            tryModifyResponse();
            tryAsyncModifyResponse().finally(() => {
              this.onreadystatechange.apply(this, args);
            });
          } else {
            this.onreadystatechange.apply(this, args);
          }
        };
        for (const key in xhr) {
          const attr = key;
          if (attr === "onreadystatechange" || attr === "onload")
            continue;
          if (typeof xhr[attr] === "function") {
            this[attr] = xhr[attr].bind(xhr);
          } else if (attr === "response" || attr === "responseText") {
            const symbol = attr === "response" ? xhrRes : xhrResText;
            Object.defineProperty(this, attr, {
              get: () => this[symbol] ?? xhr[attr],
              set: (val) => this[symbol] = val,
              enumerable: true
            });
          } else {
            Object.defineProperty(this, attr, {
              get: () => xhr[attr],
              set: (val) => xhr[attr] = val,
              enumerable: true
            });
          }
        }
      };
    }
  };

  // index.ts
  var tgf = new TGF();
  if (window.location.origin === "https://www.zhihu.com") {
    tgf.use(zhihuSearchFilter);
    tgf.useAsync(zhihuSearchAsyncFilter);
  }
  window.fetch = tgf.buildFetch(window.fetch);
  window.XMLHttpRequest = tgf.buildXHR(window.XMLHttpRequest);
})();
