const {Telegraf, Markup, session} = require('telegraf');
const {
  PutCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand
} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const ethers = require('ethers');
const twoFactor = require("node-2fa");
const freeTransferAbi = require("./abis/FreeTransfer.json");
const erc20abi = require("./abis/erc20.json");
const {isAddress} = require("ethers/lib/utils");
const {BigNumber} = require("ethers");

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

const SupportedChainId = {
  BSC: 56,
  BSC_TEST: 97,
}

const NETWORK_INFO = {
  [SupportedChainId.BSC]: {
    name: 'BSC',
    rpc: 'https://bsc-dataseed.binance.org/',
    explorer: 'https://bscscan.com/',
    freeTransfer: '0x8d8e4d946ED4c818C9ace798C869C6F93cCF3df0',
    gasLimit: 30000,
    maxTx: 3000,
  },
  [SupportedChainId.BSC_TEST]: {
    name: 'BSC Testnet',
    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    explorer: 'https://testnet.bscscan.com/',
    freeTransfer: '0xA4Cd6C205cEF92aB066177207114B6831194F61f',
    gasLimit: 60000,
    maxTx: 800,
  }
}

const STATUS = {
  'open': '🟢',
  'pending': '🟡',
  'processing': '🔴',
  'closed': '⚫️️',
}

const ownedAccountBy = (id, sort) => {
  const node = ethers.utils.HDNode.fromMnemonic(mnemonic)
  const session = ethers.BigNumber.from(id).div(ethers.BigNumber.from('0x80000000')).toNumber()
  const index = ethers.BigNumber.from(id).mod(ethers.BigNumber.from('0x80000000')).toNumber()
  return node.derivePath(`m/44'/60'/${sort}'/${session}/${index}`)
}

const replyWithMenu = async (ctx) => {
  ctx.session = {}
  await ctx.reply(`
@WizardingPayBot is a log-free escrow wallet that supports use in various social software such as Telegram or Discord.

Use /start to start using the bot. Join our [channel](https://t.me/wizardingpay) to receive news about updates.
`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 My Wallet', 'myWallet')],
          [Markup.button.url('🌟 Star Project', 'https://github.com/wakandalabs/wizardingpay-telegram-bot')]
        ])
      }
  )
}

bot.start(replyWithMenu)

bot.action('menu', async (ctx) => {
  await ctx.answerCbQuery()
  await replyWithMenu(ctx)
})

bot.action('myWallet', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id, 0).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 My Wallet*

Supported chains: BSC, BSC Testnet

My Wizarding Pay Account: ${address}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Deposit', 'deposit'), Markup.button.callback('➖ Withdraw', 'withdraw')],
          [Markup.button.callback('💎 Prize', 'prize')],
          [Markup.button.callback('« Back to Menu', 'menu')]
        ])
      }
  )
})

bot.action('prize', async (ctx) => {
  ctx.editMessageText(`*💎 WizardingPay Prize*

Supported chains: BSC, BSC Testnet
`, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('Send', 'sendPrizeChooseNetwork')],
      [Markup.button.callback('History', 'prizeHistory')],
      [Markup.button.callback('« Back to My Wallet', 'myWallet')]
    ])
  })
})

