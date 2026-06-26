# Runbook triển khai quản lý sản phẩm động + ảnh R2

Tài liệu này hướng dẫn các lệnh cần chạy để đưa thay đổi code (đã hoàn tất) lên production.
Tham chiếu kế hoạch: [ke-hoach-quan-ly-san-pham-cloud.md](ke-hoach-quan-ly-san-pham-cloud.md).

## Tóm tắt thay đổi đã code

- **Backend (`worker/src/index.js`)**: thêm CRUD admin đầy đủ + upload/serve ảnh R2.
  - `GET /api/admin/products` — danh sách gồm cả sản phẩm đang ẩn (trừ đã xóa mềm).
  - `POST /api/admin/products` — tạo mới, validate slug, chặn trùng ID.
  - `PUT /api/admin/products/:id` — cập nhật (gồm `sort_order`, `active`, gallery).
  - `PATCH /api/admin/products/:id/status` — ẩn/hiện nhanh.
  - `DELETE /api/admin/products/:id` — **xóa mềm** (`active=0`, `deleted_at`).
  - `POST /api/admin/product-images` — nhận `multipart/form-data`, lưu R2, trả `imageUrl/storageKey/mimeType/sizeBytes`.
  - `DELETE /api/admin/product-images/:id` — xóa record D1 + object R2.
  - `GET /api/images/<key>` — Worker phục vụ ảnh từ R2 (dùng khi chưa gắn public domain).
- **Schema**: `products.deleted_at`; `product_images.storage_key/mime_type/size_bytes`.
- **Storefront**: `api.js` không còn ép ảnh theo `catalog.js`; `app.js` có loading/empty/error, không hard-code "8 loại".
- **Admin**: thêm nút Thêm/Ẩn-Hiện/Xóa, field ID-slug/Thứ tự/Trạng thái; upload ảnh thẳng lên R2 thay vì base64.

## Giai đoạn 1 — Hạ tầng & schema

Chạy trong thư mục `worker/`.

```bash
# 1. Tạo R2 bucket
wrangler r2 bucket create doare-product-images

# 2. (Tùy chọn) Backup D1 production trước khi migrate
wrangler d1 export doare-coffee --remote --output ../backup-doare-$(date +%Y%m%d).sql

# 3. Áp dụng migration (thêm cột mới cho DB đã tồn tại)
wrangler d1 execute doare-coffee --remote --file=./migrations/0001_products_cloud.sql

# 4. Nếu DB chưa có sản phẩm nào, seed 8 loại gốc
wrangler d1 execute doare-coffee --remote --file=./seed.sql
```

> Lưu ý: `migrations/0001_products_cloud.sql` dùng `ALTER TABLE ADD COLUMN`. Nếu cột đã tồn tại,
> D1 báo lỗi "duplicate column" — bỏ qua dòng đó (chạy từng câu lệnh nếu cần).

### Public domain cho ảnh (tùy chọn nhưng khuyến nghị)

Mặc định ảnh được phục vụ qua Worker tại `/api/images/<key>` (không cần cấu hình thêm).
Nếu muốn cache tốt hơn qua CDN, gắn public domain cho bucket rồi đặt biến:

1. Cloudflare Dashboard → R2 → `doare-product-images` → Settings → Public access (r2.dev hoặc custom domain).
2. Trong `worker/wrangler.toml`, đặt `R2_PUBLIC_BASE_URL = "https://<public-domain>"`.

## Giai đoạn 2 — Deploy Worker rồi Pages

```bash
# Deploy Worker (backend) trước
cd worker
wrangler deploy

# Pages (frontend) deploy theo quy trình hiện tại của dự án (push git / wrangler pages)
```

## Giai đoạn 3 — Kiểm thử trên production

- `GET /api/products` trả đúng thứ tự (`sort_order ASC`), chỉ sản phẩm `active=1`.
- Đăng nhập admin → Thêm sản phẩm mới (upload ảnh) → kiểm tra storefront sau ~60s (cache).
- Sửa giá/tên/ảnh → storefront cập nhật.
- Ẩn sản phẩm → biến mất khỏi storefront; đơn cũ vẫn giữ tên/giá lịch sử.
- Xóa mềm → không hỏng order history.
- Upload sai MIME / >5MB bị từ chối.
- Response sản phẩm production không còn `data:image`.

## Giai đoạn 4 — Migration ảnh & cleanup

1. Dùng admin UI: mở từng sản phẩm → tải lại ảnh gốc (ảnh sẽ lên R2, `products.image` thành URL cloud).
   Hoặc upload hàng loạt qua `POST /api/admin/product-images` rồi `PUT` cập nhật từng sản phẩm.
2. Kiểm tra mọi `products.image` và `product_images.image_url` đều là URL cloud (không còn `assets/` hay `data:`).
3. Khi storefront ổn định, có thể bỏ `catalog.js` khỏi production:
   - Xóa 2 dòng `<script src="assets/js/catalog.js…">` trong `index.html` và `admin.html`.
   - `catalog.js` chỉ còn vai trò seed/dev; dữ liệu seed đã được chuyển vào `worker/seed.sql`.

## Rollback

- Worker: `wrangler rollback` (hoặc deploy lại commit trước).
- Dữ liệu: phục hồi từ file backup ở bước Giai đoạn 1.
- Frontend: giữ `catalog.js` đến khi chắc chắn — khi `API_BASE_URL` rỗng, storefront tự fallback catalog (dev).
