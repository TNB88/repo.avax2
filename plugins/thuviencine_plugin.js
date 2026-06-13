// =============================================================================
// ThuVienCine VAAPP plugin
// Site: https://thuviencine.xyz
// Play flow: ThuVienCine download page -> Fshare folder/file -> Fshare API login
// -> Fshare session/download -> ExoPlayer.
// =============================================================================

// Fill these in your private/local copy. Do not publish a copy with real
// credentials to a public raw GitHub URL.
var FSHARE_USERNAME = "";
var FSHARE_PASSWORD = "";

var BASE_URL = "https://thuviencine.xyz";
var FSHARE_BASE = "https://www.fshare.vn";
var FSHARE_FOLDER_API = FSHARE_BASE + "/api/v3/files/folder";
var FSHARE_LOGIN_API = "https://api.fshare.vn/api/user/login";
var FSHARE_DOWNLOAD_API = "https://api.fshare.vn/api/session/download";
// Fshare API normally requires the app_key and the User-Agent/app agent issued
// with that key. Replace both values with your own API credentials if login
// returns HTTP 400.
var FSHARE_APP_KEY = "dMnqMMZMUnN5YpvKENaEhdQQ5jxDqddt";
var FSHARE_API_USER_AGENT = "";
var FSHARE_PREFER_WEB_LOGIN = true;
var ICON_URL = BASE_URL + "/favicon.ico";
var PAGE_SIZE = 24;
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";