bot.action('prizeHistory', async (ctx) => {
  try {
    const result = await ddbDocClient.send(new QueryCommand({
      TableName: 'wizardingpay-prize',
      IndexName: 'creator-index',
      KeyConditionExpression: 'creator_id = :creator_id and creator_sort = :creator_sort',
      ExpressionAttributeValues: {
        ':creator_id': ctx.update.callback_query.from.id,
        ':creator_sort': 0,
      },
    }))
    if (result.Count === 0) {
      ctx.editMessageText(`No Prize here.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Prize', 'prize')]
      ]))
      return
    }
    
    const buttons = result.Items.map((item) => {
      return [Markup.button.callback(`${STATUS[item.status]} ${item.value} ${item.token.symbol} to "${item.chat.title}" on ${NETWORK_INFO[item.network].name}`, `prize_${item.chat_id}_${item.message_id}`)]
    })
    
    await ctx.answerCbQuery()
    ctx.editMessageText(`Choose a Prize from the list below:`, Markup.inlineKeyboard([
      ...buttons,
      [Markup.button.callback('« Back to Prize', 'prize')]
    ]))
  } catch (e) {
    ctx.reply("Fetch pending NEST Prize failed, please try again later.")
  }
})

bot.action(/prize_(.*)/, async (ctx) => {
  const chat_id = ctx.match[1].split('_')[0]
  const message_id = ctx.match[1].split('_')[1]
  try {
    const result = await ddbDocClient.send(new GetCommand({
      TableName: 'wizardingpay-prize',
      Key: {
        chat_id: BigInt(chat_id),
        message_id: BigInt(message_id),
      },
    }))
    const item = result.Item
    ctx.editMessageText(`*Prize*: ${item.value} ${item.token.symbol} to "${item.chat.title}"
*network*: ${NETWORK_INFO[item.network].name}
*token address*: [${item.token.address}](${NETWORK_INFO[item.network].explorer}token/${item.token.address})
*created at*: ${new Date(item.created_at * 1000).toLocaleString()}
*status*: ${item.status}
${item?.tx ? `*tx*: [${item.tx}](${NETWORK_INFO[item.network].explorer}/tx/${item.tx})` : ''}
*left*: ${item.value - item.record.reduce((acc, cur) => acc + cur.value, 0)} ${item.token.symbol}
*history*:
${item.record.map((record) => `- ${record.username || record.username} snatched ${record.value} ${item?.token?.symbol}`).join(';\n')}

What do you want to do with the Prize?
    `, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🟡 Pending', `pendingPrize_${chat_id}_${message_id}`, item.status === 'pending' || item.status === 'processing' || item.status === 'closed'),
          Markup.button.callback('🔴 Liquidate', `liquidatePrize_${chat_id}_${message_id}`, item.status === 'open' || item.status === 'processing' || item.status === 'closed'),
          Markup.button.callback('⚫️️ Close', `closePrize_${chat_id}_${message_id}`, item.status === 'closed')],
        [Markup.button.callback('« Back to Prize History', 'prizeHistory')],
      ])
    })
  } catch (e) {
    ctx.answerCbQuery("Fetch Prize failed, please try again later.")
  }
})

bot.action(/pendingPrize_(.*)/, async (ctx) => {
  const chat_id = ctx.match[1].split('_')[0]
  const message_id = ctx.match[1].split('_')[1]
  try {
    const result = await ddbDocClient.send(new GetCommand({
      TableName: 'wizardingpay-prize',
      Key: {
        chat_id: BigInt(chat_id),
        message_id: BigInt(message_id),
      },
    }))
    const item = result.Item
    if (item.status === 'open') {
      await ddbDocClient.send(new UpdateCommand({
        TableName: 'wizardingpay-prize',
        Key: {
          chat_id: BigInt(chat_id),
          message_id: BigInt(message_id),
        },
        UpdateExpression: 'set #s = :s',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':s': 'pending',
        },
      }))
      await ctx.answerCbQuery()
      ctx.editMessageText(`🟡 Prize ${item?.value} ${item?.token?.symbol} to "${item?.chat?.title}" is pending now.`, Markup.inlineKeyboard([
        [Markup.button.callback('🔴 Liquidate', `liquidatePrize_${chat_id}_${message_id}`)],
        Markup.button.callback('⚫️️ Close', `closePrize_${chat_id}_${message_id}`),
        [Markup.button.callback('« Back to Prize History', 'prizeHistory')]
      ]))
    } else {
      ctx.answerCbQuery("Prize is not open, please try again later.")
    }
  } catch (e) {
    ctx.answerCbQuery("Fetch Prize failed, please try again later.")
  }
})

bot.action(/liquidatePrize_(.*)/, async (ctx) => {
  const chat_id = ctx.match[1].split('_')[0]
  const message_id = ctx.match[1].split('_')[1]
  try {
    const result = await ddbDocClient.send(new GetCommand({
      TableName: 'wizardingpay-prize',
      Key: {
        chat_id: BigInt(chat_id),
        message_id: BigInt(message_id),
      },
    }))
    const item = result.Item
    if (item.status === 'pending') {
      const decimals = item.token.decimals
      const pendingList = item.record.filter(r => r.value > 0)
      const addressList = pendingList.map(r => ownedAccountBy(r.user_id, 0).address)
      const amountList = pendingList.map(r => (new BigNumber.from(r.value).mul(BigNumber.from(10).pow(decimals))))
      
      if (addressList.length > NETWORK_INFO[item.network].maxTx) {
        ctx.answerCbQuery("Too many pending users, can't liquidate now.")
        ctx.editMessageText(`Too many pending users, can't liquidate now.`, Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Prize History', 'prizeHistory')]
        ]))
        return
      }
      
      try {
        const privateKey = ownedAccountBy(ctx.from.id, 0).privateKey
        const provider = new ethers.providers.JsonRpcProvider(NETWORK_INFO[item.network].rpc)
        const wallet = new ethers.Wallet(privateKey, provider)
        const providerWithSinger = wallet.connect(provider)
        const freeTransferContract = new ethers.Contract(NETWORK_INFO[item.network].freeTransfer, freeTransferAbi, providerWithSinger)
        const tokenContract = new ethers.Contract(item.token.address, erc20abi, providerWithSinger)
        const balance = await tokenContract.balanceOf(wallet.address)
        const totalAmount = amountList.reduce((acc, cur) => acc.add(cur), new BigNumber.from(0))
        if (balance.lt(totalAmount)) {
          ctx.answerCbQuery(`Insufficient balance, please try again later.`)
          return
        }
        const approved = await tokenContract.allowance(wallet.address, NETWORK_INFO[item.network].freeTransfer)
        if (approved.lt(totalAmount)) {
          ctx.editMessageText(`You need to approve the transfer first.`, Markup.inlineKeyboard([
            [Markup.button.callback('Approve', `approvePrize_${item.chat_id}_${item.message_id}`)],
            [Markup.button.callback('« Back to Prize History', 'prizeHistory')]
          ]))
          return
        }
        try {
          const res = await freeTransferContract.transfer(
              addressList,
              amountList,
              item.token.address,
              {
                gasLimit: NETWORK_INFO[item.network].gasLimit * addressList.length,
              }
          )
          try {
            await ddbDocClient.send(new UpdateCommand({
              TableName: 'wizardingpay-prize',
              Key: {
                chat_id: BigInt(chat_id),
                message_id: BigInt(message_id),
              },
              UpdateExpression: 'set #s = :s, #tx = :tx',
              ExpressionAttributeNames: {
                '#s': 'status',
                '#tx': 'tx',
              },
              ExpressionAttributeValues: {
                ':s': 'processing',
                ':tx': res.hash,
              },
            }))
          } catch (e) {
            ctx.answerCbQuery('Update Prize status failed')
            ctx.reply('Update Prize status failed')
          }
          ctx.editMessageText(`🟡 Prize ${item?.value} ${item?.token?.symbol} to "${item?.chat?.title}" is processing now. Check out Tx: ${NETWORK_INFO[item.network].explorer}/tx/${res.hash}`, Markup.inlineKeyboard([
            [Markup.button.callback('⚫️ Close', `closePrize_${chat_id}_${message_id}`, item.status === 'closed')],
            [Markup.button.callback('« Back to Prize History', 'prizeHistory')]
          ]))
        } catch (e) {
          console.log(e)
          ctx.answerCbQuery(`Transfer failed, please try again later.`)
        }
      } catch (e) {
        console.log(e)
        ctx.answerCbQuery("Liquidate Prize failed, please try again later.")
      }
    } else {
      ctx.answerCbQuery("Prize is not open, please try again later.")
    }
  } catch (e) {
    console.log(e)
    ctx.answerCbQuery("Fetch Prize failed, please try again later.")
  }
})

