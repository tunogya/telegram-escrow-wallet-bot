const QRCode = require('qrcode');

const main = async () => {
  const res = await QRCode.toDataURL('I am a pony!')
  console.log(res)
}

main()
