const {Telegraf, Markup, session} = require('telegraf')
const ethers = require('ethers')

//
//    #####
//   #     #  ####  #    # ###### #  ####
//   #       #    # ##   # #      # #    #
//   #       #    # # #  # #####  # #
//   #       #    # #  # # #      # #  ###
//   #     # #    # #   ## #      # #    #
//    #####   ####  #    # #      #  ####
//

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

//
//    #####
//   #     # #####   ##   #####  #####
//   #         #    #  #  #    #   #
//    #####    #   #    # #    #   #
//         #   #   ###### #####    #
//   #     #   #   #    # #   #    #
//    #####    #   #    # #    #   #
//
bot.start(async (ctx) => {
  await replyL1MenuContent(ctx)
})

//
//   #         #      #     #
//   #        ##      ##   ## ###### #    # #    #
//   #       # #      # # # # #      ##   # #    #
//   #         #      #  #  # #####  # #  # #    #
//   #         #      #     # #      #  # # #    #
//   #         #      #     # #      #   ## #    #
//   ####### #####    #     # ###### #    #  ####
//
const replyL1MenuContent = async (ctx) => {
  await ctx.reply(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Join our channel (https://t.me/wizardingpay) to receive news about updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
}

const editReplyL1MenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Join our channel (https://t.me/wizardingpay) to receive news about updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
}

bot.command('menu', replyL1MenuContent)
bot.action('backToL1MenuContent', editReplyL1MenuContent)

//
//   #        #####     #     #
//   #       #     #    #  #  #   ##   #      #      ###### #####
//   #             #    #  #  #  #  #  #      #      #        #
//   #        #####     #  #  # #    # #      #      #####    #
//   #       #          #  #  # ###### #      #      #        #
//   #       #          #  #  # #    # #      #      #        #
//   ####### #######     ## ##  #    # ###### ###### ######   #
//
const replyL2WalletMenuContent = async (ctx) => {
  const address = ownedAccountBy(ctx.from.id).address
  ctx.reply(`
*💰 My Wallet*

ETH: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit')],
          [Markup.button.callback('➖ Withdraw', 'withdraw')],
          [Markup.button.callback('🎫 Cheques', 'cheques')],
          [Markup.button.callback('« Back', 'backToL1MenuContent')]
        ])
      }
  )
  
}

const editReplyL2WalletMenuContent = async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 My Wallet*

ETH: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit')],
          [Markup.button.callback('➖ Withdraw', 'withdraw')],
          [Markup.button.callback('🎫 Cheques', 'cheques')],
          [Markup.button.callback('« Back', 'backToL1MenuContent')]
        ])
      }
  )
}

bot.command('wallet', replyL2WalletMenuContent)
bot.action('my_wallet', editReplyL2WalletMenuContent)
bot.action('backToL2WalletMenuContent', editReplyL2WalletMenuContent)

//
//   #        #####      #####
//   #       #     #    #     # #    # ######  ####  #    # ######  ####
//   #             #    #       #    # #      #    # #    # #      #
//   #        #####     #       ###### #####  #    # #    # #####   ####
//   #       #          #       #    # #      #  # # #    # #           #
//   #       #          #     # #    # #      #   #  #    # #      #    #
//   ####### #######     #####  #    # ######  ### #  ####  ######  ####
//
//
const replyL2ChequesMenuContent = (ctx) => ctx.reply(`Sorry, all bot operations are unavailable for your region.`)

const editReplyL2ChequesMenuContent = async (ctx) => {
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`)
}

bot.command('cheques', replyL2ChequesMenuContent)
bot.action('cheques', editReplyL2ChequesMenuContent)
bot.action('backToL2ChequesMenuContent', editReplyL2ChequesMenuContent)

//
//   #        #####     #######
//   #       #     #    #       #    #  ####  #    #   ##   #    #  ####  ######
//   #             #    #        #  #  #    # #    #  #  #  ##   # #    # #
//   #        #####     #####     ##   #      ###### #    # # #  # #      #####
//   #       #          #         ##   #      #    # ###### #  # # #  ### #
//   #       #          #        #  #  #    # #    # #    # #   ## #    # #
//   ####### #######    ####### #    #  ####  #    # #    # #    #  ####  ######
//
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

//
//   #        #####     ######
//   #       #     #    #     # ###### #####   ####   ####  # #####
//   #             #    #     # #      #    # #    # #      #   #
//   #        #####     #     # #####  #    # #    #  ####  #   #
//   #             #    #     # #      #####  #    #      # #   #
//   #       #     #    #     # #      #      #    # #    # #   #
//   #######  #####     ######  ###### #       ####   ####  #   #
//
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
              [Markup.button.callback('« Back', 'backToL2WalletMenuContent')]
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

//
//   #        #####     #     #
//   #       #     #    #  #  # # ##### #    # #####  #####    ##   #    #
//   #             #    #  #  # #   #   #    # #    # #    #  #  #  #    #
//   #        #####     #  #  # #   #   ###### #    # #    # #    # #    #
//   #             #    #  #  # #   #   #    # #    # #####  ###### # ## #
//   #       #     #    #  #  # #   #   #    # #    # #   #  #    # ##  ##
//   #######  #####      ## ##  #   #   #    # #####  #    # #    # #    #
//
bot.action('withdraw', async (ctx) => {
  // save intent to the ctx.session
  ctx.session = {intent: 'withdraw'}
  await ctx.answerCbQuery()
  ctx.editMessageText('Input your withdrawal address', Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'backToL2WalletMenuContent')]
  ]))
})

//
//   #######           #     #
//   #     # #    #    ##   ## ######  ####   ####    ##    ####  ######
//   #     # ##   #    # # # # #      #      #       #  #  #    # #
//   #     # # #  #    #  #  # #####   ####   ####  #    # #      #####
//   #     # #  # #    #     # #           #      # ###### #  ### #
//   #     # #   ##    #     # #      #    # #    # #    # #    # #
//   ####### #    #    #     # ######  ####   ####  #    #  ####  ######
//
bot.on('message', async (ctx) => {
  const action = ctx.session?.intent
  if (action) {
    ctx.session.action = undefined
  }
  await ctx.reply(`${action}`)
})

//
//   #     #
//   #     #   ##   #    # #####  #      ######
//   #     #  #  #  ##   # #    # #      #
//   ####### #    # # #  # #    # #      #####
//   #     # ###### #  # # #    # #      #
//   #     # #    # #   ## #    # #      #
//   #     # #    # #    # #####  ###### ######
//
exports.handler = async (event, context, callback) => {
  const tmp = JSON.parse(event.body);
  await bot.handleUpdate(tmp);
  return callback(null, {
    statusCode: 200,
    body: '',
  });
};