const {Telegraf, Markup, session} = require('telegraf');
const {PutCommand, DynamoDBDocumentClient, QueryCommand} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {Snowflake} = require('nodejs-snowflake');
const ethers = require('ethers');
const twoFactor = require("node-2fa");
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
    const balance = Number(req.data.data.total_usd_value) || 0
    await ctx.answerCbQuery()
    await ctx.editMessageText(`
*💰 My Wallet*

Total USD Value: $${balance.toFixed(2)}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'withdraw')],
            [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
            [Markup.button.callback('« Back to Menu', 'menu')]
          ])
        }
    )
  } catch (e) {
    ctx.editMessageText(`
*💰 My Wallet*

Error to fetch your balance, you can try again later.`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'withdraw')],
        [Markup.button.callback('🎫 Cheques', 'cheques'), Markup.button.callback('💎 Prize', 'prize')],
        [Markup.button.callback('« Back to Menu', 'menu')]
      ])
    })
  }
})

bot.action('cheques', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(`Sorry, all bot operations are unavailable for your region.`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back to My Wallet', 'my_wallet')],
  ]))
})

bot.action('prize', async (ctx) => {
  ctx.editMessageText(`*💎 WizardingPay Prize*

Next, you will only see the network and tokens for which the account was activated.`, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Send Now', 'send_prize_choose_network')],
      [Markup.button.callback('🔍 History', 'prize_history')],
      [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
    ])
  })
})

bot.action('send_prize_choose_network', async (ctx) => {
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
    const networks = used_chains.map((chain) => [Markup.button.callback(chain.toUpperCase(), `send_prize_network_${chain}`)])
    await ctx.editMessageText('Choose a network from the list below:', Markup.inlineKeyboard([
      ...networks, [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  } catch (e) {
    await ctx.answerCbQuery('Error to fetch your balance, you can try again later.')
    await ctx.editMessageText('Sorry, something went wrong.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  }
})

bot.action(/send_prize_network_.*/, async (ctx) => {
  const network = ctx.match[0].split('_')[3]
  ctx.editMessageText(`Choose a Token from the list below:

Prize config:
- network: ${network}`, Markup.inlineKeyboard([
    [Markup.button.callback('« Back to Prize', 'prize')]
  ]))
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
  try {
    const address = ownedAccountBy(ctx.update.callback_query.from.id).address
    await ctx.answerCbQuery()
    await ctx.replyWithPhoto(`https://raw.wakanda-labs.com/qrcode?text=${address}`, {
      caption: `*${ctx.update.callback_query.from.username ?? 'Your'} WizardingPay deposit address*: ${address}`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🗑 Delete', 'delete')]
      ])
    })
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText(`Something went wrong, please try again later.`, Markup.inlineKeyboard([
      [Markup.button.callback('QR Code', 'deposit_qrcode')]
    ]))
  }
})

const _2fa_set_inlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('1', '2fa-set-input-1'), Markup.button.callback('2', '2fa-set-input-2'), Markup.button.callback('3', '2fa-set-input-3')],
  [Markup.button.callback('4', '2fa-set-input-4'), Markup.button.callback('5', '2fa-set-input-5'), Markup.button.callback('6', '2fa-set-input-6')],
  [Markup.button.callback('7', '2fa-set-input-7'), Markup.button.callback('8', '2fa-set-input-8'), Markup.button.callback('9', '2fa-set-input-9')],
  [Markup.button.callback('0', '2fa-set-input-0'), Markup.button.callback('⬅️', '2fa-set-input-back'), Markup.button.callback('✅', '2fa-set')],
  [Markup.button.callback('QR Code', '2fa-qr-code'), Markup.button.callback('« Back to My Wallet', 'my_wallet')]
])

const _2fa_conform_inlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('1', '2fa-conform-input-1'), Markup.button.callback('2', '2fa-conform-input-2'), Markup.button.callback('3', '2fa-conform-input-3')],
  [Markup.button.callback('4', '2fa-conform-input-4'), Markup.button.callback('5', '2fa-conform-input-5'), Markup.button.callback('6', '2fa-conform-input-6')],
  [Markup.button.callback('7', '2fa-conform-input-7'), Markup.button.callback('8', '2fa-conform-input-8'), Markup.button.callback('9', '2fa-conform-input-9')],
  [Markup.button.callback('0', '2fa-conform-input-0'), Markup.button.callback('⬅️', '2fa-conform-input-back'), Markup.button.callback('✅', '2fa-confirm')],
  [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
])

