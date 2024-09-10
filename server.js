const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { checkPaymentStatus } = require('./sharedFunctions');
require('dotenv').config();

const { BOT_TOKEN, IPN_SECRET, ADMIN_USER } = process.env;


app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    console.log("Original URL: " + req.originalUrl);
    next();
  } else {
    console.log("New URL: " + req.originalUrl);
    bodyParser.json()(req, res, next);
  }
});

const createBot = require('./bots/index');

const bot = createBot(BOT_TOKEN, app);

app.post('/nowpayments/ipn', (req, res) => {
  function sortObject(obj) {
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObject(obj[key]);
    });
    return sorted;
  }

  // Sort the request body
  const sortedParams = JSON.stringify(sortObject(req.body));

  // Create a HMAC-SHA512 signature using the IPN Secret Key
  const hmac = crypto.createHmac('sha512', IPN_SECRET);
  const signature = hmac.update(sortedParams).digest('hex');

  // Retrieve the signature from the headers
  const signatureKey = req.headers['x-nowpayments-sig'];

  bot.sendMessage(ADMIN_USER, `Payment Notification:\n\n Signature: ${signature} \n Sign Key: ${signatureKey}`)

  if (signature === signatureKey) {
    console.log('IPN received and verified:');
    // Process the payment information here

    // Example: Extracting relevant information
    const { payment_id, payment_status } = req.body;

    // Implement your logic for handling different payment statuses
    if (payment_status === 'confirmed' || payment_status === 'finished') {
      console.log(`Payment ${payment_id} is confirmed.`);
      // Handle the confirmed payment, e.g., update the database, notify the user, etc.
      checkPaymentStatus(bot, payment_id, true);
    } else if (payment_status === 'failed') {
      console.log(`Payment ${payment_id} failed.`);
      // Handle failed payment
      checkPaymentStatus(bot, payment_id, false);
    }

    res.status(200).send('IPN received');
  } else {
    console.log('IPN verification failed.');
    res.status(400).send('Invalid signature');
  }
});

app.get('/', (req, res) => {
  res.send('Hello, welcome to the PingMe API!');
});

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
server.timeout = 10000;