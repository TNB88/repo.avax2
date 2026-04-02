# 🛠️ VAAPP Plugin Developer Kit

## App Hoạt Động Như Nào?

VAAPP là một **trình vỏ (Shell)** — nó chỉ lo UI và Player. Toàn bộ nội dung phim/truyện được cung cấp qua **Plugin JS** do bạn viết.

### Luồng Dữ Liệu Chi Tiết

```
NGƯỜI DÙNG bấm vào mục "Hành Động" trên Trang chủ
        │
        ▼
┌─ APP gọi: getUrlList("hanh-dong", '{"page":1}') ─────────────────┐
│  Plugin trả: "https://phim.com/the-loai/hanh-dong?page=1"        │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ APP tự fetch HTTP GET url đó ────────────────────────────────────┐
│  Nhận toàn bộ HTML/JSON thô từ server                             │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ APP gọi: parseListResponse(html) ────────────────────────────────┐
│  Plugin parse HTML → trả JSON: { items: [{id, title, poster}...]} │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ APP render danh sách phim lên UI ────────────────────────────────┐
│  Người dùng bấm vào 1 phim → Lặp lại chu trình với Detail/Play   │
└───────────────────────────────────────────────────────────────────┘
```

### Luồng Xem Phim (Chi Tiết → Player)

```
Bước 1: parseMovieDetail(html)
   → Trả servers + episodes (mỗi episode có id = URL hoặc slug)

Bước 2: Người dùng chọn tập
   → App gọi getUrlDetail(episode.id) để lấy URL fetch
   → App fetch URL → gọi parseDetailResponse(html)

Bước 3: parseDetailResponse(html)
   → Trả { url, headers, mimeType, subtitles }

Bước 4:
   ├─ Nếu isEmbed = false → ExoPlayer phát url trực tiếp
   ├─ Nếu isEmbed = true  → App fetch tiếp → gọi parseEmbedResponse()
   │                        (lặp tối đa 3 lần cho đến khi isEmbed = false)
   └─ Nếu playerType = "embed" → WebView load url
```

---

## 🚀 Bắt Đầu Nhanh (3 Bước)

### Bước 1: Tạo Plugin
Copy file `plugin_template.js` → đổi tên `ten_web_plugin.js`, bắt đầu viết code.

### Bước 2: Test Trên Máy Tính
Mở file **`tester.html`** bằng Chrome:
1. **Nạp JS**: Bấm "Nạp file JS" → chọn file plugin của bạn
2. **Dán HTML**: Mở trang phim → Ctrl+U (View Source) → copy dán vào ô input
3. **Chạy thử**: Bấm các nút `parseListResponse()`, `parseMovieDetail()`...
4. **Xem kết quả**: Xanh = JSON chuẩn ✅ | Đỏ = lỗi cần sửa ❌

### Bước 3: Đăng Ký
Upload file `.js` lên GitHub Raw → thêm vào `plugins.json` → App tự cập nhật.

---

## 📋 Danh Sách Tất Cả Các Hàm

### Nhóm 1: Config (Khai báo)

| Hàm | Trả về | Bắt buộc |
|-----|--------|----------|
| `getManifest()` | Thông tin plugin | ✅ |
| `getHomeSections()` | Các mục trang chủ | ✅ |
| `getPrimaryCategories()` | Menu thể loại | Tùy chọn |
| `getFilterConfig()` | Bộ lọc | Tùy chọn |

### Nhóm 2: URL (Sinh đường dẫn)

| Hàm | Tham số | Trả về |
|-----|---------|--------|
| `getUrlList(slug, filtersJson)` | slug mục + filters | URL string |
| `getUrlSearch(keyword, filtersJson)` | từ khóa | URL string |
| `getUrlDetail(slug)` | slug phim | URL string |
| `getUrlCategories()` | — | URL string |

### Nhóm 3: Parser (Xử lý dữ liệu) ⭐

