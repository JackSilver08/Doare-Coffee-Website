# Quy chuẩn UTM Dorae Coffee

Mọi liên kết được đăng từ mạng xã hội về website phải dùng chữ thường và không
có khoảng trắng.

| Trường | Giá trị chuẩn | Ví dụ |
| --- | --- | --- |
| `utm_source` | Nền tảng | `facebook`, `zalo`, `tiktok` |
| `utm_medium` | Loại lưu lượng | `organic_social`, `paid_social` |
| `utm_campaign` | Chiến dịch/tháng | `august_2026`, `launch_rang_moc` |
| `utm_content` | Bài đăng/biến thể | `post_01`, `video_02`, `bio_link` |

Tạo liên kết bằng lệnh:

```powershell
npm run utm -- --source facebook --medium organic_social --campaign august_2026 --content post_01
```

Ví dụ kết quả:

```text
https://doraecoffee.io.vn/?utm_source=facebook&utm_medium=organic_social&utm_campaign=august_2026&utm_content=post_01
```

Không gắn UTM cho liên kết nội bộ vì việc đó làm sai nguồn phiên truy cập.