bot.action('withdraw', async (ctx) => {
  try {
    const queryUserRes = await ddbDocClient.send(new QueryCommand({
      ExpressionAttributeNames: {'#u': 'user_id', '#c': 'category'},
      TableName: 'wizardingpay',
      IndexName: 'user-index',
      KeyConditionExpression: '#u = :u and #c = :c',
      ExpressionAttributeValues: {
        ':u': ctx.update.callback_query.from.id,
        ':c': 'telegram'
      },
    }));
    if (queryUserRes.Count === 0) {
      const newSecret = twoFactor.generateSecret({
        name: "WizardingPay",
        account: 'telegram:' + ctx.update.callback_query.from.username
      });
      ctx.session = {...ctx.session, newSecret: newSecret, code: ''}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`You have not set up 2FA. Please scan the QR code to set up 2FA.
    
Your WizardingPay 2FA secret: ${newSecret.secret}

Please enter your 2FA code: ------`, _2fa_set_inlineKeyboard)
    } else {
      const secret = queryUserRes.Items[0].secret
      ctx.session = {...ctx.session, secret: secret, code: ''}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`Please enter your 2FA code: ------`, _2fa_conform_inlineKeyboard
      )
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText('Something went wrong. Please try again later.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
    ]))
  }
})

bot.action(/2fa-conform-input-.*/, async (ctx) => {
  try {
    let code = ctx.match[0].split('-')[3]
    if (code === 'back') {
      ctx.session.code = ctx.session.code.slice(0, -1)
    } else {
      if (ctx.session.code.length >= 6) {
        return
      }
      code = ctx.session.code + code
      ctx.session = {...ctx.session, code: code}
    }
    const asterisks = '*'.repeat(ctx.session.code.length)
    await ctx.answerCbQuery()
    await ctx.editMessageText(`Please enter your 2FA code: ${asterisks + '-'.repeat(6 - asterisks.length)}`, _2fa_conform_inlineKeyboard)
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText('Something went wrong. Please try again later.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Withdraw', 'withdraw')]
    ]))
  }
})

bot.action('2fa-confirm', async (ctx) => {
  try {
    const code = ctx.session.code
    const secret = ctx.session.secret
    const verified = twoFactor.verifyToken(secret, code)
    const account = ownedAccountBy(ctx.from.id)
    if (verified && verified.delta === 0) {
      await ctx.answerCbQuery()
      await ctx.editMessageText(`Address: ${account.address}
Private key: ${account.privateKey}

Delete this message immediately after you have copied the private key.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
      ]))
    } else {
      await ctx.answerCbQuery('Invalid 2FA code.')
      await ctx.editMessageText(`Invalid code. Please try again.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Withdraw', 'withdraw')]
      ]))
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText('Something went wrong. Please try again later.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Withdraw', 'withdraw')]
    ]))
  }
})

bot.action('2fa-set', async (ctx) => {
  try {
    const code = ctx.session.code
    const secret = ctx.session.newSecret.secret
    const verified = twoFactor.verifyToken(secret, code)
    if (verified && verified.delta === 0) {
      await ddbDocClient.send(new PutCommand({
        TableName: 'wizardingpay',
        Item: {
          id: uid.getUniqueID(),
          user_id: ctx.from.id,
          category: 'telegram',
          secret: secret
        }
      }))
      await ctx.answerCbQuery()
      await ctx.editMessageText(`2FA is set up successfully.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Withdraw', 'withdraw')]
      ]))
    } else {
      await ctx.answerCbQuery('Something went wrong.')
      await ctx.editMessageText(`Invalid code. Please try again.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Withdraw', 'withdraw')]
      ]))
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText('Something went wrong. Please try again later.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Withdraw', 'withdraw')]
    ]))
  }
})

bot.action(/2fa-set-input-.*/, async (ctx) => {
  try {
    let code = ctx.match[0].split('-')[3]
    if (code === 'back') {
      ctx.session.code = ctx.session.code.slice(0, -1)
    } else {
      if (ctx.session.code.length >= 6) {
        return
      }
      code = ctx.session.code + code
      ctx.session = {...ctx.session, code: code}
    }
    const asterisks = '*'.repeat(ctx.session.code.length)
    const newSecret = ctx.session.newSecret
    await ctx.answerCbQuery()
    await ctx.editMessageText(`
You have not set up 2FA. Please scan the QR code to set up 2FA.

Your WizardingPay 2FA secret: ${newSecret.secret}

Please enter your 2FA code: ${asterisks + '-'.repeat(6 - asterisks.length)}`, _2fa_set_inlineKeyboard)
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.editMessageText('Something went wrong. Please try again later.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Withdraw', 'withdraw')]
    ]))
  }
})

bot.action('2fa-qr-code', async (ctx) => {
  try {
    const newSecret = ctx.session.newSecret
    await ctx.answerCbQuery()
    await ctx.replyWithPhoto(newSecret.qr, {
      caption: `*WizardingPay 2FA Secret*:
${newSecret.secret}`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🗑 Delete', 'delete')]
      ])
    })
  } catch (_) {
    await ctx.answerCbQuery("Something went wrong.")
    await ctx.editMessageText('Sorry, something went wrong.', Markup.inlineKeyboard([
      [Markup.button.callback('« Back to Withdraw', 'withdraw')]
    ]))
  }
})

bot.action('delete', async (ctx) => {
  try {
    await ctx.answerCbQuery()
    await ctx.deleteMessage()
  } catch (_) {
    await ctx.answerCbQuery("Something went wrong.")
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