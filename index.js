const {Telegraf, Markup, session} = require('telegraf');
const {PutCommand, DynamoDBDocumentClient, QueryCommand, UpdateCommand} = require('@aws-sdk/lib-dynamodb');
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
  ctx.session = {}
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
      [Markup.button.callback('Send', 'send_prize_choose_network')],
      [Markup.button.callback('History', 'prize_history')],
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
  }
})

bot.action(/send_prize_network_.*/, async (ctx) => {
  const network = ctx.match[0].split('_')[3]
  ctx.session = {...ctx.session, network}
  const address = ownedAccountBy(ctx.update.callback_query.from.id).address
  try {
    const req = await axios(`https://api.debank.com/token/balance_list?user_addr=${address}&is_all=false&chain=${network}`)
    const balance_list = req.data.data
    if (balance_list.length === 0) {
      await ctx.answerCbQuery('You have not used any token yet.')
      await ctx.editMessageText('You have not used any token yet.', Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Prize', 'prize')],
      ]))
      return
    }
    ctx.session = {...ctx.session, balance_list}
    const tokens = balance_list.map((token, index) => [Markup.button.callback(token.symbol, `send_prize_token_${index}`)])
    await ctx.answerCbQuery()
    ctx.editMessageText(`
Network is ${network}.

Choose a Token from the list below:
`, Markup.inlineKeyboard([
      ...tokens, [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  } catch (e) {
    await ctx.answerCbQuery('Error to fetch your balance, you can try again later.')
  }
})

bot.action(/send_prize_token_.*/, async (ctx) => {
  const index = ctx.match[0].split('_')[3]
  ctx.session = {...ctx.session, index, intent: 'input-prize-value'}
  const token = ctx.session.balance_list[index]
  const network = ctx.session.network
  ctx.editMessageText(`Network is ${network},
Token is ${token.name}.

Enter the token value to put into the prize.`, Markup.inlineKeyboard([
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
        [Markup.button.callback('🗑', 'delete')]
      ])
    })
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
  }
})

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
      ctx.session = {...ctx.session, newSecret: newSecret, intent: 'set-2fa-code'}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`You have not set up 2FA. Please scan the QR code to set up 2FA.
    
Your WizardingPay 2FA secret: ${newSecret.secret}

Please enter your 2FA code:`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
      ]))
    } else {
      const secret = queryUserRes.Items[0].secret
      ctx.session = {...ctx.session, secret: secret, intent: 'verify-2fa-code'}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`Please enter your 2FA code:`, Markup.inlineKeyboard([
            [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
          ])
      )
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
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
        [Markup.button.callback('🗑', 'delete')]
      ])
    })
  } catch (_) {
    await ctx.answerCbQuery("Something went wrong.")
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

bot.on('message', async (ctx) => {
  if (ctx.session?.intent === 'verify-2fa-code') {
    try {
      const code = ctx.message.text
      const secret = ctx.session.secret
      const verified = twoFactor.verifyToken(secret, code)
      const account = ownedAccountBy(ctx.from.id)
      if (verified && verified.delta === 0) {
        ctx.session = {...ctx.session, intent: undefined}
        await ctx.reply(`Address: ${account.address}
Private key: ${account.privateKey}

Delete this message immediately after you have copied the private key.`, Markup.inlineKeyboard([
          [Markup.button.callback('🗑', 'delete')],
          [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
        ]))
      } else {
        await ctx.reply('Invalid 2FA code.')
      }
    } catch (_) {
      await ctx.reply('Something went wrong.')
    }
  }
  else if (ctx.session?.intent === 'set-2fa-code') {
    try {
      const code = ctx.message.text
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
        ctx.session = {...ctx.session, intent: undefined}
        await ctx.reply(`2FA is set up successfully.`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Withdraw', 'withdraw')]
        ]))
      } else {
        await ctx.reply('Something went wrong.')
      }
    } catch (_) {
      await ctx.reply('Something went wrong.')
    }
  }
  else if (ctx.session?.intent === 'input-prize-value') {
    const value = Number(ctx.message.text)
    if (value > 0) {
      const token = ctx.session.balance_list[ctx.session.index]
      const balance = token.balance || 0
      const decimals = token.decimals || 18
      
      if (value * 10 ** decimals <= balance) {
        ctx.session = {...ctx.session, value, intent: 'input-prize-desc'}
        const network = ctx.session.network
        ctx.reply(`Network: ${network},
Value: ${ctx.session.value} ${ctx.session.balance_list[ctx.session.index].name},

Please enter the prize description:
      `, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Prize', 'prize')],
        ]))
      } else {
        await ctx.reply(`You don't have enough ${token.symbol} to pay the prize. You ${token.symbol} balance is ${balance / (10 ** decimals)}.`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to My Wallet', 'my_wallet')]
        ]))
      }
    } else {
      await ctx.reply('Invalid value. Please try again.')
    }
  }
  else if (ctx.session?.intent === 'input-prize-desc') {
    const desc = ctx.message.text
    if (desc.length > 0) {
      ctx.session = {...ctx.session, desc: desc, intent: "input-prize-recipient"}
      const network = ctx.session.network
      ctx.reply(`Network: ${network},
Value: ${ctx.session.value} ${ctx.session.balance_list[ctx.session.index].name},
Description: ${ctx.session.desc}.

Please enter the recipient's id:
      `, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Prize', 'prize')],
        ]))
    }
  }
  else if (ctx.session.intent === 'input-prize-recipient') {
    const chat_id = ctx.message.text
    if (chat_id.length > 0) {
      ctx.session = {...ctx.session, chat_id, intent: "input-prize-quality"}
      const network = ctx.session.network
      ctx.reply(`Network: ${network},
Value: ${ctx.session.value} ${ctx.session.balance_list[ctx.session.index].name},
Description: ${ctx.session.desc},
Recipient: ${ctx.session.chat_id}.

Please enter the quality of the prize:
`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Prize', 'prize')],
        ]))
    }
  }
  else if (ctx.session?.intent === 'input-prize-quality') {
    const quality = Number(ctx.message.text)
    if (quality > 0) {
      ctx.session = {...ctx.session, intent: undefined, quality}
      const network = ctx.session.network
      ctx.reply(`Network: ${network},
Value: ${ctx.session.value} ${ctx.session.balance_list[ctx.session.index].name},
Description: ${ctx.session.desc},
Recipient: ${ctx.session.chat_id},
Prize quality: ${quality}.
`, Markup.inlineKeyboard([
        [Markup.button.callback('Send', 'send-prize')],
        [Markup.button.callback('« Back to Prize', 'prize')],
      ]))
    } else {
      await ctx.reply('Invalid quality. Please try again.')
    }
  }
})

