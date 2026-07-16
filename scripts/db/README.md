# DB export / import (Supabase → свой Postgres)

## Пустой self-hosted (только структура приложения)

После установки Docker Supabase накатите:

```bash
# из Studio SQL Editor: файл supabase/общая_схема.sql
# или:
psql "$TARGET_DB_URL" -f supabase/общая_схема.sql
```

Файл = `schema.sql` + все `patch_*.sql`. **Данных нет** — для данных используйте export ниже.

---

Скрипты снимают **схему + данные** с live Supabase, чтобы потом накатить на VPS Postgres.

| Скрипт | Зачем |
|--------|--------|
| `export-from-supabase.sh` | dump с freesh Supabase |
| `import-to-postgres.sh` | restore на новый Postgres |

Бэкапы пишутся в `backups/db/` (в git **не** коммитятся).

---

## 1. Один раз: инструменты

```bash
# macOS
brew install libpq
brew link --force libpq

# Ubuntu/Debian
sudo apt-get install -y postgresql-client
```

Проверка: `pg_dump --version`

---

## 2. Connection string

Supabase → **Project Settings → Database → Connection string**

- Бери **Direct connection** / **Session mode**, порт **5432**
- **Не** Transaction pooler (`:6543`) — `pg_dump` часто падает

В `.env.local` (не в git):

```env
SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres
```

Или:

```bash
export SUPABASE_DB_URL='postgresql://...'
```

---

## 3. Экспорт (сейчас, с freesh)

```bash
chmod +x scripts/db/*.sh

# Только app-данные (схема public) — обычно достаточно для «своего Postgres + свой auth»
./scripts/db/export-from-supabase.sh

# Только DDL (без данных)
./scripts/db/export-from-supabase.sh --schema-only

# public + auth + storage metadata (если потом self-hosted Supabase)
./scripts/db/export-from-supabase.sh --full-supabase
```

На выходе в `backups/db/`:

- `*.sql` — читаемый SQL  
- `*.dump` — custom format для `pg_restore` (удобнее)  
- `*.meta.txt` — список таблиц, размер, дата  

---

## 4. Импорт (на новом сервере)

```bash
export TARGET_DB_URL='postgresql://app:SECRET@127.0.0.1:5432/desireprive'

# Создай БД заранее, например:
# createdb -U postgres desireprive

./scripts/db/import-to-postgres.sh backups/db/supabase_public_full_XXXX.dump
# или
./scripts/db/import-to-postgres.sh backups/db/supabase_public_full_XXXX.sql
```

Скрипт **не даст** случайно залить dump обратно в `*.supabase.co` без `--yes`.

---

## 5. Что копируется, а что нет

### Копируется SQL-дампом

- Таблицы `public.*` (профили, чаты, топики, жалобы, альбомы…)
- Индексы, функции, RLS-политики, триггеры
- С `--full-supabase`: схемы `auth`, `storage` (метаданные бакетов), `extensions`

### Не копируется

| Что | Как переносить отдельно |
|-----|-------------------------|
| **Файлы Storage** (аватары, фото) | `supabase storage` CLI / S3 sync / ручной download + upload в MinIO |
| **Edge Functions** | git / redeploy |
| **Secrets, API keys** | env на новом сервере |
| **Realtime подписки** | self-hosted Supabase Realtime или свой WS |

Функции с `auth.uid()` на «голом» Postgres без схемы `auth` **сломаются**, пока нет совместимого auth (self-hosted Supabase GoTrue или свой JWT claim).

---

## 6. Два реальных сценария переезда

### A) Self-hosted Supabase (Docker) на VPS

1. `export-from-supabase.sh --full-supabase`
2. Поднять [supabase/docker](https://github.com/supabase/supabase/tree/master/docker)
3. `import-to-postgres.sh` в Postgres контейнера
4. Перенести storage files в volumes / S3
5. Прописать в Next.js новые `NEXT_PUBLIC_SUPABASE_URL` + keys

Меньше правок в коде приложения.

### B) Чистый Postgres + свой auth позже

1. `export-from-supabase.sh` (только `public`)
2. Import на VPS Postgres
3. Auth / storage — отдельный этап (или временно оставить Supabase Auth + Storage, а БД уже своя — сложнее)

---

## 7. Периодический бэкап (пока на freesh)

```bash
# cron / launchd раз в сутки
SUPABASE_DB_URL='...' /path/to/repo/scripts/db/export-from-supabase.sh
```

Храни `backups/db` **вне** git (S3, другой диск). В dump есть персональные данные.

---

## Troubleshooting

| Проблема | Что делать |
|----------|------------|
| `pg_dump: error: connection ... pooler` | Direct URI, port 5432 |
| SSL required | обычно `?sslmode=require` в URL |
| Role does not exist on restore | dump уже с `--no-owner`; игнор warnings или создай роль |
| `auth.uid()` fails on new DB | нужен auth schema / JWT / self-hosted Supabase |
| Огромный dump | используй `.dump` + `pg_restore -j 4` (можно дописать флаг) |
