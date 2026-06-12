// =============================================================================
// Chaturbate / chattubate.com VAAPP plugin
// =============================================================================

var BASE_URL = "https://chaturbate.com";
var API_URL = BASE_URL + "/api/ts/roomlist/room-list/";
var PAGE_SIZE = 48;
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";
var __lastListPage = 1;

function getManifest() {
    return JSON.stringify({
        id: "chattubate",
        name: "Chaturbate",
        version: "1.0.0",
        baseUrl: BASE_URL,
        iconUrl: "https://web2.static.mmcdn.com/images/logo-new-light.svg",
        isEnabled: true,
        isAdult: true,
        type: "MOVIE",
        playerType: "auto",
        layoutType: "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "home", title: "Live Popular", type: "Grid", path: "" },
        { slug: "female", title: "Female Cams", type: "Horizontal", path: "category" },
        { slug: "male", title: "Male Cams", type: "Horizontal", path: "category" },
        { slug: "couple", title: "Couple Cams", type: "Horizontal", path: "category" },
        { slug: "trans", title: "Trans Cams", type: "Horizontal", path: "category" },
        { slug: "new", title: "New Cams", type: "Horizontal", path: "category" },
        { slug: "gaming", title: "Gaming Cams", type: "Horizontal", path: "category" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "All Live", slug: "home" },
        { name: "Female", slug: "female" },
        { name: "Male", slug: "male" },
        { name: "Couple", slug: "couple" },
        { name: "Trans", slug: "trans" },
        { name: "New", slug: "new" },
        { name: "Gaming", slug: "gaming" },
        { name: "North America", slug: "north-america" },
        { name: "South America", slug: "south-america" },
        { name: "Asia", slug: "asia" },
        { name: "Europe/Russia", slug: "euro-russian" },
        { name: "Other Region", slug: "other-region" }
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
    __lastListPage = page;

    var params = {
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE
    };

    mergeParams(params, paramsForSlug(slug || "home"));

    if (filters.sort) params.sort = filters.sort;
    if (filters.tag) params.hashtags = String(filters.tag).replace(/^#/, "");
    if (filters.keyword || filters.keywords) {
        params.keywords = normalizeKeyword(filters.keyword || filters.keywords);
    }

    return buildUrl(API_URL, params);
}

function getUrlSearch(keyword, filtersJson) {
    var filters = parseFilters(filtersJson);
    var page = getPage(filters);
    __lastListPage = page;

    return buildUrl(API_URL, {
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        keywords: normalizeKeyword(keyword || "")
    });
}

function getUrlDetail(slug) {
    if (!slug) return "";
    slug = String(slug);
    if (slug.indexOf("http://") === 0 || slug.indexOf("https://") === 0) return slug;
    if (slug.indexOf(".m3u8") !== -1) return slug;
    slug = slug.replace(/^\/+|\/+$/g, "");
    if (!slug) return BASE_URL + "/";
    return BASE_URL + "/" + encodeURIComponent(slug) + "/";
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

function paramsForSlug(slug) {
    slug = String(slug || "home").replace(/^\/+|\/+$/g, "").toLowerCase();

    if (slug.indexOf("tag:") === 0) {
        return { hashtags: slug.substring(4).replace(/^#/, "") };
    }

    if (slug.indexOf("tag-") === 0) {
        return { hashtags: slug.substring(4).replace(/^#/, "") };
    }

    switch (slug) {
        case "":
        case "home":
        case "all":
        case "popular":
            return {};
        case "female":
        case "female-cams":
            return { genders: "f" };
        case "male":
        case "male-cams":
            return { genders: "m" };
        case "couple":
        case "couple-cams":
            return { genders: "c" };
        case "trans":
        case "trans-cams":
            return { genders: "t" };
        case "new":
        case "new-cams":
            return { new_cams: true };
        case "gaming":
        case "gaming-cams":
            return { gaming: true };
        case "exhibitionist":
        case "exhibitionist-cams":
            return { exhib: true };
        case "north-america":
        case "north-american-cams":
            return { regions: "NA" };
        case "south-america":
        case "south-american-cams":
            return { regions: "SA" };
        case "asia":
        case "asian-cams":
            return { regions: "AS" };
        case "euro-russian":
        case "euro-russian-cams":
            return { regions: "ER" };
        case "other-region":
        case "other-region-cams":
            return { regions: "O" };
        default:
            return { hashtags: slug };
    }
}

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    try {
        var data = tryParseJson(html);
        var rooms = [];

        if (data && data.rooms && data.rooms.length !== undefined) {
            rooms = data.rooms;
        } else if (data && data.items && data.items.length !== undefined) {
            rooms = data.items;
        }

        var items = [];
        for (var i = 0; i < rooms.length; i++) {
            var item = mapRoomToItem(rooms[i]);
            if (item) items.push(item);
        }

        var totalItems = toInt(data && (data.total_count || data.all_rooms_count || data.count), items.length);
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
        var dossier = parseInitialRoomDossier(html) || {};
        var username = cleanText(dossier.broadcaster_username || extractUsername(html));
        var roomUrl = username ? BASE_URL + "/" + encodeURIComponent(username) + "/" : extractCanonicalUrl(html);
        var hlsUrl = extractHlsSource(html);
        var posterUrl = normalizeUrl(dossier.summary_card_image || extractMeta(html, "og:image"));
        var title = username || cleanText(extractMeta(html, "og:title")) || "Live Room";
        var subject = cleanText(dossier.room_title || extractMeta(html, "description"));
        var status = cleanText(dossier.room_status || "live");
        var viewers = toInt(dossier.num_viewers, 0);
        var descriptionParts = [];

        if (viewers > 0) descriptionParts.push(viewers + " viewers");
        if (status) descriptionParts.push("Status: " + status);
        if (subject) descriptionParts.push(subject);

        if (!posterUrl && username) {
            posterUrl = "https://thumb.live.mmcdn.com/riw/" + encodeURIComponent(username) + ".jpg";
        }

        var episodeUrl = hlsUrl || roomUrl;
        var serverName = hlsUrl ? "HLS Live" : "Web Player";

        return JSON.stringify({
            id: username,
            title: title,
            posterUrl: posterUrl,
            backdropUrl: posterUrl,
            description: descriptionParts.join(" | "),
            servers: [{
                name: serverName,
                episodes: [{
                    id: episodeUrl,
                    name: "Live",
                    slug: "live"
                }]
            }],
            quality: hlsUrl ? "HLS" : "WEB",
            lang: "Live",
            year: 0,
            rating: 0,
            casts: username,
            director: "",
            country: "",
            category: cleanText(dossier.broadcaster_gender || ""),
            status: status || "Live",
            duration: "Live"
        });
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html, fetchedUrl) {
    try {
        var hlsUrl = extractHlsSource(html);
        if (hlsUrl) {
            return JSON.stringify({
                url: hlsUrl,
                isEmbed: false,
                mimeType: "application/x-mpegURL",
                headers: playerHeaders(fetchedUrl || BASE_URL + "/")
            });
        }

        var pageUrl = fetchedUrl || extractCanonicalUrl(html) || BASE_URL + "/";
        return JSON.stringify({
            url: pageUrl,
            isEmbed: false,
            playerType: "embed",
            headers: playerHeaders(BASE_URL + "/")
        });
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    }
}

function parseEmbedResponse(html, url) {
    try {
        var hlsUrl = extractHlsSource(html);
        if (hlsUrl) {
            return JSON.stringify({
                url: hlsUrl,
                isEmbed: false,
                mimeType: "application/x-mpegURL",
                headers: playerHeaders(url || BASE_URL + "/")
            });
        }

        var iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch) {
            return JSON.stringify({
                url: normalizeUrl(iframeMatch[1]),
                isEmbed: true,
                headers: playerHeaders(url || BASE_URL + "/")
            });
        }

        var directMatch = decodeEscapes(html).match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (directMatch) {
            return JSON.stringify({
                url: directMatch[1],
                isEmbed: false,
                mimeType: "application/x-mpegURL",
                headers: playerHeaders(url || BASE_URL + "/")
            });
        }

        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    } catch (e) {
        return JSON.stringify({ url: "", isEmbed: false, headers: {} });
    }
}

// =============================================================================
// HELPERS
// =============================================================================

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

function mergeParams(target, source) {
    for (var key in source) {
        if (source.hasOwnProperty(key)) target[key] = source[key];
    }
    return target;
}

function normalizeKeyword(keyword) {
    return String(keyword || "").replace(/\s+/g, " ").trim();
}

function mapRoomToItem(room) {
    if (!room) return null;

    var username = cleanText(room.username || room.broadcaster_username || "");
    if (!username) return null;

    var viewers = toInt(room.num_users || room.num_viewers, 0);
    var status = cleanText(room.current_show || room.room_status || room.label || "live");
    var tags = [];
    var i;

    if (room.tags && room.tags.length !== undefined) {
        for (i = 0; i < room.tags.length && i < 6; i++) {
            tags.push(cleanText(room.tags[i]));
        }
    }

    var descriptionParts = [];
    if (viewers > 0) descriptionParts.push(viewers + " viewers");
    if (status) descriptionParts.push("Status: " + status);
    if (room.location) descriptionParts.push(cleanText(room.location));

    var subject = cleanText(room.room_subject || room.subject || room.room_title || "");
    if (subject) descriptionParts.push(limitText(subject, 180));
    if (tags.length) descriptionParts.push("#" + tags.join(" #"));

    var imageUrl = normalizeUrl(room.img || room.image || room.poster || "");

    return {
        id: username,
        title: viewers > 0 ? username + " (" + viewers + ")" : username,
        posterUrl: imageUrl,
        backdropUrl: imageUrl,
        description: descriptionParts.join(" | "),
        quality: "LIVE",
        episode_current: status || "Live",
        lang: "Live",
        year: 0
    };
}

function tryParseJson(text) {
    try {
        return JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim());
    } catch (e) {
        return null;
    }
}

function parseInitialRoomDossier(html) {
    var match = html.match(/window\.initialRoomDossier\s*=\s*("(?:(?:\\.|[^"\\])*)")/i);
    if (!match) return null;

    try {
        var decoded = JSON.parse(match[1]);
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

function extractHlsSource(html) {
    var dossier = parseInitialRoomDossier(html);
    if (dossier && dossier.hls_source) {
        return decodeEntities(decodeEscapes(dossier.hls_source));
    }

    var decoded = decodeEscapes(html);
    var hlsMatch = decoded.match(/"hls_source"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
    if (hlsMatch) return decodeEntities(hlsMatch[1]);

    hlsMatch = decoded.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
    if (hlsMatch) return decodeEntities(hlsMatch[1]);

    return "";
}

function extractUsername(html) {
    var match = html.match(/"broadcaster_username"\s*:\s*"([^"]+)"/i);
    if (match) return match[1];

    match = decodeEscapes(html).match(/"broadcaster_username"\s*:\s*"([^"]+)"/i);
    if (match) return match[1];

    var url = extractCanonicalUrl(html);
    match = url.match(/chaturbate\.com\/([^\/?#]+)\/?/i);
    if (match) return decodeURIComponentSafe(match[1]);

    return "";
}

function extractCanonicalUrl(html) {
    var match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
    return match ? normalizeUrl(match[1]) : "";
}

function extractMeta(html, name) {
    var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("<meta[^>]*(?:property|name)=[\"']" + escaped + "[\"'][^>]*content=[\"']([^\"']+)[\"']", "i");
    var match = html.match(re);
    return match ? decodeEntities(match[1]) : "";
}

function playerHeaders(referer) {
    return {
        Referer: referer || BASE_URL + "/",
        "User-Agent": UA
    };
}

function normalizeUrl(url) {
    url = decodeEntities(decodeEscapes(String(url || ""))).trim();
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.charAt(0) === "/") return BASE_URL + url;
    return url;
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
