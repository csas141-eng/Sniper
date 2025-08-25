import bs58 from 'bs58';

// Replace with your base58 string
const base58Key = "4KtbpbXZsQhXJ4GEjrgNDfg9B9dctFYgXwg9Lu68koZGDVMp5tN12WS8XtZqEceSsM9w4WoGM8CTrsfAfJMXNYxp";

const secretKey = bs58.decode(base58Key);

console.log(JSON.stringify(Array.from(secretKey)));