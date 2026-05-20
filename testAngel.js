const angelService = require('./src/services/angelOneService');

async function testConnection() {
  console.log("Testing Angel One connection...");
  const success = await angelService.generateToken();
  if (success) {
    console.log("Great! The system successfully logged into Angel One.");
    console.log("JWT Token:", angelService.jwtToken ? "Generated" : "Missing");
    console.log("Feed Token:", angelService.feedToken ? "Generated" : "Missing");
  } else {
    console.log("Login failed. Check your credentials.");
  }
}

testConnection();
