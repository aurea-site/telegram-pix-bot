const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = String(process.env.TELEGRAM_GROUP_ID);
const ADMIN_ID = String(process.env.ADMIN_TELEGRAM_ID);
const PIX_KEY = process.env.PIX_KEY;
const PIX_NAME = process.env.PIX_NAME || "AUREA";
const PIX_CITY = process.env.PIX_CITY || "SANTA LUZIA";

const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!data.ok) {
    console.error("Telegram API error:", data);
    throw new Error(data.description || "Telegram API error");
  }

  return data.result;
}

function pixField(id, value) {
  const text = String(value);
  return id + text.length.toString().padStart(2, "0") + text;
}

function crc16(payload) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function createPixPayload() {
  const merchantAccount =
    pixField("00", "BR.GOV.BCB.PIX") +
    pixField("01", PIX_KEY);

  const additionalData = pixField("05", "***");

  const payload =
    pixField("00", "01") +
    pixField("26", merchantAccount) +
    pixField("52", "0000") +
    pixField("53", "986") +
    pixField("54", "4.99") +
    pixField("58", "BR") +
    pixField("59", PIX_NAME.slice(0, 25)) +
    pixField("60", PIX_CITY.slice(0, 15)) +
    pixField("62", additionalData) +
    "6304";

  return payload + crc16(payload);
}

function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

async function handleJoinRequest(request) {
  const user = request.from;
  const pix = createPixPayload();

  const name = user.first_name || "cliente";

  await tg("sendMessage", {
    chat_id: request.user_chat_id,
    text:
`🔐 ACESSO AO GRUPO

Olá, ${name}!

Para liberar sua entrada, faça o Pix de R$ 4,99.

📲 PIX COPIA E COLA:

${pix}

Depois de pagar, toque em "Já fiz o Pix".

⚠️ O acesso só será liberado após a confirmação do pagamento.`,
    reply_markup: {
      inline_keyboard: [[
        {
          text: "✅ Já fiz o Pix",
          callback_data: `paid:${user.id}`
        }
      ]]
    }
  });
}

async function handlePaid(callback) {
  const userId = callback.data.split(":")[1];

  await tg("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: "Solicitação enviada para confirmação."
  });

  const user = callback.from;

  await tg("sendMessage", {
    chat_id: ADMIN_ID,
    text:
`💰 PAGAMENTO PARA CONFERIR

👤 Nome: ${user.first_name || "-"}
🔹 Username: ${user.username ? "@" + user.username : "sem username"}
🆔 ID: ${userId}
💵 Valor: R$ 4,99

Confira o recebimento do Pix antes de liberar o acesso.`,
    reply_markup: {
      inline_keyboard: [[
        {
          text: "✅ CONFIRMAR PAGAMENTO E LIBERAR",
          callback_data: `confirm:${userId}`
        }
      ]]
    }
  });
}

async function handleConfirm(callback) {
  const userId = callback.data.split(":")[1];

  if (!isAdmin(callback.from.id)) {
    await tg("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Sem permissão."
    });
    return;
  }

  await tg("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: "Liberando acesso..."
  });

  await tg("approveChatJoinRequest", {
    chat_id: GROUP_ID,
    user_id: Number(userId)
  });

  await tg("sendMessage", {
    chat_id: Number(userId),
    text:
`✅ PAGAMENTO CONFIRMADO!

Seu Pix de R$ 4,99 foi confirmado.

🎉 Seu acesso ao grupo foi liberado. Bem-vindo!`
  });

  await tg("editMessageReplyMarkup", {
    chat_id: ADMIN_ID,
    message_id: callback.message.message_id,
    reply_markup: { inline_keyboard: [] }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, service: "telegram-pix-bot" });
  }

  try {
    const update = req.body;

    if (update.chat_join_request) {
      await handleJoinRequest(update.chat_join_request);
    } else if (update.callback_query?.data?.startsWith("paid:")) {
      await handlePaid(update.callback_query);
    } else if (update.callback_query?.data?.startsWith("confirm:")) {
      await handleConfirm(update.callback_query);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
