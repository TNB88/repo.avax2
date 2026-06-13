// =============================================================================
// TimFshare / Fshare VAAPP plugin
// Based on the Fshare flow used by Cloudstream/Kodi providers:
// 1) Search/list public TimFshare + forum.timfshare.com content
// 2) Resolve Fshare file/folder info
// 3) Login Fshare API and request a temporary download URL
// =============================================================================

// Fill these only in your private/local copy. Do not upload a copy with a real
// password to a public GitHub raw URL.
var FSHARE_USERNAME = "";
var FSHARE_PASSWORD = "";

var TIMFSHARE_BASE = "https://timfshare.com";
var TIMFSHARE_TOP_URL = TIMFSHARE_BASE + "/api/key/data-top";
var FORUM_BASE = "https://forum.timfshare.com";
var THUVIENCINE_BASE = "https://thuviencine.xyz";
var FSHARE_BASE = "https://www.fshare.vn";
var FSHARE_FOLDER_API = FSHARE_BASE + "/api/v3/files/folder";
var FSHARE_LOGIN_API = "https://api.fshare.vn/api/user/login";
var FSHARE_DOWNLOAD_API = "https://api.fshare.vn/api/session/download";
var FSHARE_APP_KEY = "dMnqMMZMUnN5YpvKENaEhdQQ5jxDqddt";
var FSHARE_ICON = "https://www.fshare.vn/favicon.ico";
var PAGE_SIZE = 48;
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";

var __lastListPage = 1;
var __lastMode = "top";
var __lastSearchKeyword = "";
var __lastFshareDownloadUrl = "";
var __lastFshareFileName = "";