| Hàm | Nhận vào | Trả về |
|-----|----------|--------|
| `parseListResponse(html)` | HTML/JSON thô | `{ items: [...], pagination: {...} }` |
| `parseSearchResponse(html)` | HTML/JSON thô | Giống parseListResponse |
| `parseMovieDetail(html)` | HTML chi tiết | `{ id, title, servers: [...], ... }` |
| `parseDetailResponse(html)` | HTML trang xem | `{ url, headers, mimeType, ... }` |
| `parseEmbedResponse(html, url)` | HTML embed page | `{ url, isEmbed, mimeType, ... }` |

---

## 📐 Data Format Chi Tiết

### `getManifest()` — Thông tin Plugin

```json
{
    "id": "unique_id",
    "name": "Tên Hiển Thị",
    "version": "1.0.0",
    "baseUrl": "https://phim.example.com",
    "iconUrl": "https://icon.png",
    "isEnabled": true,
    "isAdult": false,
    "type": "MOVIE",
    "layoutType": "VERTICAL",
    "playerType": "exoplayer"
}
```

**`playerType` options:**
| Giá trị | Khi nào dùng |
|---------|-------------|
| `"exoplayer"` | Khi bạn trích được link `.m3u8` / `.mp4` trực tiếp (khuyến nghị) |
| `"embed"` | Khi chỉ có link iframe, phải dùng WebView |
| `"auto"` | App tự phán: URL chứa `.m3u8`/`.mp4` → ExoPlayer, còn lại → WebView |

---

### `parseListResponse()` — Danh sách phim

