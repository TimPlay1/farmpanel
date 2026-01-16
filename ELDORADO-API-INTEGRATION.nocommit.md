# Eldorado API Integration Instructions

## Начальный запрос

Мне выдали личный API ключи, теперь нам нужно реализовать функционал панели:

### UI Панели (Offers раздел)
- Добавить кнопку API справа в разделе offers с кастомной иконкой мозга (белой, как в других элементах панели)
- При нажатии открывать модальное окно для сохранения API ключа
- Сохранять API ключ только после успешного тестового запроса к Eldorado API с ретраями (на случай rate limit)
- После успешного сохранения - ключ хранится ТОЛЬКО на сервере, не на клиенте
- В модалке показывать кнопку Reset для сброса ключа и ввода нового

### Telegram Bot
- API ключ бота: `7697571519:AAF8_Kd-3nvQrzoja7EV6v9kXQi4ewNA2S4`
- API ключ Eldorado используется как авторизационный пароль для юзера в боте
- После первой авторизации запоминать аккаунт телеграма и пропускать без пароля
- Интерфейс на английском
- Использовать встроенные inline кнопки Telegram
- Эмодзи использовать только когда реально нужны
- Предпочитать кастомные иконки вместо unicode где возможно
- Минималистичный, компактный, грамотный дизайн без лишнего оформления

### Функционал через API ключ (замена Tampermonkey скрипта)
1. **Отключение сканирования офферов** для пользователей с API ключами через cron сканер
2. **Получение офферов** через личный API ключ
3. **Получение коллекции brainrots** юзера
4. **Авто-выкладывание офферов** используя canvas массовый генератор офферов
   - Использование последней медианной/дефолтной/компетитора для мутации или дефолта
5. **Уведомления о продажах**
6. **Изменение цены** конкретного оффера из списка
7. **Удаление/изменение** названия, описания и других параметров офферов

---

## Техническая информация

### Инфраструктура
- **Docker** контейнеры
- **MySQL MariaDB** база данных
- **Coolify** автодеплой из GitHub push
- **НЕ используем**: MongoDB, Render - остались только остатки стилей файлов

### VPS Данные
```
Тарифный план: [DE] RX-3
Дата открытия: 2026-01-08
Доменное имя: instance195290.waicore.network
IP-адрес сервера: 87.120.216.181
Пользователь: root
Пароль: jc3gPf155auS

VMmanager 6:
Ссылка: https://vm.waicore.com
Пользователь: fivdjgwjcujj@gmail.com
Пароль: 6j51ez9jL0We

Coolify:
Пользователь: fivdjgwjcujj@gmail.com
Пароль: 6j51ez9jL0We
```

### Eldorado API
- Swagger документация: `eldoradoswagger-api.json`
- Base URL: `https://www.eldorado.gg/`
- Формат API ключа: `AbobaStore-Bot-hoSteXrHpC` (пример)

### Ключевые API эндпоинты Eldorado
- `GET /api/predefinedOffers/me` - получить свои офферы
- `POST /api/predefinedOffers` - создать оффер
- `PUT /api/predefinedOffers/{id}/details` - обновить оффер
- `DELETE /api/predefinedOffersUser/me/{id}` - удалить оффер
- `PUT /api/predefinedOffersUser/me/{id}/changePrice` - изменить цену
- `PUT /api/offerUser/me/switchOnline` - переключить онлайн
- `PUT /api/offerUser/me/switchOffline` - переключить оффлайн
- `GET /api/orders/me/seller/orders` - получить заказы (для уведомлений)
- `GET /api/notifications/me` - получить уведомления

### Flexible Offers API (для items/accounts)
- `GET /api/flexibleOffers/me/search` - поиск своих офферов
- `POST /api/flexibleOffers/account` - создать аккаунт оффер
- `POST /api/flexibleOffers/item` - создать item оффер
- `PUT /api/flexibleOffers/account/{id}/details` - обновить аккаунт
- `PUT /api/flexibleOffers/item/{id}/details` - обновить item
- `DELETE /api/flexibleOffersUser/me/{id}` - удалить
- `PUT /api/flexibleOffersUser/me/{id}/changePrice` - изменить цену

---

## Статус реализации

- [x] Кнопка API в панели offers
- [x] Модальное окно для API ключа
- [x] Валидация API ключа с ретраями
- [x] Серверное хранение API ключа (AES-256-CBC)
- [x] Telegram бот инфраструктура
- [x] Авторизация через API ключ в боте
- [x] Получение офферов через API
- [x] Получение коллекции brainrots
- [x] Авто-выкладывание офферов
- [x] Уведомления о продажах
- [x] Управление офферами (цена, удаление, редактирование)
- [x] Отключение cron сканирования для API юзеров

## Созданные файлы

### API модули
- `api/eldorado-api.js` - Управление API ключами с шифрованием, валидация с ретраями
- `api/telegram-bot.js` - Telegram бот с inline-кнопками
- `api/offers-api.js` - CRUD операции с офферами через личный API ключ
- `api/order-monitor.js` - Мониторинг заказов и уведомления
- `api/auto-create-offers.js` - Автоматическое создание офферов

### База данных
- `database/migrations/002_add_eldorado_api_keys.sql` - Таблицы для API ключей и сессий

### Frontend
- Добавлена кнопка API и модальное окно в `public/index.html`
- Стили в `public/styles.css`
- Логика в `public/app.js`

### Зависимости
- `node-telegram-bot-api` добавлен в `package.json`
