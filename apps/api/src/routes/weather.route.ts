import { FastifyInstance } from 'fastify';
import { cache, TTL } from '../services/cache.service';

const OWM = 'https://api.openweathermap.org/data/2.5';

const DOW_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── OWM response types (minimal) ────────────────────────

interface OWMMain {
  temp: number;
  feels_like: number;
  humidity: number;
  pressure: number;
}

interface OWMWeather {
  description: string;
  icon: string;
}

interface OWMCurrentResponse {
  name: string;
  main: OWMMain;
  weather: OWMWeather[];
  wind: { speed: number };
  visibility?: number;
  sys: { sunrise: number; sunset: number };
}

interface OWMForecastItem {
  dt: number;
  main: OWMMain;
  weather: OWMWeather[];
  pop?: number;
}

interface OWMForecastResponse {
  city: { timezone: number };
  list: OWMForecastItem[];
}

// ─── output types ─────────────────────────────────────────

export interface WeatherResponse {
  current: {
    temp: number;
    feelsLike: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    visibility: number;
    pressure: number;
    sunrise: number;
    sunset: number;
    city: string;
  };
  hourly: { time: string; temp: number; icon: string; rain: number }[];
  forecast: { dow: string; icon: string; hi: number; lo: number }[];
}

function formatHour(dt: number, tzOffset: number): string {
  const d = new Date((dt + tzOffset) * 1000);
  return `${d.getUTCHours()}h`;
}

async function fetchFromOWM(apiKey: string, lat: number, lon: number): Promise<WeatherResponse> {
  const qs = `lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${apiKey}`;

  const [curRes, fctRes] = await Promise.all([
    fetch(`${OWM}/weather?${qs}`),
    fetch(`${OWM}/forecast?${qs}`),
  ]);

  if (!curRes.ok || !fctRes.ok) {
    throw new Error(`OWM error: ${curRes.status} / ${fctRes.status}`);
  }

  const [cur, fct] = await Promise.all([
    curRes.json() as Promise<OWMCurrentResponse>,
    fctRes.json() as Promise<OWMForecastResponse>,
  ]);

  const tzOffset = fct.city?.timezone ?? -10800;

  const current: WeatherResponse['current'] = {
    temp:        Math.round(cur.main.temp),
    feelsLike:   Math.round(cur.main.feels_like),
    description: cur.weather[0].description,
    icon:        cur.weather[0].icon,
    humidity:    cur.main.humidity,
    windSpeed:   Math.round(cur.wind.speed * 3.6),         // m/s → km/h
    visibility:  Math.round((cur.visibility ?? 10000) / 1000), // m → km
    pressure:    cur.main.pressure,
    sunrise:     cur.sys.sunrise,
    sunset:      cur.sys.sunset,
    city:        cur.name,
  };

  // próximas 8 entradas (de 3 em 3h)
  const hourly: WeatherResponse['hourly'] = fct.list.slice(0, 8).map((item) => ({
    time: formatHour(item.dt, tzOffset),
    temp: Math.round(item.main.temp),
    icon: item.weather[0].icon,
    rain: Math.round((item.pop ?? 0) * 100),
  }));

  // agrupa por dia local → min/max por dia
  const dayMap = new Map<string, OWMForecastItem[]>();
  for (const item of fct.list) {
    const localDate = new Date((item.dt + tzOffset) * 1000);
    const key = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth()}-${localDate.getUTCDate()}`;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(item);
  }

  const forecast: WeatherResponse['forecast'] = Array.from(dayMap.values())
    .slice(0, 5)
    .map((items) => {
      const temps   = items.map((i) => i.main.temp);
      const refDt   = items[0].dt;
      const dow     = DOW_PT[new Date((refDt + tzOffset) * 1000).getUTCDay()];
      // ícone do meio-dia ou do meio do array
      const midday  = items.find((i) => {
        const h = new Date((i.dt + tzOffset) * 1000).getUTCHours();
        return h >= 11 && h <= 14;
      }) ?? items[Math.floor(items.length / 2)];
      return {
        dow,
        icon: midday.weather[0].icon,
        hi:   Math.round(Math.max(...temps)),
        lo:   Math.round(Math.min(...temps)),
      };
    });

  return { current, hourly, forecast };
}

// ─── Fastify route ────────────────────────────────────────

interface WeatherQuery {
  lat?: string;
  lon?: string;
}

export async function weatherRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: WeatherQuery }>('/', async (req, reply) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      reply.status(500);
      return { error: 'OPENWEATHER_API_KEY not configured' };
    }

    const { lat: latStr, lon: lonStr } = req.query;
    if (!latStr || !lonStr) {
      reply.status(400);
      return { error: 'lat and lon query parameters are required' };
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) {
      reply.status(400);
      return { error: 'lat and lon must be valid numbers' };
    }

    const cacheKey = `weather:${lat},${lon}`;
    const cached = cache.get<WeatherResponse>(cacheKey);
    if (cached) {
      console.log('[cache] hit: weather');
      return cached;
    }
    console.log('[cache] miss: weather → buscando na OWM');

    try {
      const data = await fetchFromOWM(apiKey, lat, lon);
      cache.set(cacheKey, data, TTL.WEATHER);
      return data;
    } catch (err) {
      reply.status(502);
      return { error: (err as Error).message };
    }
  });
}