# 🤖 Telegram Bot Setup Guide

> **Назначение:** Уведомления о читерах прямо в Telegram  
> **Хостинг:** Render.com (бесплатно!)  
> **Время настройки:** ~15 минут  

---

## 📋 Содержание

1. [Создание бота в Telegram](#шаг-1-создание-бота)
2. [Получение Chat ID](#шаг-2-получение-chat-id)
3. [Развёртывание на Render.com](#шаг-3-развёртывание-на-rendercom)
4. [Интеграция с игрой](#шаг-4-интеграция-с-игрой)
5. [Проверка работы](#шаг-5-проверка-работы)

---

## Шаг 1: Создание бота

### 1.1 Открой Telegram и найди `@BotFather`

1. Открой Telegram (мобильное приложение или десктоп)
2. В поиске найди: `@BotFather`
3. Нажми **Start** или отправь `/start`

### 1.2 Создай нового бота

Отправь команду:
```
/newbot
```

### 1.3 Укажи имя бота

BotFather спросит имя. Отправь:
```
Titan Clicker Anti-Cheat
```

### 1.4 Укажи username бота

BotFather спросит username (должен заканчиваться на `bot`). Отправь:
```
titan_clicker_anticheat_bot
```

Если занято, попробуй:
```
titanclicker_security_bot
titan_anticheat_bot
titanclicker_admin_bot
```

### 1.5 Сохрани API Token

BotFather пришлёт сообщение вида:
```
Done! Congratulations on your new bot. 
You will find it at t.me/titan_clicker_anticheat_bot

Use this token to access the HTTP API:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

**Сохрани этот токен!** Он нужен для настройки.

Пример токена: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

---

## Шаг 2: Получение Chat ID

### 2.1 Найди `@userinfobot`

1. В поиске Telegram найди: `@userinfobot`
2. Нажми **Start**

### 2.2 Сохрани свой ID

Бот пришлёт сообщение:
```
Id: 123456789
First: YourName
Last: YourLastName
Username: @yourusername
```

**Сохрани число после `Id:`** — это твой Chat ID.

Пример: `123456789`

---

## Шаг 3: Развёртывание на Render.com

### 3.1 Зарегистрируйся на Render.com

1. Открой: https://render.com
2. Нажми **Get Started for Free**
3. Зарегистрируйся через GitHub (рекомендую) или email

### 3.2 Создай новый Web Service

1. Нажми **New +** → **Web Service**
2. Выбери **Build and deploy from a Git repository**

### 3.3 Настрой деплой

Так как у тебя нет GitHub репозитория, используем простой способ:

#### Вариант A: Через GitHub (рекомендую)

1. Создай репозиторий на GitHub
2. Загрузи туда папку `telegram-bot/` (файлы `bot.js` и `package.json`)
3. Подключи репозиторий к Render.com

#### Вариант B: Быстрый старт (без GitHub)

1. В Render.com выбери **Deploy an existing image from a registry**
2. Или используй **Deploy from URL** с этим кодом:

```javascript
// Создай файл server.js в корне проекта на Render.com
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const app = express();
app.use(express.json());

let bannedPlayers = new Set();
let incidents = [];

async function sendMessage(text) {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: ADMIN_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
    });
}

app.post('/api/notify', async (req, res) => {
    const incident = req.body;
    
    const message = `
🚨 <b>ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ</b>

👤 <b>Игрок:</b> ${incident.playerName}
🆔 <b>ID:</b> <code>${incident.playerId}</code>
⚠️ <b>Тип:</b> ${incident.type}
📊 <b>Опасность:</b> ${incident.severity}
⏰ <b>Время:</b> ${new Date(incident.time).toLocaleString('ru-RU')}

🚫 /ban_${incident.playerId}
    `;
    
    await sendMessage(message);
    incidents.push(incident);
    
    res.json({ success: true });
});

app.get('/api/check-ban/:playerId', (req, res) => {
    res.json({
        playerId: req.params.playerId,
        banned: bannedPlayers.has(req.params.playerId)
    });
});

app.listen(10000, () => {
    console.log('Bot running on port 10000');
    sendMessage('🤖 Бот активирован!');
});
```

### 3.4 Настрой Environment Variables

В настройках Web Service найди **Environment** и добавь:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | Твой токен из шага 1.5 (например: `123456789:ABCdef...`) |
| `ADMIN_CHAT_ID` | Твой Chat ID из шага 2.2 (например: `123456789`) |

### 3.5 Deploy!

Нажми **Create Web Service**

Жди 2-3 минуты пока deploy завершится.

### 3.6 Сохрани URL

После деплоя Render даст тебе URL вида:
```
https://titan-anticheat-bot.onrender.com
```

**Сохрани этот URL!** Он нужен для игры.

---

## Шаг 4: Интеграция с игрой

### 4.1 Открой `index.html`

Найди место где инициализируется игра (после загрузки RuStore).

### 4.2 Добавь код инициализации

Найди функцию `init()` или место где загружается игра, добавь:

```javascript
// Инициализация Telegram Bot для анти-чита
// ЗАМЕНИ URL на свой из шага 3.6!
if (window.GameSecurity) {
    GameSecurity.initTelegramBot(
        'https://titan-anticheat-bot.onrender.com', // ← ТВОЙ URL
        playerId,    // ID из RuStore (например: ru_store_user_123)
        playerName   // Имя игрока
    );
    
    // Проверяем бан при запуске
    GameSecurity.checkServerBan();
}
```

### 4.2 Пример полной интеграции

Найди в `index.html` место где загружается игрок из RuStore, добавь после:

```javascript
// После успешной авторизации в RuStore
function onPlayerAuthorized(playerData) {
    // ... существующий код ...
    
    // Инициализируем Telegram Bot для анти-чита
    if (window.GameSecurity && playerData) {
        const botUrl = 'https://titan-anticheat-bot.onrender.com'; // ← ЗАМЕНИ!
        
        GameSecurity.initTelegramBot(
            botUrl,
            playerData.playerId,
            playerData.name
        );
        
        // Проверяем, не забанен ли игрок
        GameSecurity.checkServerBan();
    }
}
```

### 4.3 Сохрани и проверь

1. Сохрани `index.html`
2. Открой игру в браузере
3. Открой консоль (F12)
4. Должно появиться: `[Telegram] Bot integration enabled`

---

## Шаг 5: Проверка работы

### 5.1 Тестируем уведомление

В консоли игры выполни:
```javascript
GameSecurity._notifyTelegram('test_incident', { test: true }, 'HIGH');
```

Должно прийти сообщение в Telegram!

### 5.2 Тестируем автокликер

В консоли выполни:
```javascript
CheatTests.autoClicker(5000);
```

Через 5 секунд должно прийти уведомление о детекции бота!

### 5.3 Тестируем ручной бан

В Telegram отправь боту:
```
/ban_test_player_123
```

В консоли игры проверь:
```javascript
GameSecurity.checkServerBan();
```

---

## 📱 Команды бота

В Telegram отправляй боту:

```
/start - Начать работу с ботом
/stats - Статистика за сегодня
/bans - Список забаненных
/top - Топ нарушителей
/ban_[playerId] - Забанить игрока
/info_[playerId] - Информация об игроке
/help - Помощь
```

---

## 🔘 Кнопки в уведомлениях

Когда приходит уведомление о читере, есть кнопки:
- 🚫 **Забанить** — мгновенный бан
- 📊 **Подробнее** — информация об игроке
- ✅ **Игнорировать** — пропустить

---

## ⚠️ Troubleshooting

### Бот не отправляет сообщения

1. Проверь `BOT_TOKEN` — должен быть точным
2. Проверь `ADMIN_CHAT_ID` — должен быть твой ID
3. Проверь URL в игре — должен заканчиваться на `.onrender.com`
4. Открой URL бота в браузере — должен показать "Cannot GET /" (это нормально)

### Render.com показывает "Deploy failed"

1. Проверь логи в Render.com
2. Убедись что `package.json` на месте
3. Проверь что Node.js версия 18+

### Игра не подключается к боту

1. Открой консоль игры (F12)
2. Ищи ошибки с `[Telegram]`
3. Проверь что `GameSecurity.initTelegramBot()` вызывается
4. Проверь что URL правильный (без слэша в конце)

---

## 🎉 Готово!

Теперь ты получаешь уведомления о читерах прямо в Telegram!

**Что дальше:**
1. 🧪 Протестируй всё
2. 🎮 Публикуй игру в RuStore
3. 😎 Спи спокойно — бот следит за читерами!

---

## 📞 Поддержка

Если что-то не работает:
1. Проверь логи в Render.com (Logs вкладка)
2. Открой консоль игры и ищи ошибки
3. Проверь что токен и Chat ID правильные

**Готово к настройке?** 🚀