```json
{
    "items": [
        {
            "id": "slug-phim",
            "title": "Tên Phim",
            "posterUrl": "https://img.../poster.jpg",
            "backdropUrl": "https://img.../backdrop.jpg",
            "description": "Mô tả ngắn",
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

### `parseMovieDetail()` — Chi tiết phim

```json
{
    "id": "slug-phim",
    "title": "Tên Phim",
    "posterUrl": "https://...",
    "backdropUrl": "https://...",
    "description": "Nội dung phim...",
    "servers": [
        {
            "name": "Server HD",
            "episodes": [
                {
                    "id": "https://phim.com/xem/tap-1",
                    "name": "Tập 1",
                    "slug": "tap-1"
                }
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

**🔑 Về `episode.id`:**
- Nếu là link `.m3u8`/`.mp4` trực tiếp → App phát luôn, KHÔNG gọi `parseDetailResponse`
- Nếu là slug/URL khác → App gọi `getUrlDetail(episode.id)` → fetch → `parseDetailResponse(html)`

---

### `parseDetailResponse()` — Lấy Link Video

#### Trường hợp đơn giản (link trực tiếp):
```json
{
    "url": "https://cdn.example.com/video.m3u8",
    "headers": {
        "Referer": "https://phim.example.com"
    },
    "subtitles": [
        { "lang": "vi", "url": "https://.../sub_vi.srt" }
    ]
}
```

#### Trường hợp embed (cần WebView):
```json
{
    "url": "https://player.example.com/embed/abc123",
    "headers": { "Referer": "https://phim.example.com" }
}
```

#### Trường hợp nâng cao — Recursive Embed:
```json
{
    "url": "https://site.com/ajax.php",
    "isEmbed": true,
    "postBody": "id=12345&sv=1",
    "headers": {
        "Referer": "https://site.com",
        "X-Requested-With": "XMLHttpRequest"
    }
}
```
App sẽ POST tới URL đó → nhận response → gọi `parseEmbedResponse(html, url)` → lặp lại nếu `isEmbed` vẫn = `true`.

---

### `parseEmbedResponse(html, url)` — Xử lý embed nhiều bước

Hàm này **chỉ cần viết** khi trang của bạn dùng luồng phức tạp (AJAX → iframe → stream). App gọi hàm này trong vòng lặp.

```javascript
function parseEmbedResponse(html, sourceUrl) {
    // Bước trung gian: HTML chứa iframe → trích URL iframe
    var iframeMatch = html.match(/src="(https?:\/\/[^"]+)"/);
    if (iframeMatch) {
        return JSON.stringify({
            url: iframeMatch[1],
            isEmbed: true,    // ← true = App sẽ fetch tiếp URL này
            headers: { "Referer": "https://site.com/" }
        });
    }
    
    // Bước cuối: trích direct stream
    var fileMatch = html.match(/"file"\s*:\s*"(https?[^"]+)"/);
    if (fileMatch) {
        return JSON.stringify({
            url: fileMatch[1],
            isEmbed: false,   // ← false = URL cuối cùng, phát luôn
            mimeType: "application/x-mpegURL",
            headers: { "Referer": "https://embed-server.com/" }
        });
    }
    
    // Không tìm thấy → dừng loop
    return JSON.stringify({ url: "", isEmbed: false });
}
```

**Quy tắc:**
- `isEmbed: true` → App fetch URL đó rồi gọi lại `parseEmbedResponse()` (tối đa 3 lần)
- `isEmbed: false` → URL cuối cùng, App phát bằng ExoPlayer
- `url: ""` → Dừng lặp, App báo lỗi

---

### Trường `mimeType` — Khi file extension không chuẩn

ExoPlayer nhận dạng stream qua extension (`.m3u8` → HLS, `.mp4` → Progressive). Nhưng nếu server dùng extension lạ (`.vl`, `.xyz`, `.dat`...), plugin cần chỉ định `mimeType`:

```json
{
    "url": "https://cdn.example.com/03105.vl",
    "mimeType": "application/x-mpegURL"
}
```

| `mimeType` | Loại stream |
|------------|------------|
| `"application/x-mpegURL"` | HLS (m3u8 content) |
| `"video/mp4"` | MP4 |
| `""` hoặc không khai | App tự nhận dạng |

> **Lợi ích**: Nếu sau này server đổi extension từ `.vl` → `.xyz`, bạn chỉ sửa plugin JS, KHÔNG cần build lại App. Tất cả do plugin quyết định.

---

## 🧪 Mẹo Debug

### Trong tester.html:
- Hàm `parseListResponse` / `parseMovieDetail` cần dán **HTML source** của trang web tương ứng
- Hàm `getManifest` / `getHomeSections` chạy **không cần tham số**
- Hàm `getUrlList` / `getUrlDetail` cần nhập **slug** vào ô input

### Mẹo viết Regex:
```javascript
// Lấy tất cả <a> có class "movie-item"
var regex = /<a[^>]*class="movie-item"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<h3[^>]*>([^<]+)/g;
var match;
var items = [];
while ((match = regex.exec(html)) !== null) {
    items.push({
        id: match[1].replace('/phim/', ''),
        posterUrl: match[2],
        title: match[3].trim()
    });
}
```

### QuickJS sandbox — Những thứ KHÔNG dùng được:
❌ `document.querySelector()`,  `window.location`, `DOM API`
❌ `fetch()`, `XMLHttpRequest`, `async/await`
❌ `require()`, `import`

### Những thứ DÙNG ĐƯỢC:
✅ `JSON.parse()`, `JSON.stringify()`
✅ `String.match()`, `String.replace()`, `String.split()`, `String.indexOf()`
✅ `RegExp`, `/pattern/g.exec()`
✅ `Array.map()`, `Array.filter()`, `Array.forEach()`
✅ `try {} catch(e) {}`
✅ `encodeURIComponent()`, `decodeURIComponent()`

---

## 📁 Ví Dụ Thực Tế

| Plugin | Độ khó | Kỹ thuật |
|--------|--------|----------|
| `ophim_plugin.js` | ⭐ Dễ | API trả JSON → `JSON.parse()` |
| `kkphim_plugin.js` | ⭐⭐ Trung bình | API + HTML parse |
| `vlxx_plugin.js` | ⭐⭐⭐ Nâng cao | AJAX POST + recursive embed + mimeType |

🌐 Chúc bạn thành công! Đóng góp plugin cho cộng đồng nha!
