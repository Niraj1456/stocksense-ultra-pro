require('dotenv').config();
const totp = require('totp-generator');

try {
    const otp = totp(process.env.ANGEL_TOTP_SECRET);
    console.log(`\n=================================================`);
    console.log(`🕒 Current Time: ${new Date().toLocaleTimeString()}`);
    console.log(`🔢 Server Generated TOTP: ${otp}`);
    console.log(`=================================================\n`);
} catch (error) {
    console.error("Error generating TOTP:", error.message);
}
