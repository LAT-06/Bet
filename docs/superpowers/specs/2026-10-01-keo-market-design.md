# Kèo Market — design

Ngày: 2026-10-01

## Mục tiêu

Web giao diện kiểu Polymarket với đúng 1 kèo: **"Đức Vũ có đi field trip ở Nab không?"**. Nhóm bạn cược điểm ảo vào Có hoặc Không và xem tỉ lệ. Deploy lên Vercel. Ưu tiên đơn giản.

## Quyết định

- **Chỉ nickname:** nhập tên là cược được. Tên mới tự có 1.000 điểm, tên đã có thì dùng tiếp acc đó. Chấp nhận việc giả danh và tạo nhiều acc.
- **Admin chốt kèo bằng `ADMIN_KEY`** (env var), vì nickname thì ai cũng gõ được.
- **Stack:** HTML tĩnh + 1 Vercel Function (Node) + Upstash Redis (free, thêm qua Vercel Marketplace). Không framework, không bước build.
- **Cơ chế: pool chia thưởng (parimutuel).**
  - Điểm cược dồn vào 2 pool Có và Không. Tỉ lệ = pool Có / tổng; chưa ai cược thì 50%.
  - Giá hiển thị kiểu Polymarket: Có 63¢ / Không 37¢.
  - Khi chốt, bên thắng chia toàn bộ pool theo tỉ lệ điểm mỗi người đã cược. Nếu không ai cược bên thắng thì hoàn điểm cho tất cả.
- **Không làm:** bán hoặc rút cược, nhiều kèo, comment, chống clone acc.

## Thành phần

### `api/index.js` — endpoint `/api`

- `GET` trả `{start: 1000, res: null | "yes" | "no", trades: [[t, side, amt, name], ...]}`.
- `POST {name, side, amount}` để cược. Lua script chạy atomic:
  - kèo đã chốt thì từ chối;
  - tổng điểm đã cược + `amount` > 1.000 thì từ chối;
  - còn lại thì cộng điểm đã cược và ghi lệnh.
- `POST {action: "resolve", key, side}`: so `key` với `ADMIN_KEY` bằng `timingSafeEqual` rồi ghi kết quả. Chốt lần nữa thì ghi đè, để sửa khi bấm nhầm.
- POST thành công trả state mới, giống GET.
- Validation:
  - tên khớp `^[\p{L}\p{M}\p{N}_]{2,20}$` sau khi normalize NFC;
  - `amount` là số nguyên ≥ 1;
  - `side` chỉ nhận `yes` hoặc `no`.
- Lỗi trả `{error}` bằng tiếng Việt với status 4xx.

### Redis

| Key | Kiểu | Nội dung |
|---|---|---|
| `users` | hash | tên → tổng điểm đã cược (dùng để kiểm tra số dư một cách atomic) |
| `trades` | list | mỗi phần tử là `"t side amt name"` |
| `res` | string | kết quả; không có key = kèo đang mở |

Client tự tính từ `trades` các thứ còn lại: pool, số dư, tỉ lệ theo thời gian, ai cược bao nhiêu. Mỗi GET chỉ tốn 2 lệnh Redis.

### `public/index.html` — JS thuần

- Giao diện kiểu Polymarket:
  - icon + câu hỏi, Vol, "% khả năng" chữ to;
  - chart tỉ lệ theo thời gian (SVG);
  - card cược bên phải: nút Có/Không kèm giá ¢, ô tên, ô số điểm, nút nhanh +10/+100/Max, dòng "nếu thắng nhận ~X", nút Cược;
  - hoạt động gần đây;
  - danh sách người cược chia 2 cột Có / Không.
- Tên lưu trong `localStorage`. Sửa tên trong ô = đổi acc.
- Tự refresh mỗi 20s khi tab đang hiển thị. Light/dark theo hệ thống. Mobile hiển thị 1 cột.
- `/?admin` hiện ô nhập key và nút Chốt Có / Chốt Không, có hỏi confirm trước khi chốt.

## Test

Chạy `npm test` (cần docker). Test tự dựng Redis + `serverless-redis-http` (giả lập Upstash REST), rồi kiểm tra:

- cược hợp lệ;
- không đủ điểm;
- input sai;
- 20 lệnh song song, mỗi lệnh 100 điểm: đúng 10 lệnh thành công;
- chốt kèo với key sai bị từ chối;
- cược sau khi chốt bị từ chối.

## Deploy

1. Push repo lên GitHub, import vào Vercel.
2. Vào Storage, thêm Upstash Redis (free) và connect với project.
3. Thêm env `ADMIN_KEY`.
4. Redeploy.
