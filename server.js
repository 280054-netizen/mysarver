const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const logs = [];

// 計測タグ用JavaScript
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

// データ受信API
app.post('/api/collect', (req, res) => {
  logs.push({ ...req.body, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
  res.status(200).send({ status: 'ok' });
});

// データ取得API
app.get('/api/stats', (req, res) => {
  res.json(logs);
});

// ダッシュボード画面
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>アクセス解析ダッシュボード</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: #f4f6f9; }
        .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .pv { font-size: 32px; font-weight: bold; color: #00bcd4; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f8f9fa; }
      </style>
    </head>
    <body>
      <h1>アクセス解析ダッシュボード</h1>
      <div class="card">
        <div>総PV数</div>
        <div class="pv" id="pv">0</div>
      </div>
      <div class="card">
        <h3>最新ログ</h3>
        <table>
          <thead>
            <tr><th>日時</th><th>パス</th><th>流入元</th><th>画面サイズ</th></tr>
          </thead>
          <tbody id="logs"></tbody>
        </table>
      </div>
      <script>
        async function load() {
          const res = await fetch('/api/stats');
          const data = await res.json();
          document.getElementById('pv').textContent = data.length;
          const tbody = document.getElementById('logs');
          tbody.innerHTML = '';
          data.slice().reverse().forEach(l => {
            tbody.innerHTML += \`<tr><td>\${new Date(l.timestamp).toLocaleTimeString()}</td><td>\${l.path}</td><td>\${l.referrer}</td><td>\${l.screenSize}</td></tr>\`;
          });
        }
        load();
        setInterval(load, 3000);
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
