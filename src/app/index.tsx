import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { SafeAreaView } from 'react-native-safe-area-context';

// Arka plan görevi adı
const LOCATION_TRACKING_TASK = 'background-location-tracking';

// Arka plan görevi tanımlanıyor
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Arka plan konum hatası:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[0];
      
      // Local Sunucumuza POST isteği gönderiyoruz
      try {
        await fetch('http://192.168.1.102:3000/api/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: location.coords.speed || 0,
            timestamp: location.timestamp,
            battery: 100 // Test amaçlı
          })
        });
      } catch (err) {
        console.log('Sunucuya konum gönderilemedi:', err);
      }
    }
  }
});

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('Bilinmiyor');
  const [locationLogs, setLocationLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissionsAndStatus();
  }, []);

  const checkPermissionsAndStatus = async () => {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      setTrackingActive(isRunning);

      if (backgroundStatus === 'granted') {
        setPermissionStatus('Her Zaman (Arka Plan Dahil)');
      } else if (foregroundStatus === 'granted') {
        setPermissionStatus('Sadece Uygulama Açıkken');
      } else {
        setPermissionStatus('İzin Verilmedi');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const requestPermissions = async () => {
    setLoading(true);
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        alert('Ön plan konum izni reddedildi!');
        setLoading(false);
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        alert('Arka plan konum izni (Her Zaman) reddedildi. Arka planda takip çalışmayacaktır.');
      }
      
      await checkPermissionsAndStatus();
    } catch (error) {
      alert('İzin istenirken hata oluştu.');
    }
    setLoading(false);
  };

  const startTracking = async () => {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        alert('Lütfen öncelikle konum izinlerini verin.');
        return;
      }

      // Ön planda (aktifken) hızlıca bir anlık konum alalım
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(loc);
      addLog(`Anlık Konum Alındı: Lat: ${loc.coords.latitude.toFixed(6)}, Lon: ${loc.coords.longitude.toFixed(6)}`);

      // Arka plan takibini başlatalım
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // 10 saniyede bir (Test amaçlı sık tutuldu)
        distanceInterval: 5,  // 5 metre hareket edince
        foregroundService: {
          notificationTitle: 'Güvenli Takip Devrede',
          notificationBody: 'Çocuğunuzun konumu güvenli ebeveyn takibi için izleniyor.',
          notificationColor: '#4F46E5',
        },
      });

      setTrackingActive(true);
      addLog('Konum Takibi Başlatıldı!');
    } catch (error: any) {
      console.error(error);
      alert('Takip başlatılamadı: ' + error.message);
    }
  };

  const stopTracking = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      setTrackingActive(false);
      addLog('Konum Takibi Durduruldu!');
    } catch (error) {
      console.error(error);
    }
  };

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLocationLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 19)]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>L I F E  1 8 0</Text>
        <Text style={styles.subLogoText}>Ebeveyn Kontrol & Çocuk Koruma</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Durum Kartı */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cihaz İzin Durumu</Text>
          <Text style={[styles.statusText, { color: permissionStatus.includes('Her Zaman') ? '#10B981' : '#F59E0B' }]}>
            {permissionStatus}
          </Text>
          {permissionStatus !== 'Her Zaman (Arka Plan Dahil)' && (
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermissions} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>İzinleri Yapılandır</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Takip Kontrolü Kartı */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.cardTitle}>Konum Takibi</Text>
              <Text style={styles.cardSubtitle}>Arka planda izleme durumu</Text>
            </View>
            <Switch
              value={trackingActive}
              onValueChange={(val) => (val ? startTracking() : stopTracking())}
              trackColor={{ false: '#767577', true: '#818CF8' }}
              thumbColor={trackingActive ? '#4F46E5' : '#f4f3f4'}
            />
          </View>
          
          {currentLocation && (
            <View style={styles.coordsBox}>
              <Text style={styles.coordsTitle}>Son Alınan Koordinat:</Text>
              <Text style={styles.coordsValue}>Enlem: {currentLocation.coords.latitude.toFixed(6)}</Text>
              <Text style={styles.coordsValue}>Boylam: {currentLocation.coords.longitude.toFixed(6)}</Text>
              <Text style={styles.coordsValue}>Hız: {((currentLocation.coords.speed || 0) * 3.6).toFixed(1)} km/s</Text>
            </View>
          )}
        </View>

        {/* Günlükler (Logs) */}
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Konum Günlüğü (Sadece Cihaz İçi)</Text>
          <Text style={styles.logDescription}>
            Cihazın konum güncellemelerini buradan anlık izleyebilirsiniz:
          </Text>
          <ScrollView style={styles.logContainer} nestedScrollEnabled>
            {locationLogs.length === 0 ? (
              <Text style={styles.emptyLogText}>Henüz konum kaydı yok.</Text>
            ) : (
              locationLogs.map((log, index) => (
                <Text key={index} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Premium Sleek Dark Blue
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1', // Indigo gradient feel
    letterSpacing: 4,
  },
  subLogoText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },
  permissionBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
  },
  coordsTitle: {
    color: '#818CF8',
    fontWeight: '600',
    marginBottom: 4,
  },
  coordsValue: {
    color: '#E2E8F0',
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 20,
  },
  logDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 10,
  },
  logContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    maxHeight: 250,
  },
  logText: {
    color: '#10B981',
    fontFamily: 'System',
    fontSize: 12,
    marginBottom: 6,
  },
  emptyLogText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
});
