require('dotenv').config();
const { TOTP } = require('totp-generator');

async function run() {
  try {
      const { otp } = await TOTP.generate(process.env.ANGEL_TOTP_SECRET);
      console.log(`\n=================================================`);
      console.log(`🕒 Current Time: ${new Date().toLocaleTimeString()}`);
      console.log(`🔢 Server Generated TOTP: ${otp}`);
      console.log(`=================================================\n`);
  } catch (error) {
      console.error("Error generating TOTP:", error.message);
  }
}

run();
