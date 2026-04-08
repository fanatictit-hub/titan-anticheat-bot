/**
 * 🤖 Titan Clicker Anti-Cheat Telegram Bot
 * 
 * Отправляет уведомления о читерах прямо в Telegram!
 * Хостится бесплатно на Render.com
 * 
 * @version 1.0.0
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// ==================== CONFIGURATION ====================

// ЗАМЕНИ ЭТИ ЗНАЧЕНИЯ ПОСЛЕ СОЗДАНИЯ БОТА:
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_CHAT_ID_HERE';
// 🔍 ОТЛАДКА: Показываем что загрузилось
console.log('🔍 DEBUG: BOT_TOKEN loaded:', BOT_TOKEN ? `YES (length: ${BOT_TOKEN.length}, starts with: ${BOT_TOKEN.substring(0, 10)}...)` : 'NO');
console.log('🔍 DEBUG: ADMIN_CHAT_ID loaded:', ADMIN_CHAT_ID ? `YES (${ADMIN_CHAT_ID})` : 'NO');
// Проверка конфигурации
if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || !BOT_TOKEN || ADMIN_CHAT_ID === 'YOUR_CHAT_ID_HERE' || !ADMIN_CHAT_ID) {
    console.error('❌ ОШИБКА: Нужно настроить BOT_TOKEN и ADMIN_CHAT_ID!');
    console.log('1. Создай бота через @BotFather');
    console.log('2. Получи Chat ID через @userinfobot');
    console.log('3. Укажи их в переменных окружения Render.com');
    process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 3000;

// ==================== DATA STORAGE ====================

const DATA_FILE = path.join(__dirname, 'data', 'bans.json');
const INCIDENTS_FILE = path.join(__dirname, 'data', 'incidents.json');

// ==================== EXPRESS APP ====================

const app = express();
app.use(express.json());

// Хранение инцидентов в памяти (плюс файл)
let incidents = [];
let bannedPlayers = new Set();

// ==================== TELEGRAM BOT FUNCTIONS ====================

/**
 * Отправить сообщение в Telegram
 */
async function sendTelegramMessage(text, options = {}) {
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            ...options
        });
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки в Telegram:', error.message);
        return null;
    }
}

/**
 * Отправить уведомление о читере
 */
async function notifyCheatDetected(incident) {
    const severityEmoji = {
        'CRITICAL': '🚨',
        'HIGH': '⚠️',
        'MEDIUM': '🔶',
        'LOW': 'ℹ️'
    };

    const message = `
${severityEmoji[incident.severity] || '⚠️'} <b>ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ</b>

👤 <b>Игрок:</b> ${incident.playerName || 'Unknown'}
🆔 <b>ID:</b> <code>${incident.playerId}</code>
⚠️ <b>Тип:</b> ${incident.type}
📊 <b>Опасность:</b> ${incident.severity} (${incident.score || 'N/A'}/10)
⏰ <b>Время:</b> ${new Date(incident.time).toLocaleString('ru-RU')}
🎮 <b>Этап:</b> ${incident.stage || 'N/A'}

📈 <b>Детали:</b>
<pre>${JSON.stringify(incident.details, null, 2).substring(0, 300)}</pre>

<b>Действия:</b>
🚫 /ban_${incident.playerId}
📊 /info_${incident.playerId}
✅ /ignore
    `;

    // Кнопки для быстрых действий
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚫 Забанить', callback_data: `ban:${incident.playerId}` },
                { text: '📊 Подробнее', callback_data: `info:${incident.playerId}` }
            ],
            [
                { text: '✅ Игнорировать', callback_data: 'ignore' }
            ]
        ]
    };

    return await sendTelegramMessage(message, {
        reply_markup: JSON.stringify(keyboard)
    });
}

/**
 * Отправить ежедневную сводку
 */
