// Impor modul 'fs' (File System) untuk menulis file
const fs = require('fs');

// Konfigurasi repositori Anda
const GITHUB_USERNAME = 'brodatv1';
const GITHUB_REPO = 'jsonp';
const GITHUB_BRANCH = 'master';
const GITHUB_FOLDER = 'mio';

const JSON_FILES = [
  'AA.json', 'AU.json', 'BR.json', 'EV.json', 'GB.json', 'ID.json',
  'JP.json', 'KD.json', 'KR.json', 'LO.json', 'MI.json', 'MY.json',
  'RI.json', 'SA.json', 'SG.json', 'SP.json'
];

const BASE_URL = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FOLDER}/`;
const OUTPUT_FILE = './dist/playlist.m3u'; // Nama file output

// --- Helper Function ---
// Fungsi untuk mengubah string Base64URL menjadi HEX
function b64urlToHex(b64url) {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // Di Node.js, kita gunakan Buffer untuk menangani base64, ini pengganti atob()
  const raw = Buffer.from(base64, 'base64').toString('binary');
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    const byte = raw.charCodeAt(i);
    hex += ('0' + byte.toString(16)).slice(-2);
  }
  return hex;
}

// Fungsi utama yang akan kita panggil
async function generateM3U() {
  try {
    console.log('Fetching all JSON files...');
    const allJsonPromises = JSON_FILES.map(file =>
      fetch(BASE_URL + file).then(res => {
        if (res.ok) {
          console.log(`Successfully fetched ${file}`);
          return res.json();
        }
        console.error(`Failed to fetch ${file}: ${res.statusText}`);
        return null;
      })
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

            if (channel.jenis === 'dash-clearkey' && channel.url_license) {
              m3uContent += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
              let licenseKey = channel.url_license;
              try {
                // Di Node.js, atob() diganti dengan Buffer
                const decodedLicense = Buffer.from(channel.url_license, 'base64').toString('utf-8');
                const licenseJson = JSON.parse(decodedLicense);
                if (licenseJson.keys && licenseJson.keys[0]) {
                  const kid = b64urlToHex(licenseJson.keys[0].kid);
                  const key = b64urlToHex(licenseJson.keys[0].k);
                  licenseKey = `${kid}:${key}`;
                }
              } catch (e) {
                 // Abaikan jika error
              }
              m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${licenseKey}\n`;
            }

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

    // Membuat folder 'dist' jika belum ada
    if (!fs.existsSync('./dist')){
        fs.mkdirSync('./dist');
    }
    
    // Menulis konten M3U ke file
    fs.writeFileSync(OUTPUT_FILE, m3uContent);
    console.log(`Successfully generated playlist at ${OUTPUT_FILE}`);

  } catch (error) {
    console.error(`Error generating M3U: ${error.message}`);
    process.exit(1); // Keluar dengan status error
  }
}

// Panggil fungsi utama
generateM3U();
