const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Son alınan konum bilgisini hafızada (RAM) tutuyoruz.
// Prototip olduğu için veritabanı yerine RAM kullandık.
let lastKnownLocation = {
  latitude: 39.9334, // Başlangıçta Ankara koordinatları
  longitude: 32.8597,
  timestamp: Date.now(),
  speed: 0,
  battery: 100
};

// Konum geçmişi listesi
let locationHistory = [];

// Telefondan konum verisi almak için API uç noktası
app.post('/api/location', (req, res) => {
  const { latitude, longitude, speed, timestamp, battery } = req.body;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Eksik koordinat bilgisi.' });
  }

  lastKnownLocation = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    speed: speed ? parseFloat(speed) : 0,
    timestamp: timestamp || Date.now(),
    battery: battery || 100
  };

  // Geçmiş listesine ekle (Son 100 konumu tutalım)
  locationHistory.push(lastKnownLocation);
  if (locationHistory.length > 100) {
    locationHistory.shift();
  }

  console.log(`[Yeni Konum] Lat: ${latitude}, Lon: ${longitude}, Hız: ${speed || 0} km/s`);
  return res.json({ success: true, status: 'Konum başarıyla güncellendi.' });
});

// Web panelinin son konumu çekmesi için API
app.get('/api/location/current', (req, res) => {
  res.json(lastKnownLocation);
});

// Web panelinin konum geçmişini çekmesi için API
app.get('/api/location/history', (req, res) => {
  res.json(locationHistory);
});

// Web Arayüzü (HTML + Harita)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LIFE180 - Ebeveyn Kontrol Paneli</title>
      
      <!-- Leaflet CSS (Harita Kütüphanesi) -->
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <!-- Google Fonts -->
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Outfit', sans-serif;
        }
        body {
          background-color: #0F172A;
          color: #F8FAFC;
          display: flex;
          height: 100vh;
          overflow: hidden;
        }
        #sidebar {
          width: 380px;
          background-color: #1E293B;
          border-right: 1px solid #334155;
          padding: 30px 20px;
          display: flex;
          flex-direction: column;
          gap: 25px;
          z-index: 10;
          box-shadow: 10px 0 30px rgba(0,0,0,0.2);
        }
        .logo-container {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #334155;
        }
        .logo {
          font-size: 28px;
          fontWeight: 800;
          color: #6366F1;
          letter-spacing: 5px;
        }
        .subtitle {
          font-size: 12px;
          color: #94A3B8;
          margin-top: 5px;
        }
        .card {
          background-color: #0F172A;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #334155;
        }
        .card-title {
          font-size: 14px;
          color: #818CF8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 15px;
        }
        .info-row:last-child {
          margin-bottom: 0;
        }
        .info-label {
          color: #94A3B8;
        }
        .info-value {
          color: #F8FAFC;
          font-weight: 600;
        }
        #map {
          flex: 1;
          height: 100%;
        }
        .pulse-indicator {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #10B981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .btn {
          background-color: #6366F1;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          text-align: center;
          transition: all 0.2s;
        }
        .btn:hover {
          background-color: #4F46E5;
        }
      </style>
    </head>
    <body>
      <div id="sidebar">
        <div class="logo-container">
          <div class="logo">LIFE180</div>
          <div class="subtitle">Ebeveyn Takip Haritası (Local)</div>
        </div>

        <div class="card">
          <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>Çocuk Durumu</span>
            <span class="pulse-indicator" id="pulse"></span>
          </div>
          <div class="info-row">
            <span class="info-label">Cihaz</span>
            <span class="info-value" id="device-status">Aktif İzleme</span>
          </div>
          <div class="info-row">
            <span class="info-label">Pil Seviyesi</span>
            <span class="info-value" id="battery-status">-%</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hız</span>
            <span class="info-value" id="speed-status">0 km/s</span>
          </div>
          <div class="info-row">
            <span class="info-label">Son Güncelleme</span>
            <span class="info-value" id="time-status">Bekleniyor...</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Koordinatlar</div>
          <div class="info-row">
            <span class="info-label">Enlem</span>
            <span class="info-value" id="lat-val">0.0</span>
          </div>
          <div class="info-row">
            <span class="info-label">Boylam</span>
            <span class="info-value" id="lon-val">0.0</span>
          </div>
        </div>

        <button class="btn" onclick="focusOnChild()">Haritada Çocuğa Odaklan</button>
      </div>

      <div id="map"></div>

      <!-- Leaflet JS -->
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        // Haritayı başlatıyoruz
        const map = L.map('map').setView([39.9334, 32.8597], 13);

        // Harita katmanını ekle (Karanlık mod hissi veren CartoDB Dark Matter kullanıyoruz)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        // Özel İkon (Çocuk İkonu)
        const childIcon = L.divIcon({
          html: '<div style="background-color: #6366F1; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 10px rgba(99, 102, 241, 0.8);"></div>',
          className: 'custom-div-icon',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        // İşaretçi (Marker)
        let childMarker = L.marker([39.9334, 32.8597], { icon: childIcon }).addTo(map)
          .bindPopup('<b>Çocuğunuz Burada</b>')
          .openPopup();

        // Konum geçmişi çizgi yolu (Polyline)
        let routeLine = L.polyline([], { color: '#818CF8', weight: 4, opacity: 0.7 }).addTo(map);

        let currentLat = 39.9334;
        let currentLon = 32.8597;

        function updatePanelData(data) {
          currentLat = data.latitude;
          currentLon = data.longitude;

          document.getElementById('lat-val').innerText = currentLat.toFixed(6);
          document.getElementById('lon-val').innerText = currentLon.toFixed(6);
          document.getElementById('speed-status').innerText = (data.speed * 3.6).toFixed(1) + ' km/s';
          document.getElementById('battery-status').innerText = '%' + data.battery;
          
          const time = new Date(data.timestamp).toLocaleTimeString();
          document.getElementById('time-status').innerText = time;

          // Haritada güncelle
          const newPos = [currentLat, currentLon];
          childMarker.setLatLng(newPos);
          
          // Harita odağını kaydırma (Eğer çocuk çok hareket ederse takip etsin)
          // map.panTo(newPos);
        }

        function focusOnChild() {
          map.setView([currentLat, currentLon], 16);
          childMarker.openPopup();
        }

        // Verileri API'den 3 saniyede bir çek
        async function fetchLocation() {
          try {
            const response = await fetch('/api/location/current');
            const data = await response.json();
            updatePanelData(data);

            // Geçmişi de çekip yolu çizelim
            const historyResponse = await fetch('/api/location/history');
            const historyData = await historyResponse.json();
            if (historyData.length > 0) {
              const points = historyData.map(p => [p.latitude, p.longitude]);
              routeLine.setLatLngs(points);
            }
          } catch (e) {
            console.error('Veri çekilemedi:', e);
            document.getElementById('pulse').style.backgroundColor = '#EF4444'; // Hata durumunda kırmızı
          }
        }

        setInterval(fetchLocation, 3000);
        fetchLocation();
      </script>
    </body>
    </html>
  `);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`LIFE180 Ebeveyn Kontrol Paneli Başlatıldı!`);
  console.log(`Haritayı görmek için: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
