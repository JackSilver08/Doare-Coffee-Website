# Cách cập nhật website Dorae Coffee

## Cập nhật Frontend

Chạy lệnh sau tại thư mục gốc của dự án:

```bash
npx wrangler pages deploy . --project-name=doare-coffee --branch=main
```

## Cập nhật API (nếu có thay đổi worker)

```bash
cd worker
npx wrangler deploy
```
