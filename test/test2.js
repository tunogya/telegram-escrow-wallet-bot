const {BigNumber} = require("ethers");

const a = 1

// use big number * 10 ** 18
const b = BigNumber.from(a).mul(BigNumber.from(10).pow(18))

console.log(b.toString())