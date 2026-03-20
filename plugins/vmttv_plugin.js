// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "vmttv",
        "name": "VMT TV",
        "version": "1.0.0",
        "baseUrl": "https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main",
        "iconUrl": "https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/Logo.png",
        "isEnabled": true,
        "type": "VIDEO",
        "layoutType": "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'su-kien', title: '🔴 Sự Kiện', type: 'Grid', path: 'vmttv' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Tất cả', slug: 'all' },
        { name: 'Kubo Network', slug: 'kubo-network' },
        { name: 'Sự Kiện', slug: 'su-kien' },
        { name: 'THỂ THAO QUỐC TẾ', slug: 'the-thao-quoc-te' },
        { name: '⚽ Thể thao quốc tế', slug: 'bong-da-quoc-te' },
        { name: 'TVB', slug: 'tvb' },
        { name: 'LIVE EVENTS 🔴', slug: 'live-events' },
        { name: 'Sự Kiện TV360', slug: 'su-kien-tv360' },
        { name: 'Rạp Phim', slug: 'rap-phim' },
        { name: 'VTV', slug: 'vtv' },
        { name: 'VTVcab', slug: 'vtvcab' },
        { name: 'SCTV', slug: 'sctv' },
        { name: 'HTV', slug: 'htv' },
        { name: 'Địa phương', slug: 'dia-phuong' },
        { name: 'Quốc Tế', slug: 'quoc-te' },
        { name: 'Radio', slug: 'radio' },
        { name: '🇻🇳 Vietnam Radio', slug: 'vietnam-radio' },
        { name: '🇬🇧 UK Radio', slug: 'uk-radio' },
        { name: '🇰🇷 Hàn Quốc', slug: 'han-quoc' },
        { name: '🇨🇳 Trung Quốc', slug: 'trung-quoc' },
        { name: '🇹🇭 Thái Lan', slug: 'thai-lan' },
        { name: '🇰🇭 Campuchia', slug: 'campuchia' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL GENERATION & STATE
// =============================================================================

var M3U_URL = "https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv";

// Biến toàn cục lưu trạng thái lọc (vì parseListResponse chỉ nhận 1 arg)
var _currentCatSlug = 'all';
var _currentSearchKeyword = '';

function getUrlList(slug, filtersJson) {
    _currentCatSlug = slug || 'all';
    _currentSearchKeyword = '';
    return M3U_URL;
}

function getUrlSearch(keyword, filtersJson) {
    _currentSearchKeyword = keyword || '';
    _currentCatSlug = 'all';
    return M3U_URL;
}

function getUrlDetail(slug) {
    // Nếu slug là URL stream → trả thẳng cho player
    if (slug.indexOf("http") === 0) {
        return slug;
    }
    // Nếu là channel ID → trả M3U URL kèm param id để parseMovieDetail tìm kênh
    return M3U_URL + "?id=" + encodeURIComponent(slug);
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// CATEGORY SLUG MAPPING
// =============================================================================

var CATEGORY_MAP = {
    'kubo-network': 'Kubo Network',
    'su-kien': 'Sự Kiện',
    'the-thao-quoc-te': 'THỂ THAO QUỐC TẾ',
    'bong-da-quoc-te': '⚽| Thể thao quốc tế',
    'tvb': 'TVB',
    'live-events': 'LIVE EVENTS 🔴',
    'su-kien-tv360': 'Sự Kiện TV360',
    'rap-phim': 'Rạp Phim',
    'vtv': 'VTV',
    'vtvcab': 'VTVcab',
    'sctv': 'SCTV',
    'htv': 'HTV',
    'dia-phuong': 'Địa phương',
    'quoc-te': 'Quốc Tế',
    'radio': 'Radio',
    'vietnam-radio': '🇻🇳 Vietnam Radio',
    'uk-radio': '🇬🇧 UK Radio',
    'han-quoc': '🇰🇷| Hàn Quốc',
    'trung-quoc': '🇨🇳| Trung Quốc',
    'thai-lan': '🇹🇭| Thái Lan',
    'campuchia': '🇰🇭| Campuchia'
};

// Reverse map: group-title → slug
var GROUP_TO_SLUG = {};
(function () {
    var keys = Object.keys(CATEGORY_MAP);
    for (var i = 0; i < keys.length; i++) {
        GROUP_TO_SLUG[CATEGORY_MAP[keys[i]]] = keys[i];
    }
})();

// =============================================================================
// M3U PARSER
// =============================================================================

function parseM3U(text) {
    var lines = text.split('\n');
    var channels = [];
    var currentInfo = null;
    var currentUserAgent = '';
    var channelIndex = 0;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        if (line.indexOf('#EXTINF:') === 0) {
            // Parse EXTINF line
            var groupMatch = line.match(/group-title="([^"]*)"/);
            var logoMatch = line.match(/tvg-logo="([^"]*)"/);
            var tvgIdMatch = line.match(/tvg-id="([^"]*)"/);

            // Channel name: sau dấu phẩy cuối cùng
            var commaIdx = line.lastIndexOf(',');
            var name = commaIdx >= 0 ? line.substring(commaIdx + 1).trim() : '';

            currentInfo = {
                group: groupMatch ? groupMatch[1] : '',
                logo: logoMatch ? logoMatch[1] : '',
                tvgId: tvgIdMatch ? tvgIdMatch[1] : '',
                name: name,
                index: channelIndex++
            };
            currentUserAgent = '';
        } else if (line.indexOf('#EXTVLCOPT:http-user-agent=') === 0) {
            currentUserAgent = line.substring('#EXTVLCOPT:http-user-agent='.length).trim();
        } else if (line.indexOf('#EXTVLCOPT:http-referrer=') === 0) {
            // Skip referrer directives
        } else if (line.indexOf('#KODIPROP:') === 0) {
            // Skip DRM/Kodi properties
        } else if (line.indexOf('#') === 0) {
            // Skip other directives (#EXTM3U, etc.)
        } else if (line.length > 0 && (line.indexOf('http') === 0 || line.indexOf('//') === 0)) {
            // This is a URL line
            if (currentInfo) {
                currentInfo.url = line;
                currentInfo.userAgent = currentUserAgent;
                channels.push(currentInfo);
                currentInfo = null;
                currentUserAgent = '';
            } else {
                // URL without EXTINF → skip (standalone EXTVLCOPT/KODIPROP entries)
                currentUserAgent = '';
            }
        }
    }
    return channels;
}

