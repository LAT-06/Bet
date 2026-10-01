// Từ danh sách lệnh [t, side, amt, name]: pool 2 bên, ai cược bao nhiêu, tỉ lệ Có sau mỗi lệnh
export function derive(trades) {
  const pool = { yes: 0, no: 0 }, users = {}, hist = [];
  for (const [t, side, amt, name] of trades) {
    pool[side] += amt;
    (users[name] ??= { name, yes: 0, no: 0 })[side] += amt;
    hist.push([t, pool.yes / (pool.yes + pool.no)]);
  }
  const total = pool.yes + pool.no;
  return { pool, users, hist, total, p: total ? pool.yes / total : 0.5 };
}

// Sau khi chốt: bên thắng chia cả pool theo điểm đã cược. Không ai cược bên thắng thì hoàn điểm.
export const payout = ({ pool, total }, res, u) => pool[res] ? u[res] * total / pool[res] : u.yes + u.no;

// Nhận về nếu cược thêm `amt` vào `side` và bên đó thắng (tạm tính, chưa có các lệnh sau)
export const toWin = ({ pool, total }, side, amt) => amt && amt * (total + amt) / (pool[side] + amt);
