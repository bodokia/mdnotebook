# Архитектура mdnotebook

→ [PLAN.md](PLAN.md) · [DESIGN.md](DESIGN.md)

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Стили | Tailwind CSS v3 + @tailwindcss/typography |
| Markdown рендеринг | react-markdown + remark-gfm + rehype-highlight |
| Редактор | TipTap (ProseMirror-based) |
| Backend | Express.js (Node, TypeScript, tsx) — порт **3001** |
| Vite dev server | порт **5173**, proxy `/api` → `localhost:3001` |
| Auth | Supabase Auth (email/password) |
| Хранилище | Supabase Storage — бакет `notes`, папка `<userId>/` на пользователя |
| Шрифты | Inter (UI), Lora (контент), JetBrains Mono (код) — Google Fonts |

---

## Структура файлов

```
mdnotebook/
├── server.ts              # Express API — работает с Supabase Storage
├── .env                   # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_*
├── src/
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Главный компонент (состояние, auth-gate)
│   ├── api.ts             # fetch-обёртки, Bearer-токен в каждом запросе
│   ├── index.css          # CSS-переменные + Tailwind
│   ├── lib/
│   │   └── supabase.ts    # createClient (anon key, frontend)
│   └── components/
│       ├── AuthScreen.tsx # Экран входа/регистрации
│       ├── Sidebar.tsx    # Дерево файлов/папок
│       ├── Editor.tsx     # TipTap-редактор
│       ├── Preview.tsx    # Рендеринг Markdown
│       └── Toast.tsx      # Undo-toast при удалении файла
├── docs/
│   ├── PLAN.md
│   ├── ARCHITECTURE.md
│   └── DESIGN.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

---

## Auth-поток

```
1. src/lib/supabase.ts  createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
2. App.tsx              supabase.auth.getSession() → setSession / setAuthToken
                        onAuthStateChange → держит токен актуальным
3. api.ts               все запросы идут с заголовком Authorization: Bearer <token>
                        при 401 (и только если токен был) — window.location.reload()
4. server.ts            requireAuth middleware: supabase.auth.getUser(token) → userId
5. Supabase Storage     все файлы под префиксом userId/ → изоляция между пользователями
```

`loadFiles()` вызывается только после того, как `session` установлен — нет race condition.

---

## API Backend (`server.ts`)

Все эндпоинты требуют `Authorization: Bearer <supabase-jwt>`. `userId` извлекается из токена в `requireAuth`.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/files` | Дерево .md файлов пользователя из Supabase Storage (рекурсивно) |
| GET | `/api/file?path=...` | Содержимое файла |
| POST | `/api/file?path=...` | Сохранить содержимое (`body.content`) |
| POST | `/api/file/create` | Создать новый .md файл |
| POST | `/api/folder/create` | Создать папку (загружает `.keep` placeholder) |
| DELETE | `/api/file?path=...` | Удалить файл |
| PATCH | `/api/file/rename` | Переименовать файл (`body: { oldPath, newPath }`) |

Storage-ключ для каждого файла: `<userId>/<relativePath>`.

Папки в S3/Supabase Storage виртуальные — материализуются через `.keep`-файл.

---

## Переменные окружения

```
# .env (не коммитится — см. .env.example)

# Backend (сервис-ключ, доступ ко всему хранилищу)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Frontend (Vite передаёт только VITE_* в браузер)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`tsx --env-file=.env server.ts` — обязательный флаг в npm-скрипте, иначе сервер не стартует.

---

## Запуск

```bash
npm run dev   # tsx --env-file=.env server.ts + vite — оба процесса параллельно
```

iPhone: `http://<IP-Mac>:5173` — IP смотреть в System Settings → Wi-Fi → Details.
