const { handlePurchase, cryptoPayment, getExpirationStatus, adminMessage } = require('../sharedFunctions');
const { stripe } = require('../config/stripe');

const init = (bot, firstChatId, pool) => {

    console.log("KK2")
    const userState = {};
    console.log("UserState Initialized")

    userState[firstChatId] = {}
    responseText = "*FetBot - Automation for OFM with AI Chatting:*\n\nFetBot is a Chrome extension designed that automates the processes of following, liking, commenting and chatting.\n\nFetBot enables precise targeting based on role, age and location, making it ideal to target for example high-paying submissive or slave users."
        + "\n\n*Features of FetBot:*\n- AI Chatting (Mass DM)\n- Webcam spoofer to fake verification\n- Funneling (spintax supported)\n- Liking\n- Commenting\n- Following\n- Targeting of Submissive or Dominant users\n- Mimic human behaviour through routines\n- Target niche communities (gay people, guys who like transgenders, specific kinks, etc.) with the custom user scraper.\n- Engage / Pause cycles \n- Gay or Transgender Models option\n\n" +
        "*Price:*\nFetBot starts at $500 per month and can be used for up to 5 Models.\nYou can create unlimited accounts per model.\nAdditional model slots can be purchased for $150 each."

    const referralOptions = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🫂 Referral', callback_data: 'referral' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'All Features and Infos', url: 'https://t.me/fetbotextension/134' }],
                [{ text: 'Purchase FetBot', callback_data: 'purchase_fetbot' }],
                [{ text: 'Extend License', callback_data: 'extend_license' }]
            ]
        },
        parse_mode: 'Markdown',
        caption: responseText
    };

    bot.sendPhoto(firstChatId, `https://memedex-content.ams3.cdn.digitaloceanspaces.com/TelegramBot/fetbot.jpg`, options)
        .then(() => {

            bot.sendMessage(firstChatId, `Interested in our referral program?`, referralOptions);
        });

    const handleMessage = async (msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username
        const userId = msg.from.id;
        console.log(msg.text, userState[chatId], userState[chatId]?.awaitingLicense)
        if (userState[chatId] && userState[chatId].awaitingLicense) {
            //EXTEND
            let responseText = 'You entered an invalid license key';
            const [licenses] = await pool.query('SELECT * FROM FetBotLicenses WHERE license_key = ?', [msg.text]);
            if (licenses.length === 0) {
                //You entered an invalid license key 
                bot.sendMessage(chatId, responseText);
                return
            }
            userState[chatId].licensekey = msg.text;
            console.log("Licensekey is: " + userState[chatId].licensekey)
            userState[chatId].awaitingLicense = false;
            userState[chatId].mode = "EXTEND"

            //fetch license key infos 


            const licenseDetails = licenses[0];
            var expiryTimestamp = licenseDetails.expiration
            var currentTimestamp = Math.floor(Date.now() / 1000);
            console.log("License Details: ", licenseDetails)
            var expiredText = getExpirationStatus(expiryTimestamp, currentTimestamp)


            if (licenseDetails.commentsSheet && licenseDetails.messageSheet) {
                console.log("Sheets Spotted: ", licenseDetails.commentsSheet, licenseDetails.messageSheet)
                userState[chatId].commentsSheet = licenseDetails.commentsSheet
                userState[chatId].messageSheet = licenseDetails.messageSheet
            }
            responseText = `Current Subscription:\n${expiredText}\nPrice: $500`;
            if (licenseDetails.expiration) {
                console.log("Expiration Spotted: ", licenseDetails.expiration)
                userState[chatId].expiration = licenseDetails.expiration
            }

            adminMessage(bot, `is interested in extending *FetBot*`, username, userId, '$500', null, "")

            const responseText2 = '\n\n_Note: If your current license has not yet expired and you choose to extend it, the additional time purchased will be added to the end of your existing license period_\n\nChoose your preferred payment method:';
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        // [{ text: 'Stripe (VCC/Google Pay)', callback_data: 'pay_stripe' }],
                        [{ text: 'USDT (TRC20)', callback_data: 'pay_usdt_trc20' }],
                        [{ text: 'USDT (ERC20)', callback_data: 'pay_usdt_erc20' }],
                        [{ text: 'ETH', callback_data: 'pay_eth' }],
                        [{ text: 'BTC', callback_data: 'pay_btc' }],
                        [{ text: 'LTC', callback_data: 'pay_ltc' }],
                        [{ text: 'Other methods (Contact Support)', url: 'https://t.me/aarontells' }]
                    ]
                },
                parse_mode: 'Markdown',
            };

            bot.sendMessage(chatId, responseText + responseText2, options);
        }
    }

    const handleCallbackQuery = async (callbackQuery) => {
        const message = callbackQuery.message;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;
        const username = callbackQuery.from.username
        const userId = callbackQuery.from.id
        let responseText = '';
        let options;

        if (!userState[chatId]) {
            userState[chatId] = {}; // Initialize as an empty object if it doesn't exist
        }

        switch (data) {
            case 'referral':

                if (username) {

                    try {
                        var salesTeam = [
                            "BTZtg7",
                            "bobamilktea2003",
                            "shanecarrollfrancis",
                            "SourceCode101",
                            "zalzzzzz",
                            "estalecs",
                            "ChoppaChon",
                            "real_paul",
                            "noretreat123"
                        ]
                        if (salesTeam.includes(username)) {
                            const results = await pool.query('SELECT balance, referrals, clicks FROM TelegramReferees WHERE userId = ?', [userId]);

                            let balance = 0;
                            let referrals = 0;
                            let clicks = 0;

                            if (results[0] && results[0].length > 0) {
                                // User exists, get balance and referrals
                                balance = results[0][0].balance;
                                referrals = results[0][0].referrals
                                clicks = results[0][0].clicks
                            } else {
                                // User does not exist, create a new user in the database
                                const newUser = await pool.query('INSERT INTO TelegramReferees (username, userId, balance, referrals) VALUES (?, ?, ?, ?)', [username, userId, 0, 0]);

                                if (newUser) {
                                    console.log('New user created with userId:', userId);
                                } else {
                                    console.log('Failed to create new user');
                                }
                            }

                            const referralLink = `t.me/FetBot_PurchaseBot?start=${userId}`.replace(/_/g, "\\_");  // Replace with actual referral link

                            const updatedMessage = `Interested in our referral program?\n\n💰 *Referral balance: $${balance}*\n👤 *Referrals: ${referrals}*\n*🖱️ Clicks: ${clicks}*\n\nYou will receive 30% for life from all purchases of clients who came through your referral link:\n\n${referralLink}`;

                            const updatedOptions = {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '💸 Withdrawal USDT', url: 'https://t.me/aarontells' }],
                                        [{ text: '🔗 How to hide a referral link', callback_data: 'hide_referral' }]   // Using the 'url' parameter to link to your Telegram profile
                                    ]
                                },
                                parse_mode: 'Markdown',
                                disable_web_page_preview: true
                            };
                            bot.editMessageText(updatedMessage, updatedOptions, {
                                chat_id: chatId,
                                message_id: messageId
                            })
                        } else {
                            const results = await pool.query('SELECT referrals FROM TelegramReferees WHERE userId = ?', [userId]);

                            let referrals = 0;

                            if (results[0] && results[0].length > 0) {
                                // User exists, get balance and referrals 
                                referrals = results[0][0].referrals;
                            } else {
                                // User does not exist, create a new user in the database
                                const newUser = await pool.query('INSERT INTO TelegramReferees (username, userId, balance, referrals) VALUES (?, ?, ?, ?)', [username, userId, 0, 0]);

                                if (newUser) {
                                    console.log('New user created with userId:', userId);
                                } else {
                                    console.log('Failed to create new user');
                                }
                            }

                            console.log('userId:', userId);

                            const referralLink = `t.me/FetBot_PurchaseBot?start=${userId}`.replace(/_/g, "\\_");  // Replace with actual referral link

                            const updatedMessage = `Interested in our referral program?\n\n*Referrals: 👤 ${referrals}*\n\nYou'll receive 2 weeks of free access to FetBot if you referr a customer that purchases FetBot through your referral link:\n\n${referralLink}\n\n`;

                            const updatedOptions = {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '💸 Redeem referrals', url: 'https://t.me/aarontells' }],
                                        [{ text: '🔗 How to hide a referral link', callback_data: 'hide_referral' }]  // Using the 'url' parameter to link to your Telegram profile
                                    ]
                                },
                                parse_mode: 'Markdown',
                                disable_web_page_preview: true
                            };
                            bot.editMessageText(updatedMessage, updatedOptions, {
                                chat_id: chatId,
                                message_id: messageId
                            })

                            adminMessage(bot, `is interested in the referral programm`, username, userId, null, null, "")
                        }

                    } catch (error) {
                        console.error('Error fetching balance:', error);
                    }


                } else {

                    bot.sendMessage(chatId, "Please give your Telegram account a username first to signup for the referral programm");
                }

                break
            case 'purchase_fetbot':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].productDescription = "FetBot"
                adminMessage(bot, `is interested in purchasing *FetBot*`, username, userId, "$500", null, "")
                handlePurchase(bot, chatId)
                break;

            case 'pay_eth':
                cryptoPayment(bot, chatId, messageId, userId, username, userState[chatId], "ETH", "eth")
                break;
            case 'pay_usdt_trc20':
                cryptoPayment(bot, chatId, messageId, userId, username, userState[chatId], "USDT - TRC20", "usdttrc20")
                break;
            case 'pay_usdt_erc20':
                cryptoPayment(bot, chatId, messageId, userId, username, userState[chatId], "USDT - ERC20", "usdterc20")
                break;
            case 'pay_btc':
                console.log("BTC", userState[chatId])
                cryptoPayment(bot, chatId, messageId, userId, username, userState[chatId], "BTC", "btc")
                break;
            case 'pay_ltc':
                cryptoPayment(bot, chatId, messageId, userId, username, userState[chatId], "LTC", "ltc")
                break;
            case 'pay_stripe':
                console.log("chatId before session creation:", chatId);

                let photoMessageId, textMessageId;

                bot.deleteMessage(chatId, messageId)
                    .then(() => {
                        return bot.sendMessage(chatId, `Processing your payment`);
                    })
                    .then(sentMessage => {
                        photoMessageId = sentMessage.message_id;
                        return bot.sendMessage(chatId, `Please wait....`);
                    })
                    .then(sentMessage => {
                        textMessageId = sentMessage.message_id;
                        return stripe.checkout.sessions.create({
                            payment_method_types: ['card'],
                            line_items: [{
                                price_data: {
                                    currency: 'usd',
                                    product_data: {
                                        name: "FetBot",
                                    },
                                    unit_amount: parseFloat((500 * 100).toFixed(2))
                                },
                                quantity: 1,
                            }],
                            mode: 'payment',
                            success_url: 'https://t.me/FetBot_PurchaseBot',
                            cancel_url: 'https://t.me/FetBot_PurchaseBot',
                            metadata: {
                                chatId: chatId,
                                userId: userId,
                                photoMessageId: photoMessageId.toString(),
                                textMessageId: textMessageId.toString(),
                                username: username,
                                licenseKey: userState[chatId].licensekey,
                                expiration: userState[chatId].expiration,
                                commentsSheet: userState[chatId].commentsSheet,
                                messageSheet: userState[chatId].messageSheet,
                                mode: userState[chatId].mode,
                                bot: "FetBot"
                            }
                        });
                    })
                    .then(session => {
                        // Update the first or second message with the Stripe session URL
                        // Choose the message to update (either photoMessageId or textMessageId)
                        const options = {
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: 'Pay with Stripe', url: session.url }
                                ]]
                            },
                            parse_mode: 'Markdown',
                        };

                        return bot.editMessageText(`Product: *FetBot*\nPrice: $500\n\nPlease proceed with the payment:`, {
                            chat_id: chatId,
                            message_id: photoMessageId, // Ensure this is the correct message to update
                            ...options
                        });
                    })
                    .then(() => {
                        return bot.editMessageText(`Waiting for payment...`, {
                            chat_id: chatId,
                            message_id: textMessageId
                        });
                    })
                    .catch(error => {
                        console.error('Error in payment process:', error);
                    });
                break;
            case 'extend_license':

                responseText = `Enter your license key:`;
                bot.sendMessage(chatId, responseText)
                    .then(sentMessage => {
                        console.log(userState[chatId], chatId, userState)
                        userState[chatId].lastMessageId = sentMessage.message_id
                        userState[chatId].awaitingLicense = true
                        userState[chatId].productDescription = "FetBot Base"
                    });

                break;
            case 'hide_referral':
                responseText = '1. Type @FetBot_PurchaseBot\n2. Highlight it and right click -> Transformations -> Make Link\n3. Add your referral link as the URL';
                bot.sendMessage(chatId, responseText);
                break;
            default:
                break;
        }

        bot.answerCallbackQuery(callbackQuery.id);
    }

    bot.on('message', handleMessage);
    bot.on('callback_query', handleCallbackQuery);

    return {
        handleMessage,
        handleCallbackQuery
    };
};

module.exports = { init };