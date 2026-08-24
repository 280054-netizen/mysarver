const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const logs = [];

// 1. 計測用JS
app.get('/analytics.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    (function() {
      const serverUrl = '${req.protocol}://${req.get('host')}';
      const data = {
        path: window.location.pathname,
        referrer: document.referrer || '直接訪問',
        title: document.title,
        screenSize: window.innerWidth + 'x' + window.innerHeight,
        timestamp: new Date().toISOString()
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon(serverUrl + '/api/collect', JSON.stringify(data));
      } else {
        fetch(serverUrl + '/api/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        });
      }
    })();
  `);
});

// 2. データ受信API
app.post('/api/collect', (req, res) => {
  logs.push({ ...req.body, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
  res.status(200).send({ status: 'ok' });
});

// 3. データ取得API
app.get('/api/stats', (req, res) => {
  res.json(logs);
});

// 4. トップページ（/）と /dashboard の両方でダッシュボードを表示！
const sendDashboard = (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>自作アナリティクス・ダッシュボード</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .card { background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .pv-box { display: flex; align-items: baseline; gap: 10px; }
        .pv-count { font-size: 42px; font-weight: bold; color: #00bcd4; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-top: 10px; }
        .status-online { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .btn { background: #00bcd4; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn:hover { background: #00838f; }
        .btn:disabled { background: #ccc; cursor: not-allowed; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; font-size: 14px; }
        th { background: #f8f9fa; color: #555; }
        .badge { background: #e0f7fa; color: #00838f; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
    </style>
</head>
<body>

<div class="container">
    <h1>自作アクセス解析 (Render連動)</h1>

    <div class="card">
        <div>総ページビュー (PV)</div>
        <div class="pv-box">
            <div class="pv-count" id="pv-count">0</div>
            <div>PV</div>
        </div>
        <div>
            <span class="status-badge status-online">🟢 Renderサーバー正常連動中</span>
        </div>
    </div>

    <div class="card">
        <h3>連動テスト機能</h3>
        <p style="font-size: 13px; color: #555;">ボタンを押すとアクセスログを1件追加できます。</p>
        <button id="test-btn" class="btn" onclick="sendTestSignal()">🚀 テストデータを送信してみる</button>
        <span id="test-result" style="margin-left: 10px; font-size: 13px; font-weight: bold;"></span>
    </div>

    <div class="card">
        <h3>リアルタイム・アクセスログ</h3>
        <table>
            <thead>
                <tr>
                    <th>日時</th>
                    <th>アクセスパス</th>
                    <th>流入元</th>
                    <th>画面サイズ</th>
                </tr>
            </thead>
            <tbody id="log-table">
                <tr><td colspan="4" style="text-align: center; color: #999;">データを取得中...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<script>
    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const logs = await res.json();
            document.getElementById('pv-count').textContent = logs.length;
            const tbody = document.getElementById('log-table');
            tbody.innerHTML = '';
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">ログデータはまだありません</td></tr>';
                return;
            }
            logs.slice().reverse().forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td>\${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td><span class="badge">\${log.path}</span></td>
                    <td>\${log.referrer}</td>
                    <td>\${log.screenSize}</td>
                \`;
                tbody.appendChild(tr);
            });
        } catch (e) {}
    }

    async function sendTestSignal() {
        const btn = document.getElementById('test-btn');
        const result = document.getElementById('test-result');
        btn.disabled = true;
        result.textContent = '送信中...';
        result.style.color = '#ff9800';

        try {
            const res = await fetch('/api/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/test-page',
                    referrer: 'ダッシュボード内テストボタン',
                    title: 'テスト',
                    screenSize: window.innerWidth + 'x' + window.innerHeight,
                    timestamp: new Date().toISOString()
                })
            });
            if (res.ok) {
                result.textContent = '✅ 送信成功！PVが増加しました';
                result.style.color = '#4caf50';
                fetchStats();
            }
        } catch (e) {
            result.textContent = '❌ 送信失敗';
            result.style.color = '#f44336';
        } finally {
            btn.disabled = false;
        }
    }

    fetchStats();
    setInterval(fetchStats, 3000);
</script>

</body>
</html>
  `);
};

app.get('/', sendDashboard);
app.get('/dashboard', sendDashboard);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
