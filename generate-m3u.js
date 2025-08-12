// Impor modul 'fs' (File System) untuk menulis file
const fs = require('fs');

// Konfigurasi sumber data JSON
const GITHUB_USERNAME = 'brodatv1';
const GITHUB_REPO = 'jsonp';
const GITHUB_BRANCH = 'master';
const GITHUB_FOLDER = 'mio';

// Daftar file JSON yang akan diproses
const JSON_FILES = [
  'AU.json', 'BR.json', 'EV.json', 'GB.json', 'ID.json',
  'JP.json', 'KD.json', 'KR.json', 'LO.json', 'MI.json', 'MY.json',
  'RI.json', 'SA.json', 'SG.json', 'SP.json'
];

const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FOLDER}/`;
const OUTPUT_FILE = './dist/playlist.m3u';

// Fungsi bantuan untuk konversi Base64URL ke HEX
function b64urlToHex(b64url) {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = Buffer.from(base64, 'base64').toString('binary');
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    const byte = raw.charCodeAt(i);
    hex += ('0' + byte.toString(16)).slice(-2);
  }
  return hex;
}

// Fungsi utama untuk membuat playlist
async function generateM3U() {
  try {
    console.log('Mengambil semua file JSON...');
    const allJsonPromises = JSON_FILES.map(file =>
      fetch(BASE_URL + file).then(res => res.ok ? res.json() : null)
    );
    const allJsonData = await Promise.all(allJsonPromises);

    let m3uContent = '#EXTM3U\n';

    allJsonData.forEach(jsonData => {
      if (jsonData && Array.isArray(jsonData.info)) {
        const groupName = jsonData.country_name || 'General';
        const channels = jsonData.info;

        channels.forEach(channel => {
          if (channel && channel.name && channel.hls) {
            
            // =================================================================
            //      ATURAN FINAL BERDASARKAN POLA URL '/live/channel'
            // =================================================================
            // Jika URL stream mengandung '/live/channel', terapkan header khusus.
            if (channel.hls.includes('/live/channel')) {
              console.log(`Menerapkan aturan header untuk channel: ${channel.name}`);
              channel.header_iptv = "{\"http-user-agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36\",\"http-referrer\":\"https://xl365.plcdn.xyz/\",\"http-origin\":\"https://xl365.plcdn.xyz\",\"network-caching\":\"1000\",\"--http-reconnect\":\"true\"}";
            }
            // =================================================================

            const logo = channel.image ? `tvg-logo="${channel.image}"` : '';
            m3uContent += `#EXTINF:-1 ${logo} group-title="${groupName}",${channel.name}\n`;

            // Logika untuk lisensi DRM
            if (channel.jenis === 'dash-clearkey' && channel.url_license) {
              m3uContent += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
              let licenseKey = channel.url_license;
              try {
                const decodedLicense = Buffer.from(channel.url_license, 'base64').toString('utf-8');
                const licenseJson = JSON.parse(decodedLicense);
                if (licenseJson.keys && licenseJson.keys[0]) {
                  const kid = b64urlToHex(licenseJson.keys[0].kid);
                  const key = b64urlToHex(licenseJson.keys[0].k);
                  licenseKey = `${kid}:${key}`;
                }
              } catch (e) { /* Abaikan */ }
              m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${licenseKey}\n`;
            
            } else if (channel.jenis === 'widevine' && channel.url_license) {
              m3uContent += `#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n`;
              m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${channel.url_license}\n`;
            }

            // Logika untuk menulis header dari `header_iptv`
            if (channel.header_iptv) {
              try {
                const headers = JSON.parse(channel.header_iptv);
                for (const [key, value] of Object.entries(headers)) {
                  m3uContent += `#EXTVLCOPT:${key}=${value}\n`;
                }
              } catch (e) { /* Abaikan */ }
            }
            
            m3uContent += `${channel.hls}\n`;
          }
        });
      }
    });

    if (!fs.existsSync('./dist')){
        fs.mkdirSync('./dist');
    }
    
    fs.writeFileSync(OUTPUT_FILE, m3uContent);
    console.log(`Playlist berhasil dibuat di ${OUTPUT_FILE}`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

generateM3U();
