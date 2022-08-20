const {Telegraf, Markup} = require('telegraf')

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token, {
  telegram: {webhookReply: true},
  handlerTimeout: 3000,
})

const replyL1MenuContent = (ctx) => ctx.reply(`
Buy, send, and exchange crypto with @WizardingPayBot. It is always available in your Telegram or Discord account!

Join our channel (https://t.me/wizardingpay) to receive news about the crypto market and @WizardingPayBot updates.
`, Markup.inlineKeyboard([
      [Markup.button.callback('💰 My Wallet', 'my_wallet')],
      [Markup.button.url('Support', 'https://www.wakanda-labs.com'), Markup.button.callback('⚙️ Settings', 'settings')]
    ]))

bot.start(replyL1MenuContent)
bot.command('menu', replyL1MenuContent)

bot.command('wallet', (ctx) => ctx.reply('Your wallet address is: ' + ctx.from.id))

bot.command('cheques', (ctx) => ctx.reply(''))

bot.command('exchange', (ctx) => ctx.reply(''))

bot.command('setting', (ctx) => ctx.reply(''))

exports.handler = (event, context, callback) => {
  const tmp = JSON.parse(event.body); // get data passed to us
  bot.handleUpdate(tmp); // make Telegraf process that data
  return callback(null, { // return something for webhook, so it doesn't try to send same stuff again
    statusCode: 200,
    body: '',
  });
};