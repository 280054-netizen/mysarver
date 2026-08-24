const express = require('express');
const cors = require('cors');
const app = express();

// ★すべてのアクセス（ローカルHTMLファイル含む）を許可する設定
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const logs = [];

// 計測用JS
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

// サーバー起動確認用のルート（動作チェック用）
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
