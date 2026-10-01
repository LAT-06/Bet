import { Redis } from '@upstash/redis';
import { timingSafeEqual } from 'node:crypto';

const START = 1000; // điểm ảo mỗi người
const redis = Redis.fromEnv({ automaticDeserialization: false });

// Atomic: kèo chưa chốt và còn đủ điểm thì cộng điểm đã cược + ghi lệnh "t side amt name"
const BET = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 'closed' end
local spent = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
if spent + tonumber(ARGV[3]) > tonumber(ARGV[5]) then return 'funds' end
redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[3])
redis.call('RPUSH', KEYS[2], ARGV[4] .. ' ' .. ARGV[2] .. ' ' .. ARGV[3] .. ' ' .. ARGV[1])
return 'ok'`;

const fail = (error, status = 400) => Response.json({ error }, { status });

export async function GET() {
  const [trades, res] = await redis.pipeline().lrange('trades', 0, -1).get('res').exec();
  return Response.json({
    start: START,
    res,
    trades: trades.map(s => { const [t, side, amt, name] = s.split(' '); return [+t, side, +amt, name]; }),
  });
}

export async function POST(req) {
  const b = (await req.json().catch(() => null)) ?? {};
  if (b.side !== 'yes' && b.side !== 'no') return fail('Chọn Có hoặc Không');

  if (b.action === 'resolve') {
    const key = Buffer.from(String(b.key ?? '')), admin = Buffer.from(process.env.ADMIN_KEY ?? '');
    if (!admin.length || key.length !== admin.length || !timingSafeEqual(key, admin)) return fail('Sai admin key', 403);
    await redis.set('res', b.side);
    return GET();
  }

  const name = String(b.name ?? '').normalize('NFC').trim();
  if (!/^[\p{L}\p{M}\p{N}_]{2,20}$/u.test(name)) return fail('Tên 2–20 ký tự, chỉ gồm chữ, số, _');
  if (!Number.isInteger(b.amount) || b.amount < 1) return fail('Số điểm phải là số nguyên ≥ 1');
  const r = await redis.eval(BET, ['users', 'trades', 'res'], [name, b.side, b.amount, Date.now(), START]);
  if (r !== 'ok') return fail(r === 'closed' ? 'Kèo đã chốt' : 'Không đủ điểm');
  return GET();
}
