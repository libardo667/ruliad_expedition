// Curated RSS feed configs and article scoring utilities for the Parallax Lens (Sources) mode.

export const STOPWORDS = new Set([
  "the","and","for","that","this","with","from","have","been","they","will",
  "more","also","about","into","which","their","after","when","were","what",
  "said","says","year","over","than","just","some","such","would","could",
  "then","these","those","there","where","while","other","first","last",
  "news","report","says","amid","amid","week","days","time","make","made",
  // 3-char stopwords (added when lowering min token length to 3)
  "has","was","are","its","not","but","who","how","did","can","new","old",
  "get","got","had","now","per","all","any","own","our","may","too","yet",
  "top","use","set","way","see","two","one","let","ago","say","put","try"
]);

// Each column has: id, label, color, feeds (array of RSS URLs)
// feeds lists are ordered by preference; multiple feeds increase article count
export const LENS_CONFIGS = {
  political: {
    label: "Political Spectrum",
    columns: [
      {
        id: "left",
        label: "Left",
        color: "#3b82f6",
        feeds: [
          "https://www.theguardian.com/world/rss",
          "https://www.motherjones.com/feed/",
          "https://theintercept.com/feed/",
          "https://www.thenation.com/feed/",
          "https://www.commondreams.org/feeds/news",
          "https://www.democracynow.org/democracynow.rss"
        ]
      },
      {
        id: "center-left",
        label: "Center-Left",
        color: "#6792d7",
        feeds: [
          "https://feeds.npr.org/1001/rss.xml",
          "https://feeds.washingtonpost.com/rss/world",
          "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
          "https://www.vox.com/rss/index.xml",
          "https://www.pbs.org/newshour/feeds/rss/headlines",
          "https://slate.com/feeds/all.rss"
        ]
      },
      {
        id: "center",
        label: "Center",
        color: "#94a3b8",
        feeds: [
          "https://feeds.bbci.co.uk/news/world/rss.xml",
          "https://feeds.reuters.com/reuters/topNews",
          "https://rsshub.app/apnews/topics/apf-topnews",
          "https://www.csmonitor.com/layout/set/rss/World",
          "https://abcnews.go.com/abcnews/internationalheadlines",
          "https://feeds.skynews.com/feeds/rss/world.xml"
        ]
      },
      {
        id: "center-right",
        label: "Ctr-Right",
        color: "#c1737e",
        feeds: [
          "https://www.economist.com/sections/briefing/rss.xml",
          "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
          "https://reason.com/feed/",
          "https://thehill.com/feed/",
          "https://www.realclearpolitics.com/index.xml"
        ]
      },
      {
        id: "right",
        label: "Right",
        color: "#ef4444",
        feeds: [
          "https://moxie.foxnews.com/google-publisher/world.xml",
          "https://www.nationalreview.com/feed/",
          "https://www.washingtontimes.com/rss/headlines/news/",
          "https://nypost.com/feed/",
          "https://feeds.feedburner.com/breitbart"
        ]
      }
    ]
  },
  geographic: {
    label: "Geographic",
    columns: [
      {
        id: "na",
        label: "N. America",
        color: "#3b82f6",
        feeds: [
          "https://feeds.npr.org/1001/rss.xml",
          "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
          "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
          "https://www.cbc.ca/cmlink/rss-world",
          "https://rsshub.app/apnews/topics/apf-topnews",
          "https://globalnews.ca/feed/"
        ]
      },
      {
        id: "eu",
        label: "Europe",
        color: "#8b5cf6",
        feeds: [
          "https://feeds.bbci.co.uk/news/world/rss.xml",
          "https://www.theguardian.com/world/rss",
          "https://www.france24.com/en/rss",
          "https://rss.dw.com/rdf/rss-en-top",
          "https://www.euronews.com/rss",
          "https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada"
        ]
      },
      {
        id: "ap",
        label: "Asia-Pacific",
        color: "#06b6d4",
        feeds: [
          "https://www.scmp.com/rss/91/feed",
          "https://www3.nhk.or.jp/nhkworld/en/news/rss/",
          "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
          "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
          "https://www.abc.net.au/news/feed/51120/rss.xml",
          "https://english.kyodonews.net/rss/all.xml"
        ]
      },
      {
        id: "me",
        label: "Mid East & Africa",
        color: "#f59e0b",
        feeds: [
          "https://www.aljazeera.com/xml/rss/all.xml",
          "https://www.middleeasteye.net/rss",
          "https://www.dailymaverick.co.za/feed/",
          "https://www.arabnews.com/rss.xml",
          "https://www.timesofisrael.com/feed/"
        ]
      },
      {
        id: "intl",
        label: "Global / Intl",
        color: "#10b981",
        feeds: [
          "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
          "https://feeds.reuters.com/reuters/topNews",
          "https://rsshub.app/apnews/topics/apf-topnews",
          "https://www.france24.com/en/rss",
          "https://foreignpolicy.com/feed/",
          "https://www.project-syndicate.org/rss"
        ]
      }
    ]
  },
  domain: {
    label: "Domain",
    columns: [
      {
        id: "science",
        label: "Science",
        color: "#06b6d4",
        feeds: [
          "https://www.nature.com/news.rss",
          "https://feeds.sciencedaily.com/sciencedaily/top_news",
          "https://www.newscientist.com/section/news/feed/",
          "https://phys.org/rss-feed/",
          "https://www.livescience.com/feeds/all",
          "https://www.sciencenews.org/feed"
        ]
      },
      {
        id: "tech",
        label: "Tech",
        color: "#8b5cf6",
        feeds: [
          "https://feeds.wired.com/wired/index",
          "https://feeds.arstechnica.com/arstechnica/index",
          "https://www.theverge.com/rss/index.xml",
          "https://techcrunch.com/feed/",
          "https://www.technologyreview.com/feed/",
          "https://www.zdnet.com/news/rss.xml"
        ]
      },
      {
        id: "policy",
        label: "Policy / Gov",
        color: "#f59e0b",
        feeds: [
          "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
          "https://thehill.com/feed/",
          "https://www.brookings.edu/feed/",
          "https://www.politico.com/rss/politicopicks.xml",
          "https://www.cfr.org/rss/",
          "https://foreignpolicy.com/feed/"
        ]
      },
      {
        id: "finance",
        label: "Finance",
        color: "#10b981",
        feeds: [
          "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
          "https://feeds.reuters.com/reuters/businessNews",
          "https://www.cnbc.com/id/100003114/device/rss/rss.html",
          "https://feeds.bloomberg.com/markets/news.rss",
          "https://www.marketwatch.com/rss/topstories"
        ]
      },
      {
        id: "culture",
        label: "Culture",
        color: "#ec4899",
        feeds: [
          "https://www.theatlantic.com/feed/all/",
          "https://www.newyorker.com/feed/everything",
          "https://www.theguardian.com/culture/rss",
          "https://www.salon.com/feed/",
          "https://lithub.com/feed/"
        ]
      }
    ]
  },
  custom: {
    label: "Custom",
    columns: [] // user-defined at runtime
  }
};