// =============================================================================
// HELPERS
// =============================================================================

function extractParamFromUrl(url, param) {
    if (!url) return "";
    var match = url.match(new RegExp('[?&]' + param + '=([^&]+)'));
    return match ? decodeURIComponent(match[1]) : "";
}

function makeChannelId(channel) {
    // Tạo ID duy nhất: tvgId hoặc group::name::index
    if (channel.tvgId) {
        return channel.tvgId;
    }
    return (channel.group || 'unknown') + '::' + (channel.name || '') + '::' + channel.index;
}

function findChannelByIdInList(channels, channelId) {
    for (var i = 0; i < channels.length; i++) {
        if (makeChannelId(channels[i]) === channelId) {
            return channels[i];
        }
    }
    return null;
}

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(apiResponseJson) {
    try {
        var channels = parseM3U(apiResponseJson);

        // Lọc theo category từ biến toàn cục
        if (_currentCatSlug && _currentCatSlug !== 'all' && CATEGORY_MAP[_currentCatSlug]) {
            var groupName = CATEGORY_MAP[_currentCatSlug];
            channels = channels.filter(function (ch) {
                return ch.group === groupName;
            });
        }

        // Lọc theo search keyword từ biến toàn cục
        if (_currentSearchKeyword) {
            var keyword = _currentSearchKeyword.toLowerCase();
            channels = channels.filter(function (ch) {
                return ch.name.toLowerCase().indexOf(keyword) >= 0;
            });
        }

        var allItems = [];
        channels.forEach(function (channel) {
            allItems.push({
                id: makeChannelId(channel),
                title: channel.name,
                posterUrl: channel.logo || "",
                backdropUrl: channel.logo || "",
                year: 0,
                quality: "LIVE",
                episode_current: channel.group || "Live",
                lang: channel.group || ""
            });
        });

        return JSON.stringify({
            items: allItems,
            pagination: { currentPage: 1, totalPages: 1, totalItems: allItems.length, itemsPerPage: 500 }
        });
    } catch (error) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(apiResponseJson) {
    return parseListResponse(apiResponseJson);
}

function parseMovieDetail(apiResponseJson, apiUrl) {
    try {
        var channelId = extractParamFromUrl(apiUrl, 'id');
        if (!channelId) return "null";

        var channels = parseM3U(apiResponseJson);
        var channel = findChannelByIdInList(channels, channelId);
        if (!channel) return "null";

        // Build servers + episodes → episode ID = link stream trực tiếp
        var servers = [];
        var episodes = [];

        episodes.push({
            id: channel.url,
            name: channel.name,
            slug: "stream"
        });

        servers.push({
            name: channel.group || "Live Source",
            episodes: episodes
        });

        var description = "Kênh: " + channel.name;
        if (channel.group) description += " | Nhóm: " + channel.group;

        return JSON.stringify({
            id: makeChannelId(channel),
            title: channel.name,
            originName: channel.group || "",
            posterUrl: channel.logo || "",
            backdropUrl: channel.logo || "",
            description: description,
            year: 0,
            rating: 0,
            quality: "LIVE",
            servers: servers,
            episode_current: "Live",
            lang: channel.group || "Việt",
            category: channel.group || "TV",
            country: "Việt",
            director: "VMT TV",
            casts: ""
        });
    } catch (error) {
        return "null";
    }
}

// parseDetailResponse: nhận episode ID (= URL stream trực tiếp)
// getUrlDetail trả thẳng URL stream → app fetch → trả response ở đây
function parseDetailResponse(apiResponseJson, apiUrl) {
    try {
        // apiUrl chính là link stream (vì getUrlDetail trả thẳng khi slug là http URL)
        var streamUrl = apiUrl || "";

        // Xác định user-agent phù hợp
        var userAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

        return JSON.stringify({
            url: streamUrl,
            headers: {
                "User-Agent": userAgent
            },
            subtitles: []
        });
    } catch (error) {
        return JSON.stringify({
            url: apiUrl,
            headers: { "User-Agent": "Mozilla/5.0" },
            subtitles: []
        });
    }
}

function parseCategoriesResponse(apiResponseJson) {
    var cats = [];
    var keys = Object.keys(CATEGORY_MAP);
    for (var i = 0; i < keys.length; i++) {
        cats.push({ name: CATEGORY_MAP[keys[i]], slug: keys[i] });
    }
    return JSON.stringify(cats);
}

function parseCountriesResponse(apiResponseJson) { return "[]"; }
function parseYearsResponse(apiResponseJson) { return "[]"; }
