RASSCHEET 0.1 — iOS site

Что это:
Отдельная Safari/iPhone-версия калькулятора. Она НЕ использует Telegram Mini App API.

Лицензии:
Используется та же таблица Supabase `licenses` и тот же TELEGRAM_BOT_TOKEN.
Вход выполняется через Telegram Login Widget, после чего сервер проверяет Telegram ID и активную лицензию.
Новые лицензии и текущая привязка Telegram ID не меняются.

ВАЖНО:
Перед публикацией нужно один раз разрешить домен сайта в BotFather для @Rasscheet_geo_bot через настройку домена Telegram Login Widget.

ENV на новом Netlify site:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN

Секреты сюда НЕ добавлять.

Публикация:
1) Создай отдельный Netlify site из этой папки.
2) Добавь три ENV-переменные выше.
3) Полученный домен добавь боту в настройках Telegram Login Widget.
4) Открой домен в Safari на iPhone.

Текущий `private/app.html` уже очищен от Telegram Mini App script/ready/expand и используется только как iOS-калькулятор.
