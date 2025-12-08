const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// 🔐 Получаем значения из переменных окружения (Render)
const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL;
const CUSTOM_FIELD_ID = process.env.CUSTOM_FIELD_ID;

// Проверка обязательных переменных
if (!BITRIX_WEBHOOK_URL || !CUSTOM_FIELD_ID) {
console.error('❌ ОШИБКА: Не заданы переменные окружения BITRIX_WEBHOOK_URL или CUSTOM_FIELD_ID');
process.exit(1);
}

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

async function createLead(clientId) {
try {
    const response = await axios.post(BITRIX_WEBHOOK_URL + 'crm.lead.add', {
     fields: {
        TITLE: 'Лид с YaCID',
        NAME: 'Автоматический лид',
        SOURCE_ID: 'WEB',
        SOURCE_DESCRIPTION: 'YaMetrika client_id',
        CUSTOM_FIELDS: {
         [CUSTOM_FIELD_ID]: clientId
        }
     }
    });
    return response.data.result;
} catch (error) {
    console.error('Ошибка при создании лида:', error.response?.data || error.message);
    throw error;
}
}

app.post('/send-yaclid', async (req, res) => {
const { client_id } = req.body;

if (!client_id) {
    return res.status(400).json({ success: false, error: 'client_id не передан' });
}

try {
    const existingLeadId = await findLeadByClientId(client_id);

    if (existingLeadId) {
     console.log([code]🔁 Лид с client_id=${client_id} уже существует (ID: ${existingLeadId})
);
     return res.json({ success: true, leadId: existingLeadId, message: 'Лид уже существует, дубликат не создан' });
    }

    const newLeadId = await createLead(client_id);
    console.log(
✅ Новый лид создан: ID=${newLeadId}, client_id=${client_id}
);
    res.json({ success: true, leadId: newLeadId });

} catch (error) {
    console.error('❌ Ошибка при обработке запроса:', error);
    res.status(500).json({ success: false, error: 'Не удалось обработать запрос' });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(
🚀 Прокси-сервер запущен на порту ${PORT}
);
});[/code]
