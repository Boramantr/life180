// functions/api/location.js

// GET /api/location - En son konumu ve konum geçmişini döner
export async function onRequestGet(context) {
  const { env } = context;
  
  // KV veritabanından son konumu ve geçmişi alıyoruz.
  // Not: KV adını 'LIFE180_KV' olarak belirleyeceğiz.
  try {
    const lastLocation = await env.LIFE180_KV.get('last_location', { type: 'json' }) || {
      latitude: 39.9334,
      longitude: 32.8597,
      timestamp: Date.now(),
      speed: 0,
      battery: 100
    };

    const history = await env.LIFE180_KV.get('location_history', { type: 'json' }) || [];

    return new Response(JSON.stringify({
      current: lastLocation,
      history: history
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/location - Telefondan yeni konum alır ve KV'ye yazar
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { latitude, longitude, speed, timestamp, battery } = data;

    if (!latitude || !longitude) {
      return new Response(JSON.stringify({ error: 'Eksik koordinat' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: speed ? parseFloat(speed) : 0,
      timestamp: timestamp || Date.now(),
      battery: battery || 100
    };

    // Son konumu kaydet
    await env.LIFE180_KV.put('last_location', JSON.stringify(newLocation));

    // Geçmişi kaydet (Son 50 konumu tutalım)
    let history = await env.LIFE180_KV.get('location_history', { type: 'json' }) || [];
    history.push(newLocation);
    if (history.length > 50) {
      history.shift();
    }
    await env.LIFE180_KV.put('location_history', JSON.stringify(history));

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// CORS OPTIONS istekleri için izin tanımı
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
