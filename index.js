const {Telegraf, Markup, session} = require('telegraf')
const ethers = require('ethers')

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const mnemonic = process.env.MNEMONIC
if (mnemonic === undefined) {
  throw new Error('MNEMONIC must be provided!')
}

const bot = new Telegraf(token)
bot.use(session())

const ownedAccountBy = (id) => {
  const node = ethers.utils.HDNode.fromMnemonic(mnemonic)
  const session = ethers.BigNumber.from(id).div(ethers.BigNumber.from('0x80000000')).toNumber()
  const index = ethers.BigNumber.from(id).mod(ethers.BigNumber.from('0x80000000')).toNumber()
  return node.derivePath(`m/44'/60'/0'/${session}/${index}`)
}

bot.start(async (ctx) => {
  await ctx.reply(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Join our channel (https://t.me/wizardingpay) to receive news about updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
})

// menu command
bot.command('menu', async (ctx) => {
  await ctx.reply(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Join our channel (https://t.me/wizardingpay) to receive news about updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
})

// back to menu
bot.action('menu', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Join our channel (https://t.me/wizardingpay) to receive news about updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
})

bot.command('wallet', async (ctx) => {
  const address = ownedAccountBy(ctx.from.id).address
  ctx.reply(`
*💰 My Wallet*

ETH: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'choice_withdraw_network')],
          [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
          [Markup.button.callback('« Back', 'menu')]
        ])
      }
  )
})

bot.action('my_wallet', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 My Wallet*

ETH: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'choice_withdraw_network')],
          [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
          [Markup.button.callback('« Back', 'menu')]
        ])
      }
  )
})

bot.command('cheques', (ctx) => ctx.reply(`Sorry, all bot operations are unavailable for your region.`))
bot.action('cheques', async (ctx) => {
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`)
})

bot.action('exchange', async (ctx) => {
  await ctx.reply(`Exchange`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'menu')]
      ])
  )
})

bot.action('deposit', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 Deposit*

Your address: ${address}

You can deposit crypto to this address. Use /depositqrcode to get QR code.
    `,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
              [Markup.button.callback('« Back', 'my_wallet')]
            ]
        )
      }
  )
})

bot.command('depositqrcode', async (ctx) => {
  const address = ownedAccountBy(ctx.from.id).address
  await ctx.replyWithPhoto(`https://raw.wakanda-labs.com/qrcode?text=${address}`, {
    caption: `*Your WizardingPay deposit address*: ${address}`,
    parse_mode: 'Markdown'
  })
})

bot.action('choice_withdraw_network', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.editMessageText(`Choose network to withdraw from`,
      Markup.inlineKeyboard([
        [Markup.button.callback('ETH', 'withdraw_network_eth'), Markup.button.callback('BSC', 'withdraw_network_bsc')],
        [Markup.button.callback('Matic', 'withdraw_network_matic'), Markup.button.callback('Arbitrum', 'withdraw_network_arbitrum')],
        [Markup.button.callback('« Back', 'my_wallet')]
      ]))
})

// RegExp 'withdraw_network_(eth|bsc|matic|arbitrum)'
bot.action(/withdraw_network_(eth|bsc|matic|arbitrum)/, async (ctx) => {
  const network = ctx.match[1]
  ctx.session = {...ctx.session, network: network}
  await ctx.answerCbQuery()
  ctx.editMessageText('Chose currency to withdraw', Markup.inlineKeyboard([
    [Markup.button.callback('ETH', 'withdraw_token_eth'), Markup.button.callback('USDT', 'withdraw_token_usdt')],
    [Markup.button.callback('« Back', 'choice_withdraw_network')]
  ]))
})

// RegExp 'withdraw_token_(eth|usdt)'
bot.action(/withdraw_token_(eth|usdt)/, async (ctx) => {
  const token = ctx.match[1]
  ctx.session = {...ctx.session, token: token}
  await ctx.answerCbQuery()
  ctx.editMessageText(`Enter amount to withdraw`, Markup.inlineKeyboard([
    [Markup.button.callback('1', 'withdraw_amount_1'), Markup.button.callback('10', 'withdraw_amount_10')],
    [Markup.button.callback('100', 'withdraw_amount_100'), Markup.button.callback('1K', 'withdraw_amount_1000')],
    [Markup.button.callback('10K', 'withdraw_amount_10000'), Markup.button.callback('100K', 'withdraw_amount_100000')],
    [Markup.button.callback('1M', 'withdraw_amount_1000000'), Markup.button.callback('10M', 'withdraw_amount_10000000')],
    [Markup.button.callback('« Back', 'choice_withdraw_network')]
  ]))
})

bot.action(/withdraw_amount_(\d+)/, async (ctx) => {
  const amount = ctx.match[1]
  ctx.session = {...ctx.session, amount: amount, intent: 'withdraw_address'}
  await ctx.answerCbQuery()
  ctx.editMessageText(`Enter address to withdraw to`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'choice_withdraw_network')]
  ]))
})

bot.action('withdraw_confirm', async (ctx) => {
  const {network, token, amount, address} = ctx.session
  await ctx.answerCbQuery()
  ctx.editMessageText(`Withdraw pending...`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'choice_withdraw_network')],
  ]))
})

bot.on('message', async (ctx) => {
  const action = ctx.session?.intent
  const input = ctx.message.text
  if (action === 'withdraw_address') {
    ctx.session = {...ctx.session, address: input, intent: 'withdraw_confirm'}
    ctx.reply(`Confirm withdraw of ${ctx.session.amount} ${ctx.session.token} to ${input}, network ${ctx.session.network}`, Markup.inlineKeyboard([
      [Markup.button.callback('Confirm', 'withdraw_confirm'), Markup.button.callback('« Back', 'choice_withdraw_network')]
    ]))
  }
})

exports.handler = async (event, context, callback) => {
  const tmp = JSON.parse(event.body);
  await bot.handleUpdate(tmp);
  return callback(null, {
    statusCode: 200,
    body: '',
  });
};