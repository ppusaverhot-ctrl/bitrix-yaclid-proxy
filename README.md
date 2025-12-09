Прокси-сервер для передачи YaCID из Яндекс.Метрики в Битрикс24

🔧 Назначение
Сервер принимает
client_id
из Яндекс.Метрики (через GTM) и создаёт лид в Битрикс24 только если передан email или телефон.
Исключает дубликаты, фильтрует мусор, заполняет кастомное поле
YaCID
.


✅ Техническая архитектура

| Компонент | Описание |
|----------|----------|
| Frontend | GTM на
saverhot.ru
отправляет
client_id
,
email
,
phone
через
fetch
|
| Backend | Node.js + Express на Render.com — прокси-сервер |
| CRM | Битрикс24 — получает лиды через вебхук |
| Кастомное поле |
UF_CRM_6932AF9AB4EDC
— хранит
client_id
|


📦 Зависимости

- Node.js 18+
- Express 4.x
- Axios 1.x

// package.json
{
"name": "bitrix-yaclid-proxy",
"version": "1.0.0",
"main": "server.js",
"scripts": {
    "start": "node server.js"
},
"dependencies": {
    "express": "^4.18.2",
    "axios": "^1.7.2"
}
}


📂 Файл:
server.js


const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// 🔐 Получаем значения из переменных окружения
const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL;
const CUSTOM_FIELD_ID = process.env.CUSTOM_FIELD_ID;

// Проверка обязательных переменных
if (!BITRIX_WEBHOOK_URL || !CUSTOM_FIELD_ID) {
console.error('❌ ОШИБКА: Не заданы переменные окружения BITRIX_WEBHOOK_URL или CUSTOM_FIELD_ID');
process.exit(1);
}

// 🔐 CORS — разрешаем только saverhot.ru
app.use((req, res, next) => {
res.header('Access-Control-Allow-Origin', 'https://saverhot.ru');
res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.header('Access-Control-Allow-Headers', 'Content-Type');

if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
}

next();
});

// 🔍 Поиск лида по YaCID
async function findLeadByClientId(clientId) {
try {
    const response = await axios.post(BITRIX_WEBHOOK_URL + 'crm.lead.list', {
     filter: { [CUSTOM_FIELD_ID]: clientId },
     select: ['ID']
    });
    const leads = response.data.result;
    return leads.length > 0 ? leads[0].ID : null;
} catch (error) {
    console.error('Ошибка при поиске лида:', error.response?.data || error.message);
    return null;
}
}

// ➕ Создание лида с email/phone
async function createLead(clientId, email, phone) {
try {
    const fields = {
     TITLE: 'Лид из Яндекс.Метрики',
     NAME: 'Автоматический лид',
     SOURCE_ID: 'WEB',
     SOURCE_DESCRIPTION: 'YaMetrika client_id',
     CUSTOM_FIELDS: {
        [CUSTOM_FIELD_ID]: clientId
     }
    };

    if (email) fields.EMAIL = [{ VALUE: email.trim(), VALUE_TYPE: 'WORK' }];
    if (phone) fields.PHONE = [{ VALUE: phone.trim().replace(/\D/g, ''), VALUE_TYPE: 'WORK' }];

    const response = await axios.post(BITRIX_WEBHOOK_URL + 'crm.lead.add', { fields });
    return response.data.result;
} catch (error) {
    console.error('Ошибка при создании лида:', error.response?.data || error.message);
    throw error;
}
}

// 📥 Приём данных от GTM
app.post('/send-yaclid', async (req, res) => {
const { client_id, email, phone } = req.body;

if (!client_id) {
    return res.status(400).json({ success: false, error: 'client_id не передан' });
}

// 🚫 Не создавать лид без email или телефона
if (!email && !phone) {
    console.log('⚠️ Запрос отклонён: нет email или phone для client_id:', client_id);
    return res.status(200).json({
     success: true,
     message: 'Лид не создан — нет email или телефона',
     leadId: null
    });
}

try {
    const existingLeadId = await findLeadByClientId(client_id);

    if (existingLeadId) {
     console.log('🔁 Лид с client_id=' + client_id + ' уже существует (ID: ' + existingLeadId + ')');
     return res.json({
        success: true,
        leadId: existingLeadId,
        message: 'Лид уже существует, дубликат не создан'
     });
    }

    const newLeadId = await createLead(client_id, email, phone);
    console.log('✅ Новый лид создан: ID=' + newLeadId + ', client_id=' + client_id);
    res.json({ success: true, leadId: newLeadId });

} catch (error) {
    console.error('❌ Ошибка при обработке запроса:', error);
    res.status(500).json({ success: false, error: 'Не удалось обработать запрос' });
}
});

// 🚀 Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log('🚀 Прокси-сервер запущен на порту ' + PORT);
});


⚙️ Настройка на Render.com

| Параметр | Значение |
|----------|----------|
| Build Command | (оставить пустым) |
| Start Command |
npm start
|
| Environment Variables | |

BITRIX_WEBHOOK_URL=https://saverhot.bitrix24.ru/rest/1/gtw9mu26uw6pbney/
CUSTOM_FIELD_ID=UF_CRM_6932AF9AB4EDC

✅ Важно:
CUSTOM_FIELD_ID
— полный код поля (включая
UF_CRM_
), а не только цифры.


📥 GTM: Как отправлять данные

В теге GTM (например, в кастомном HTML-теге):

<sc ript>
(function() {
function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
}

var clientId = getCookie("_ym_uid");
var email = document.querySelector('input[name="email"], input[type="email"]')?.value || '';
var phone = document.querySelector('input[name="phone"], input[type="tel"]')?.value || '';

if (clientId) {
    fetch('https://bitrix-yaclid-proxy.onrender.com/send-yaclid', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ client_id: clientId, email, phone })
    })
    .then(r => r.json())
    .then(data => console.log('✅ YaCID отправлен:', data))
    .catch(e => console.error('❌ Ошибка:', e));
}
})();
</sc ript>

💡 Если email/phone приходят через
dataLayer
, замените
document.querySelector
на
dataLayer.get('email')
.


✅ Проверка работоспособности

1. Откройте
https://saverhot.ru
в режиме Предварительного просмотра GTM.
2. В консоли браузера должно появиться:
✅ YaCID отправлен в Битрикс24: { success: true, leadId: "12345" }
3. Зайдите в Битрикс24 → CRM → Лиды → откройте последний лид → убедитесь, что:
- Поле
UF_CRM_6932AF9AB4EDC
заполнено
client_id
- Поле
Email
или
Телефон
заполнено (если передано)
4. Проверьте логи Render.com — нет ошибок
401
,
500
,
undefined
.


🛡️ Преимущества решения

| Проблема | Решение |
|----------|---------|
| Дубликаты лидов | ✅ Проверка по
client_id
|
| Мусорные лиды | ✅ Только при наличии email/phone |
| Нет связи с CRM | ✅ Прямая интеграция через вебхук |
| CORS-ошибки | ✅ Настроен строгий CORS для
saverhot.ru
|
| Надёжность | ✅ Переменные окружения, логирование, обработка ошибок |