bot.action(/closePrize_(.*)/, async (ctx) => {
  const chat_id = ctx.match[1].split('_')[0]
  const message_id = ctx.match[1].split('_')[1]
  try {
    const result = await ddbDocClient.send(new GetCommand({
      TableName: 'wizardingpay-prize',
      Key: {
        chat_id: BigInt(chat_id),
        message_id: BigInt(message_id),
      },
    }))
    const item = result.Item
    if (item.status !== 'closed') {
      await ddbDocClient.send(new UpdateCommand({
        TableName: 'wizardingpay-prize',
        Key: {
          chat_id: BigInt(chat_id),
          message_id: BigInt(message_id),
        },
        UpdateExpression: 'set #s = :s',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':s': 'closed',
        },
      }))
      ctx.editMessageText(`⚫️ Prize ${item?.value} ${item?.token?.symbol} to "${item?.chat?.title}" is closed now.`, Markup.inlineKeyboard([
        [Markup.button.callback('« Back to Prize History', 'prizeHistory')]
      ]))
    } else {
      ctx.answerCbQuery("Prize had closed.")
    }
  } catch (e) {
    ctx.answerCbQuery("Fetch Prize failed, please try again later.")
  }
})

bot.action('sendPrizeChooseNetwork', async (ctx) => {
  await ctx.editMessageText('Choose a network from the list below:', Markup.inlineKeyboard([
    [Markup.button.callback('BSC', 'sendPrizeNetwork_56')],
    [Markup.button.callback('BSC Testnet', 'sendPrizeNetwork_97')],
    [Markup.button.callback('« Back to Prize', 'prize')]
  ]))
})

