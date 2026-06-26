# Kế hoạch chuyển sang quản lý sản phẩm động và lưu dữ liệu trên Cloud

## Mục tiêu

- Bỏ phụ thuộc vào `assets/js/catalog.js` như nguồn dữ liệu sản phẩm cố định.
- Cho admin thêm, sửa, ẩn/xóa sản phẩm từ trang `admin.html`.
- Lưu dữ liệu sản phẩm trên Cloudflare D1, lưu ảnh sản phẩm trên Cloudflare R2 hoặc một dịch vụ object storage tương đương.
- Storefront `index.html` luôn lấy danh sách sản phẩm từ API, có trạng thái loading/error rõ ràng.
- Giữ khả năng rollback an toàn trong lúc chuyển đổi dữ liệu.

## Hiện trạng

- Storefront đang gọi `window.DoareAPI.getProducts()`, nhưng vẫn có fallback về `window.DOARE_CATALOG`.
- `assets/js/catalog.js` vẫn là dữ liệu sản phẩm cứng và đang được dùng để sửa lỗi ảnh local theo `id`.
- Worker đã có bảng `products` và `product_images` trong `worker/schema.sql`.
- API public đã có `GET /api/products`.
- API admin mới có `PUT /api/admin/products/:id`, chưa có `POST` để thêm mới và `DELETE` để xóa/ẩn.
- Admin UI đã có modal sửa sản phẩm, nhưng chưa có nút thêm mới, xóa/ẩn, sắp xếp, hoặc quản lý gallery hoàn chỉnh.
- Ảnh sản phẩm hiện có thể bị lưu trực tiếp dạng base64 trong D1, không phù hợp lâu dài vì làm dữ liệu nặng và khó cache.

## Kiến trúc đề xuất

### Nguồn dữ liệu

- D1 là nguồn sự thật cho metadata sản phẩm:
  - tên, slug/id, mô tả, giá, khối lượng, mức rang, notes, badge, trạng thái, thứ tự hiển thị.
- R2 là nguồn sự thật cho file ảnh:
  - ảnh chính sản phẩm.
  - ảnh gallery nếu cần nhiều ảnh cho một sản phẩm.
- `assets/js/catalog.js` chỉ còn là dữ liệu seed hoặc fallback phát triển local, không được dùng để override dữ liệu API ở production.

### Luồng storefront

1. `index.html` tải cấu hình và `api.js`.
2. `api.js` gọi `GET /api/products`.
3. Nếu API thành công, render toàn bộ sản phẩm từ D1.
4. Nếu API lỗi:
   - production hiển thị thông báo nhẹ hoặc trạng thái trống.
   - local development có thể fallback `DOARE_CATALOG`.
5. Không tự thay ảnh API bằng ảnh local nữa sau khi dữ liệu cloud đã đúng.

### Luồng admin

1. Admin đăng nhập qua session hiện có.
2. Trang sản phẩm có:
   - nút `Thêm sản phẩm`.
   - nút `Sửa`.
   - nút `Ẩn/Hiện`.
   - nút `Xóa` hoặc `Xóa mềm`.
   - trường `Thứ tự hiển thị`.
3. Khi upload ảnh:
   - frontend gửi file lên API admin.
   - Worker lưu file vào R2.
   - Worker lưu URL/key vào D1.
4. Khi lưu sản phẩm:
   - metadata lưu vào D1.
   - ảnh chính/galleries liên kết qua `product_images`.

## Dữ liệu đề xuất

### Bảng `products`

Giữ phần lớn schema hiện tại, bổ sung hoặc chuẩn hóa:

- `id TEXT PRIMARY KEY`: slug ổn định, ví dụ `dorae-hat-chin`.
- `name TEXT NOT NULL`
- `subtitle TEXT NOT NULL`
- `category TEXT NOT NULL`
- `roast TEXT NOT NULL`
- `notes TEXT NOT NULL DEFAULT '[]'`
- `price INTEGER NOT NULL`
- `weight TEXT NOT NULL`
- `accent TEXT NOT NULL`
- `image TEXT NOT NULL`: URL ảnh chính hoặc R2 public URL.
- `badge TEXT NOT NULL DEFAULT ''`
- `active INTEGER NOT NULL DEFAULT 1`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `created_at`, `updated_at`

Nên thêm:

