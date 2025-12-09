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

// 🔍 Поиск сделки по YaCID
async function findDealByClientId(clientId) {
try {
    const response = await axios.post(BITRIX_WEBHOOK_URL + 'crm.deal.list', {
     filter: { [CUSTOM_FIELD_ID]: clientId },
     select: ['ID']
    });
    const deals = response.data.result;
    return deals.length > 0 ? deals[0].ID : null;
} catch (error) {
    console.error('Ошибка при поиске сделки:', error.response?.data || error.message);
    return null;
}
}

// ➕ Создание сделки с email/phone
async function createDeal(clientId, email, phone) {
try {
    const fields = {
     TITLE: 'Сделка из Яндекс.Метрики',
     NAME: 'Автоматическая сделка',
     SOURCE_ID: 'WEB',
     SOURCE_DESCRIPTION: 'YaMetrika client_id',
     STAGE_ID: 'NEW', // ← Укажите нужную стадию по умолчанию (например, 'WON', 'PROPOSAL', и т.д.)
     CUSTOM_FIELDS: {
        [CUSTOM_FIELD_ID]: clientId
     }
    };

    if (email) fields.EMAIL = [{ VALUE: email.trim(), VALUE_TYPE: 'WORK' }];
    if (phone) fields.PHONE = [{ VALUE: phone.trim().replace(/\D/g, ''), VALUE_TYPE: 'WORK' }];

    const response = await axios.post(BITRIX_WEBHOOK_URL + 'crm.deal.add', { fields });
    return response.data.result;
} catch (error) {
    console.error('Ошибка при создании сделки:', error.response?.data || error.message);
    throw error;
}
}

// 📥 Приём данных от GTM
app.post('/send-yaclid', async (req, res) => {
const { client_id, email, phone } = req.body;

if (!client_id) {
    return res.status(400).json({ success: false, error: 'client_id не передан' });
}

// 🚫 Не создавать сделку без email или телефона
if (!email && !phone) {
    console.log('⚠️ Запрос отклонён: нет email или phone для client_id:', client_id);
    return res.status(200).json({
     success: true,
     message: 'Сделка не создана — нет email или телефона',
     dealId: null
    });
}

try {
    const existingDealId = await findDealByClientId(client_id);

    if (existingDealId) {
     console.log('🔁 Сделка с client_id=' + client_id + ' уже существует (ID: ' + existingDealId + ')');
     return res.json({
        success: true,
        dealId: existingDealId,
        message: 'Сделка уже существует, дубликат не создан'
     });
    }

    const newDealId = await createDeal(client_id, email, phone);
    console.log('✅ Новая сделка создана: ID=' + newDealId + ', client_id=' + client_id);
    res.json({ success: true, dealId: newDealId });

} catch (error) {
    console.error('❌ Ошибка при обработке запроса:', error);
    res.status(500).json({ success: false, error: 'Не удалось обработать запрос' });
}
});

// 🚀 Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log('🚀 Прокси-сервер для сделок запущен на порту ' + PORT);
});