// Tokenize a string into meaningful words (4+ chars, not in STOPWORDS)
export function tokenize(text) {
  return (text || "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

// Score an article against the topic (0–100)
export function scoreArticle(article, topicTokens) {
  if (!topicTokens.length) return 0;
  const haystack = new Set(tokenize((article.title || "") + " " + (article.description || "")));
  const matches = topicTokens.filter(t => haystack.has(t)).length;
  return Math.round((matches / topicTokens.length) * 100);
}

// Parse recency from an RSS pubDate string
export function parseRecency(pubDateStr) {
  if (!pubDateStr) return { label: "unknown", ms: Infinity };
  const d = new Date(pubDateStr);
  if (isNaN(d.getTime())) return { label: "unknown", ms: Infinity };
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return { label: "< 1h ago", ms: diff };
  if (h < 24) return { label: `${h}h ago`, ms: diff };
  return { label: `${Math.floor(h / 24)}d ago`, ms: diff };
}

// Cross-coverage: how many OTHER columns have an article sharing ≥ 2 topic-relevant tokens
// with this article's headline. Returns count of other columns with coverage (max = cols-1).
export function crossMentionCount(article, allArticlesByColumn, thisColumnId, topicTokens) {
  const titleTokens = tokenize(article.title || "")
    .filter(t => topicTokens.includes(t) || t.length >= 5);
  if (!titleTokens.length) return 0;
  let count = 0;
  for (const [colId, articles] of Object.entries(allArticlesByColumn)) {
    if (colId === thisColumnId) continue;
    for (const other of articles) {
      const otherTokens = new Set(tokenize(other.title || ""));
      const shared = titleTokens.filter(t => otherTokens.has(t)).length;
      if (shared >= 2) { count++; break; } // count once per column
    }
  }
  return count;
}

// Parse RSS/Atom XML string into article items [{title, link, description, pubDate}]
export function parseFeedItems(rawXml) {
  try {
    const doc = new DOMParser().parseFromString(rawXml, "text/xml");
    const items = [];
    // RSS 2.0: <item>
    for (const el of doc.querySelectorAll("item")) {
      const link = el.querySelector("link")?.textContent?.trim()
        || el.querySelector("guid")?.textContent?.trim()
        || "";
      if (!link.startsWith("http")) continue;
      items.push({
        title: el.querySelector("title")?.textContent?.trim() || "",
        link,
        description: el.querySelector("description")?.textContent?.replace(/<[^>]+>/g, " ").trim().slice(0, 300) || "",
        pubDate: el.querySelector("pubDate")?.textContent?.trim() || ""
      });
    }
    // Atom: <entry>
    if (!items.length) {
      for (const el of doc.querySelectorAll("entry")) {
        const linkEl = el.querySelector("link[href]");
        const link = linkEl?.getAttribute("href") || "";
        if (!link.startsWith("http")) continue;
        items.push({
          title: el.querySelector("title")?.textContent?.trim() || "",
          link,
          description: el.querySelector("summary,content")?.textContent?.replace(/<[^>]+>/g, " ").trim().slice(0, 300) || "",
          pubDate: el.querySelector("published,updated")?.textContent?.trim() || ""
        });
      }
    }
    return items.slice(0, 20); // cap per feed
  } catch {
    return [];
  }
}

// Filter articles to within ±windowDays of seedDate; keeps articles with unknown/unparseable dates
export function filterByTemporalProximity(articles, seedDate, windowDays = 7) {
  if (!seedDate || isNaN(seedDate.getTime())) return articles;
  const windowMs = windowDays * 24 * 3_600_000;
  return articles.filter(a => {
    if (!a.pubDate) return true;
    const d = new Date(a.pubDate);
    if (isNaN(d.getTime())) return true;
    return Math.abs(d.getTime() - seedDate.getTime()) <= windowMs;
  });
}

// Enhanced scoring: 60% topic-keyword overlap + 40% named-entity string match
// Uses .includes() for entities so proper nouns ("Netanyahu", "Operation Epic Fury") survive intact
export function scoreArticleWithSeed(article, topicTokens, entities) {
  const haystack = new Set(tokenize((article.title || "") + " " + (article.description || "")));
  const topicScore = topicTokens.length
    ? topicTokens.filter(t => haystack.has(t)).length / topicTokens.length
    : 0;
  const entityHaystack = ((article.title || "") + " " + (article.description || "")).toLowerCase();
  const entityScore = entities.length
    ? entities.filter(e => entityHaystack.includes(e.toLowerCase())).length / entities.length
    : 0;
  return Math.round((topicScore * 0.6 + entityScore * 0.4) * 100);
}

// Temporal relevance bonus — soft alternative to hard date-window filtering.
// Articles within ±windowDays get a bonus; further out get neutral or mild penalty.
export function temporalRelevanceBonus(article, seedDate, windowDays = 7) {
  if (!seedDate || isNaN(seedDate.getTime())) return 0;
  if (!article.pubDate) return 0;
  const d = new Date(article.pubDate);
  if (isNaN(d.getTime())) return 0;
  const daysDiff = Math.abs(d.getTime() - seedDate.getTime()) / (24 * 3_600_000);
  if (daysDiff <= windowDays) return 10;
  if (daysDiff <= windowDays * 2) return 0;
  return -10;
}

// Soft scoring with prefix matching — catches morphological variants
// ("strikes"→"strike", "economic"→"economy") via shared 5-char prefix.
export function softScoreArticle(article, topicTokens) {
  if (!topicTokens.length) return 0;
  const haystack = tokenize((article.title || "") + " " + (article.description || ""));
  let matches = 0;
  for (const t of topicTokens) {
    const prefix = t.length >= 5 ? t.slice(0, 5) : t;
    if (haystack.some(h => h === t || h.startsWith(prefix))) { matches++; }
  }
  return Math.round((matches / topicTokens.length) * 100);
}

// ── Tier 2: Dynamic Search Utilities ──────────────────────────────────

// Build a Google News RSS search URL. Returns standard RSS XML that parseFeedItems() handles.
export function buildGoogleNewsRssUrl(query, lang = "en", country = "US") {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`;
}

// Generate 2-3 targeted search queries per column via LLM.
// `llmCall` is injected to avoid circular imports — signature: (systemPrompt, userPrompt) => parsed JSON.
export async function generateSearchQueries(topicLabel, entities, columnLabel, columnPerspective, llmCall) {
  const entityStr = entities.length ? entities.slice(0, 6).join(", ") : "none";
  const systemPrompt = "You generate news search queries. Return only strict JSON.";
  const userPrompt = `Given this topic and perspective, generate 2-3 Google News search queries that would find relevant articles.

Topic: "${topicLabel}"
Key entities: ${entityStr}
Perspective/column: "${columnLabel}" (${columnPerspective || columnLabel})

Return JSON only:
{ "queries": ["query 1", "query 2", "query 3"] }

Rules:
- Each query should be 4-8 words
- Include the perspective's angle (e.g. for "Asia-Pacific" column, include regional terms)
- Include at least one entity name per query when possible
- Don't use quotation marks within queries`;

  try {
    const raw = await llmCall(systemPrompt, userPrompt);
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed.queries) ? parsed.queries.map(q => String(q).trim()).filter(Boolean).slice(0, 3) : [];
  } catch {
    return [`${topicLabel} ${columnLabel}`];
  }
}

// Normalize Brave News API results to standard article format
export function normalizeBraveResults(braveJson) {
  const results = braveJson?.results || [];
  return results.map(r => ({
    title: r.title || "",
    link: r.url || "",
    description: (r.description || "").slice(0, 300),
    pubDate: r.age || r.meta_url?.last_crawled || ""
  }));
}

// Normalize NewsAPI.org results to standard article format
export function normalizeNewsApiResults(newsApiJson) {
  const articles = newsApiJson?.articles || [];
  return articles.map(a => ({
    title: a.title || "",
    link: a.url || "",
    description: (a.description || "").slice(0, 300),
    pubDate: a.publishedAt || ""
  }));
}

// Deduplicate articles by normalized URL and fuzzy title similarity
export function deduplicateArticles(existing, newArticles) {
  const seenUrls = new Set(existing.map(a => normalizeUrl(a.link)));
  const seenTitles = existing.map(a => (a.title || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  const unique = [];
  for (const art of newArticles) {
    const normUrl = normalizeUrl(art.link);
    if (seenUrls.has(normUrl)) continue;
    const normTitle = (art.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normTitle) continue;
    if (seenTitles.some(t => titleSimilarity(t, normTitle) > 0.8)) continue;
    seenUrls.add(normUrl);
    seenTitles.push(normTitle);
    unique.push(art);
  }
  return unique;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch { return url; }
}

function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  const set = new Set(shorter.split(""));
  let match = 0;
  for (const c of longer) { if (set.has(c)) match++; }
  return match / longer.length;
}