async function sendDailyStats() {
    const today = new Date().toDateString();
    const todayIncidents = incidents.filter(i => 
        new Date(i.time).toDateString() === today
    );

    const critical = todayIncidents.filter(i => i.severity === 'CRITICAL').length;
    const high = todayIncidents.filter(i => i.severity === 'HIGH').length;
    const medium = todayIncidents.filter(i => i.severity === 'MEDIUM').length;

    const message = `
📊 <b>ЕЖЕДНЕВНАЯ СВОДКА</b>
📅 ${new Date().toLocaleDateString('ru-RU')}

<b>Инциденты за сегодня:</b>
🚨 Критических: ${critical}
⚠️ Высоких: ${high}
🔶 Средних: ${medium}
📊 Всего: ${todayIncidents.length}

<b>Забанено игроков:</b> ${bannedPlayers.size}

<b>Топ нарушителей:</b>
${getTopOffenders(5)}
    `;

    await sendTelegramMessage(message);
}

/**
 * Получить топ нарушителей
 */
function getTopOffenders(limit = 5) {
    const counts = {};
    incidents.forEach(i => {
        counts[i.playerId] = (counts[i.playerId] || 0) + 1;
    });

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, count], index) => `${index + 1}. ${id}: ${count} инцидентов`)
        .join('\n') || 'Нет данных';
}

// ==================== API ENDPOINTS ====================

/**
 * Получить уведомление о читере из игры
 */
