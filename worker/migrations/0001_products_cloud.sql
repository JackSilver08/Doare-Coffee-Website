-- Migration: quản lý sản phẩm động + lưu ảnh trên R2
-- Áp dụng cho database production đã tồn tại (schema.sql chỉ tạo bảng mới, không alter).
-- SQLite/D1 không có "ADD COLUMN IF NOT EXISTS"; nếu cột đã tồn tại sẽ báo lỗi -> bỏ qua dòng đó.

-- Xóa mềm sản phẩm: giữ lịch sử đơn hàng cũ.
ALTER TABLE products ADD COLUMN deleted_at TEXT;

-- Metadata R2 cho ảnh sản phẩm: biết file nào trong bucket khi thay/xóa ảnh.
ALTER TABLE product_images ADD COLUMN storage_key TEXT NOT NULL DEFAULT '';
ALTER TABLE product_images ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE product_images ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_active_sort ON products(active, sort_order);
