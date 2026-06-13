// =============================================================================
// Stripchat VAAPP plugin
// =============================================================================

var BASE_URL = "https://vi.strip.chat";
var API_MODELS_URL = BASE_URL + "/api/front/v2/models";
var API_CAM_URL = BASE_URL + "/api/front/v2/models/username/";
var STATIC_URL = "https://static-proxy.strpst.com";
var PAGE_SIZE = 48;
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";
var __lastListPage = 1;

function getManifest() {
    return JSON.stringify({
        id: "stripchat",
        name: "Stripchat",
        version: "1.0.2",
        baseUrl: BASE_URL,
        iconUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Stripchat-logo.svg/960px-Stripchat-logo.svg.png",
        isEnabled: true,
        isAdult: true,
        type: "MOVIE",
        playerType: "embed",
        layoutType: "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "login", title: "Dang nhap Stripchat", type: "Horizontal", path: "category" },
        { slug: "girls", title: "Girls Live", type: "Grid", path: "" },
        { slug: "men", title: "Men Live", type: "Horizontal", path: "category" },
        { slug: "couples", title: "Couples Live", type: "Horizontal", path: "category" },
        { slug: "trans", title: "Trans Live", type: "Horizontal", path: "category" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Dang nhap", slug: "login" },
        { name: "Girls", slug: "girls" },
        { name: "Men", slug: "men" },
        { name: "Couples", slug: "couples" },
        { name: "Trans", slug: "trans" }
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
    var primaryTag = normalizePrimaryTag(slug || filters.primaryTag || "girls");
    __lastListPage = page;

    if (String(slug || "").toLowerCase() === "login") {
        return BASE_URL + "/login";
    }

    return buildUrl(API_MODELS_URL, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        primaryTag: primaryTag
    });
}

function getUrlSearch(keyword, filtersJson) {
    var username = normalizeUsername(keyword || "");
    if (!username) {
        return buildUrl(API_MODELS_URL, {
            limit: PAGE_SIZE,
            offset: 0,
            primaryTag: "girls"
        });
    }

    __lastListPage = 1;
    return API_CAM_URL + encodeURIComponent(username) + "/cam";
}

function getUrlDetail(slug) {
    if (!slug) return "";
    slug = String(slug);
    if (slug === "__stripchat_login__") return BASE_URL + "/login";
    if (slug.indexOf("http://") === 0 || slug.indexOf("https://") === 0) return slug;
    return API_CAM_URL + encodeURIComponent(normalizeUsername(slug)) + "/cam";
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    try {
        var data = tryParseJson(html);

        if (!data) {
            return JSON.stringify({
                items: [{
                    id: "__stripchat_login__",
                    title: "Dang nhap Stripchat",
                    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Stripchat-logo.svg/960px-Stripchat-logo.svg.png",
                    backdropUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Stripchat-logo.svg/960px-Stripchat-logo.svg.png",
                    description: "Mo WebView de dang nhap mot lan. Neu app giu cookie, cac phong live se tu nhan phien dang nhap.",
                    quality: "WEB",
                    episode_current: "Login",
                    lang: "Web",
                    year: 0
                }],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 1,
                    itemsPerPage: PAGE_SIZE
                }
            });
        }

        if (data && data.cam) {
            return JSON.stringify({
                items: [mapCamToItem(data)].filter(function (item) { return !!item; }),
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 1,
                    itemsPerPage: PAGE_SIZE
                }
            });
        }

        var models = extractModels(data);
        var items = [];
        var seen = {};

        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var username = String(model.username || "");
            if (!username || seen[username]) continue;
            seen[username] = true;

            var item = mapModelToItem(model);
            if (item) items.push(item);
        }

        var totalItems = toInt(data && (data.totalCount || data.total_count || data.count), items.length);
        var totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 1;
        if (totalPages < __lastListPage) totalPages = __lastListPage;

        return JSON.stringify({
            items: items,
            pagination: {
                currentPage: __lastListPage || 1,
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: PAGE_SIZE
            }
        });
    } catch (e) {
        return JSON.stringify({
            items: [],
            pagination: { currentPage: 1, totalPages: 1 }
        });
    }
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        var data = tryParseJson(html);

        if (data && data.cam) {
            return JSON.stringify(mapCamToDetail(data));
        }

        var pageUrl = extractCanonicalUrl(html);
        var username = extractUsernameFromUrl(pageUrl) || extractText(html, /"username"\s*:\s*"([^"]+)"/i);
        var posterUrl = normalizeMediaUrl(extractText(html, /"previewUrlThumbBig"\s*:\s*"([^"]+)"/i) || extractMeta(html, "og:image"));
        var episodeUrl = webPlayerUrl(username, pageUrl);

        if (!username && !pageUrl) {
            episodeUrl = BASE_URL + "/login";
        }

        return JSON.stringify({
            id: username,
            title: username || "Dang nhap Stripchat",
            posterUrl: posterUrl,
            backdropUrl: posterUrl,
            description: username ? "" : "Dang nhap trong WebView de luu cookie cho cac phong live.",
            servers: [{
                name: "Web Player",
                episodes: [{
                    id: episodeUrl,
                    name: "Live",
                    slug: "live"
                }]
            }],
            quality: "WEB",
            lang: "Live",
            year: 0,
            rating: 0,
            casts: username,
            director: "",
            country: "",
            category: "",
            status: "Live",
            duration: "Live"
        });
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html, fetchedUrl) {
    try {
        var data = tryParseJson(html);
        if (data && data.cam) {
            var detail = mapCamToDetail(data);
            return JSON.stringify({
                url: webPlayerUrl(detail.id, BASE_URL + "/"),
                isEmbed: false,
                playerType: "embed",
                headers: playerHeaders(detail.id)
            });
        }

        var username = extractUsernameFromAnyUrl(fetchedUrl || "") || extractText(html, /"username"\s*:\s*"([^"]+)"/i);
        return JSON.stringify({
            url: webPlayerUrl(username, fetchedUrl || BASE_URL + "/"),
            isEmbed: false,
            playerType: "embed",
            headers: playerHeaders(username)
        });
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    }
}

