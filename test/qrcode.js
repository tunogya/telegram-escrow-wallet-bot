const QRCode = require('qrcode');

const main = async () => {
  const options = {
    type: 'image/png',
    margin: 4,
    version: 3,
  }
  const buffer = await QRCode.toBuffer('0x3B00ce7E2d0E0E905990f9B09A1F515C71a91C10', options)
  console.log(buffer.toString('base64'));
}
main()
