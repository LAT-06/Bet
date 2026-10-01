# KèoMarket

Kèo kiểu Polymarket cho nhóm bạn: **Đức Vũ có đi field trip ở Nab không?**

Mọi người cược điểm ảo vào Có hoặc Không và xem tỉ lệ. Khi chốt, bên thắng chia toàn bộ điểm theo tỉ lệ mỗi người đã cược.

## Deploy lên Vercel

1. Push repo lên GitHub, rồi import ở [vercel.com/new](https://vercel.com/new). Framework Preset để **Other**, không cần build command.
2. Trong project vừa tạo, vào **Storage**, tạo database **Upstash for Redis** (gói free) và connect vào project. Giữ prefix env mặc định để Vercel tự thêm `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
3. Vào **Settings → Environment Variables**, thêm `ADMIN_KEY` với giá trị là một chuỗi bí mật tự đặt.
4. Vào **Deployments**, bấm **Redeploy** để function nhận env mới.

Xong thì gửi link cho bạn bè. Mỗi người nhập tên là có 1.000 điểm.

## Chốt kèo

1. Mở `https://<domain>/?admin`.
2. Nhập `ADMIN_KEY`, bấm **Chốt Có** hoặc **Chốt Không**.

Chốt xong thì khoá cược. Nếu bấm nhầm, chốt lại lần nữa thì kết quả mới ghi đè kết quả cũ.

## Lưu ý

- Chỉ dùng nickname, không có mật khẩu. Ai biết tên người khác thì cược được bằng acc đó.
- Muốn reset kèo: mở Data Browser trong Upstash console, xoá các key `trades`, `users`, `res`.

## Test

Chạy `npm test` (cần docker). Test tự dựng Redis + serverless-redis-http tạm thời, rồi kiểm tra API và logic chia thưởng.