- `description TEXT NOT NULL DEFAULT ''` nếu cần mô tả dài.
- `stock_status TEXT NOT NULL DEFAULT 'in_stock'` nếu sau này cần hết hàng.
- `deleted_at TEXT` nếu chọn xóa mềm thay vì xóa cứng.

### Bảng `product_images`

Giữ schema hiện tại, chuẩn hóa:

- `product_id`
- `image_url`
- `alt_text`
- `sort_order`
- `active`

Nên thêm:

- `storage_key TEXT` để biết file nào trong R2 cần xóa khi thay ảnh.
- `mime_type TEXT`
- `size_bytes INTEGER`

## API cần bổ sung

### Public

- `GET /api/products`
  - Chỉ trả sản phẩm `active = 1`.
  - Sort theo `sort_order ASC, created_at DESC`.
  - Cache ngắn, ví dụ 60 giây.

### Admin

- `GET /api/admin/products`
  - Trả cả active/inactive để admin quản lý.

- `POST /api/admin/products`
  - Tạo sản phẩm mới.
  - Validate `id` slug, tên, giá, ảnh chính.
  - Chặn trùng `id`.

- `PUT /api/admin/products/:id`
  - Cập nhật sản phẩm hiện có.
  - Đang có nền tảng, cần mở rộng để xử lý `sort_order`, `active`, gallery.

- `PATCH /api/admin/products/:id/status`
  - Ẩn/hiện nhanh sản phẩm.

- `DELETE /api/admin/products/:id`
  - Ưu tiên xóa mềm: set `active = 0`, `deleted_at = CURRENT_TIMESTAMP`.
  - Chỉ xóa cứng khi chắc không còn order reference quan trọng.

- `POST /api/admin/product-images`
  - Nhận file ảnh, lưu R2, trả về `imageUrl`, `storageKey`, metadata.

- `DELETE /api/admin/product-images/:id`
  - Xóa record D1 và xóa object R2 nếu không còn dùng.

## Upload và lưu ảnh

### Khuyến nghị

- Dùng R2 cho ảnh sản phẩm thay vì lưu base64 vào D1.
- Worker nhận upload qua `FormData`.
- Worker validate:
  - MIME: JPEG, PNG, WebP.
  - dung lượng tối đa.
  - tên file/key an toàn.
- Key gợi ý:
  - `products/{productId}/{timestamp}-{random}.webp`
- Sau upload, lưu URL vào D1.

### Việc cần dọn

- Không lưu `data:image/...;base64` trong cột `products.image`.
- Viết migration hoặc script admin để thay các ảnh base64 hiện tại bằng file R2/local đúng.
- Sau khi dữ liệu cloud ổn, bỏ logic frontend ép ảnh về `DOARE_CATALOG`.

## Thay đổi frontend

### Storefront

- `assets/js/api.js`
  - Xóa normalize ảnh theo catalog sau khi dữ liệu cloud đã đúng.
  - Fallback catalog chỉ dùng khi `API_BASE_URL` rỗng hoặc môi trường dev.

- `assets/js/app.js`
  - Render loading state khi chờ `GET /api/products`.
  - Nếu không có sản phẩm, hiển thị empty state thân thiện.
  - Không giả định luôn có 8 sản phẩm.

- `index.html`
  - Có thể giữ script `catalog.js` trong giai đoạn chuyển đổi.
  - Sau khi production ổn, bỏ script `catalog.js` khỏi storefront.

### Admin

- `admin.html`
  - Thêm nút `Thêm sản phẩm`.
  - Thêm nút `Ẩn/Hiện`, `Xóa`.
  - Thêm field `ID/slug`, `Thứ tự`, `Trạng thái`.

- `assets/js/admin.js`
  - Tách form sản phẩm thành hai mode: create và edit.
  - Gọi `GET /api/admin/products` thay vì public `GET /api/products`.
  - Thêm request:
    - `createProduct`
    - `updateProduct`
    - `deleteProduct`
    - `toggleProductStatus`
    - `uploadProductImage`
  - Không resize ảnh thành base64 để lưu trực tiếp vào D1; nếu cần resize client-side thì vẫn upload file/blob lên Worker.

## Thay đổi backend

