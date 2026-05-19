# 🏠 Home Dashboard

Painel de controle residencial inteligente com controle de dispositivos Tuya, clima em tempo real, player Spotify e histórico de atividades.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Fastify 4, TypeScript |
| Banco de dados | PostgreSQL (Supabase) via Prisma ORM |
| Autenticação web | NextAuth v5 (Google OAuth) |
| Autenticação API | JWT + TOTP (2FA via speakeasy) |
| Realtime | Socket.IO (polling Tuya a cada 10s) |
| Estilização | Tailwind CSS, lucide-react |
| IoT | Tuya Cloud Open API |
| Clima | OpenWeatherMap API |
| Música | Spotify Web API |

---

## Arquitetura

```
home-dash/
├── apps/
│   ├── api/          # Fastify REST + Socket.IO (porta 3001)
│   └── web/          # Next.js App Router (porta 3000)
└── packages/
    └── types/        # Tipos compartilhados (Device, DeviceLog, etc.)
```

### Fluxo de dados

```
Browser (Next.js)
  │
  ├── REST  ──► /api/* (Next.js Route Handlers)
  │               ├── /api/weather     → OpenWeatherMap
  │               ├── /api/spotify/*   → Spotify Web API
  │               └── /api/auth/*      → NextAuth (Google)
  │
  └── REST + WS ──► Fastify API (localhost:3001)
                      ├── GET/POST /devices/*  → Tuya Cloud
                      ├── GET /weather         → OpenWeatherMap (cache 10min)
                      ├── POST /auth/*         → JWT + TOTP
                      └── Socket.IO            → push de status a cada 10s
```

### Módulos da API (`apps/api`)

| Arquivo | Responsabilidade |
|---|---|
| `src/index.ts` | Bootstrap Fastify, registra plugins e rotas |
| `src/plugins/socket.plugin.ts` | Socket.IO + polling Tuya a cada 10s |
| `src/plugins/auth.plugin.ts` | Middleware JWT para rotas protegidas |
| `src/routes/auth.route.ts` | Login, 2FA (TOTP), refresh token, logout |
| `src/routes/devices.route.ts` | CRUD de dispositivos via Tuya |
| `src/routes/labels.route.ts` | Labels customizados para switches |
| `src/routes/weather.route.ts` | Proxy OpenWeatherMap com cache em memória |
| `src/services/tuya.service.ts` | Autenticação HMAC-SHA256 + chamadas Tuya Cloud |
| `prisma/schema.prisma` | Modelos: Device, DeviceLog, SwitchLabel, User, RememberToken |

### Páginas do Frontend (`apps/web`)

| Rota | Descrição |
|---|---|
| `/` | Dashboard principal — métricas, switches, clima, Spotify |
| `/history` | Histórico de atividades + gráfico de uso semanal |
| `/settings` | Integrações, dispositivos, tema, configuração 2FA |
| `/routines` | Rotinas (em desenvolvimento) |
| `/login` | Login via Google OAuth |

---

## Pré-requisitos

- Node.js 20+
- npm 10+
- PostgreSQL (ou conta Supabase)
- Conta Tuya IoT Platform
- Conta Spotify Developer
- Conta Google Cloud (OAuth)
- Chave OpenWeatherMap

---

## Executando localmente

### 1. Clone e instale as dependências

```bash
git clone <repo-url>
cd home-dash
npm install
```

### 2. Configure a API (`apps/api/.env`)

```env
TUYA_ACCESS_ID=<seu_tuya_access_id>
TUYA_ACCESS_SECRET=<seu_tuya_access_secret>
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
OPENWEATHER_API_KEY=<sua_chave_owm>
JWT_SECRET=<string_aleatoria_segura>
```

### 3. Configure o Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001

# Spotify
SPOTIFY_CLIENT_ID=<seu_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<seu_spotify_client_secret>
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback

# OpenWeatherMap
OPENWEATHER_API_KEY=<sua_chave_owm>
NEXT_PUBLIC_WEATHER_LAT=<latitude>
NEXT_PUBLIC_WEATHER_LON=<longitude>
NEXT_PUBLIC_WEATHER_CITY=<nome_da_cidade>

# NextAuth / Google OAuth
GOOGLE_CLIENT_ID=<seu_google_client_id>
GOOGLE_CLIENT_SECRET=<seu_google_client_secret>
AUTH_SECRET=<string_aleatoria_segura>
NEXTAUTH_URL=http://localhost:3000
ALLOWED_EMAIL=<email_autorizado>
```

### 4. Configure o banco de dados

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

### 5. Inicie o projeto

Na raiz do monorepo:

```bash
npm run dev
```

Isso inicia simultaneamente:
- API em `http://localhost:3001`
- Web em `http://localhost:3000`

---

## Padrões utilizados

- **Monorepo com Turborepo** — builds paralelos e cache inteligente entre apps
- **Shared types** — pacote `@home-dash/types` compartilhado entre API e Web
- **Plugin pattern (Fastify)** — Socket.IO e autenticação encapsulados como plugins
- **Optimistic UI** — toggles de switch atualizam a UI antes da confirmação da API
- **In-memory cache** — respostas do OpenWeatherMap cacheadas por 10 minutos na API
- **Rate limiting** — proteção contra brute-force no endpoint de login (5 tentativas → bloqueio de 15min)
- **TOTP 2FA** — autenticação em duas etapas com QR Code via speakeasy
- **Remember token** — tokens de longa duração (30 dias) para "lembrar dispositivo"
- **Realtime via Socket.IO** — status dos dispositivos atualizado via push sem polling no cliente

---

## Obtendo credenciais externas

**Tuya IoT Platform**
1. Acesse [iot.tuya.com](https://iot.tuya.com) → crie um projeto Cloud
2. Copie `Access ID` e `Access Secret`

**Spotify**
1. Acesse [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → crie um app
2. Adicione `http://127.0.0.1:3000/api/spotify/callback` como Redirect URI

**Google OAuth**
1. Acesse [console.cloud.google.com](https://console.cloud.google.com) → Credenciais → OAuth 2.0
2. Adicione `http://localhost:3000/api/auth/callback/google` como URI autorizado

**OpenWeatherMap**
1. Acesse [openweathermap.org/api](https://openweathermap.org/api) → gere uma chave gratuita