app.post('/api/notify', async (req, res) => {
    const { playerId, playerName, type, severity, score, details, stage, time } = req.body;

    if (!playerId || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Проверяем, не забанен ли уже
    if (bannedPlayers.has(playerId)) {
        return res.json({ success: true, message: 'Player already banned' });
    }

    const incident = {
        id: Date.now().toString(),
        playerId,
        playerName: playerName || 'Unknown',
        type,
        severity: severity || 'MEDIUM',
        score: score || 0,
        details: details || {},
        stage: stage || 0,
        time: time || Date.now(),
        notified: false
    };

    // Сохраняем инцидент
    incidents.push(incident);
    await saveIncidents();

    // Отправляем в Telegram (только если HIGH или выше)
    if (['CRITICAL', 'HIGH'].includes(incident.severity)) {
        await notifyCheatDetected(incident);
        incident.notified = true;
    }

    console.log(`🚨 Инцидент: ${type} от ${playerName || playerId}`);

    res.json({ success: true, incidentId: incident.id });
});

/**
 * Проверить, забанен ли игрок
 */
app.get('/api/check-ban/:playerId', (req, res) => {
    const { playerId } = req.params;
    const isBanned = bannedPlayers.has(playerId);
    
    res.json({
        playerId,
        banned: isBanned,
        reason: isBanned ? 'Manual ban by admin' : null
    });
});

/**
 * Получить список забаненных
 */
app.get('/api/bans', (req, res) => {
    res.json({
        bannedCount: bannedPlayers.size,
        bannedPlayers: Array.from(bannedPlayers)
    });
});

/**
 * Ручной бан игрока (через API)
 */
app.post('/api/ban', async (req, res) => {
    const { playerId, reason } = req.body;
    
    if (!playerId) {
        return res.status(400).json({ error: 'playerId required' });
    }

    bannedPlayers.add(playerId);
    await saveBans();

    await sendTelegramMessage(`
🚫 <b>ИГРОК ЗАБАНЕН</b>

🆔 ID: <code>${playerId}</code>
📝 Причина: ${reason || 'Manual ban via API'}
⏰ Время: ${new Date().toLocaleString('ru-RU')}
    `);

    console.log(`🚫 Игрок забанен: ${playerId}`);
    
    res.json({ success: true, playerId, banned: true });
});

/**
 * Разбан игрока
 */
app.post('/api/unban', async (req, res) => {
    const { playerId } = req.body;
    
    if (!playerId) {
        return res.status(400).json({ error: 'playerId required' });
    }

    bannedPlayers.delete(playerId);
    await saveBans();

    await sendTelegramMessage(`
✅ <b>ИГРОК РАЗБАНЕН</b>

🆔 ID: <code>${playerId}</code>
⏰ Время: ${new Date().toLocaleString('ru-RU')}
    `);

    console.log(`✅ Игрок разбанен: ${playerId}`);
    
    res.json({ success: true, playerId, banned: false });
});

/**
 * Статистика
 */
app.get('/api/stats', (req, res) => {
    const today = new Date().toDateString();
    const todayIncidents = incidents.filter(i => 
        new Date(i.time).toDateString() === today
    );

    res.json({
        totalIncidents: incidents.length,
        todayIncidents: todayIncidents.length,
        bannedPlayers: bannedPlayers.size,
        recentIncidents: incidents.slice(-10)
    });
});

// ==================== TELEGRAM WEBHOOK HANDLERS ====================

/**
 * Обработка команд из Telegram
 */
app.post('/webhook', async (req, res) => {
    const { message, callback_query } = req.body;

    // Обработка текстовых команд
    if (message && message.text) {
        const text = message.text;
        const chatId = message.chat.id;

        // Команда /start
        if (text === '/start') {
            await sendTelegramMessage(`
🤖 <b>Titan Clicker Anti-Cheat Bot</b>

Привет! Я бот для мониторинга читеров в игре.

<b>Команды:</b>
/stats - Статистика за сегодня
/bans - Список забаненных
/top - Топ нарушителей
/help - Помощь

Я буду присылать уведомления о подозрительной активности!
            `);
        }

        // Команда /stats
        else if (text === '/stats') {
            const today = new Date().toDateString();
            const todayIncidents = incidents.filter(i => 
                new Date(i.time).toDateString() === today
            );

            await sendTelegramMessage(`
📊 <b>Статистика за сегодня</b>

🚨 Критических: ${todayIncidents.filter(i => i.severity === 'CRITICAL').length}
⚠️ Высоких: ${todayIncidents.filter(i => i.severity === 'HIGH').length}
🔶 Средних: ${todayIncidents.filter(i => i.severity === 'MEDIUM').length}
📊 Всего инцидентов: ${todayIncidents.length}
🚫 Забанено: ${bannedPlayers.size}
            `);
        }

        // Команда /bans
        else if (text === '/bans') {
            const banList = Array.from(bannedPlayers).slice(0, 20);
            const message = banList.length > 0 
                ? `🚫 <b>Забаненные игроки (${bannedPlayers.size}):</b>\n\n${banList.map((id, i) => `${i + 1}. <code>${id}</code>`).join('\n')}`
                : '🚫 Нет забаненных игроков';
            
            await sendTelegramMessage(message);
        }

        // Команда /top
        else if (text === '/top') {
            const top = getTopOffenders(10);
            await sendTelegramMessage(`
📊 <b>ТОП НАРУШИТЕЛЕЙ</b>

${top}
            `);
        }

        // Команда /ban_[playerId]
        else if (text.startsWith('/ban_')) {
            const playerId = text.replace('/ban_', '');
            bannedPlayers.add(playerId);
            await saveBans();
            
            await sendTelegramMessage(`
🚫 <b>Игрок забанен!</b>

🆔 ID: <code>${playerId}</code>
⏰ Время: ${new Date().toLocaleString('ru-RU')}
            `);
        }

        // Команда /info_[playerId]
        else if (text.startsWith('/info_')) {
            const playerId = text.replace('/info_', '');
            const playerIncidents = incidents.filter(i => i.playerId === playerId);
            
            await sendTelegramMessage(`
📊 <b>Информация об игроке</b>

🆔 ID: <code>${playerId}</code>
📊 Всего инцидентов: ${playerIncidents.length}
🚫 Забанен: ${bannedPlayers.has(playerId) ? 'Да' : 'Нет'}

<b>Последние инциденты:</b>
${playerIncidents.slice(-5).map(i => 
    `• ${i.type} (${i.severity}) - ${new Date(i.time).toLocaleDateString('ru-RU')}`
).join('\n') || 'Нет данных'}
            `);
        }

        // Команда /help
        else if (text === '/help') {
            await sendTelegramMessage(`
🤖 <b>Команды бота:</b>

<b>Общие:</b>
/stats - Статистика за сегодня
/bans - Список забаненных
/top - Топ нарушителей

<b>Управление:</b>
/ban_[playerId] - Забанить игрока
/info_[playerId] - Информация об игроке

<b>Примеры:</b>
<code>/ban_ru_store_user_123</code>
<code>/info_player_456</code>
            `);
        }
    }

    // Обработка кнопок (inline keyboard)
    if (callback_query) {
        const data = callback_query.data;
        
        if (data.startsWith('ban:')) {
            const playerId = data.replace('ban:', '');
            bannedPlayers.add(playerId);
            await saveBans();
            
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
                callback_query_id: callback_query.id,
                text: `Игрок ${playerId} забанен!`
            });
            
            await sendTelegramMessage(`🚫 Игрок <code>${playerId}</code> забанен!`);
        }
        
        else if (data.startsWith('info:')) {
            const playerId = data.replace('info:', '');
            const playerIncidents = incidents.filter(i => i.playerId === playerId);
            
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
                callback_query_id: callback_query.id,
                text: `${playerIncidents.length} инцидентов`
            });
        }
        
        else if (data === 'ignore') {
            await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
                callback_query_id: callback_query.id,
                text: 'Игнорировано'
            });
        }
    }

    res.sendStatus(200);
});