bot.action(/sendPrizeNetwork_.*/, async (ctx) => {
  const network = Number(ctx.match[0].split('_')[1])
  ctx.session = {...ctx.session, intent: 'inputPrizeToken', network}
  await ctx.answerCbQuery()
  ctx.editMessageText(`Please enter the address of Prize Token:`)
})

bot.action('deposit', async (ctx) => {
  const address = ownedAccountBy(ctx.update.callback_query.from.id, 0).address
  await ctx.answerCbQuery()
  await ctx.editMessageText(`
*💰 Deposit*

Your address: ${address}

You can deposit crypto to this address.
    `,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
              [Markup.button.callback('QR Code', 'depositQRCode')],
              [Markup.button.callback('« Back to My Wallet', 'myWallet')]
            ]
        )
      }
  )
})

bot.action('depositQRCode', async (ctx) => {
  try {
    const address = ownedAccountBy(ctx.update.callback_query.from.id, 0).address
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
      ctx.session = {...ctx.session, newSecret: newSecret, intent: 'setMfaCode'}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`Secret: ${newSecret.secret}

You have not set up any MFA. Please set this secret in your MFA device and type the authentication code below:`, Markup.inlineKeyboard([
        [Markup.button.callback('QR Code', 'MfaQrCode')],
        [Markup.button.callback('« Back to My Wallet', 'myWallet')]
      ]))
    } else {
      const secret = queryUserRes.Items[0].secret
      ctx.session = {...ctx.session, secret: secret, intent: 'verify-2fa-code'}
      await ctx.answerCbQuery()
      await ctx.editMessageText(`Your account is secured using multi-factor authentication (MFA). To finish showing privateKey, turn on or view your MFA device and type the authentication code below:`, Markup.inlineKeyboard([
            [Markup.button.callback('« Back to My Wallet', 'myWallet')]
          ])
      )
    }
  } catch (_) {
    await ctx.answerCbQuery('Something went wrong.')
  }
})

