export const QR_LOGIN_PAGE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Device Login QR Code</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f4f5f7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1c2024;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08);
    padding: 28px;
  }
  h1 {
    font-size: 18px;
    margin: 0 0 4px;
  }
  p.subtitle {
    margin: 0 0 20px;
    font-size: 13px;
    color: #6b7280;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin: 14px 0 6px;
  }
  input {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
  }
  input:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  #error {
    margin-top: 12px;
    font-size: 13px;
    color: #b91c1c;
    min-height: 16px;
  }
  #result {
    margin-top: 22px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 20px;
  }
  #result img {
    width: 220px;
    height: 220px;
    image-rendering: pixelated;
    transition: opacity 0.2s ease;
  }
  #site-label {
    margin: 10px 0 2px;
    font-size: 14px;
    font-weight: 600;
  }
  #countdown {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 12px;
  }
  #download-link {
    display: inline-block;
    padding: 8px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #1c2024;
    text-decoration: none;
  }
  #download-link:hover {
    background: #f4f5f7;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Reader device login</h1>
    <p class="subtitle">Sign in with the site's credentials, then scan the QR code with the device's camera.</p>

    <form id="qr-form">
      <label for="serverAddress">Server address</label>
      <input id="serverAddress" type="text" autocomplete="off" required />

      <label for="siteCode">Site code</label>
      <input id="siteCode" type="text" autocomplete="off" required />

      <label for="userPin">Site password</label>
      <input id="userPin" type="password" autocomplete="off" required />

      <label for="serialNumber">Device serial number</label>
      <input id="serialNumber" type="text" autocomplete="off" required />

      <button id="generate-btn" type="submit">Generate QR code</button>
      <div id="error"></div>
    </form>

    <div id="result" hidden>
      <img id="qr-image" alt="Device login QR code" />
      <div id="site-label"></div>
      <div id="countdown"></div>
      <a id="download-link" download>Download QR code</a>
    </div>
  </div>

  <script>
    var form = document.getElementById('qr-form');
    var result = document.getElementById('result');
    var qrImage = document.getElementById('qr-image');
    var errorEl = document.getElementById('error');
    var countdownEl = document.getElementById('countdown');
    var siteLabel = document.getElementById('site-label');
    var downloadLink = document.getElementById('download-link');
    var generateBtn = document.getElementById('generate-btn');
    var countdownTimer = null;

    function parseExpiresInSeconds(expiresIn) {
      var match = /^(\d+)\s*([smhd])$/.exec(String(expiresIn).trim());
      if (!match) return 300;
      var multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
      return Number(match[1]) * multipliers[match[2]];
    }

    function startCountdown(seconds) {
      if (countdownTimer) clearInterval(countdownTimer);
      var remaining = seconds;
      countdownEl.textContent = 'Expires in ' + remaining + 's';
      countdownTimer = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          countdownEl.textContent = 'Expired — generate a new code';
          qrImage.style.opacity = '0.3';
          return;
        }
        countdownEl.textContent = 'Expires in ' + remaining + 's';
      }, 1000);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      errorEl.textContent = '';
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating\u2026';

      var body = {
        serverAddress: document.getElementById('serverAddress').value.trim(),
        siteCode: document.getElementById('siteCode').value.trim(),
        userPin: document.getElementById('userPin').value,
        serialNumber: document.getElementById('serialNumber').value.trim(),
      };

      fetch('/api/v1/auth/qr-login/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            return { ok: res.ok, json: json };
          });
        })
        .then(function (r) {
          if (!r.ok || !r.json.success) {
            throw new Error((r.json.data && r.json.data.message) || 'Failed to generate QR code');
          }

          var data = r.json.data;
          qrImage.src = data.qrImage;
          qrImage.style.opacity = '1';
          result.hidden = false;

          siteLabel.textContent = '';
          siteLabel.appendChild(
            document.createTextNode(data.site.siteName + ' (' + data.site.siteCode + ')'),
          );

          var filenameSuffix = (data.site.siteCode || 'device').replace(/[^a-z0-9-]+/gi, '-');
          downloadLink.href = data.qrImage;
          downloadLink.setAttribute('download', 'qr-login-' + filenameSuffix + '.png');

          startCountdown(parseExpiresInSeconds(data.expiresIn));
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Something went wrong';
        })
        .finally(function () {
          generateBtn.disabled = false;
          generateBtn.textContent = 'Generate QR code';
        });
    });
  </script>
</body>
</html>
`;
