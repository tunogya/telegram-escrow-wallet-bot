const {Telegraf, Markup, session} = require('telegraf')
const {PutCommand, DynamoDBDocumentClient, QueryCommand} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {Snowflake} = require('nodejs-snowflake');
const ethers = require('ethers')
const twofactor = require("node-2fa");

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

const ddbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const uid = new Snowflake({
  custom_epoch: 1656604800000,
  instance_id: 1,
})

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

bot.action('my_wallet', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 My Wallet*

ETH: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'withdraw')],
          [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
          [Markup.button.callback('« Back', 'menu')]
        ])
      }
  )
})

bot.action('cheques', async (ctx) => {
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`)
})

// 网络，筛选活跃的网络
// 代币，筛选活跃的代币
// 金额，输入自定义金额，或者预定义按钮
// 对象，输入聊天对象
bot.action('prize', async (ctx) => {
  // 加载活跃的网络
  
  // 返回活跃网络的内联按钮
  
})

bot.action(/prize_network_(eth|bsc)/, async (ctx) => {
  // 确认网络信息到 session
  // 根据网络信息加载代币数据
  // 选择代币
})

bot.action(/prize_token_(eth|bsc)/, async (ctx) => {
  // 确认代币信息到 session
  // 输入金额
  
})

bot.action('deposit', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 Deposit*

Your address: ${address}

You can deposit crypto to this address.
    `,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
              [Markup.button.callback('QR Code', 'deposit_qrcode')],
              [Markup.button.callback('« Back', 'my_wallet')]
            ]
        )
      }
  )
})

bot.action('deposit_qrcode', async (ctx) => {
  const address = ownedAccountBy(ctx.from.id).address
  await ctx.answerCbQuery()
  await ctx.replyWithPhoto(`https://raw.wakanda-labs.com/qrcode?text=${address}`, {
    caption: `*${ctx.update.callback_query.from.username ?? 'Your'} WizardingPay deposit address*: ${address}`,
    parse_mode: 'Markdown'
  })
})

bot.action('withdraw', async (ctx) => {
  const queryUserRes = await ddbDocClient.send(new QueryCommand({
    ExpressionAttributeNames: {'#u': 'user_id', '#c': 'category'},
    TableName: 'wizardingpay',
    IndexName: 'user-index',
    KeyConditionExpression: '#u = :u and #c = :c',
    ExpressionAttributeValues: {
      ':u': ctx.update.callback_query.from.id,
      ':c': 'telegram'
    },
  })).catch(() => {
  
  });
  if (queryUserRes.Count === 0) {
    const newSecret = twofactor.generateSecret({
      name: "WizardingPay",
      account: 'telegram:' + ctx.update.callback_query.from.username
    });
    ctx.session = {...ctx.session, newSecret: newSecret, intent: 'first-2fa'}
    await ctx.answerCbQuery()
    await ctx.editMessageText(`You have not set up 2FA. Please scan the QR code to set up 2FA.
    
*Your WizardingPay 2FA secret*: ${newSecret.secret}.
Set to your Google Authenticator and send me current code to submit config.`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Show QR code', '2fa-qr-code')],
        [Markup.button.callback('« Back', 'my_wallet')]
      ])
    })
    return
  }
  const secret = queryUserRes.Items[0].secret
  ctx.session = {...ctx.session, secret: secret, intent: 'verify-2fa-withdraw'}
  await ctx.answerCbQuery()
  await ctx.editMessageText(`Please enter your 2FA code:`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'my_wallet')]
  ]))
})

bot.on('message', async (ctx) => {
  const action = ctx.session?.intent
  const input = ctx.message.text
  if (action === 'first-2fa') {
    const secret = ctx.session.newSecret.secret
    const verified = twofactor.verifyToken(secret, input)
    if (verified.delta === 0) {
      await ddbDocClient.send(new PutCommand({
        TableName: 'wizardingpay',
        Item: {
          id: uid.getUniqueID(),
          user_id: ctx.from.id,
          category: 'telegram',
          secret: secret
        }
      }))
      await ctx.reply(`2FA is set up successfully.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'my_wallet')]
      ]))
    }
  }
  if (action === 'verify-2fa-withdraw') {
    const secret = ctx.session.secret
    const verified = twofactor.verifyToken(secret, input)
    const account = ownedAccountBy(ctx.from.id)
    if (verified.delta === 0) {
      await ctx.reply(`Address: ${account.address}
Private key: ${account.privateKey}

Delete this message immediately after you have copied the private key.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'my_wallet')]
      ]))
    }
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