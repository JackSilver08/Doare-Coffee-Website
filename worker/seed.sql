DELETE FROM products;

INSERT OR REPLACE INTO products
  (id, name, subtitle, category, roast, notes, price, weight, accent, image, badge, active, sort_order)
VALUES
  ('dorae-nguyen-chat', 'Dorae Nguyên Chất', 'Cà phê xay nguyên chất 100%', 'ground', 'Rang vừa', '["Thơm nhẹ","Thanh mát","Dịu êm"]', 219000, '250g', '#c9e5f2', 'assets/images/products/dorae-nguyen-chat.webp', 'Bán chạy', 1, 1),
  ('dorae-dam-vi', 'Dorae Đậm Vị', 'Cà phê rang đậm, vị mạnh mẽ', 'ground', 'Rang đậm', '["Đậm đà","Mạnh mẽ","Hậu vị sâu"]', 259000, '250g', '#d4c9b8', 'assets/images/products/dorae-dam-vi.webp', '', 1, 2),
  ('dorae-thom-ngon', 'Dorae Thơm Ngon', 'Hương thơm nồng nàn, vị cân bằng', 'ground', 'Rang vừa đậm', '["Thơm nồng","Cân bằng","Êm dịu"]', 289000, '250g', '#e0d8cd', 'assets/images/products/dorae-thom-ngon.webp', 'Yêu thích', 1, 3),
  ('dorae-hat-chin', 'Dorae Hạt Chín', 'Cà phê hạt chín mọng, rang kỹ', 'ground', 'Rang kỹ', '["Trái chín","Ngọt hậu","Đậm hương"]', 329000, '250g', '#c5dce7', 'assets/images/products/dorae-hat-chin.webp', '', 1, 4),
  ('dorae-moi-ngay', 'Dorae Mỗi Ngày', 'Dành cho thói quen cà phê hằng ngày', 'ground', 'Rang nhẹ', '["Nhẹ nhàng","Dễ uống","Tiện lợi"]', 349000, '250g', '#d9e8d0', 'assets/images/products/dorae-moi-ngay.webp', '', 1, 5),
  ('dorae-tinh-hoa', 'Dorae Tinh Hoa', 'Phiên bản chọn lọc đặc biệt', 'ground', 'Rang vừa', '["Tinh tế","Sâu lắng","Lưu hương"]', 399000, '250g', '#e2d5c7', 'assets/images/products/dorae-tinh-hoa.webp', 'Đặc biệt', 1, 6),
  ('dorae-rang-moc', 'Dorae Rang Mộc', 'Rang mộc truyền thống, hương tự nhiên', 'ground', 'Rang mộc', '["Tự nhiên","Mộc mạc","Hương đất"]', 449000, '250g', '#d0c4b5', 'assets/images/products/dorae-rang-moc.webp', '', 1, 7),
  ('dorae-mua-hoa', 'Dorae Mùa Hoa', 'Phiên bản giới hạn theo mùa', 'ground', 'Rang nhẹ vừa', '["Hoa cỏ","Thanh tao","Ngọt nhẹ"]', 489000, '250g', '#cde4d5', 'assets/images/products/dorae-mua-hoa.webp', 'Giới hạn', 1, 8);

DELETE FROM product_images;
INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
VALUES 
  ('dorae-nguyen-chat', 'assets/images/products/dorae-nguyen-chat.webp', 'Cà phê xay Dorae Nguyên Chất', 0),
  ('dorae-dam-vi', 'assets/images/products/dorae-dam-vi.webp', 'Cà phê xay Dorae Đậm Vị', 0),
  ('dorae-thom-ngon', 'assets/images/products/dorae-thom-ngon.webp', 'Cà phê xay Dorae Thơm Ngon', 0),
  ('dorae-hat-chin', 'assets/images/products/dorae-hat-chin.webp', 'Cà phê xay Dorae Hạt Chín', 0),
  ('dorae-moi-ngay', 'assets/images/products/dorae-moi-ngay.webp', 'Cà phê xay Dorae Mỗi Ngày', 0),
  ('dorae-tinh-hoa', 'assets/images/products/dorae-tinh-hoa.webp', 'Cà phê xay Dorae Tinh Hoa', 0),
  ('dorae-rang-moc', 'assets/images/products/dorae-rang-moc.webp', 'Cà phê xay Dorae Rang Mộc', 0),
  ('dorae-mua-hoa', 'assets/images/products/dorae-mua-hoa.webp', 'Cà phê xay Dorae Mùa Hoa', 0);