function getManifest() {
    return JSON.stringify({
        "id": "timfshare",
        "name": "Tìm Fshare",
        "version": "1.0.1",
        "baseUrl": "https://timfshare.com",
        "fallbackUrls": ["https://forum.timfshare.com", "https://thuviencine.xyz", "https://www.fshare.vn"],
        "iconUrl": FSHARE_ICON,
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "playerType": "exoplayer",
        "layoutType": "VERTICAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "top", title: "Top TimFshare", type: "Grid", path: "" },
        { slug: "forum", title: "VietmediaF Forum", type: "Horizontal", path: "category" },
        { slug: "fsharecine", title: "Fshare Cine", type: "Horizontal", path: "category" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Top TimFshare", slug: "top" },
        { name: "VietmediaF Forum", slug: "forum" },
        { name: "Fshare Cine", slug: "fsharecine" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL GENERATION
// =============================================================================

function getUrlList(slug, filtersJson) {
    var filters = parseFilters(filtersJson);
    var page = getPage(filters);
    var normalized = normalizeSlug(slug || "top");

    __lastListPage = page;
    __lastSearchKeyword = "";

    if (normalized === "forum" || normalized === "vietmediaf") {
        __lastMode = "forum";
        return buildForumPageUrl("/forums/phim-anh.3/", page);
    }

    if (normalized === "fsharecine" || normalized === "cine" || normalized === "thuviencine") {
        __lastMode = "cine";
        return buildCinePageUrl(page);
    }

    __lastMode = "top";
    return TIMFSHARE_TOP_URL;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = parseFilters(filtersJson);
    var page = getPage(filters);
    var query = cleanText(keyword || "");

    __lastListPage = page;
    __lastMode = "search";
    __lastSearchKeyword = query;

    if (isFshareUrl(query) || looksLikeFshareCode(query)) {
        return buildFshareInfoUrl(query);
    }

    return FORUM_BASE + "/search/search?keywords=" + encodeURIComponent(query) + (page > 1 ? "&page=" + page : "");
}

function getUrlDetail(slug) {
    slug = cleanText(slug || "");
    if (!slug) return "";

    if (isFshareUrl(slug) || looksLikeFshareCode(slug)) {
        return buildFshareInfoUrl(slug);
    }

    if (slug.indexOf("cine:") === 0) {
        return THUVIENCINE_BASE + "/download?id=" + encodeURIComponent(slug.replace(/^cine:/, ""));
    }

    if (slug.indexOf("/threads/") === 0) {
        return FORUM_BASE + slug;
    }

    if (slug.indexOf("http://") === 0 || slug.indexOf("https://") === 0) {
        return slug;
    }

    return buildFshareInfoUrl(slug);
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// LIST PARSERS
// =============================================================================

function parseListResponse(html) {
    try {
        var data = tryParseJson(html);

        if (data) {
            return JSON.stringify(buildListResult(parseJsonListItems(data), true));
        }

        var items = __lastMode === "forum" ? parseForumThreadItems(html) : (__lastMode === "cine" ? parseCineListItems(html) : parseForumSearchItems(html));
        return JSON.stringify(buildListResult(items, false));
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(html) {
    try {
        var data = tryParseJson(html);

        if (data) {
            var jsonItems = parseJsonListItems(data);
            if (__lastSearchKeyword) jsonItems = filterItemsByKeyword(jsonItems, __lastSearchKeyword);
            return JSON.stringify(buildListResult(jsonItems, true));
        }

        var items = parseForumSearchItems(html);
        if (items.length === 0) items = parseForumThreadItems(html);
        return JSON.stringify(buildListResult(items, false));
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseJsonListItems(data) {
    var rawItems = [];
    var items = [];
    var i;

    if (!data) return items;

    if (data.data && data.data.length !== undefined) {
        rawItems = data.data;
    } else if (data.dataFile && data.dataFile.length !== undefined) {
        rawItems = rawItems.concat(data.dataFile);
        if (data.dataFile_timfshare && data.dataFile_timfshare.length !== undefined) {
            rawItems = rawItems.concat(data.dataFile_timfshare);
        }
    } else if (data.current && data.current.linkcode) {
        rawItems = [data.current];
    } else if (data.items && data.items.length !== undefined) {
        rawItems = data.items;
    }

    for (i = 0; i < rawItems.length; i++) {
        var item = mapFshareApiItemToListItem(rawItems[i], "TimFshare");
        if (item) items.push(item);
    }

    return uniqueItems(items);
}

function parseForumThreadItems(html) {
    var blocks = splitForumBlocks(html);
    var items = [];

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var href = extractText(block, /<a[^>]+href=["']([^"']*\/threads\/[^"']+)["'][^>]*>/i);
        var titleHtml = extractText(block, /<h3[^>]*class=["'][^"']*contentRow-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)
            || extractText(block, /<div[^>]*class=["'][^"']*structItem-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        var title = cleanText(stripTags(titleHtml)) || cleanText(stripTags(extractText(block, /<a[^>]+href=["'][^"']*\/threads\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)));

        if (!href || !title) continue;

        items.push({
            id: absoluteForumUrl(href),
            title: title,
            posterUrl: "",
            backdropUrl: "",
            description: cleanText(stripTags(extractText(block, /<div[^>]*class=["'][^"']*contentRow-snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i))) || "",
            quality: "Forum",
            episode_current: "VietmediaF",
            lang: "Fshare",
            year: 0
        });
    }

    return uniqueItems(items);
}

function parseForumSearchItems(html) {
    var blocks = splitForumBlocks(html);
    var items = [];

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var baseTitle = cleanText(stripTags(extractText(block, /<h3[^>]*class=["'][^"']*contentRow-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)))
            || cleanText(stripTags(extractText(block, /<a[^>]+href=["'][^"']*\/threads\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)))
            || "Kết quả TimFshare";
        var desc = cleanText(stripTags(extractText(block, /<div[^>]*class=["'][^"']*contentRow-snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)))
            || cleanText(stripTags(block));
        var links = extractFshareUrls(block);

        if (links.length === 0) {
            var threadHref = extractText(block, /<a[^>]+href=["']([^"']*\/threads\/[^"']+)["'][^>]*>/i);
            if (threadHref) {
                items.push({
                    id: absoluteForumUrl(threadHref),
                    title: baseTitle,
                    posterUrl: "",
                    backdropUrl: "",
                    description: desc,
                    quality: "Forum",
                    episode_current: "VietmediaF",
                    lang: "Fshare",
                    year: 0
                });
            }
            continue;
        }

        for (var j = 0; j < links.length; j++) {
            var link = links[j];
            var code = extractFshareCode(link);
            var kind = isFshareFolderUrl(link) ? "FOLDER" : "FILE";
            items.push({
                id: link,
                title: links.length === 1 ? baseTitle : baseTitle + " - " + code,
                posterUrl: FSHARE_ICON,
                backdropUrl: FSHARE_ICON,
                description: desc ? desc + " | Link: " + link : "Link: " + link,
                quality: kind,
                episode_current: kind,
                lang: "Fshare",
                year: 0
            });
        }
    }

    return uniqueItems(items);
}

function parseCineListItems(html) {
    var parts = String(html || "").split(/<div\s+id=["']post-/i);
    var items = [];

    for (var i = 1; i < parts.length; i++) {
        var block = parts[i];
        var postId = extractText(block, /^(\d+)/);
        if (!postId) continue;

        var title = htmlDecode(extractText(block, /<a[^>]+rel=["']bookmark["'][^>]+title=["']([^"']+)["']/i))
            || cleanText(stripTags(extractText(block, /<h2[^>]*class=["'][^"']*movie-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)))
            || "Fshare Cine " + postId;
        var poster = extractText(block, /<img[^>]+(?:data-src|data-original)=["']([^"']+)["']/i)
            || extractText(block, /<img[^>]+src=["']([^"']+)["']/i);
        if (poster.indexOf("data:image") === 0) poster = "";

        var description = cleanText(stripTags(extractText(block, /<p[^>]*class=["'][^"']*movie-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)));
        var quality = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*item-quality[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))) || detectQuality(title);
        var year = toInt(cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*movie-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))), extractYear(title));
        var genre = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*genre[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)));
        var runtime = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*runtime[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)));

        items.push({
            id: "cine:" + postId,
            title: title,
            posterUrl: poster,
            backdropUrl: poster,
            description: [description, genre, runtime].filter(function (x) { return !!x; }).join(" | "),
            quality: quality,
            episode_current: "Fshare Cine",
            lang: detectLang(title + " " + description + " " + quality),
            year: year
        });
    }

    return uniqueItems(items);
}

function buildListResult(items, sliceForPage) {
    items = items || [];

    var totalItems = items.length;
    var totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1;

    if (sliceForPage) {
        var start = ((__lastListPage || 1) - 1) * PAGE_SIZE;
        items = items.slice(start, start + PAGE_SIZE);
    } else if (__lastMode === "forum" || __lastMode === "search") {
        totalPages = (__lastListPage || 1) + 1;
    }

    return {
        items: items,
        pagination: {
            currentPage: __lastListPage || 1,
            totalPages: totalPages,
            totalItems: totalItems,
            itemsPerPage: PAGE_SIZE
        }
    };
}

// =============================================================================
// DETAIL / PLAY PARSERS
// =============================================================================

function parseMovieDetail(html) {
    try {
        var data = tryParseJson(html);

        if (data && data.current) {
            return JSON.stringify(buildFshareDetail(data));
        }

        if (html.indexOf("movie-actions") >= 0 || html.indexOf("/download?id=") >= 0) {
            return JSON.stringify(buildCineDownloadDetail(html));
        }

        return JSON.stringify(buildForumThreadDetail(html));
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html, fetchedUrl) {
    try {
        var data = tryParseJson(html);
        var fileItem = null;

        if (data && data.current) {
            if (toInt(data.current.type, 0) === 1) {
                fileItem = data.current;
            } else if (data.items && data.items.length !== undefined) {
                fileItem = firstPlayableFile(data.items);
            }
        }

        var fileUrl = "";
        var fileName = "";

        if (fileItem && fileItem.linkcode) {
            fileUrl = FSHARE_BASE + "/file/" + fileItem.linkcode;
            fileName = cleanText(fileItem.name || fileItem.linkcode);
        } else {
            var code = extractFshareCode(fetchedUrl || html);
            if (code) {
                fileUrl = FSHARE_BASE + "/file/" + code;
                fileName = code;
            }
        }

        if (!fileUrl) {
            return JSON.stringify({ url: "", isEmbed: false, headers: {}, error: "Không tìm thấy file Fshare để phát" });
        }

        return JSON.stringify(buildFshareLoginStep(fileUrl, fileName));
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {}, error: String(e && e.message ? e.message : e) });
    }
}

function parseEmbedResponse(html, sourceUrl) {
    try {
        var data = tryParseJson(html) || {};
        sourceUrl = cleanText(sourceUrl || "");

        if (data.token || data.session_id || sourceUrl.indexOf("/api/user/login") >= 0) {
            var token = cleanText(data.token || "");
            var sessionId = cleanText(data.session_id || "");

            if (!token || !sessionId || !__lastFshareDownloadUrl) {
                return JSON.stringify({ url: "", isEmbed: false, headers: {}, error: cleanText(data.msg || "Login Fshare lỗi") });
            }

            return JSON.stringify({
                url: FSHARE_DOWNLOAD_API,
                isEmbed: true,
                postBody: JSON.stringify({
                    url: addShareParam(__lastFshareDownloadUrl),
                    password: "",
                    token: token,
                    zipflag: 0
                }),
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": UA,
                    "Cookie": "session_id=" + sessionId,
                    "Origin": FSHARE_BASE,
                    "Referer": FSHARE_BASE + "/"
                }
            });
        }

        var location = cleanText(data.location || "");
        if (!location) {
            location = extractText(html, /"location"\s*:\s*"([^"]+)"/i);
            location = unescapeJsonString(location);
        }

        if (location) {
            return JSON.stringify({
                url: location,
                isEmbed: false,
                mimeType: guessMimeType(location, __lastFshareFileName),
                headers: {
                    "User-Agent": UA,
                    "Referer": FSHARE_BASE + "/"
                }
            });
        }

        return JSON.stringify({ url: "", isEmbed: false, headers: {}, error: cleanText(data.msg || "Không lấy được link Fshare") });
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {}, error: String(e && e.message ? e.message : e) });
    }
}

function buildFshareDetail(data) {
    var current = data.current || {};
    var title = cleanText(current.name || current.linkcode || "Fshare");
    var isFile = toInt(current.type, 0) === 1;
    var episodes = [];
    var folderFiles = [];
    var subfolders = 0;

    if (isFile) {
        episodes.push(buildEpisodeFromFshareItem(current));
    } else if (data.items && data.items.length !== undefined) {
        for (var i = 0; i < data.items.length; i++) {
            var item = data.items[i];
            if (toInt(item.type, 0) === 1) {
                folderFiles.push(item);
                episodes.push(buildEpisodeFromFshareItem(item));
            } else {
                subfolders++;
            }
        }
    }

    var descriptionParts = [];
    if (current.linkcode) descriptionParts.push("Linkcode: " + current.linkcode);
    if (current.size) descriptionParts.push("Dung lượng: " + humanSize(current.size));
    if (!isFile) descriptionParts.push("File phát được: " + folderFiles.length);
    if (subfolders > 0) descriptionParts.push("Thư mục con: " + subfolders + " (VAAPP bản này chưa duyệt sâu trong màn play)");

    return {
        id: current.linkcode || "",
        title: title,
        posterUrl: FSHARE_ICON,
        backdropUrl: FSHARE_ICON,
        description: descriptionParts.join(" | "),
        servers: [{
            name: isFile ? "Fshare File" : "Fshare Folder",
            episodes: episodes
        }],
        quality: detectQuality(title),
        lang: detectLang(title),
        year: extractYear(title),
        rating: 0,
        casts: "",
        director: "",
        country: "",
        category: isFile ? "Fshare File" : "Fshare Folder",
        status: episodes.length > 0 ? "Ready" : "Không có file phát được",
        duration: ""
    };
}

function buildForumThreadDetail(html) {
    var title = cleanText(stripTags(extractText(html, /<h1[^>]*class=["'][^"']*p-title-value[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)))
        || cleanText(extractMeta(html, "og:title"))
        || "VietmediaF";
    var content = extractThreadContent(html) || html;
    var description = cleanText(stripTags(content)).slice(0, 2000);
    var image = normalizeForumUrl(extractText(content, /<img[^>]+(?:data-src|data-url|src)=["']([^"']+)["']/i));
    var links = extractFshareUrls(content);
    var episodes = [];

    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        episodes.push({
            id: link,
            name: (isFshareFolderUrl(link) ? "Folder " : "File ") + (i + 1) + " - " + extractFshareCode(link),
            slug: extractFshareCode(link)
        });
    }

    return {
        id: title,
        title: title,
        posterUrl: image || FSHARE_ICON,
        backdropUrl: image || FSHARE_ICON,
        description: description,
        servers: [{
            name: "Fshare Links",
            episodes: episodes
        }],
        quality: detectQuality(title),
        lang: detectLang(title + " " + description),
        year: extractYear(title),
        rating: 0,
        casts: "",
        director: "",
        country: "",
        category: "VietmediaF",
        status: episodes.length + " link",
        duration: ""
    };
}

function buildCineDownloadDetail(html) {
    var blocks = String(html || "").split(/<li\b/i);
    var episodes = [];

    for (var i = 1; i < blocks.length; i++) {
        var block = blocks[i].split(/<\/li>/i)[0];
        var href = extractText(block, /<a[^>]+href=["']([^"']+)["']/i);
        if (!isFshareUrl(href)) continue;

        var title = htmlDecode(extractText(block, /\btitle=["']([^"']+)["']/i))
            || cleanText(stripTags(extractText(block, /<span[^>]*>([\s\S]*?)<\/span>/i)))
            || (isFshareFolderUrl(href) ? "Fshare Folder" : "Fshare File");

        episodes.push({
            id: normalizeFshareUrl(href),
            name: title,
            slug: extractFshareCode(href)
        });
    }

    episodes = uniqueEpisodes(episodes);

    return {
        id: episodes.length ? episodes[0].slug : "fsharecine",
        title: episodes.length === 1 ? episodes[0].name : "Fshare Cine",
        posterUrl: FSHARE_ICON,
        backdropUrl: FSHARE_ICON,
        description: episodes.length ? "Nguồn: Fshare Cine | Link: " + episodes.length : "Không tìm thấy link Fshare trong trang download",
        servers: [{
            name: "Fshare Cine",
            episodes: episodes
        }],
        quality: episodes.length ? detectQuality(episodes[0].name) : "Fshare",
        lang: episodes.length ? detectLang(episodes[0].name) : "Fshare",
        year: episodes.length ? extractYear(episodes[0].name) : 0,
        rating: 0,
        casts: "",
        director: "",
        country: "",
        category: "Fshare Cine",
        status: episodes.length + " link",
        duration: ""
    };
}

function buildEpisodeFromFshareItem(item) {
    var code = cleanText(item.linkcode || "");
    var name = cleanText(item.name || code || "Fshare");
    var size = item.size ? " | " + humanSize(item.size) : "";

    return {
        id: FSHARE_BASE + "/file/" + code,
        name: name + size,
        slug: code
    };
}

function buildFshareLoginStep(fileUrl, fileName) {
    __lastFshareDownloadUrl = fileUrl;
    __lastFshareFileName = fileName || "";

    if (!cleanText(FSHARE_USERNAME) || !cleanText(FSHARE_PASSWORD)) {
        return {
            url: "",
            isEmbed: false,
            headers: {},
            error: "Chưa cấu hình FSHARE_USERNAME/FSHARE_PASSWORD trong plugin"
        };
    }

    return {
        url: FSHARE_LOGIN_API,
        isEmbed: true,
        postBody: JSON.stringify({
            app_key: FSHARE_APP_KEY,
            user_email: cleanText(FSHARE_USERNAME),
            password: cleanText(FSHARE_PASSWORD)
        }),
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": UA
        }
    };
}

// =============================================================================
// HELPERS
// =============================================================================

function parseFilters(filtersJson) {
    try {
        return filtersJson ? JSON.parse(filtersJson) : {};
    } catch (e) {
        return {};
    }
}

function getPage(filters) {
    var page = toInt(filters && filters.page, 1);
    return page > 0 ? page : 1;
}

function buildForumPageUrl(path, page) {
    path = path || "/forums/phim-anh.3/";
    if (page <= 1) return FORUM_BASE + path;
    return FORUM_BASE + path.replace(/\/+$/, "") + "/page-" + page;
}

function buildCinePageUrl(page) {
    if (page <= 1) return THUVIENCINE_BASE + "/";
    return THUVIENCINE_BASE + "/page/" + page + "/";
}

function buildFshareInfoUrl(value) {
    var code = extractFshareCode(value);
    if (!code) code = cleanText(value);

    return FSHARE_FOLDER_API
        + "?linkcode=" + encodeURIComponent(code)
        + "&sort=type,name&page=1&per-page=100";
}

function mapFshareApiItemToListItem(item, source) {
    if (!item) return null;

    var code = cleanText(item.linkcode || item.id || "");
    var rawUrl = cleanText(item.url || "");
    var isFolder = toInt(item.type, -1) === 0 || /\/folder\//i.test(rawUrl);

    if (!rawUrl && code) rawUrl = FSHARE_BASE + (isFolder ? "/folder/" : "/file/") + code;
    rawUrl = normalizeFshareUrl(rawUrl, code, isFolder);
    code = extractFshareCode(rawUrl) || code;

    if (!rawUrl || !code) return null;

    var title = cleanText(item.name || code || "Fshare");
    var size = item.size ? humanSize(item.size) : "";
    var downloads = cleanText(item.downloadcount || item.download_count || "");
    var kind = isFshareFolderUrl(rawUrl) ? "FOLDER" : "FILE";
    var desc = [];

    if (downloads) desc.push("Lượt tải: " + downloads);
    if (size) desc.push("Dung lượng: " + size);
    desc.push("Nguồn: " + source);
    desc.push("Link: " + rawUrl);

    return {
        id: rawUrl,
        title: title,
        posterUrl: FSHARE_ICON,
        backdropUrl: FSHARE_ICON,
        description: desc.join(" | "),
        quality: kind === "FOLDER" ? "FOLDER" : detectQuality(title),
        episode_current: kind,
        lang: detectLang(title),
        year: extractYear(title)
    };
}

function splitForumBlocks(html) {
    var blocks = [];
    var parts = String(html || "").split(/<li[^>]+class=["'][^"']*block-row[\s\S]*?>/i);

    for (var i = 1; i < parts.length; i++) {
        blocks.push(parts[i].split(/<\/li>/i)[0]);
    }

    if (blocks.length === 0) {
        parts = String(html || "").split(/<div[^>]+class=["'][^"']*structItem[\s\S]*?>/i);
        for (i = 1; i < parts.length; i++) blocks.push(parts[i].split(/<\/div>\s*<\/div>/i)[0]);
    }

    return blocks;
}

function extractThreadContent(html) {
    return extractText(html, /<article[^>]*class=["'][^"']*message--post[^"']*["'][\s\S]*?<div[^>]*class=["'][^"']*bbWrapper[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/article>/i)
        || extractText(html, /<div[^>]*class=["'][^"']*bbWrapper[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        || "";
}

function extractFshareUrls(value) {
    var candidates = [];
    var texts = [];
    var html = htmlDecode(String(value || "").replace(/\\\//g, "/"));

    texts.push(html);
    texts.push(multiDecode(html));

    for (var t = 0; t < texts.length; t++) {
        var text = texts[t];
        var regex = /https?:\/\/(?:www\.)?fshare\.vn\/(?:file|folder)\/[A-Za-z0-9]+/gi;
        var match;
        while ((match = regex.exec(text)) !== null) {
            candidates.push(match[0].split("?")[0]);
        }

        var workerRegex = /https?:\/\/fshare\.dzvc\.workers\.dev\/([A-Za-z0-9]+)/gi;
        while ((match = workerRegex.exec(text)) !== null) {
            candidates.push(FSHARE_BASE + "/folder/" + match[1]);
        }
    }

    return uniqueStrings(candidates);
}

function normalizeFshareUrl(url, code, forceFolder) {
    url = multiDecode(cleanText(url)).replace(/&amp;/g, "&");
    var found = extractFshareUrls(url);
    if (found.length > 0) return found[0];

    code = cleanText(code || extractFshareCode(url));
    if (!code) return "";

    return FSHARE_BASE + (forceFolder ? "/folder/" : "/file/") + code;
}

function isFshareUrl(value) {
    return /(?:https?:\/\/)?(?:www\.)?fshare\.vn\/(?:file|folder)\//i.test(cleanText(value));
}

function isFshareFolderUrl(value) {
    return /\/folder\//i.test(cleanText(value));
}

function extractFshareCode(value) {
    value = multiDecode(cleanText(value)).replace(/&amp;/g, "&");

    var match = value.match(/fshare\.vn\/(?:file|folder)\/([A-Za-z0-9]+)/i);
    if (match) return match[1];

    match = value.match(/(?:^|[^A-Za-z0-9])([A-Z0-9]{8,})(?:[^A-Za-z0-9]|$)/);
    return match ? match[1] : "";
}

function looksLikeFshareCode(value) {
    return /^[A-Za-z0-9]{8,}$/.test(cleanText(value));
}

function firstPlayableFile(items) {
    for (var i = 0; i < items.length; i++) {
        if (toInt(items[i] && items[i].type, 0) === 1) return items[i];
    }
    return null;
}

function filterItemsByKeyword(items, keyword) {
    keyword = normalizeSearchText(keyword);
    if (!keyword) return items;

    var filtered = [];
    for (var i = 0; i < items.length; i++) {
        var text = normalizeSearchText((items[i].title || "") + " " + (items[i].description || ""));
        if (text.indexOf(keyword) >= 0) filtered.push(items[i]);
    }
    return filtered.length > 0 ? filtered : items;
}

function addShareParam(url) {
    if (!url) return url;
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "share=8805984";
}

function guessMimeType(url, fileName) {
    var text = (url + " " + fileName).toLowerCase();
    if (text.indexOf(".m3u8") >= 0) return "application/x-mpegURL";
    if (text.indexOf(".mp4") >= 0) return "video/mp4";
    if (text.indexOf(".mkv") >= 0) return "video/x-matroska";
    return "";
}

function detectQuality(text) {
    text = cleanText(text).toLowerCase();
    if (/(2160p|4k|uhd)/i.test(text)) return "4K";
    if (/(1080p|fhd|fullhd|full hd)/i.test(text)) return "FHD";
    if (/720p/i.test(text)) return "HD";
    return "Fshare";
}

function detectLang(text) {
    text = normalizeSearchText(text);
    if (text.indexOf("thuyet minh") >= 0 || text.indexOf("long tieng") >= 0) return "Thuyết minh";
    if (text.indexOf("sub viet") >= 0 || text.indexOf("vietsub") >= 0 || text.indexOf("phu de viet") >= 0) return "Vietsub";
    return "Fshare";
}

function extractYear(text) {
    var match = cleanText(text).match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : 0;
}

function humanSize(value) {
    var size = parseFloat(value || 0);
    if (!size || size < 0) return "";

    var units = ["B", "KB", "MB", "GB", "TB"];
    var idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
        size = size / 1024;
        idx++;
    }

    return (idx === 0 ? String(Math.round(size)) : size.toFixed(2)) + " " + units[idx];
}

function buildUrl(base, params) {
    var query = [];
    for (var key in params) {
        if (!params.hasOwnProperty(key)) continue;
        if (params[key] === undefined || params[key] === null || params[key] === "") continue;
        query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])));
    }
    return base + (query.length ? "?" + query.join("&") : "");
}

function normalizeSlug(value) {
    return cleanText(value).replace(/^\/+|\/+$/g, "").toLowerCase();
}

function normalizeForumUrl(url) {
    url = cleanText(url);
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.charAt(0) === "/") return FORUM_BASE + url;
    return FORUM_BASE + "/" + url;
}

function absoluteForumUrl(url) {
    return normalizeForumUrl(url).split("?")[0];
}

function uniqueItems(items) {
    var seen = {};
    var out = [];

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        var key = cleanText(item.id || item.title).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        out.push(item);
    }

    return out;
}

function uniqueStrings(values) {
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i++) {
        var value = cleanText(values[i]).split("?")[0];
        var key = value.toLowerCase();
        if (!value || seen[key]) continue;
        seen[key] = true;
        out.push(value);
    }
    return out;
}

function uniqueEpisodes(episodes) {
    var seen = {};
    var out = [];
    for (var i = 0; i < episodes.length; i++) {
        var episode = episodes[i];
        var key = cleanText(episode.id || episode.slug).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        out.push(episode);
    }
    return out;
}

function tryParseJson(text) {
    try {
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

function extractMeta(html, property) {
    var re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + escapeRegExp(property) + "[\"'][^>]+content=[\"']([^\"']+)[\"']", "i");
    return htmlDecode(extractText(html, re));
}

function extractText(text, regex) {
    var match = String(text || "").match(regex);
    return match ? match[1] : "";
}

function stripTags(value) {
    return htmlDecode(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function htmlDecode(value) {
    return String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, function (_m, code) {
            return String.fromCharCode(parseInt(code, 10));
        })
        .replace(/&#x([0-9a-f]+);/gi, function (_m, code) {
            return String.fromCharCode(parseInt(code, 16));
        });
}

function multiDecode(value) {
    var result = String(value || "");
    for (var i = 0; i < 4; i++) {
        try {
            var decoded = decodeURIComponent(result);
            if (decoded === result) break;
            result = decoded;
        } catch (e) {
            break;
        }
    }
    return result;
}

function unescapeJsonString(value) {
    return String(value || "").replace(/\\\//g, "/").replace(/\\"/g, "\"").replace(/\\u0026/g, "&");
}

function normalizeSearchText(value) {
    value = cleanText(value).toLowerCase();
    value = value
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
        .replace(/[èéẹẻẽêềếệểễ]/g, "e")
        .replace(/[ìíịỉĩ]/g, "i")
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
        .replace(/[ùúụủũưừứựửữ]/g, "u")
        .replace(/[ỳýỵỷỹ]/g, "y")
        .replace(/đ/g, "d");
    return value;
}

function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