bot.action('send-prize', async (ctx) => {
  try {
    const network = ctx.session.network
    const token = ctx.session.balance_list[ctx.session.index]
    const value = ctx.session.value
    const desc = ctx.session.desc
    const chat_id = ctx.session.chat_id
    const quantity= ctx.session.quality
    try {
      const res = await ctx.telegram.sendMessage(chat_id,`${desc}`, Markup.inlineKeyboard([
        [Markup.button.callback('Snatch!', 'snatch')]
      ]))
      try {
        await ddbDocClient.send(new PutCommand({
          TableName: 'wizardingpay',
          Item: {
            id: uid.getUniqueID(),
            chat_id: res.chat.id,
            message_id: res.message_id,
            network,
            token: {
              id: token.id,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              price: token.price,
            },
            value,
            quantity,
            desc,
            status: 'pending',
            record: []
          }
        }))
        await ctx.answerCbQuery('Prize sent successfully.')
        ctx.editMessageText(`Successfully sent a prize to ${chat_id}.`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Prize', 'prize')],
        ]))
      } catch (e) {
        await ctx.answerCbQuery('Prize saved failed.')
        ctx.reply('Failed to save prize to dynamodb.')
      }
    } catch (e) {
      await ctx.answerCbQuery('Something went wrong.')
      ctx.reply(`Failed to send message to ${chat_id}. Please check if the id is correct. And make sure the bot is added to the recipient's chat.`)
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
    await ctx.reply('Something went wrong.')
  }
})

bot.action('snatch', async (ctx) => {
  try {
    const queryPrizeRes = await ddbDocClient.send(new QueryCommand({
      ExpressionAttributeNames: {'#chat_id': 'chat_id', '#message_id': 'message_id'},
      TableName: 'wizardingpay',
      IndexName: 'prize-index',
      KeyConditionExpression: '#chat_id = :chat_id AND #message_id = :message_id',
      ExpressionAttributeValues: {
        ':chat_id': ctx.update.callback_query.message.chat.id,
        ':message_id': ctx.update.callback_query.message.message_id,
      },
    }))
    if (!queryPrizeRes || queryPrizeRes.Count === 0) {
      ctx.answerCbQuery("Sorry, this Prize is not found.")
      return
    }
    const prize = queryPrizeRes.Items[0]
    if (prize.record.some(record => record.user_id === ctx.update.callback_query.from.id)) {
      await ctx.answerCbQuery('You have already snatched this Prize!')
      return
    }
    if (prize.status !== 'open') {
      await ctx.answerCbQuery(`Sorry, you are late.`)
      return
    }
    let status = "open", value = 0
    if (prize.record.length + 1 >= prize.quantity) {
      status = "pending"
      if (prize.value - prize.record.reduce((acc, cur) => acc + cur.value, 0) > 0) {
        value = prize.value - prize.record.reduce((acc, cur) => acc + cur.value, 0)
      }
    } else {
      value = ((prize.value - prize.record.reduce((acc, cur) => acc + cur.value, 0)) * Math.random()).toFixed(2)
    }
    try {
      await ddbDocClient.send(new UpdateCommand({
        TableName: 'wizardingpay',
        Key: {id: prize.id},
        UpdateExpression: 'set updated_at = :updated_at, #record = list_append(#record, :record), #status = :status',
        ExpressionAttributeNames: {'#record': 'record', '#status': 'status'},
        ExpressionAttributeValues: {
          ':updated_at': new Date().getTime(),
          ':record': [{
            user_id: ctx.update.callback_query.from.id,
            username: ctx.update.callback_query.from.username,
            value,
            created_at: new Date().getTime(),
          }],
          ':status': status,
        }
      }))
      await ctx.answerCbQuery(`You have snatched ${value} ${prize.token.symbol}!`)
      ctx.reply(`Congratulations! ${ctx.update.callback_query.from.username || ctx.update.callback_query.from.id} have snatched ${value} ${prize.token.symbol}!`)
    }catch (e) {
      await ctx.answerCbQuery('Sorry, snatch failed.')
    }
  } catch (e) {
    await ctx.answerCbQuery('Something went wrong.')
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

bot.launch().then(() => console.log('Bot launched...'))

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))