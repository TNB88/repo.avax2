# VAAPP Plugin System — Hướng Dẫn Phát Triển 🚀

---

## Tổng Quan — App Hoạt Động Như Nào?

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VAAPP (Android App)                          │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │  UI/UX   │◄───│  ViewModel   │◄───│  Repository  │                │
│  │ Compose  │    │  (Kotlin)    │    │  (Kotlin)    │                │
│  └──────────┘    └──────────────┘    └──────┬───────┘                │
│                                             │                        │
│                                    ┌────────▼────────┐               │
│                                    │ Plugin Executor  │               │
│                                    │ (QuickJS Engine) │               │
│                                    └────────┬────────┘               │
│                                             │                        │
│                               ┌─────────────▼─────────────┐         │
│                               │   your_plugin.js (Bạn viết) │         │
│                               └───────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
```

**Luồng hoạt động cốt lõi:**

1. **App gọi `getUrl...()`** → Plugin trả về URL cần tải
2. **App tự fetch HTTP** (GET hoặc POST) → Nhận HTML/JSON thô
3. **App gọi `parse...(html)`** → Plugin parse dữ liệu, trả JSON chuẩn
4. **App render UI** từ JSON đó (danh sách phim, chi tiết, player...)

> ⚠️ **Quan trọng**: Plugin chạy trong QuickJS sandbox — KHÔNG có `document`, `window`, `DOM`, `fetch`, `XMLHttpRequest`. Chỉ dùng Vanilla JS thuần: `JSON.parse()`, `RegExp`, `String.split()`, v.v.

---

## 1. Đăng Ký Plugin (`plugins.json`)

File `plugins.json` là danh sách plugin hiển thị trong phần **Cài đặt** của App:

```json
{
    "version": 1,
    "plugins": [
        {
            "id": "my_plugin",
            "name": "Nguồn Phim ABC",
            "version": "1.0.0",
            "scriptUrl": "https://raw.githubusercontent.com/.../my_plugin.js",
            "iconUrl": "https://raw.githubusercontent.com/.../icon.png"
        }
    ]
}
```

| Trường | Mô tả |
|--------|--------|
| `id` | Định danh duy nhất (không dấu, không khoảng trắng). VD: `ophim`, `kkphim` |
| `name` | Tên hiển thị trong App |
| `version` | Khi thay đổi → App tự cập nhật plugin |
| `scriptUrl` | URL trực tiếp tới file `.js` (GitHub Raw, Pastebin, v.v.) |
| `iconUrl` | Icon vuông trong suốt |

---

## 2. Cấu Trúc Plugin (File `.js`)

Mỗi plugin gồm **3 nhóm hàm**. Tất cả hàm đều `return JSON.stringify(...)`.

### A. Nhóm Config — Khai báo Plugin

| Hàm | Mô tả |
|-----|--------|
| `getManifest()` | Thông tin plugin: id, name, baseUrl, type, playerType |
| `getHomeSections()` | Các mục trên Trang chủ (Hành động, Mới cập nhật...) |
| `getPrimaryCategories()` | Menu thể loại |
| `getFilterConfig()` | Bộ lọc (Năm, Quốc gia, Sắp xếp) |

**Manifest chi tiết:**
```javascript
function getManifest() {
    return JSON.stringify({
        "id": "my_plugin",
        "name": "Nguồn Phim ABC",
        "version": "1.0.0",
        "baseUrl": "https://phim.example.com",
        "iconUrl": "https://icon.png",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",           // "MOVIE" hoặc "COMIC"
        "layoutType": "VERTICAL",  // "VERTICAL" hoặc "HORIZONTAL"
        "playerType": "exoplayer"  // "exoplayer" | "embed" | "auto" (xem chi tiết ở mục Player)
    });
}
```

### B. Nhóm URL — Sinh đường dẫn

App gọi các hàm này để biết phải **fetch HTTP vào URL nào**:

| Hàm | Đầu vào | Mô tả |
|-----|---------|--------|
| `getUrlList(slug, filtersJson)` | slug mục + JSON filters (page, sort...) | URL danh sách phim |
| `getUrlSearch(keyword, filtersJson)` | từ khóa tìm kiếm | URL trang tìm kiếm |
| `getUrlDetail(slug)` | slug phim | URL trang chi tiết phim |
| `getUrlCategories()` | — | URL lấy danh sách thể loại |
| `getUrlCountries()` | — | URL lấy danh sách quốc gia |
| `getUrlYears()` | — | URL lấy danh sách năm |

### C. Nhóm Parser — Xử lý dữ liệu (⭐ Quan trọng nhất)

App fetch URL xong → ném **toàn bộ HTTP response** (HTML/JSON thô) vào hàm parse:

---

#### `parseListResponse(html)` / `parseSearchResponse(html)`

Trả về danh sách phim:

```json
{
    "items": [
        {
            "id": "slug-phim-01",
            "title": "Tên Phim",
            "posterUrl": "https://img.../poster.jpg",
            "backdropUrl": "https://img.../backdrop.jpg",
            "description": "Mô tả ngắn...",
            "year": 2024,
            "quality": "FHD",
            "episode_current": "Tập 10/12",
            "lang": "Vietsub"
        }
    ],
    "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 100,
        "itemsPerPage": 20
    }
}
```

---

#### `parseMovieDetail(html)`

Trả về chi tiết phim + **danh sách server/tập**:

```json
{
    "id": "slug-phim-01",
    "title": "Avenger",
    "posterUrl": "https://...",
    "backdropUrl": "https://...",
    "description": "Nội dung phim...",
    "servers": [
        {
            "name": "Server HD",
            "episodes": [
                { "id": "tap-1-url-or-slug", "name": "Tập 1", "slug": "tap-1" },
                { "id": "tap-2-url-or-slug", "name": "Tập 2", "slug": "tap-2" }
            ]
        }
    ],
    "quality": "FHD",
    "year": 2024,
    "rating": 8.5,
    "casts": "Diễn viên A, B",
    "director": "Đạo diễn C",
    "category": "Hành Động, Phiêu Lưu",
    "status": "Full",
    "duration": "120 Phút"
}
```

> **Lưu ý `episode.id`**: Đây là giá trị App sẽ dùng để resolve link xem. Có thể là:
> - Link `.m3u8`/`.mp4` trực tiếp → App phát luôn
> - Slug hoặc URL trang → App gọi `getUrlDetail(id)` rồi `parseDetailResponse()` để lấy link

---

#### `parseDetailResponse(html)` — Lấy Link Video!

Đây là hàm cuối cùng, trả về link stream cho ExoPlayer hoặc WebView:

```json
{
    "url": "https://cdn.example.com/video.m3u8",
    "headers": {
        "Referer": "https://phim.example.com",
        "User-Agent": "Mozilla/5.0 ..."
    },
    "subtitles": [
        { "lang": "vi", "url": "https://.../sub_vi.srt" }
    ]
}
```

---

## 3. Các Tình Huống Nâng Cao

### 🔄 Tình huống 1: Link Embed (WebView)

Nhiều trang giấu video trong iframe (doodstream, hydrax...). App hỗ trợ phát qua **WebView** tự động:

```javascript
// Trong parseDetailResponse() — chỉ cần trả link embed
return JSON.stringify({
    url: "https://vidplayer.site/embed/abc123",
    headers: { "Referer": "https://phim.example.com" }
});
```

Manifest cần set `"playerType": "embed"` hoặc `"auto"` (App tự nhận dạng).

### 🔗 Tình huống 2: Recursive Embed (AJAX → Embed → Stream)

Một số trang phức tạp cần **nhiều bước** để lấy link stream:

```
Trang chi tiết → AJAX POST → Nhận iframe URL → Fetch embed page → Trích .vl/.m3u8 URL
```

App hỗ trợ **recursive embed extraction** (tối đa 3 cấp). Plugin cần:

**Bước 1**: `parseDetailResponse()` trả `isEmbed: true` + `postBody` (nếu cần POST):
```javascript
return JSON.stringify({
    url: "https://site.com/ajax.php",
    isEmbed: true,
    postBody: "id=12345&sv=1",  // '' nếu dùng GET
    headers: { "Referer": "https://site.com" }
});
```

**Bước 2**: App fetch URL đó → gọi `parseEmbedResponse(html, url)`:
```javascript
function parseEmbedResponse(html, sourceUrl) {
    // Bước trung gian: trích iframe URL từ AJAX response
    if (sourceUrl.indexOf('ajax') !== -1) {
        var data = JSON.parse(html);
        var match = data.player.match(/src="([^"]+)"/);
        return JSON.stringify({
            url: match[1],
            isEmbed: true  // Vẫn cần fetch tiếp
        });
    }
    
    // Bước cuối: trích direct stream URL từ embed page
    var fileMatch = html.match(/"file"\s*:\s*"(https?[^"]+)"/);
    if (fileMatch) {
        return JSON.stringify({
            url: fileMatch[1],
            isEmbed: false,  // Kết thúc, đây là link stream cuối
            mimeType: "application/x-mpegURL",  // Báo App đây là HLS
            headers: { "Referer": "https://embed-server.com/" }
        });
    }
    
    return JSON.stringify({ url: "", isEmbed: false });
}
```

### 📺 Tình huống 3: File extension lạ (.vl, .xyz...)

Khi server dùng extension không chuẩn cho HLS stream, ExoPlayer không tự nhận dạng. Plugin cần chỉ định **`mimeType`**:

```javascript
return JSON.stringify({
    url: "https://cdn.example.com/video.vl",  // Extension lạ
    mimeType: "application/x-mpegURL",         // Báo App đây là HLS
    headers: { "Referer": "https://source.com/" }
});
```

**Các giá trị `mimeType` hỗ trợ:**

| Giá trị | Loại stream |
|---------|------------|
| `"application/x-mpegURL"` | HLS (m3u8) |
| `"video/mp4"` | MP4 progressive |
| `""` (rỗng/bỏ qua) | App tự nhận dạng từ URL |

### 🔑 Tình huống 4: Tái tạo link m3u8 từ UUID/Token

Nhiều trang (MissAV...) giấu link qua UUID trong HTML:
```javascript
// Tìm UUID trong HTML
var uuidMatch = html.match(/data-uuid="([a-f0-9-]+)"/);
var uuid = uuidMatch[1];
// Tự ghép thành link CDN
return JSON.stringify({
    url: "https://cdn.example.com/" + uuid + "/playlist.m3u8"
});
```

---

## 4. Player Types

Manifest field `playerType` quyết định App dùng player nào:

| Giá trị | Hành vi |
|---------|---------|
| `"exoplayer"` | **Mặc định**. Dùng ExoPlayer native (hỗ trợ HLS, MP4, phụ đề, PiP) |
| `"embed"` | Luôn dùng WebView (cho các nguồn chỉ có link iframe) |
| `"auto"` | App tự phán đoán: URL chứa `.m3u8`/`.mp4` → ExoPlayer, còn lại → WebView |

> **Khuyến nghị**: Luôn cố gắng trích link `.m3u8`/`.mp4` trực tiếp để dùng `"exoplayer"`. Player native cho trải nghiệm tốt hơn (seek, PiP, notification control, offline...).

---

## 5. Tham Khảo Data Models

Đây là các trường mà App đọc từ JSON plugin trả về. Trường có `= ""` nghĩa là optional:

### Movie (Danh sách)
```
id          : String    — Slug định danh duy nhất
title       : String    — Tên phim
posterUrl   : String    — Ảnh poster
backdropUrl : String    — Ảnh nền (optional)
description : String    — Mô tả (optional)
year        : Int       — Năm (optional)
quality     : String    — "FHD", "HD", "CAM" (optional)
episode_current : String — "Tập 10/12" (optional)
lang        : String    — "Vietsub", "Thuyết Minh" (optional)
```

### MovieStreamResult (Kết quả `parseDetailResponse` / `parseEmbedResponse`)
```
url       : String              — Link stream hoặc embed URL
headers   : Map<String, String> — HTTP headers (Referer, User-Agent...)
subtitles : List<Subtitle>      — Danh sách phụ đề (optional)
isEmbed   : Boolean             — true = cần fetch tiếp, false = link cuối cùng
postBody  : String              — Body cho POST request (rỗng = dùng GET)
mimeType  : String              — Content type ("application/x-mpegURL" cho HLS)
```

---

## 6. Bắt Đầu Nhanh

1. Copy `plugin-dev-kit/plugin_template.js` → đổi tên `ten_web_plugin.js`
2. Mở `plugin-dev-kit/tester.html` bằng Chrome để test
3. Viết logic parse, test từng hàm cho đúng format
4. Upload lên GitHub → thêm vào `plugins.json`
5. Trong App → Cài đặt → Thêm nguồn plugin

**Xem ví dụ thực tế:**
- `ophim_plugin.js` — Plugin API đơn giản (JSON parse)
- `kkphim_plugin.js` — Plugin API + HTML parse
- `vlxx_plugin.js` — Plugin nâng cao: AJAX POST + recursive embed + mimeType

---

## Mẹo Vặt

- **Không có DOM**: Dùng `RegExp` và `String` methods thay vì `document.querySelector`
- **Debug**: Dùng `tester.html` — nạp JS + dán HTML source → xem output
- **CORS**: App fetch HTTP native, không bị CORS. Nhưng khi test trên browser bạn sẽ gặp → dùng `View Page Source` để copy HTML thủ công
- **Performance**: QuickJS rất nhanh, nhưng tránh vòng lặp vô hạn trong regex
- **Fallback**: Luôn `try-catch` và trả `{ items: [] }` khi lỗi, đừng để crash

🌐 Chúc bạn thành công! Đừng quên chia sẻ plugin cho cộng đồng!