function parseEmbedResponse(html, url) {
    try {
        var username = extractUsernameFromAnyUrl(url || "") || extractText(html, /"username"\s*:\s*"([^"]+)"/i);
        return JSON.stringify({
            url: webPlayerUrl(username, url || BASE_URL + "/"),
            isEmbed: false,
            playerType: "embed",
            headers: playerHeaders(username)
        });
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    }
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizePrimaryTag(slug) {
    slug = String(slug || "girls").replace(/^\/+|\/+$/g, "").toLowerCase();

    if (slug === "" || slug === "home" || slug === "popular" || slug === "female" || slug === "women") return "girls";
    if (slug === "male" || slug === "man") return "men";
    if (slug === "couple") return "couples";
    if (slug === "tranny" || slug === "transgender") return "trans";

    if (slug !== "girls" && slug !== "men" && slug !== "couples" && slug !== "trans") return "girls";
    return slug;
}

function extractModels(data) {
    var models = [];
    var i;
    var j;

    if (!data) return models;

    if (data.models && data.models.length !== undefined) {
        for (i = 0; i < data.models.length; i++) models.push(data.models[i]);
    }

    if (data.blocks && data.blocks.length !== undefined) {
        for (i = 0; i < data.blocks.length; i++) {
            var block = data.blocks[i];
            if (!block || !block.models) continue;
            for (j = 0; j < block.models.length; j++) models.push(block.models[j]);
        }
    }

    return models;
}

function mapModelToItem(model) {
    if (!model || !model.username) return null;

    var username = cleanText(model.username);
    var viewers = toInt(model.viewersCount, 0);
    var status = cleanText(model.status || (model.isLive ? "public" : "offline"));
    var posterUrl = normalizeMediaUrl(model.previewUrlThumbSmall || model.previewUrl || model.avatarUrl || "");
    var descriptionParts = [];

    if (viewers > 0) descriptionParts.push(viewers + " viewers");
    if (status) descriptionParts.push("Status: " + status);
    if (model.country) descriptionParts.push(String(model.country).toUpperCase());
    if (model.isHd) descriptionParts.push("HD");
    if (model.isNew) descriptionParts.push("New");

    if (model.groupShowTopic) {
        descriptionParts.push(limitText(cleanText(model.groupShowTopic), 160));
    }

    return {
        id: username,
        title: viewers > 0 ? username + " (" + viewers + ")" : username,
        posterUrl: posterUrl,
        backdropUrl: posterUrl,
        description: descriptionParts.join(" | "),
        quality: model.isHd ? "HD" : "LIVE",
        episode_current: status || "Live",
        lang: "Live",
        year: 0
    };
}

function mapCamToItem(data) {
    var cam = data && data.cam ? data.cam : {};
    var user = data && data.user && data.user.user ? data.user.user : {};
    var model = {
        username: user.username || user.name || "",
        viewersCount: user.viewersCount || cam.viewersCount || 0,
        status: user.status || cam.privateMode || "",
        country: user.country || "",
        isHd: user.isHd,
        isNew: false,
        previewUrlThumbSmall: user.previewUrlThumbSmall || user.avatarUrlThumb || user.avatarUrl,
        groupShowTopic: cam.topic || ""
    };

    return mapModelToItem(model);
}

