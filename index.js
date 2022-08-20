const {Telegraf, Markup} = require('telegraf')

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token, {
  telegram: {webhookReply: true},
  handlerTimeout: 3000,
})

// L1 Menu
const replyL1MenuContent = async (ctx) => {
  await ctx.reply(`
Buy, send, and exchange crypto with @WizardingPayBot. It is always available in your Telegram or Discord account!

Join our channel (https://t.me/wizardingpay) to receive news about the crypto market and @WizardingPayBot updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com'), Markup.button.callback('⚙️ Settings', 'settings')]
      ])
  )
}

const editReplyL1MenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
Buy, send, and exchange crypto with @WizardingPayBot. It is always available in your Telegram or Discord account!

Join our channel (https://t.me/wizardingpay) to receive news about the crypto market and @WizardingPayBot updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com'), Markup.button.callback('⚙️ Settings', 'settings')]
      ])
  )
}

bot.start(replyL1MenuContent)
bot.command('menu', replyL1MenuContent)
bot.action('backToL1MenuContent', editReplyL1MenuContent)

// L2 Wallet
const replyL2WalletMenuContent = (ctx) => ctx.reply(`💰 My Wallet

BTC: 0.00`, Markup.inlineKeyboard([
      [Markup.button.callback('Deposit', 'deposit'), Markup.button.callback('Withdraw', 'withdraw')],
      [Markup.button.callback('Buy crypto with bank card', 'buy_crypto_with_bank_card')],
      [Markup.button.callback('Exchange', 'exchange')],
      [Markup.button.callback('« Back', 'backToL1MenuContent')]
    ])
)

const editReplyL2WalletMenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
💰 My Wallet

BTC: 0.00`, Markup.inlineKeyboard([
        [Markup.button.callback('Deposit', 'deposit'), Markup.button.callback('Withdraw', 'withdraw')],
        [Markup.button.callback('Buy crypto with bank card', 'buy_crypto_with_bank_card')],
        [Markup.button.callback('Exchange', 'exchange')],
        [Markup.button.callback('« Back', 'backToL1MenuContent')]
      ])
  )
}

bot.command('wallet', replyL2WalletMenuContent)
bot.action('my_wallet', editReplyL2WalletMenuContent)
bot.action('backToL2WalletMenuContent', editReplyL2WalletMenuContent)

// L2 Cheques
const replyL2ChequesMenuContent = (ctx) => ctx.reply(`Sorry, all bot operations are unavailable for your region.`)

const editReplyL2ChequesMenuContent = async (ctx) => {
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`)
}

bot.command('cheques', replyL2ChequesMenuContent)
bot.action('cheques', editReplyL2ChequesMenuContent)
bot.action('backToL2ChequesMenuContent', editReplyL2ChequesMenuContent)

// L2 Exchange
const replyL2ExchangeMenuContent = async (ctx) => {
  await ctx.reply(`Exchange`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'backToL1MenuContent')]
      ])
  )
}

const editReplyL2ExchangeMenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`Exchange`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'backToL1MenuContent')]
      ])
  )
}

bot.command('exchange', replyL2ExchangeMenuContent)
bot.action('exchange', editReplyL2ExchangeMenuContent)
bot.action('backToL2ExchangeMenuContent', editReplyL2ExchangeMenuContent)

// L2 Settings
const replyL2SettingsMenuContent = async (ctx) => {
  await ctx.reply(`⚙️ Settings

Language: 🇬🇧 English
Local currency: USD`, Markup.inlineKeyboard([
        [Markup.button.callback('Change language', 'set_language')],
        [Markup.button.callback('Change local currency', 'set_local_currency')],
        [Markup.button.callback('« Back', 'backToL1MenuContent')]
      ])
  )
}

const editReplyL2SettingsMenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`⚙️ Settings

Language: 🇬🇧 English
Local currency: USD`, Markup.inlineKeyboard([
        [Markup.button.callback('Change language', 'set_language')],
        [Markup.button.callback('Change local currency', 'set_local_currency')],
        [Markup.button.callback('« Back', 'backToL1MenuContent')]
      ])
  )
}

bot.command('settings', replyL2SettingsMenuContent)
bot.action('settings', editReplyL2SettingsMenuContent)
bot.action('backToL2SettingsMenuContent', editReplyL2SettingsMenuContent)

exports.handler = (event, context, callback) => {
  const tmp = JSON.parse(event.body); // get data passed to us
  bot.handleUpdate(tmp); // make Telegraf process that data
  return callback(null, { // return something for webhook, so it doesn't try to send same stuff again
    statusCode: 200,
    body: '',
  });
};