// Impor modul 'fs' (File System) untuk menulis file
const fs = require('fs');

// Konfigurasi menunjuk ke sumber data JSON
const GITHUB_USERNAME = 'brodatv1';
const GITHUB_REPO = 'jsonp';
const GITHUB_BRANCH = 'master'; // Diatur ke master sesuai repositori sumber
const GITHUB_FOLDER = 'mio';

// Daftar file JSON yang akan diproses (AA.json sudah dihapus)
const JSON_FILES = [
  'AU.json', 'BR.json', 'EV.json', 'GB.json', 'ID.json',
  'JP.json', 'KD.json', 'KR.json', 'LO.json', 'MI.json', 'MY.json',
  'RI.json', 'SA.json', 'SG.json', 'SP.json'
];

const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FOLDER}/`;
const OUTPUT_FILE = './dist/playlist.m3u';

// --- Helper Function ---
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

async function generateM3U() {
  try {
    console.log('Fetching all JSON files...');
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
          const isChannelValid = 
            channel && typeof channel === 'object' &&
            channel.name && typeof channel.name === 'string' && channel.name.trim() !== '' &&
            channel.hls && typeof channel.hls === 'string' && channel.hls.trim() !== '';

          if (isChannelValid) {
            const logo = channel.image ? `tvg-logo="${channel.image}"` : '';
            m3uContent += `#EXTINF:-1 ${logo} group-title="${groupName}",${channel.name}\n`;

            // Logika untuk menangani berbagai jenis lisensi
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
              } catch (e) { /* Abaikan jika gagal, gunakan nilai asli */ }
              m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${licenseKey}\n`;
            
            } else if (channel.jenis === 'widevine' && channel.url_license) {
              m3uContent += `#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n`;
              m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${channel.url_license}\n`;
            }

            // Logika untuk menangani header HTTP
            if (channel.header_iptv) {
              try {
                const headers = JSON.parse(channel.header_iptv);
                if (headers['User-Agent'] && headers['User-Agent'] !== 'none') {
                  m3uContent += `#EXTVLCOPT:http-user-agent=${headers['User-Agent']}\n`;
                }
                if (headers['Referer'] && headers['Referer'] !== 'none') {
                  m3uContent += `#EXTVLCOPT:http-referrer=${headers['Referer']}\n`;
                }
                if (headers['Origin'] && headers['Origin'] !== 'none') {
                  m3uContent += `#EXTVLCOPT:http-origin=${headers['Origin']}\n`;
                }
              } catch (e) { /* Abaikan jika error */ }
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
    console.log(`Successfully generated playlist at ${OUTPUT_FILE}`);

  } catch (error) {
    console.error(`Error generating M3U: ${error.message}`);
    process.exit(1);
  }
}

generateM3U();
