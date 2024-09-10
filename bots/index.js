const TelegramBot = require('node-telegram-bot-api');
const pool = require('../config/dbPool');

require('dotenv').config();

module.exports = function (token, app) {
    let bot;

    const url = process.env.BACKEND_URL; // Change this to your server URL. Make sure it's accessible from the internet.

    if (process.env.NODE_ENV === 'production') {
        bot = new TelegramBot(token);
        // Set webhook to receive updates
        bot.setWebHook(`${url}/bot${token}`);
    } else {
        // Use local development environment variables
        // Create a bot that uses 'polling' to fetch new updates
        bot = new TelegramBot(token, { polling: true });
    }

    app.post(`/bot${token}`, (req, res) => {
        console.log("Received body");
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    let activeBotModule = null;

    const resetBotState = () => {
        if (activeBotModule) {
            bot.removeListener('message', activeBotModule.handleMessage);
            bot.removeListener('callback_query', activeBotModule.handleCallbackQuery);
            activeBotModule = null;
            bot.addListener('callback_query', handleCallbackQuery);
        }
        console.log("Bot state has been reset.");
    };

    const handleMessage = async (msg, match) => {
        resetBotState(); // Reset state each time /start is called

        console.log("Received /start command:", msg.text);
        const chatId = msg.chat.id;
        const referee = match[1] || '0000000000';
        let username = msg.from.username || 'Unknown user';
        const userId = msg.from.id;

        if (!msg.from.username) {
            bot.sendMessage(chatId, "It seems like you don't have a Telegram username set. Please go to your Telegram settings and set a username to continue.");
            return;
        }

        try {
            let [rows] = await pool.query('SELECT * FROM TelegramReferrals WHERE userId = ?', [userId]);
            if (rows.length === 0) {
                await pool.query('INSERT INTO TelegramReferrals (userId, referee, username) VALUES (?, ?, ?)', [userId, referee, username]);
                await pool.query('UPDATE TelegramReferees SET clicks = clicks + 1 WHERE userId = ?', [referee]);

                adminMessage(bot, `just got referred`, username, userId, null, referee);
            }
            const responseText = "*Welcome to our company!*\n\nPlease select your interesting bot";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'SwipeRightBot', callback_data: 'swiperight_bot' }],
                        [{ text: 'FetBot', callback_data: 'fet_bot' }],
                    ]
                },
            };

            bot.sendMessage(chatId, responseText, options);
        } catch (err) {
            console.error('Error while accessing the database:', err);
            bot.sendMessage(chatId, 'Sorry, there was an error processing your request.');
        }
    }

    const handleCallbackQuery = async (callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;


        switch (data) {
            case 'swiperight_bot':
                activeBotModule = require('./SwipeRight');
                break;
            case 'fet_bot':
                activeBotModule = require('./FetBot');
                break;
            default:
                return;
        }

        if (activeBotModule) {
            activeBotModule.init(bot, chatId, pool);
        }
    }

    bot.onText(/\/start(?: (.*))?/, handleMessage);
    bot.on('callback_query', handleCallbackQuery);

    return bot;
}