// ==================== DATA PERSISTENCE ====================

async function loadData() {
    try {
        // Создаём папку data если нет
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        
        // Загружаем баны
        const bansData = await fs.readFile(DATA_FILE, 'utf8').catch(() => '[]');
        bannedPlayers = new Set(JSON.parse(bansData));
        
        // Загружаем инциденты
        const incidentsData = await fs.readFile(INCIDENTS_FILE, 'utf8').catch(() => '[]');
        incidents = JSON.parse(incidentsData);
        
        console.log(`📁 Загружено: ${incidents.length} инцидентов, ${bannedPlayers.size} банов`);
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
    }
}

async function saveBans() {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(Array.from(bannedPlayers), null, 2));
    } catch (error) {
        console.error('❌ Ошибка сохранения банов:', error);
    }
}

async function saveIncidents() {
    try {
        // Храним только последние 1000 инцидентов
        const recent = incidents.slice(-1000);
        await fs.writeFile(INCIDENTS_FILE, JSON.stringify(recent, null, 2));
    } catch (error) {
        console.error('❌ Ошибка сохранения инцидентов:', error);
    }
}

// ==================== SCHEDULED TASKS ====================

// Ежедневная сводка в 9:00
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
        sendDailyStats();
    }
}, 60000); // Проверяем каждую минуту

// ==================== START SERVER ====================

app.listen(PORT, async () => {
    console.log('🤖 Titan Clicker Anti-Cheat Bot');
    console.log('=' .repeat(40));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Telegram: ${ADMIN_CHAT_ID}`);
    console.log('=' .repeat(40));
    
    await loadData();
    
    // Отправляем приветственное сообщение
    await sendTelegramMessage(`
🤖 <b>Бот активирован!</b>

✅ Сервер запущен
📊 Загружено инцидентов: ${incidents.length}
🚫 Забанено игроков: ${bannedPlayers.size}

Жду уведомлений о читерах... 👀
    `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('👋 Получен SIGTERM, сохраняю данные...');
    await saveBans();
    await saveIncidents();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('👋 Получен SIGINT, сохраняю данные...');
    await saveBans();
    await saveIncidents();
    process.exit(0);
});
