# Telegram Pix Bot

Bot de acesso pago a grupo privado do Telegram.

## Fluxo

1. Usuário solicita entrada no grupo.
2. Bot envia Pix de R$ 4,99.
3. Usuário toca em "Já fiz o Pix".
4. Administrador confere o recebimento.
5. Administrador confirma.
6. Bot aprova a solicitação de entrada.

## Variáveis de ambiente

- TELEGRAM_BOT_TOKEN
- TELEGRAM_GROUP_ID
- ADMIN_TELEGRAM_ID
- PIX_KEY
- PIX_NAME
- PIX_CITY

## Observação

Esta primeira versão usa confirmação manual do Pix. A versão automática deve integrar um PSP/API Pix com webhook de confirmação antes de aprovar a entrada.