function getManifest() {
    return JSON.stringify({
        "id": "thuviencine",
        "name": "ThuVienCine",
        "version": "1.0.3",
        "baseUrl": "https://www.fshare.vn",
        "fallbackUrls": ["https://thuviencine.xyz"],
        "iconUrl": ICON_URL,
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "playerType": "auto",
        "layoutType": "VERTICAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "home", title: "ThuVienCine", type: "Grid", path: "" },
        { slug: "top", title: "Phim Hot", type: "Horizontal", path: "category" },
        { slug: "movies", title: "Phim Lẻ", type: "Horizontal", path: "category" },
        { slug: "tv-series", title: "Phim Bộ", type: "Horizontal", path: "category" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Trang chủ", slug: "home" },
        { name: "Phim Hot", slug: "top" },
        { name: "Tất Cả", slug: "home-page" },
        { name: "Phim Lẻ", slug: "movies" },
        { name: "Phim Bộ", slug: "tv-series" }
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
    var normalized = normalizeSlug(slug || "home");

    if (normalized === "top") return buildPagedUrl("/top/", page);
    if (normalized === "movies") return buildPagedUrl("/movies/", page);
    if (normalized === "tv-series" || normalized === "series") return buildPagedUrl("/tv-series/", page);
    if (normalized === "home-page" || normalized === "all") return buildPagedUrl("/home-page/", page);

    return buildPagedUrl("/", page);
}

function getUrlSearch(keyword, filtersJson) {
    var filters = parseFilters(filtersJson);
    var page = getPage(filters);
    var query = cleanText(keyword || "").replace(/\s+/g, "+");

    if (page <= 1) return BASE_URL + "/?s=" + encodeURIComponent(query).replace(/%2B/g, "+");
    return BASE_URL + "/page/" + page + "/?s=" + encodeURIComponent(query).replace(/%2B/g, "+");
}

function getUrlDetail(slug) {
    slug = cleanText(slug || "");
    if (!slug) return "";

    if (slug.indexOf("download:") === 0) {
        return BASE_URL + "/download?id=" + encodeURIComponent(slug.replace(/^download:/, ""));
    }

    if (isFshareUrl(slug) || looksLikeFshareCode(slug)) {
        return buildFshareInfoUrl(slug);
    }

    if (slug.indexOf("http://") === 0 || slug.indexOf("https://") === 0) {
        return slug;
    }

    return BASE_URL + "/" + slug.replace(/^\/+/, "");
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    return JSON.stringify({
        items: parseMovieCards(html),
        pagination: parsePagination(html)
    });
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        var data = tryParseJson(html);
        if (data && data.current) return JSON.stringify(buildFshareFolderDetail(data));

        if (hasDownloadLinks(html)) return JSON.stringify(buildDownloadPageDetail(html));

        return JSON.stringify(buildMoviePageDetail(html));
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html, fetchedUrl) {
    try {
        var data = tryParseJson(html);
        if (data && data.current) {
            return JSON.stringify(resolveFshareFolderData(data));
        }

        var links = parseDownloadLinks(html);
        if (links.length > 0) {
            return JSON.stringify(resolveFshareUrl(links[0].url, links[0].name));
        }

        var code = extractFshareCode(fetchedUrl || "");
        if (code) {
            return JSON.stringify(buildFsharePlayStep(FSHARE_BASE + "/file/" + code, code));
        }

        return JSON.stringify(buildSafeFsharePageResult(FSHARE_BASE + "/", "Khong tim thay link Fshare"));
    } catch (e) {
        return JSON.stringify(buildSafeFsharePageResult(FSHARE_BASE + "/", String(e && e.message ? e.message : e)));
    }
}

function parseEmbedResponse(html, sourceUrl) {
    try {
        var data = tryParseJson(html) || {};
        sourceUrl = cleanText(sourceUrl || "");

        if (data && data.current) {
            return JSON.stringify(resolveFshareFolderData(data));
        }

        if (sourceUrl.indexOf(FSHARE_BASE + "/download/get") === 0 || data.url || data.download_url) {
            return JSON.stringify(resolveFshareWebDownloadData(data, sourceUrl));
        }

        if (isFshareFileUrl(sourceUrl) || /id=["']form-download["']/i.test(html || "")) {
            return JSON.stringify(buildFshareWebDownloadStep(html, sourceUrl));
        }

        if (sourceUrl.indexOf(FSHARE_LOGIN_API) === 0 || data.token || data.session_id) {
            var token = cleanText(data.token || "");
            var sessionId = cleanText(data.session_id || "");
            var fileUrl = getQueryParam(sourceUrl, "fileUrl");
            var fileName = getQueryParam(sourceUrl, "fileName");

            if (!token || !sessionId || !fileUrl) {
                return JSON.stringify(buildSafeFsharePageResult(fileUrl || FSHARE_BASE + "/site/login", cleanText(data.msg || "Login Fshare loi. Kiem tra tai khoan VIP, FSHARE_APP_KEY va FSHARE_API_USER_AGENT.")));
            }

            return JSON.stringify({
                url: FSHARE_DOWNLOAD_API + "?fileName=" + encodeURIComponent(fileName),
                isEmbed: true,
                postBody: JSON.stringify({
                    url: addShareParam(fileUrl),
                    password: "",
                    token: token,
                    zipflag: 0
                }),
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": fshareUserAgent(),
                    "Cookie": "session_id=" + sessionId
                }
            });
        }

        var location = cleanText(data.location || "");
        if (!location) {
            location = unescapeJsonString(extractText(html, /"location"\s*:\s*"([^"]+)"/i));
        }

        if (location) {
            var finalName = getQueryParam(sourceUrl, "fileName");
            return JSON.stringify({
                url: location,
                isEmbed: false,
                mimeType: guessMimeType(location, finalName),
                headers: {
                    "User-Agent": fshareUserAgent(),
                    "Referer": FSHARE_BASE + "/"
                }
            });
        }

        return JSON.stringify(buildSafeFsharePageResult(FSHARE_BASE + "/", cleanText(data.msg || "Khong lay duoc link Fshare")));
    } catch (e) {
        return JSON.stringify(buildSafeFsharePageResult(FSHARE_BASE + "/", String(e && e.message ? e.message : e)));
    }
}

// =============================================================================
// THUVIENCINE PARSING
// =============================================================================

function parseMovieCards(html) {
    var parts = String(html || "").split(/<div\s+id=["']post-/i);
    var items = [];

    for (var i = 1; i < parts.length; i++) {
        var block = parts[i];
        var postId = extractText(block, /^(\d+)/);
        var href = extractText(block, /<a[^>]+href=["']([^"']+)["'][^>]+rel=["']bookmark["']/i)
            || extractText(block, /<a[^>]+rel=["']bookmark["'][^>]+href=["']([^"']+)["']/i);

        if (!postId || !href) continue;

        var title = htmlDecode(extractText(block, /<a[^>]+rel=["']bookmark["'][^>]+title=["']([^"']+)["']/i))
            || cleanText(stripTags(extractText(block, /<h2[^>]*class=["'][^"']*movie-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)))
            || "ThuVienCine " + postId;
        var poster = normalizeImageUrl(extractText(block, /<img[^>]+(?:data-src|data-original)=["']([^"']+)["']/i)
            || extractText(block, /<img[^>]+src=["']([^"']+)["']/i));
        var description = cleanText(stripTags(extractText(block, /<p[^>]*class=["'][^"']*movie-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)));
        var quality = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*item-quality[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))) || detectQuality(title);
        var year = toInt(cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*movie-date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))), extractYear(title));
        var genre = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*genre[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)));
        var runtime = cleanText(stripTags(extractText(block, /<span[^>]*class=["'][^"']*runtime[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)));

        items.push({
            id: normalizeUrl(href),
            title: title,
            posterUrl: poster,
            backdropUrl: poster,
            description: [description, genre, runtime].filter(Boolean).join(" | "),
            quality: quality,
            episode_current: "Fshare",
            lang: detectLang(title + " " + quality + " " + description),
            year: year
        });
    }

    return uniqueItems(items);
}

function buildMoviePageDetail(html) {
    var postId = extractText(html, /<article[^>]+id=["']post-(\d+)["']/i)
        || extractText(html, /download\?id=(\d+)/i);
    var title = cleanText(stripTags(extractText(html, /<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)))
        || htmlDecode(extractMeta(html, "og:title"))
        || "ThuVienCine";
    var poster = normalizeImageUrl(extractText(html, /<div[^>]*class=["'][^"']*movie-image[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
        || extractMeta(html, "og:image"));
    var description = cleanText(stripTags(extractText(html, /<p[^>]*class=["'][^"']*movie-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)))
        || cleanText(extractMeta(html, "description"));
    var year = toInt(cleanText(stripTags(extractText(html, /<a[^>]+href=["'][^"']*\/years\/[^"']+["'][^>]*>(\d{4})<\/a>/i))), extractYear(title));
    var genre = collectAnchorTexts(extractText(html, /<span[^>]+itemprop=["']genre["'][^>]*>([\s\S]*?)<\/span>/i)).join(", ");
    var duration = cleanText(stripTags(extractText(html, /<span[^>]+itemprop=["']duration["'][^>]*>([\s\S]*?)<\/span>/i)));
    var casts = collectPersonTexts(html, "actors").join(", ");
    var directors = collectPersonTexts(html, "director").join(", ");
    var rating = parseFloat(cleanText(stripTags(extractText(html, /<span[^>]*class=["'][^"']*progress-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)))) || 0;

    return {
        id: postId || title,
        title: title,
        posterUrl: poster,
        backdropUrl: poster,
        description: description,
        servers: [{
            name: "ThuVienCine",
            episodes: postId ? [{
                id: "download:" + postId,
                name: "Download Fshare",
                slug: postId
            }] : []
        }],
        quality: detectQuality(title + " " + html),
        lang: detectLang(title + " " + description),
        year: year,
        rating: rating,
        casts: casts,
        director: directors,
        country: "",
        category: genre,
        status: postId ? "Ready" : "Không tìm thấy link download",
        duration: duration
    };
}

function buildDownloadPageDetail(html) {
    var links = parseDownloadLinks(html);
    var episodes = [];

    for (var i = 0; i < links.length; i++) {
        episodes.push({
            id: links[i].url,
            name: links[i].name,
            slug: extractFshareCode(links[i].url)
        });
    }

    return {
        id: episodes.length ? episodes[0].slug : "download",
        title: episodes.length === 1 ? episodes[0].name : "ThuVienCine Download",
        posterUrl: ICON_URL,
        backdropUrl: ICON_URL,
        description: "Nguồn: ThuVienCine | Fshare links: " + episodes.length,
        servers: [{ name: "Fshare", episodes: episodes }],
        quality: episodes.length ? detectQuality(episodes[0].name) : "Fshare",
        lang: episodes.length ? detectLang(episodes[0].name) : "Fshare",
        year: episodes.length ? extractYear(episodes[0].name) : 0,
        rating: 0,
        casts: "",
        director: "",
        country: "",
        category: "Fshare",
        status: episodes.length + " link",
        duration: ""
    };
}

function parseDownloadLinks(html) {
    var blocks = String(html || "").split(/<li\b/i);
    var links = [];

    for (var i = 1; i < blocks.length; i++) {
        var block = blocks[i].split(/<\/li>/i)[0];
        var href = extractText(block, /<a[^>]+href=["']([^"']+)["']/i);
        if (!isFshareUrl(href)) continue;

        var name = htmlDecode(extractText(block, /\btitle=["']([^"']+)["']/i))
            || cleanText(stripTags(extractText(block, /<span[^>]*>([\s\S]*?)<\/span>/i)))
            || (isFshareFolderUrl(href) ? "Fshare Folder" : "Fshare File");

        links.push({ name: name, url: normalizeFshareUrl(href) });
    }

    return uniqueLinkObjects(links);
}

function hasDownloadLinks(html) {
    return /movie-actions/i.test(html || "") && /fshare\.vn\/(?:file|folder)\//i.test(html || "");
}

// =============================================================================
// FSHARE RESOLUTION
// =============================================================================

function buildFshareFolderDetail(data) {
    var current = data.current || {};
    var episodes = [];

    if (toInt(current.type, 0) === 1) {
        episodes.push(episodeFromFshareItem(current));
    } else if (data.items && data.items.length !== undefined) {
        for (var i = 0; i < data.items.length; i++) {
            if (toInt(data.items[i].type, 0) === 1) episodes.push(episodeFromFshareItem(data.items[i]));
        }
    }

    return {
        id: current.linkcode || "",
        title: cleanText(current.name || current.linkcode || "Fshare"),
        posterUrl: ICON_URL,
        backdropUrl: ICON_URL,
        description: current.size ? "Dung lượng: " + humanSize(current.size) : "",
        servers: [{ name: "Fshare", episodes: episodes }],
        quality: detectQuality(current.name || ""),
        lang: detectLang(current.name || ""),
        year: extractYear(current.name || ""),
        rating: 0,
        casts: "",
        director: "",
        country: "",
        category: toInt(current.type, 0) === 1 ? "Fshare File" : "Fshare Folder",
        status: episodes.length + " file",
        duration: ""
    };
}

function resolveFshareFolderData(data) {
    var current = data.current || {};

    if (toInt(current.type, 0) === 1 && current.linkcode) {
        return buildFsharePlayStep(FSHARE_BASE + "/file/" + current.linkcode, current.name || current.linkcode);
    }

    var item = firstPlayableFile(data.items || []);
    if (item && item.linkcode) {
        return buildFsharePlayStep(FSHARE_BASE + "/file/" + item.linkcode, item.name || item.linkcode);
    }

    return buildSafeFsharePageResult(FSHARE_BASE + "/", "Folder Fshare khong co file phat duoc");
}

function resolveFshareUrl(url, name) {
    if (isFshareFolderUrl(url)) {
        return {
            url: buildFshareInfoUrl(url),
            isEmbed: true,
            headers: {
                "Accept": "application/json,text/plain,*/*",
                "User-Agent": fshareUserAgent(),
                "Referer": FSHARE_BASE + "/"
            }
        };
    }

    return buildFsharePlayStep(normalizeFshareUrl(url), name || extractFshareCode(url));
}

function buildFsharePlayStep(fileUrl, fileName) {
    if (FSHARE_PREFER_WEB_LOGIN) return buildFshareWebFileStep(fileUrl, fileName);
    if (cleanText(FSHARE_USERNAME) && cleanText(FSHARE_PASSWORD)) return buildFshareLoginStep(fileUrl, fileName);
    return buildFshareWebFileStep(fileUrl, fileName);
}

function buildFshareWebFileStep(fileUrl, fileName) {
    return {
        url: normalizeFshareUrl(fileUrl),
        isEmbed: true,
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": UA,
            "Referer": FSHARE_BASE + "/"
        }
    };
}

function buildFshareWebDownloadStep(html, sourceUrl) {
    var form = extractText(html, /(<form[^>]+id=["']form-download["'][\s\S]*?<\/form>)/i);
    var action = normalizeFshareAction(extractText(form, /<form[^>]+action=["']([^"']+)["']/i) || "/download/get");
    var body = buildFormPostBody(form);

    if (!body || body.indexOf("linkcode=") < 0) {
        var code = extractFshareCode(sourceUrl || html || "");
        if (code) {
            body = "linkcode=" + encodeURIComponent(code) + "&ushare=&withFcode5=0";
        }
    }

    if (!body) {
        return buildSafeFsharePageResult(sourceUrl || FSHARE_BASE + "/site/login", "Khong lay duoc form download Fshare. Hay dang nhap Fshare bang nut Dang nhap roi thu lai.");
    }

    action = action + (action.indexOf("?") >= 0 ? "&" : "?")
        + "fallbackUrl=" + encodeURIComponent(normalizeUrlForReferer(sourceUrl))
        + "&fileName=" + encodeURIComponent(extractFshareFileName(html) || extractFshareCode(sourceUrl || ""));

    return {
        url: action,
        isEmbed: true,
        postBody: body,
        headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": UA,
            "Referer": normalizeUrlForReferer(sourceUrl),
            "Origin": FSHARE_BASE
        }
    };
}

function resolveFshareWebDownloadData(data, sourceUrl) {
    var url = cleanText(data.url || data.download_url || data.location || "");
    if (url) {
        var finalName = getQueryParam(sourceUrl, "fileName");
        return {
            url: normalizeUrlWithBase(url, FSHARE_BASE),
            isEmbed: false,
            mimeType: guessMimeType(url, finalName),
            headers: {
                "User-Agent": UA,
                "Referer": FSHARE_BASE + "/"
            }
        };
    }

    var error = cleanText(data.msg || data.message || data.error || "");
    if (!error && data.errors) error = cleanText(JSON.stringify(data.errors));
    return buildSafeFsharePageResult(
        getQueryParam(sourceUrl, "fallbackUrl") || FSHARE_BASE + "/site/login",
        error || "Fshare chua tra link tai. Hay dang nhap Fshare, tai khoan VIP se on dinh hon tai khoan free."
    );
}

function buildFshareLoginStep(fileUrl, fileName) {
    if (!cleanText(FSHARE_USERNAME) || !cleanText(FSHARE_PASSWORD)) {
        return {
            url: normalizeFshareUrl(fileUrl) || FSHARE_BASE + "/site/login",
            isEmbed: false,
            mimeType: "text/html",
            headers: {
                "User-Agent": UA,
                "Referer": FSHARE_BASE + "/"
            },
            error: "Chua cau hinh FSHARE_USERNAME/FSHARE_PASSWORD trong plugin"
        };
    }

    return {
        url: FSHARE_LOGIN_API + "?fileUrl=" + encodeURIComponent(fileUrl) + "&fileName=" + encodeURIComponent(fileName || ""),
        isEmbed: true,
        postBody: JSON.stringify({
            user_email: cleanText(FSHARE_USERNAME),
            password: cleanText(FSHARE_PASSWORD),
            app_key: FSHARE_APP_KEY
        }),
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": fshareUserAgent()
        }
    };
}

function episodeFromFshareItem(item) {
    var code = cleanText(item.linkcode || "");
    var name = cleanText(item.name || code || "Fshare");
    if (item.size) name += " | " + humanSize(item.size);
    return { id: FSHARE_BASE + "/file/" + code, name: name, slug: code };
}

function firstPlayableFile(items) {
    for (var i = 0; i < items.length; i++) {
        if (toInt(items[i] && items[i].type, 0) === 1) return items[i];
    }
    return null;
}

// =============================================================================
// HELPERS
// =============================================================================

function buildPagedUrl(path, page) {
    path = path || "/";
    if (page <= 1) return BASE_URL + path;
    return BASE_URL + path.replace(/\/+$/, "") + "/page/" + page + "/";
}

function buildFshareInfoUrl(value) {
    var code = extractFshareCode(value) || cleanText(value);
    return FSHARE_FOLDER_API + "?linkcode=" + encodeURIComponent(code) + "&sort=type,name&page=1&per-page=100";
}

function buildSafeFsharePageResult(url, message) {
    return {
        url: normalizeUrlWithBase(url || FSHARE_BASE + "/site/login", FSHARE_BASE),
        isEmbed: false,
        mimeType: "text/html",
        headers: {
            "User-Agent": UA,
            "Referer": FSHARE_BASE + "/"
        },
        error: cleanText(message || "Fshare chua tra link xem")
    };
}

function buildFormPostBody(formHtml) {
    var values = [];
    var re = /<input[^>]+>/gi;
    var match;

    while ((match = re.exec(formHtml || "")) !== null) {
        var tag = match[0];
        var name = htmlDecode(extractText(tag, /\bname=["']([^"']+)["']/i));
        if (!name) continue;

        var value = htmlDecode(extractText(tag, /\bvalue=["']([^"']*)["']/i));
        values.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
    }

    if (values.join("&").indexOf("withFcode5=") < 0) values.push("withFcode5=0");
    return values.join("&");
}

function extractFshareFileName(html) {
    return htmlDecode(extractText(html, /<div[^>]+id=["']file-name-r["'][^>]*>([\s\S]*?)<\/div>/i))
        || htmlDecode(extractText(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i))
        || htmlDecode(extractText(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
}

function normalizeFshareAction(action) {
    return normalizeUrlWithBase(action || "/download/get", FSHARE_BASE);
}

function normalizeUrlWithBase(url, base) {
    url = cleanText(url);
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.charAt(0) === "/") return base.replace(/\/+$/, "") + url;
    return base.replace(/\/+$/, "") + "/" + url;
}

function normalizeUrlForReferer(url) {
    if (isFshareFileUrl(url)) return normalizeFshareUrl(url);
    return FSHARE_BASE + "/";
}

function parsePagination(html) {
    var current = 1;
    var total = 1;
    var match;
    var re = /\/page\/(\d+)\/|[?&]paged?=(\d+)/gi;

    while ((match = re.exec(html || "")) !== null) {
        var page = toInt(match[1] || match[2], 1);
        if (page > total) total = page;
    }

    var active = extractText(html, /<span[^>]*class=["'][^"']*current[^"']*["'][^>]*>(\d+)<\/span>/i);
    if (active) current = toInt(active, 1);

    return {
        currentPage: current,
        totalPages: total,
        totalItems: 0,
        itemsPerPage: PAGE_SIZE
    };
}

function isFshareUrl(value) {
    return /(?:https?:\/\/)?(?:www\.)?fshare\.vn\/(?:file|folder)\//i.test(cleanText(value));
}

function isFshareFolderUrl(value) {
    return /\/folder\//i.test(cleanText(value));
}

function isFshareFileUrl(value) {
    return /(?:https?:\/\/)?(?:www\.)?fshare\.vn\/file\//i.test(cleanText(value));
}

function normalizeFshareUrl(url) {
    url = multiDecode(cleanText(url)).replace(/&amp;/g, "&");
    var match = url.match(/https?:\/\/(?:www\.)?fshare\.vn\/(?:file|folder)\/[A-Za-z0-9]+/i);
    if (match) return match[0].replace("http://", "https://").replace("https://fshare.vn", FSHARE_BASE);

    var code = extractFshareCode(url);
    return code ? FSHARE_BASE + "/file/" + code : "";
}

function extractFshareCode(value) {
    value = multiDecode(cleanText(value));
    var match = value.match(/fshare\.vn\/(?:file|folder)\/([A-Za-z0-9]+)/i);
    if (match) return match[1];
    match = value.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{8,})(?:[^A-Za-z0-9]|$)/);
    return match ? match[1] : "";
}

function looksLikeFshareCode(value) {
    return /^[A-Za-z0-9]{8,}$/.test(cleanText(value));
}

function addShareParam(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "share=8805984";
}

function fshareUserAgent() {
    return cleanText(FSHARE_API_USER_AGENT) || UA;
}

function getQueryParam(url, key) {
    var match = String(url || "").match(new RegExp("[?&]" + escapeRegExp(key) + "=([^&#]*)"));
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
}

function guessMimeType(url, fileName) {
    var text = (url + " " + fileName).toLowerCase();
    if (text.indexOf(".m3u8") >= 0) return "application/x-mpegURL";
    if (text.indexOf(".mp4") >= 0) return "video/mp4";
    if (text.indexOf(".mkv") >= 0) return "video/x-matroska";
    return "";
}

function collectPersonTexts(html, prop) {
    var values = [];
    var re = new RegExp("<span[^>]+itemprop=[\"']" + prop + "[\"'][\\s\\S]*?<\\/span>\\s*<\\/span>", "gi");
    var match;
    while ((match = re.exec(html || "")) !== null) {
        var name = cleanText(stripTags(match[0]));
        if (name) values.push(name);
    }
    return uniqueStrings(values);
}

function collectAnchorTexts(html) {
    var values = [];
    var re = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    var match;
    while ((match = re.exec(html || "")) !== null) {
        var value = cleanText(stripTags(match[1]));
        if (value) values.push(value);
    }
    return uniqueStrings(values);
}

function detectQuality(text) {
    text = cleanText(text).toLowerCase();
    if (text.indexOf("4k") >= 0 || text.indexOf("2160p") >= 0 || text.indexOf("uhd") >= 0) return "4K";
    if (text.indexOf("1080p") >= 0 || text.indexOf("fhd") >= 0 || text.indexOf("full hd") >= 0) return "FHD";
    if (text.indexOf("720p") >= 0) return "HD";
    return "Fshare";
}

function detectLang(text) {
    text = normalizeSearchText(text);
    if (text.indexOf("thuyet minh") >= 0 || text.indexOf("long tieng") >= 0 || text.indexOf("tm") >= 0) return "Thuyết minh";
    if (text.indexOf("vietsub") >= 0 || text.indexOf("sub viet") >= 0 || text.indexOf("phu de") >= 0 || text.indexOf("pd") >= 0) return "Vietsub";
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

function normalizeSlug(value) {
    return cleanText(value).replace(/^\/+|\/+$/g, "").toLowerCase();
}

function normalizeUrl(url) {
    url = cleanText(url);
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.charAt(0) === "/") return BASE_URL + url;
    return BASE_URL + "/" + url;
}

function normalizeImageUrl(url) {
    url = normalizeUrl(url);
    if (url.indexOf("data:image") === 0) return "";
    return url;
}

function parseFilters(filtersJson) {
    try { return filtersJson ? JSON.parse(filtersJson) : {}; } catch (e) { return {}; }
}

function getPage(filters) {
    var page = toInt(filters && filters.page, 1);
    return page > 0 ? page : 1;
}

function tryParseJson(text) {
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
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
    return htmlDecode(String(value || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "));
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
        .replace(/&#(\d+);/g, function (_m, code) { return String.fromCharCode(parseInt(code, 10)); })
        .replace(/&#x([0-9a-f]+);/gi, function (_m, code) { return String.fromCharCode(parseInt(code, 16)); });
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
    return cleanText(value).toLowerCase()
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
        .replace(/[èéẹẻẽêềếệểễ]/g, "e")
        .replace(/[ìíịỉĩ]/g, "i")
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
        .replace(/[ùúụủũưừứựửữ]/g, "u")
        .replace(/[ỳýỵỷỹ]/g, "y")
        .replace(/đ/g, "d");
}

function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
}

function uniqueItems(items) {
    var seen = {};
    var out = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var key = cleanText(item.id || item.title).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        out.push(item);
    }
    return out;
}

function uniqueLinkObjects(links) {
    var seen = {};
    var out = [];
    for (var i = 0; i < links.length; i++) {
        var key = cleanText(links[i].url).toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        out.push(links[i]);
    }
    return out;
}

function uniqueStrings(values) {
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i++) {
        var value = cleanText(values[i]);
        var key = value.toLowerCase();
        if (!value || seen[key]) continue;
        seen[key] = true;
        out.push(value);
    }
    return out;
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
