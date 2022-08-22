const {ethers} = require("ethers")

const privateKey = ethers.utils.randomBytes(32);
const wallet = new ethers.Wallet(privateKey);
let keyNumber = ethers.BigNumber.from(privateKey);
console.log('私钥: ', keyNumber._hex);
console.log("账号地址: " + wallet.address);
