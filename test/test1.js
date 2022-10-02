const {PutCommand, DynamoDBDocumentClient} = require("@aws-sdk/lib-dynamodb");
const {DynamoDBClient} = require("@aws-sdk/client-dynamodb");

const ddbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

(async () => {
  try {
    await ddbDocClient.send(new PutCommand({
      TableName: 'wizardingpay-prize',
      Item: {
        chat_id: -1233,
        message_id: 233,
        creator_id: 372893,
        creator_sort: 0,
        chat: {
          name: '123'
        },
        network: 56,
        token: {
          address: '0x233',
          decimals: 18,
          symbol: 'WIZ'
        },
        value: 20,
        quantity: 2,
        desc: '123443',
        status: 'open',
        record: [],
        created_at: Math.floor(Date.now() / 1000),
        ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 // 1 year
      }
    }))
  } catch (e) {
    console.log(e)
  }
})();
