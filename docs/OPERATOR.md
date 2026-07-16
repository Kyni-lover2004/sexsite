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

Выдать себе admin:

```sql
update public.profiles
set role = 'admin'
where username = 'ВАШ_USERNAME';
-- или where id = 'uuid-из-auth.users';
```

---

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
- [ ] Email confirm / SMTP в Supabase Auth  
- [ ] Premium: либо pay provider, либо ручная выдача  
- [ ] Cron inactive cleanup на last_active_at  
- [ ] Storage buckets: profile-photos (+ private)  
- [ ] Подставить реквизиты в /legal/privacy и /legal/offer  