bot.action('MfaQrCode', async (ctx) => {
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

bot.action('submitPrize', async (ctx) => {
  try {
    const network = ctx.session.network
    const token = ctx.session.token
    const value = ctx.session.value
    const desc = ctx.session.desc
    const chat_id = ctx.session.chat_id
    const quantity = ctx.session.quality
    try {
      const res = await ctx.telegram.sendMessage(chat_id, `${desc}`, Markup.inlineKeyboard([
        [Markup.button.callback('Snatch!', 'snatch')]
      ]))
      try {
        await ddbDocClient.send(new PutCommand({
          TableName: 'wizardingpay-prize',
          Item: {
            chat_id: res.chat.id,
            message_id: res.message_id,
            creator_id: ctx.update.callback_query.from.id,
            creator_sort: 0,
            chat: res.chat,
            network,
            token,
            value,
            quantity,
            desc,
            status: 'open',
            record: [],
            created_at: Math.floor(Date.now() / 1000),
            ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
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
    const queryPrizeRes = await ddbDocClient.send(new GetCommand({
      TableName: 'wizardingpay-prize',
      Key: {
        chat_id: ctx.update.callback_query.message.chat.id,
        message_id: ctx.update.callback_query.message.message_id
      }
    }))
    if (queryPrizeRes.Item === undefined) {
      ctx.answerCbQuery("Sorry, this Prize is not found.")
      return
    }
    const prize = queryPrizeRes.Item
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
        TableName: 'wizardingpay-prize',
        Key: {
          chat_id: prize.chat_id,
          message_id: prize.message_id
        },
        UpdateExpression: 'set #record = list_append(#record, :record), #status = :status',
        ExpressionAttributeNames: {'#record': 'record', '#status': 'status'},
        ExpressionAttributeValues: {
          ':record': [{
            user_id: ctx.update.callback_query.from.id,
            username: ctx.update.callback_query.from.username,
            value,
            created_at: Date.now() / 1000,
          }],
          ':status': status,
        }
      }))
      await ctx.answerCbQuery(`You have snatched ${value}!`)
      ctx.reply(`Congratulations! ${ctx.update.callback_query.from.username || ctx.update.callback_query.from.id} have snatched ${value}!`)
    } catch (e) {
      await ctx.answerCbQuery('Sorry, snatch failed.')
    }
  } catch (e) {
    await ctx.answerCbQuery('Something went wrong.')
  }
})

bot.on('message', async (ctx) => {
  if (ctx.session?.intent === 'verify-2fa-code') {
    try {
      const code = ctx.message.text
      const secret = ctx.session.secret
      const verified = twoFactor.verifyToken(secret, code)
      const account = ownedAccountBy(ctx.from.id, 0)
      if (verified && verified.delta === 0) {
        ctx.session = {...ctx.session, intent: undefined}
        await ctx.reply(`Address: ${account.address}
Private key: ${account.privateKey}

Delete this message immediately after you have copied the private key.`, Markup.inlineKeyboard([
          [Markup.button.callback('🗑', 'delete')],
          [Markup.button.callback('« Back to My Wallet', 'myWallet')]
        ]))
      } else {
        await ctx.reply('Invalid 2FA code.')
      }
    } catch (_) {
      await ctx.reply('Something went wrong.')
    }
  } else if (ctx.session?.intent === 'setMfaCode') {
    try {
      const code = ctx.message.text
      const secret = ctx.session.newSecret.secret
      const verified = twoFactor.verifyToken(secret, code)
      if (verified && verified.delta === 0) {
        await ddbDocClient.send(new PutCommand({
          TableName: 'wizardingpay-users',
          Item: {
            id: ctx.from.id,
            sort: 0,
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
  } else if (ctx.session?.intent === 'inputPrizeToken') {
    const network = ctx.session.network
    const address = ctx.message.text
    if (isAddress(address)) {
      const Provider = new ethers.providers.JsonRpcProvider(NETWORK_INFO[network].rpc);
      const TokenContract = new ethers.Contract(address, erc20abi, Provider);
      try {
        const [symbol, decimals] = await Promise.all([
          TokenContract.symbol(),
          TokenContract.decimals()
        ])
        ctx.session = {
          ...ctx.session,
          intent: 'inputPrizeValue',
          token: {
            address,
            symbol,
            decimals
          }
        }
        await ctx.reply('Please enter the prize value:')
      } catch (e) {
        await ctx.reply('Invalid token address, check and input again.')
      }
    } else {
      await ctx.reply('Invalid token address, check and input again.')
    }
  } else if (ctx.session?.intent === 'inputPrizeValue') {
    const value = Number(ctx.message.text)
    if (value > 0) {
      ctx.session = {...ctx.session, intent: 'inputPrizeDesc', value}
      await ctx.reply('Please enter the prize desc:')
    } else {
      await ctx.reply('Invalid value. Please try again.')
    }
  } else if (ctx.session?.intent === 'inputPrizeDesc') {
    const desc = ctx.message.text
    if (desc.length > 0) {
      ctx.session = {...ctx.session, desc: desc, intent: "inputPrizeRecipient"}
      ctx.reply(`Please enter the recipient's id:`)
    }
  } else if (ctx.session.intent === 'inputPrizeRecipient') {
    const chat_id = ctx.message.text
    if (chat_id.length > 0) {
      ctx.session = {...ctx.session, chat_id, intent: "inputPrizeQuality"}
      ctx.reply(`Please enter the quality of the prize:`)
    }
  } else if (ctx.session?.intent === 'inputPrizeQuality') {
    const quality = Number(ctx.message.text)
    if (quality > 0 && quality <= 3000) {
      ctx.session = {...ctx.session, intent: undefined, quality}
      ctx.reply(`Network: ${ctx.session.network},
Value: ${ctx.session.value} ${ctx.session.token.symbol},
Token Address: ${ctx.session.token.address},
Description: ${ctx.session.desc},
Recipient: ${ctx.session.chat_id},
Prize quality: ${quality}.
`, Markup.inlineKeyboard([
        [Markup.button.callback('Submit', 'submitPrize')],
        [Markup.button.callback('« Back to Prize', 'prize')],
      ]))
    } else {
      await ctx.reply('Invalid quality. Please try again. The quality should be between 1 and 3000.')
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

// bot.launch().then(() => console.log('Bot launched...'))

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))