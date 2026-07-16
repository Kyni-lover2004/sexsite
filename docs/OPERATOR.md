# Desire Privé — runbook оператора

Краткая памятка: что крутить руками, без «где это лежит в коде».

---

## 1. Доступ

| Что | Где |
|-----|-----|
| Админка | `/admin` (роль `profiles.role = 'admin'`) |
| Supabase | Dashboard проекта |
| SQL | Supabase → SQL Editor |
| Auth users | Supabase → Authentication |

Выдать себе admin + owner (владелец сайта — единственный, кто может «Снять админа»):

```sql
-- один раз: патч supabase/patch_super_admin_owner.sql

update public.profiles
set role = 'admin', is_owner = true
where username = 'ВАШ_USERNAME';
-- или where id = 'uuid-из-auth.users';
```

Обычных админов по-прежнему можно делать через `/admin` → «Сделать админом».  
Снять админку с них может только аккаунт с `is_owner = true`.

---

## 1b. Self-hosted: накатить схему приложения

После `docker compose` / `setup.sh` (пустой self-hosted) — **один файл**:

`supabase/общая_схема.sql`

Studio → SQL Editor → вставить целиком → Run  
(или `psql "$TARGET_DB_URL" -f supabase/общая_схема.sql`)

Это **структура + логика** (таблицы, RLS, RPC).  
**Данные** с freesh — отдельно: `scripts/db/export-from-supabase.sh`.

Потом:

```sql
update public.profiles
set role = 'admin', is_owner = true
where id = 'uuid-из-auth.users';
```

## 1c. Бэкап / переезд БД (Supabase → свой Postgres)

Скрипты: `scripts/db/` (см. `scripts/db/README.md`).

```bash
# connection string: Supabase → Database → Direct URI (port 5432)
export SUPABASE_DB_URL='postgresql://...'

./scripts/db/export-from-supabase.sh              # public schema + data
./scripts/db/export-from-supabase.sh --full-supabase  # + auth/storage metadata
```

Файлы → `backups/db/` (не в git). Импорт на VPS:

```bash
export TARGET_DB_URL='postgresql://user:pass@server:5432/dbname'
./scripts/db/import-to-postgres.sh backups/db/supabase_....dump
```

Фото/аватары из Storage SQL-дамп **не** включает.

## 2. SQL-патчи (прод)

Репозиторий: `supabase/patch_*.sql` + `schema.sql`.

**Прод — источник правды.** Патчи из git могли не примениться.

Рекомендуемый порядок «свежих» фич (если ещё не гоняли):

1. `patch_invisible_mode.sql` — невидимка  
2. `patch_last_active_retention.sql` — `last_active_at` + cleanup 30 дней  
3. `patch_e2ee_cloud_backup.sql` — облачный E2EE backup  
4. `patch_profiles_realtime.sql` — optional realtime на profiles  
5. Остальные `patch_*` по необходимости (квоты, swipe, reports…)

Проверка колонок:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by 1;
```

Должны быть: `is_invisible`, `last_active_at`, `premium_until`, …

```sql
select to_regclass('public.e2ee_key_backups');
```

---

## 3. Premium вручную

```sql
-- +30 дней Premium
update public.profiles
set premium_until = greatest(coalesce(premium_until, now()), now()) + interval '30 days'
where username = 'user_name';
```

Снять:

```sql
update public.profiles set premium_until = null where username = 'user_name';
```

---

## 4. Бан

Через `/admin` или:

```sql
update public.profiles
set
  is_banned = true,
  ban_reason = 'причина',
  banned_until = now() + interval '7 days', -- или null = навсегда
  banned_at = now()
where id = 'uuid';
```

---

## 5. Cron: удаление неактивных

Функция: `public.delete_inactive_profiles(30)`  
Ориентир: `last_active_at` (не публичный last_seen).

Проверка:

```sql
select public.delete_inactive_profiles(30); -- вернёт число удалённых; осторожно на проде
```

Расписание: Supabase → Database → Cron / Extensions `pg_cron`.  
Джоба вида: `select public.delete_inactive_profiles(30);` в 03:00.

---

## 6. E2EE / «пропали сообщения»

1. Пользователь **не** должен создавать новый ключ на новом браузере.  
2. Должен ввести **пароль восстановления** (E2eeRecoveryGate) или загрузить `.json` backup.  
3. Cloud blob: таблица `e2ee_key_backups` (только шифротекст).  
4. Support **не может** расшифровать сообщения — только подсказать recovery.  
5. Если ключ потерян и backup нет — история **невосстановима** (это нормально для E2EE).

Проверка backup у user:

```sql
select user_id, updated_at from public.e2ee_key_backups where user_id = 'uuid';
```

---

## 7. Жалобы

- Контент / профили → админка (очереди reports).  
- Причина `underage` — приоритет, блокировать аккаунт.  
- Чат E2EE: текст жалобы пользователь копирует сам; сервер не видит ciphertext.

---

## 8. Legal (без логина)

| URL | Содержание |
|-----|------------|
| `/legal` | оглавление |
| `/legal/rules` | 18+, правила |
| `/legal/terms` | условия |
| `/legal/privacy` | 152-ФЗ / данные |
| `/legal/offer` | оферта Premium |

Перед продом: юрлицо, email, ИНН в privacy + offer.

---

## 9. Аналитика воронки

RPC `track_event` (если применён hardening-патч).  
События: `signup_completed`, `profile_filled`, `first_like`, `first_message_sent`, `premium_viewed`, …

```sql
-- пример, если есть таблица analytics_events
select event, count(*) from analytics_events
where created_at > now() - interval '7 days'
group by 1 order by 2 desc;
```

(Имя таблицы уточните по `patch_platform_hardening.sql`.)

---

## 10. Чеклист «перед наливом людей»

- [ ] SQL: invisible, last_active, e2ee_backups  
- [ ] Admin user есть  
- [ ] Legal ссылки с лендинга, 18+ gate  
- [ ] Email: **Confirm email = OFF** (регистрация без письма; см. § Auth ниже)  
- [ ] SMTP — только если позже понадобится «забыл пароль»  

---

## Auth: без верификации почты

Регистрация = email + пароль, **без** письма подтверждения.
Мусор чистится модерацией + cleanup неактивных (~30 дней по `last_active_at`).

### Freesh / cloud Supabase
Dashboard → **Authentication** → **Providers** → **Email**:
- **Confirm email** → **выключено**
- (опционально) Secure email change — как удобно

Без этого `signUp` не выдаёт сессию, и пользователь не войдёт.

### Self-hosted
В `.env` Docker-стека (имена зависят от версии, смотри `.env.example`):

```env
GOTRUE_MAILER_AUTOCONFIRM=true
# или ENABLE_EMAIL_AUTOCONFIRM=true
```

Пересоздать auth: `sh run.sh recreate auth` (или полный restart).

SMTP для signup **не нужен**. SMTP — только для reset password, когда решите включить.
- [ ] Premium: либо pay provider, либо ручная выдача  
- [ ] Cron inactive cleanup на last_active_at  
- [ ] Storage buckets: profile-photos (+ private)  
- [ ] Подставить реквизиты в /legal/privacy и /legal/offer  
