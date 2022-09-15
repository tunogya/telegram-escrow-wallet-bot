const {Telegraf, Markup, session} = require('telegraf');
const {PutCommand, DynamoDBDocumentClient, QueryCommand} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {Snowflake} = require('nodejs-snowflake');
const ethers = require('ethers');
const twofactor = require("node-2fa");
const axios = require('axios');

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

Use /start to start using the bot. Join our [channel](https://t.me/wizardingpay) to receive news about updates.
`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 My Wallet', 'my_wallet')],
          [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
        ])
      }
  )
})

// back to menu
bot.action('menu', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Use /start to start using the bot. Join our [channel](https://t.me/wizardingpay) to receive news about updates.
`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 My Wallet', 'my_wallet')],
          [Markup.button.url('Support', 'https://www.wakanda-labs.com')]
        ])
      }
  )
})

bot.action('my_wallet', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  try {
    const req = await axios({
      method: 'get',
      url: `https://api.debank.com/user/total_balance?addr=${address}`,
    })
    if (req) {
      const balance = req.data.data.total_usd_value || 0
      await ctx.answerCbQuery()
      await ctx.editMessageText(`
*💰 My Wallet*

Total USD Value: $${balance}`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'withdraw')],
              [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
              [Markup.button.callback('« Back to menu', 'menu')]
            ])
          }
      )
    }
  } catch (e) {
  
  }
  
})

bot.action('cheques', async (ctx) => {
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`)
})

bot.action('prize', async (ctx) => {
  ctx.editMessageText('Welcome to use Wizarding Pay Prize!', Markup.inlineKeyboard([
    [Markup.button.callback('Send Prize', 'send_prize')],
    [Markup.button.callback('History', 'prize_history')],
    [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
  ]))
})

bot.action('send_prize', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  try {
    const req = await axios.get(`https://api.debank.com/user/addr?addr=${address}`)
    const used_chains = req.data.data.used_chains
    if (used_chains.length === 0) {
      await ctx.editMessageText('You have not used any network yet.', Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Prize', 'prize')],
      ]))
      return
    }
    await ctx.answerCbQuery()
    await ctx.editMessageText('Choose a network from the list below:', Markup.inlineKeyboard([
      used_chains.map((chain) => {
        return [Markup.button.callback(chain, `send_prize_network_${chain}`)]
      }),
      [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  } catch (e) {
    await ctx.editMessageText('Sorry, something went wrong.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  }
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
              [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
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
        [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
      ])
    })
    return
  }
  const secret = queryUserRes.Items[0].secret
  ctx.session = {...ctx.session, secret: secret, intent: 'verify-2fa-withdraw'}
  await ctx.answerCbQuery()
  await ctx.editMessageText(`Please enter your 2FA code:`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
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
        [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
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
        [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
      ]))
    }
  }
})

bot.catch((error) => {
  console.log(error)
})

exports.handler = async (event, context, callback) => {
  const tmp = JSON.parse(event.body);
  await bot.handleUpdate(tmp);
  return callback(null, {
    statusCode: 200,
    body: '',
  });
};

bot.launch().then(() => console.log('Bot launched...'))

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))