function mapCamToDetail(data) {
    var cam = data && data.cam ? data.cam : {};
    var user = data && data.user && data.user.user ? data.user.user : {};
    var username = cleanText(user.username || user.name || "");
    var status = cleanText(user.status || cam.privateMode || "");
    var posterUrl = normalizeMediaUrl(user.previewUrlThumbBig || user.previewUrl || user.avatarUrl || "");
    var descriptionParts = [];
    var episodeUrl = webPlayerUrl(username, BASE_URL + "/");

    if (user.age) descriptionParts.push("Age: " + user.age);
    if (status) descriptionParts.push("Status: " + status);
    if (user.country) descriptionParts.push(String(user.country).toUpperCase());
    if (cam.topic) descriptionParts.push(limitText(cleanText(cam.topic), 220));
    if (user.description) descriptionParts.push(limitText(cleanText(user.description), 220));

    return {
        id: username,
        title: username || "Stripchat Live",
        posterUrl: posterUrl,
        backdropUrl: posterUrl,
        description: descriptionParts.join(" | "),
        servers: [{
            name: "Web Player",
            episodes: [{
                id: episodeUrl,
                name: "Live",
                slug: "live"
            }]
        }],
        quality: "WEB",
        lang: "Live",
        year: 0,
        rating: 0,
        casts: username,
        director: "",
        country: user.country || "",
        category: cleanText(user.broadcastGender || user.gender || ""),
        status: status || "Live",
        duration: "Live"
    };
}

function webPlayerUrl(username, fallback) {
    username = normalizeUsername(username || "");
    if (username) return BASE_URL + "/" + encodeURIComponent(username);
    return fallback || BASE_URL + "/";
}

function playerHeaders(username) {
    username = normalizeUsername(username || "");
    return {
        Referer: username ? BASE_URL + "/" + encodeURIComponent(username) : BASE_URL + "/",
        "User-Agent": UA
    };
}

function parseFilters(filtersJson) {
    try {
        return JSON.parse(filtersJson || "{}") || {};
    } catch (e) {
        return {};
    }
}

function getPage(filters) {
    var page = parseInt(filters.page || filters.currentPage || filters.p || 1, 10);
    if (isNaN(page) || page < 1) page = 1;
    return page;
}

function buildUrl(base, params) {
    var query = [];
    for (var key in params) {
        if (!params.hasOwnProperty(key)) continue;
        var value = params[key];
        if (value === undefined || value === null || value === "") continue;
        query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    }
    return base + (query.length ? "?" + query.join("&") : "");
}

function normalizeUsername(username) {
    username = String(username || "").trim();
    username = username.replace(/^https?:\/\/[^\/]+\/?/i, "");
    username = username.replace(/^\/+|\/+$/g, "");
    username = username.split(/[?#]/)[0];
    return username.replace(/\s+/g, "_");
}

function normalizeMediaUrl(url) {
    url = decodeEntities(decodeEscapes(String(url || ""))).trim();
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.charAt(0) === "/") return STATIC_URL + url;
    return url;
}

function tryParseJson(text) {
    try {
        return JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim());
    } catch (e) {
        return null;
    }
}

function extractCanonicalUrl(html) {
    var match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
    return match ? normalizeMediaUrl(match[1]) : "";
}

function extractUsernameFromUrl(url) {
    url = String(url || "");
    var match = url.match(/strip\.chat\/([^\/?#]+)/i);
    return match ? decodeURIComponentSafe(match[1]) : "";
}

function extractUsernameFromAnyUrl(url) {
    url = String(url || "");

    var apiMatch = url.match(/\/models\/username\/([^\/?#]+)\/cam/i);
    if (apiMatch) return decodeURIComponentSafe(apiMatch[1]);

    return extractUsernameFromUrl(url);
}

function extractMeta(html, name) {
    var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("<meta[^>]*(?:property|name)=[\"']" + escaped + "[\"'][^>]*content=[\"']([^\"']+)[\"']", "i");
    var match = html.match(re);
    return match ? decodeEntities(match[1]) : "";
}

function extractText(text, regex) {
    var match = decodeEscapes(String(text || "")).match(regex);
    return match ? decodeEntities(match[1]) : "";
}

function decodeEscapes(text) {
    return String(text || "")
        .replace(/\\u([0-9a-fA-F]{4})/g, function (m, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/\\\//g, "/")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
}

function cleanText(text) {
    return decodeEntities(decodeEscapes(String(text || "")))
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function decodeEntities(text) {
    var entities = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " "
    };

    return String(text || "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (match, entity) {
        var key = entity.toLowerCase();
        if (entities.hasOwnProperty(key)) return entities[key];

        if (key.charAt(0) === "#") {
            var isHex = key.charAt(1) === "x";
            var num = parseInt(isHex ? key.substring(2) : key.substring(1), isHex ? 16 : 10);
            if (!isNaN(num)) return String.fromCharCode(num);
        }

        return match;
    });
}

function limitText(text, maxLen) {
    text = String(text || "").trim();
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3).replace(/\s+\S*$/, "") + "...";
}

function toInt(value, fallback) {
    var number = parseInt(value, 10);
    return isNaN(number) ? fallback : number;
}

function decodeURIComponentSafe(value) {
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return value;
    }
}
