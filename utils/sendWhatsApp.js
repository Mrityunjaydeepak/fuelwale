// utils/sendWhatsApp.js

module.exports = async function sendWhatsApp({ to, message }) {
  console.log('📤 Sending WhatsApp message...');
  console.log('To:', to);
  console.log('Message:\n', message);
  // Simulate a delay like actual API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Message "sent" (mock)');
};
