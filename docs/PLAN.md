# План реализации mdnotebook

→ [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md)

---

## Статус MVP

### Инфраструктура
- [x] Config файлы (package.json, tsconfig, vite, tailwind, postcss, index.html)
- [x] `.env` + `.env.example` — Supabase credentials
- [x] Supabase проект создан, бакет `notes` настроен

### Backend (`server.ts`)
- [x] Express, порт 3001
- [x] `requireAuth` middleware — извлекает `userId` из Supabase JWT
- [x] `GET /api/files` — рекурсивный листинг из Supabase Storage (`userId/`)
- [x] `GET /api/file` — скачать файл
- [x] `POST /api/file` — сохранить файл (upsert)
- [x] `POST /api/file/create` — создать файл
- [x] `POST /api/folder/create` — создать папку (`.keep` placeholder)
- [x] `DELETE /api/file` — удалить файл
- [x] `PATCH /api/file/rename` — переименовать (copy + delete)
- [x] `POST /api/files/upload` — загрузка нескольких `.md` файлов в корень или папку
- [x] `tsx --env-file=.env server.ts` — корректная загрузка `.env`

### Frontend
- [x] `src/lib/supabase.ts` — Supabase client (anon key)
- [x] `src/components/AuthScreen.tsx` — вход / регистрация
- [x] `src/api.ts` — Bearer-токен в каждом запросе, 401-защита без бесконечного reload
- [x] `src/App.tsx` — auth-gate: `loadFiles()` только после установки сессии
- [x] `src/components/Sidebar.tsx` — файловое дерево + создание папок
- [x] `src/components/Editor.tsx` — TipTap-редактор, автосохранение 2 сек
- [x] `src/components/Preview.tsx` — react-markdown + syntax highlight
- [x] `src/components/Toast.tsx` — undo-toast при удалении
- [x] Загрузка файлов — кнопка `↑` в хедере (корень) и в контексте папки; поддержка нескольких файлов сразу
- [x] Undo/Redo — кнопки в FormatToolbar (WYSIWYG); нативный `Cmd+Z`/`Cmd+Shift+Z` работает в обоих режимах

---

## Порядок реализации (выполнено)

```
1. server.ts + Supabase Storage API
2. src/lib/supabase.ts
3. src/components/AuthScreen.tsx
4. src/api.ts (с auth-токеном)
5. src/App.tsx (auth-gate, race-condition fix)
6. src/components/Sidebar.tsx
7. src/components/Editor.tsx
8. src/components/Preview.tsx
9. src/components/Toast.tsx
```

---

## Следующие шаги (backlog)

- [ ] Полнотекстовый поиск по заметкам
- [ ] Drag-and-drop перемещение файлов в дереве
- [ ] Переименование папок (сейчас только файлы)
- [ ] OAuth (вход через Google/GitHub)
- [ ] PWA / офлайн-режим
- [ ] Экспорт в PDF

---

## Известные ограничения

- Supabase Storage (S3) не поддерживает реальные папки — эмулируются через `.keep`-файлы
- `list()` требует отдельного вызова на каждую подпапку (нет рекурсивного API)
- Переименование папки = переименование каждого файла внутри по отдельности (не реализовано)
