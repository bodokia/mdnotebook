# mdnotebook — CLAUDE.md

Этот файл читается автоматически при каждом запуске Claude Code.

**mdnotebook** — персональный Markdown-блокнот, аналог iOS-приложения [Minimal](https://minimal.app). Web App (React), запускается на Mac, доступен с iPhone по `http://[IP-Mac]:5173`.

---

## Документация проекта

| Файл | Содержание |
|------|-----------|
| [docs/PLAN.md](docs/PLAN.md) | Статус MVP-чеклиста, порядок реализации, backlog |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Стек, структура файлов, API backend, auth-поток, env |
| [docs/DESIGN.md](docs/DESIGN.md) | Дизайн-принципы, шрифты, цвета, layout, mobile |

---

## Быстрый старт

```bash
cd /Users/name/Yandex.Disk.localized/mdnotebook
npm install     # первый раз
npm run dev     # tsx --env-file=.env server.ts + Vite — оба процесса параллельно
```

Открыть на iPhone: System Settings → Wi-Fi → Details → IP, затем `http://[IP]:5173` в Safari.

---

## Ключевые факты

- **Backend:** Express.js, порт `3001`, хранит `.md` файлы в **Supabase Storage** (бакет `notes`)
- **Frontend:** React 18 + Vite, порт `5173`, `/api` проксируется на `3001`
- **Auth:** Supabase Auth (email/password). Каждый пользователь видит только свои файлы (`userId/` prefix в storage)
- **`.env`:** содержит `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Важно:** `tsx --env-file=.env server.ts` — без флага сервер не стартует (нет dotenv)

## Стек (кратко)

React 18 + Vite + TypeScript · Tailwind CSS v3 + @tailwindcss/typography · TipTap (редактор) · react-markdown + remark-gfm + rehype-highlight · Express.js (tsx) · Supabase Auth + Storage · Шрифты: Inter / Lora / JetBrains Mono

---

## Правило: обновление документации

**После каждой добавленной функции или API-эндпоинта — обязательно обнови соответствующий документ:**

| Что изменилось | Какой файл обновить |
|----------------|---------------------|
| Новая фича завершена / задача выполнена | `docs/PLAN.md` — отметь как сделанное, обнови backlog |
| Новый API-эндпоинт или изменение backend-логики | `docs/ARCHITECTURE.md` — добавь в раздел API |
| Изменение UI, шрифтов, цветов, layout | `docs/DESIGN.md` — зафикси дизайн-решение |

Это правило применяется к изменениям в `server.ts` и файлах в `src/`.
