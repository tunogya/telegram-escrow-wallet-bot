const QRCode = require('qrcode');

exports.handler = async (event) => {
  const text = event?.queryStringParameters?.text || 'Hello World!';
  const option = {
    version: event?.queryStringParameters?.version || 4,
    errorCorrectionLevel: event?.queryStringParameters?.errorCorrectionLevel || 'M',
    maskPattern: event?.queryStringParameters?.maskPattern || 3,
    margin: event?.queryStringParameters?.margin || 4,
    scale: event?.queryStringParameters?.scale || 4,
    small: event?.queryStringParameters?.small || false,
    width: event?.queryStringParameters?.width || 300
  }
  try {
    const buffer = await QRCode.toBuffer(text, option)
    return {
      statusCode: 200,
      headers: {
        "content-type": 'image/png',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e.message,
    }
  }
};
