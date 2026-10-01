// npm test — cần docker. Dựng Redis + serverless-redis-http (giả lập Upstash REST) rồi gọi thẳng handler trong api/index.js.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { derive, payout, toWin } from './public/market.js';

// Logic chia thưởng phía client (số tính tay)
const D = derive([[1, 'yes', 300, 'An'], [2, 'no', 100, 'Bình'], [3, 'yes', 100, 'Bình']]);
assert.deepEqual(D.pool, { yes: 400, no: 100 });
assert.equal(D.total, 500);
assert.equal(D.p, 0.8);
assert.deepEqual(D.hist.map(([, p]) => p), [1, 0.75, 0.8]);
assert.deepEqual(D.users['Bình'], { name: 'Bình', yes: 100, no: 100 });
assert.equal(derive([]).p, 0.5);
assert.equal(payout(D, 'yes', D.users.An), 375); // 300/400 × 500
assert.equal(payout(D, 'yes', D.users['Bình']), 125); // 100/400 × 500
assert.equal(payout(D, 'no', D.users['Bình']), 500);
assert.equal(payout(D, 'no', D.users.An), 0);
const solo = derive([[1, 'yes', 50, 'An']]);
assert.equal(payout(solo, 'no', solo.users.An), 50); // không ai cược bên thắng: hoàn điểm
assert.equal(toWin(D, 'no', 100), 300); // 100 × 600 / 200
assert.equal(toWin(D, 'yes', 0), 0);

const sh = cmd => execSync(cmd, { stdio: 'ignore' });
const cleanup = () => { try { sh('docker rm -f keo-test-srh keo-test-redis'); } catch {} };
cleanup();
sh('docker run -d --rm --name keo-test-redis -p 8079:80 redis:alpine');
sh('docker run -d --rm --name keo-test-srh --network container:keo-test-redis -e SRH_MODE=env -e SRH_TOKEN=t -e SRH_CONNECTION_STRING=redis://localhost:6379 hiett/serverless-redis-http');
process.on('exit', cleanup);

for (let i = 0; ; i++) {
  try { if ((await fetch('http://localhost:8079', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: '["PING"]' })).ok) break; } catch {}
  if (i > 60) throw new Error('serverless-redis-http không lên');
  await new Promise(r => setTimeout(r, 500));
}

process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN = 't';
process.env.ADMIN_KEY = 'bí mật';
const { GET, POST } = await import('./api/index.js');

const get = async () => (await GET()).json();
const post = async body => {
  const res = await POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
};

// kèo trống
assert.deepEqual(await get(), { start: 1000, res: null, trades: [] });

// cược hợp lệ được ghi lại; tên NFD ("Vu" + dấu ngã rời) gộp về NFC "Vũ"
let s = await post({ name: 'Vũ', side: 'yes', amount: 300 });
assert.equal(s.status, 200);
assert.deepEqual(s.trades.map(([, ...t]) => t), [['yes', 300, 'Vũ']]);
assert.ok(Math.abs(s.trades[0][0] - Date.now()) < 5000);

// ngân sách 1000 điểm/người: 300 + 701 vượt, 300 + 700 vừa đủ, hết thì không cược thêm được
assert.equal((await post({ name: 'Vũ', side: 'no', amount: 701 })).status, 400);
assert.equal((await post({ name: 'Vũ', side: 'no', amount: 700 })).status, 200);
assert.equal((await post({ name: 'Vũ', side: 'no', amount: 1 })).status, 400);

// input sai bị từ chối
for (const bad of [
  { name: 'A', side: 'yes', amount: 1 },
  { name: 'a b', side: 'yes', amount: 1 },
  { name: 'An', side: 'maybe', amount: 1 },
  { name: 'An', side: 'yes', amount: 0 },
  { name: 'An', side: 'yes', amount: 1.5 },
  { name: 'An', side: 'yes', amount: '5' },
]) assert.equal((await post(bad)).status, 400, JSON.stringify(bad));

// 20 lệnh song song × 100 điểm của cùng 1 người: đúng 10 lệnh lọt (check số dư phải atomic)
const rs = await Promise.all(Array.from({ length: 20 }, () => post({ name: 'Bình', side: 'no', amount: 100 })));
assert.equal(rs.filter(r => r.status === 200).length, 10);
assert.equal((await get()).trades.length, 12);

// chốt kèo: chỉ đúng ADMIN_KEY mới chốt được, chốt rồi thì khoá cược
assert.equal((await post({ action: 'resolve', key: 'sai', side: 'yes' })).status, 403);
assert.equal((await post({ action: 'resolve', side: 'yes' })).status, 403);
assert.equal((await post({ action: 'resolve', key: 'bí mật', side: 'no' })).res, 'no');
assert.equal((await post({ name: 'Cường', side: 'yes', amount: 1 })).status, 400);
assert.equal((await get()).trades.length, 12);

console.log('ok');
