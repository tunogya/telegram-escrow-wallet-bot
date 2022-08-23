const {Telegraf, Markup} = require('telegraf')
const {PutCommand, DynamoDBDocumentClient, GetCommand} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {ethers} = require("ethers")

const ddbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token)

// L1 Menu
const replyL1MenuContent = async (ctx) => {
  await ctx.reply(`
Buy, send, and exchange crypto with @WizardingPayBot. It is always available in your Telegram or Discord account!

Join our channel (https://t.me/wizardingpay) to receive news about the crypto market and @WizardingPayBot updates.
`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 My Wallet', 'my_wallet')],
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
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
        [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
      ])
  )
}

bot.start(async (ctx) => {
  await replyL1MenuContent(ctx)
  ddbDocClient.send(new GetCommand({
    TableName: 'wizardingpay',
    Key: {
      id: ctx.from.id,
      sort: "telegram",
    }
  })).then((res) => {
    if (!res.Item) {
      const privateKey = ethers.utils.randomBytes(32);
      ddbDocClient.send(new PutCommand({
        TableName: 'wizardingpay',
        Item: {
          id: ctx.from.id,
          sort: "telegram",
          address: (new ethers.Wallet(privateKey)).address,
          privateKey: ethers.BigNumber.from(privateKey)._hex
        }
      })).catch(e => console.log(e))
    }
  }).catch(e => console.log(e))
})
bot.command('menu', replyL1MenuContent)
bot.action('backToL1MenuContent', editReplyL1MenuContent)

// L2 Wallet
const replyL2WalletMenuContent = (ctx) => ctx.reply(`💰 My Wallet

BTC: 0.00`, Markup.inlineKeyboard([
      [Markup.button.callback('💰 Deposit', 'deposit'), Markup.button.callback('➕ Withdraw', 'withdraw')],
      [Markup.button.callback('Exchange', 'exchange'), Markup.button.callback('Cheques', 'cheques')],
      [Markup.button.callback('Buy crypto with bank card', 'buy_crypto_with_bank_card')],
      [Markup.button.callback('« Back', 'backToL1MenuContent')]
    ])
)

const editReplyL2WalletMenuContent = async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
💰 My Wallet

BTC: 0.00`, Markup.inlineKeyboard([
        [Markup.button.callback('💰 Deposit', 'deposit'), Markup.button.callback('➕ Withdraw', 'withdraw')],
        [Markup.button.callback('Exchange', 'exchange'), Markup.button.callback('Cheques', 'cheques')],
        [Markup.button.callback('Buy crypto with bank card', 'buy_crypto_with_bank_card')],
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

// L3 Deposit
bot.action('deposit', async (ctx) => {
  const res = ddbDocClient.send(new GetCommand({
    TableName: 'wizardingpay',
    Key: {
      id: ctx.from.id,
      sort: "telegram",
    }
  }))
  if (res?.Item) {
    const address = res.Item.address ?? undefined
    await ctx.answerCbQuery()
    await ctx.reply(`
💰 Deposit

Your address: ${address}

You can deposit crypto to this address.
`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back', 'backToL2WalletMenuContent')]
        ])
    )
  }
})

// L3 Withdraw
bot.action('withdraw', async (ctx) => {
  // save an action to the ctx
  ctx.session.action = 'withdraw'
  await ctx.answerCbQuery()
  ctx.reply('Input your withdrawal address', Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'backToL2WalletMenuContent')]
  ]))
})

bot.on('message', async (ctx) => {
  const action = ctx.session.action
  ctx.reply(`${action}`)
})

bot.command('exchange', replyL2ExchangeMenuContent)
bot.action('exchange', editReplyL2ExchangeMenuContent)
bot.action('backToL2ExchangeMenuContent', editReplyL2ExchangeMenuContent)


exports.handler = async (event, context, callback) => {
  const tmp = JSON.parse(event.body);
  await bot.handleUpdate(tmp);
  return callback(null, {
    statusCode: 200,
    body: '',
  });
};