- `worker/src/index.js`
  - Tách `normalizeProductBody(body, mode)` dùng chung cho create/update.
  - Thêm `createAdminProduct`.
  - Thêm `deleteAdminProduct` hoặc `softDeleteAdminProduct`.
  - Thêm `getAdminProducts`.
  - Thêm route upload ảnh lên R2.
  - Cập nhật CORS nếu upload dùng `multipart/form-data`.

- `worker/schema.sql`
  - Thêm cột `deleted_at` nếu chọn xóa mềm.
  - Thêm các cột R2 metadata cho `product_images` nếu cần.

- `worker/wrangler.toml`
  - Thêm binding R2 bucket.
  - Giữ binding D1 hiện có.

## Migration dữ liệu

1. Backup D1 production.
2. Export danh sách sản phẩm hiện tại.
3. Upload ảnh nguyên bản từ `assets/images/products` lên R2.
4. Cập nhật `products.image` và `product_images.image_url` sang URL cloud.
5. Kiểm tra `GET /api/products` trả URL ảnh đúng, không còn base64.
6. Tắt logic override ảnh bằng catalog ở frontend.
7. Deploy Worker trước, Pages sau.
8. Kiểm tra admin tạo/sửa/ẩn/xóa sản phẩm trên production.

## Thứ tự triển khai đề xuất

### Giai đoạn 1: Chuẩn hóa backend

- Thêm endpoint admin đầy đủ cho product CRUD.
- Thêm endpoint upload ảnh.
- Thêm R2 binding và migration schema.
- Viết validate input kỹ cho sản phẩm.

### Giai đoạn 2: Nâng admin UI

- Thêm nút tạo sản phẩm.
- Thêm xóa mềm/ẩn hiện.
- Thêm upload ảnh lên cloud.
- Thêm trạng thái lưu, lỗi, confirm trước khi xóa.

### Giai đoạn 3: Chuyển storefront sang dữ liệu động

- Storefront chỉ render từ API.
- Không hard-code "8 loại".
- Không dùng `catalog.js` để chỉnh ảnh production.
- Thêm loading/error state.

### Giai đoạn 4: Migration và cleanup

- Đưa ảnh nguyên bản lên R2.
- Dọn dữ liệu base64 trong D1.
- Bỏ `catalog.js` khỏi production hoặc chuyển vào `worker/seed.sql`/script seed.
- Cập nhật tài liệu deployment.

## Kiểm thử cần có

- `GET /api/products` trả đúng thứ tự, chỉ sản phẩm active.
- Admin tạo sản phẩm mới và storefront thấy sản phẩm sau deploy/cache hết hạn.
- Admin sửa giá, tên, ảnh và storefront cập nhật đúng.
- Admin ẩn sản phẩm, storefront không còn hiển thị nhưng order cũ vẫn giữ tên/giá lịch sử.
- Admin xóa mềm không làm hỏng order history.
- Upload ảnh sai MIME/dung lượng bị từ chối.
- Không còn `data:image` trong response sản phẩm production.

## Rủi ro và cách giảm thiểu

- Ảnh base64 làm D1 phình to: chuyển ảnh sang R2 trước khi mở CRUD rộng.
- Xóa sản phẩm có order cũ: dùng xóa mềm thay vì xóa cứng.
- Cache làm storefront chưa cập nhật ngay: dùng cache ngắn cho `/api/products`, admin hiển thị thông báo có thể mất tối đa 60 giây.
- Dữ liệu API lỗi làm trang trắng: thêm loading/error/empty state.
- Admin upload ảnh quá lớn: validate ở cả frontend và Worker.

## Câu hỏi cần chốt trước khi làm

- Khách muốn xóa thật hay chỉ ẩn sản phẩm khỏi cửa hàng?
- Ảnh sản phẩm có cần nhiều ảnh/gallery hay chỉ một ảnh chính?
- Có cần quản lý tồn kho/hết hàng ngay trong đợt này không?
- R2 bucket sẽ public trực tiếp hay đi qua Worker để cache và kiểm soát URL?
- Có cần phân quyền admin nhiều tài khoản hay chỉ một tài khoản hiện tại?

## Kết quả mong muốn sau khi hoàn tất

- Admin có thể thêm/sửa/ẩn/xóa sản phẩm mà không sửa code.
- Sản phẩm và ảnh được lưu trên cloud.
- Storefront tự cập nhật theo API.
- `assets/js/catalog.js` không còn là nguồn dữ liệu sản phẩm production.
