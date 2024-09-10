const { handlePurchase, cryptoPayment, getExpirationStatus, getExpiryDiffDays, adminMessage } = require('../sharedFunctions');
const { stripe } = require('../config/stripe');
require('dotenv').config();

const init = (bot, firstChatId, pool) => {

    console.log("KK1")

    const userState = {};
    console.log("UserState Initialized")

    userState[firstChatId] = {}
    responseText = "*SwipeRight - DA Swiper with AI Chatting:*\n\nSwipeRight is a Chrome extension designed for DAs that automates the processes of swiping, chatting, funneling and scraping. Perfect to boost your OFM"
        + " revenue.\n\n*SwipeRight Base:*\n- Price: $50 per month\n- Features: basic swiping functionality, beeline/gold swiping, mass unmatcher, shadowban checker, etc.\n\n*SwipeRight Pro:*\n- Price: $500 per month\n- Features: Includes all Base features plus AI Chatter, Verification Tool,"
        + " Bio and Social Scraper, Boost Scheduler, Smart Unmatcher.\n\n*Individual Pricing (Base Version included):*\n- AI Chatter: $450 per month\n- Verification tool: $250 per month\n- Boost Scheduler: $200 per month\n- Bio & Social Scraper: $150 per month\n\n_Note:\nAll versions and add-ons can be used for up to 500 dating app profiles per month. Once all activations are used up, the license expires and can be purchased again._\n\n*Trial:*\n"
        + "Each Base version customer gets SwipeRight Pro unlocked on his first 5 activations.";
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
                [{ text: 'All Features', url: 'https://t.me/swiperightextension/58' }],
                [{ text: 'Purchase Base', callback_data: 'purchase_base' }],
                [{ text: 'Purchase Pro', callback_data: 'purchase_pro' }],
                [{ text: 'Purchase Features Individually', callback_data: 'purchase_individually' }],
                [{ text: 'Extend License', callback_data: 'extend_license' }],
                [{ text: 'Upgrade License', callback_data: 'upgrade_license' }]
            ]
        },
        parse_mode: 'Markdown',
        caption: responseText
    };

    bot.sendPhoto(firstChatId, `https://memedex-content.ams3.cdn.digitaloceanspaces.com/TelegramBot/swiperight.jpg`, options)
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
            const [licenses] = await pool.query('SELECT * FROM Licenses WHERE license_key = ?', [msg.text]);
            if (licenses.length === 0) {
                //You entered an invalid license key 
                bot.sendMessage(chatId, responseText);
                return
            }
            userState[chatId].licensekey = msg.text;
            console.log("Licensekey is: " + userState[chatId].licensekey)
            //peerWalletPayment(chatId, userState[chatId].email, userState[chatId].price, userState[chatId].productDescription);
            userState[chatId].awaitingLicense = false;
            userState[chatId].creditedDays = 0
            userState[chatId].mode = "EXTEND"

            //fetch license key infos 


            const licenseDetails = licenses[0];
            var expiryTimestamp = licenseDetails.expiration
            var currentTimestamp = Math.floor(Date.now() / 1000);
            console.log("License Details: ", licenseDetails)
            var expiredText = getExpirationStatus(expiryTimestamp, currentTimestamp)

            if (licenseDetails.aiPurchased && licenseDetails.verificationTool && licenseDetails.boostScheduler && licenseDetails.scraper) {
                responseText = `Current Subscription: SwipeRight Pro\n${expiredText}\n\nPrice: $500`;
                userState[chatId].productId = 1
                userState[chatId].price = 500
                userState[chatId].productDescription = "SwipeRight Pro"
                //SwipeRight pro 
            } else if (licenseDetails.aiPurchased) {
                responseText = `Current Subscription: AI Chatting\n${expiredText}\n\nPrice: $450`;
                userState[chatId].productId = 2
                userState[chatId].price = 450
                userState[chatId].productDescription = "AI Chatter"
                //AI Chatting
            } else if (licenseDetails.verificationTool) {
                responseText = `Current Subscription: Verification Tool\n${expiredText}\n\nPrice: $250`;
                userState[chatId].productId = 3
                userState[chatId].price = 250
                userState[chatId].productDescription = "Verification tool"
                //Verification Tool
            } else if (licenseDetails.boostScheduler) {
                responseText = `Current Subscription: Boost Scheduler\n${expiredText}\n\nPrice: $200`;
                userState[chatId].productId = 4
                userState[chatId].price = 200
                userState[chatId].productDescription = "Boost Scheduler"
                //Boost Scheduler
            } else if (licenseDetails.scraper) {
                responseText = `Current Subscription: Bio & Social Scraper\n${expiredText}\n\nPrice: $150`;
                userState[chatId].productId = 5
                userState[chatId].price = 150
                userState[chatId].productDescription = "Bio & Social Scraper"
                //Scraper
            } else {
                responseText = `Current Subscription: SwipeRight Base\n${expiredText}\n\nPrice: $50`;
                userState[chatId].productId = 0
                userState[chatId].price = 50
                userState[chatId].productDescription = "SwipeRight Base"
                //Base
            }
            if (licenseDetails.scraperSheets) {
                console.log("Sheet Spotted: ", licenseDetails.scraperSheets)
                userState[chatId].scraperSheet = licenseDetails.scraperSheets
            }
            if (licenseDetails.expiration) {
                console.log("Expiration Spotted: ", licenseDetails.expiration)
                userState[chatId].expiration = licenseDetails.expiration
            }

            adminMessage(bot, `is interested in extending *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)

            const responseText2 = '\n\n_Note: If your current license has not yet expired and you choose to extend it, the additional time purchased will be added to the end of your existing license period_\n\nChoose your preferred payment method:';
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        //[{ text: 'Stripe (VCC/Google Pay)', callback_data: 'pay_stripe' }],
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
        } else if (userState[chatId] && userState[chatId].awaitingLicenseUpgrade) {
            //UPGRADE

            userState[chatId].licensekey = msg.text;
            userState[chatId].awaitingLicenseUpgrade = false;
            userState[chatId].mode = "UPGRADE"
            let responseText = 'You entered an invalid license key';
            const [licenses] = await pool.query('SELECT * FROM Licenses WHERE license_key = ?', [msg.text]);
            if (licenses.length === 0) {
                //You entered an invalid license key
                responseText = 'You entered an invalid license key';
                bot.sendMessage(chatId, responseText);
                return
            }
            const licenseDetails = licenses[0];
            console.log("License Details: ", licenseDetails)
            var expiryTimestamp = licenseDetails.expiration
            var currentTimestamp = Math.floor(Date.now() / 1000);
            console.log(expiryTimestamp, currentTimestamp)
            var expiredText = getExpirationStatus(expiryTimestamp, currentTimestamp)
            var diffDays = getExpiryDiffDays(expiryTimestamp, currentTimestamp)
            userState[chatId].creditedDays = 0
            var upgradeOptions = []

            if (licenseDetails.aiPurchased && licenseDetails.verificationTool && licenseDetails.boostScheduler && licenseDetails.scraper) {
                responseText = `Current Subscription: SwipeRight Pro\n${expiredText}\n\nPrice: $500 per month`;

                bot.sendMessage(chatId, responseText + "\n\nThere are no upgrade options for SwipeRight Pro");
                return
                //There are no upgrade options for SwipeRight Pro 
                //SwipeRight pro 
            } else if (licenseDetails.aiPurchased) {
                responseText = `Current Subscription: AI Chatting\n${expiredText}\n\nPrice: $450 per month`;
                creditedDays = parseFloat(((450 / 30) * diffDays).toFixed(2));
                upgradeOptions = [
                    [{ text: 'SwipeRight Pro', callback_data: 'purchase_pro_upgrade' }]
                ]
                //AI Chatting
            } else if (licenseDetails.verificationTool) {
                responseText = `Current Subscription: Verification Tool\n${expiredText}\n\nPrice: $250 per month`;
                creditedDays = parseFloat(((250 / 30) * diffDays).toFixed(2));
                upgradeOptions = [
                    [{ text: 'SwipeRight Pro', callback_data: 'purchase_pro_upgrade' }]
                ]

                //Verification Tool
            } else if (licenseDetails.boostScheduler) {
                responseText = `Current Subscription: Boost Scheduler\n${expiredText}\n\nPrice: $200 per month`;
                creditedDays = parseFloat(((200 / 30) * diffDays).toFixed(2));
                upgradeOptions = [
                    [{ text: 'SwipeRight Pro', callback_data: 'purchase_pro_upgrade' }]
                ]
                //Boost Scheduler
            } else if (licenseDetails.scraper) {
                responseText = `Current Subscription: Bio & Social Scraper\n${expiredText}\n\nPrice: $150 per month`;
                creditedDays = parseFloat(((150 / 30) * diffDays).toFixed(2));
                upgradeOptions = [
                    [{ text: 'SwipeRight Pro', callback_data: 'purchase_pro_upgrade' }]
                ]
                //Scraper
            } else {
                responseText = `Current Subscription: SwipeRight Base\n${expiredText}\n\nPrice: $50 per month`;
                creditedDays = parseFloat(((50 / 30) * diffDays).toFixed(2));
                upgradeOptions = [
                    [{ text: 'SwipeRight Pro', callback_data: 'purchase_pro_upgrade' }],
                    [{ text: 'AI Chatter', callback_data: 'purchase_ai_chatter_upgrade' }],
                    [{ text: 'Verification tool', callback_data: 'purchase_verification_tool_upgrade' }],
                    [{ text: 'Boost Scheduler', callback_data: 'purchase_boost_scheduler_upgrade' }],
                    [{ text: 'Bio & Social Scraper', callback_data: 'purchase_scraper_upgrade' }]
                ]
                //Base
            }

            userState[chatId].creditedDays = creditedDays
            userState[chatId].diffDays = diffDays
            if (licenseDetails.scraperSheets) {
                console.log("Sheet Spotted: ", licenseDetails.scraperSheets)
                userState[chatId].scraperSheet = licenseDetails.scraperSheets
            }
            if (licenseDetails.expiration) {
                console.log("Expiration Spotted: ", licenseDetails.expiration)
                userState[chatId].expiration = licenseDetails.expiration
            }
            console.log("CREDIT DAYS", userState[chatId])
            const responseText2 = `\n\nSince you have ${diffDays} days remaining on your current license, you will receive a $${creditedDays} credit towards your upgraded license.\n\nUpgrade Options:`;
            const options = {
                reply_markup: {
                    inline_keyboard: upgradeOptions
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
                            "Brandonofm",
                            "skilaa1",
                            "raffaelemanila",
                            "onelly3"
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

                            const referralLink = `t.me/SwipeRight_PurchaseBot?start=${userId}`.replace(/_/g, "\\_");  // Replace with actual referral link

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

                            const referralLink = `t.me/SwipeRight_PurchaseBot?start=${userId}`.replace(/_/g, "\\_");  // Replace with actual referral link

                            const updatedMessage = `Interested in our referral program?\n\n*Referrals: 👤 ${referrals}*\n\nYou'll receive 2 weeks of free access to SwipeRight Pro if you referr a customer that purchases SwipeRight Pro through your referral link:\n\n${referralLink}\n\n`;

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

                            adminMessage(bot, `is interested in the referral programm`, username, userId, null, null)
                        }

                    } catch (error) {
                        console.error('Error fetching balance:', error);
                    }


                } else {

                    bot.sendMessage(chatId, "Please give your Telegram account a username first to signup for the referral programm");
                }

                break
            case 'purchase_pro':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 1
                userState[chatId].price = 500
                userState[chatId].productDescription = "SwipeRight Pro"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_pro_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 1
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((500 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 500
                }
                userState[chatId].productDescription = "SwipeRight Pro"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_individually':
                responseText = 'Select a feature you want to purchase. Base version is included.';
                options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Purchase AI Chatter', callback_data: 'purchase_ai_chatter' }],
                            [{ text: 'Purchase Verification tool', callback_data: 'purchase_verification_tool' }],
                            [{ text: 'Purchase Boost Scheduler', callback_data: 'purchase_boost_scheduler' }],
                            [{ text: 'Purchase Bio & Social Scraper', callback_data: 'purchase_scraper' }]
                        ]
                    }
                };

                bot.sendMessage(chatId, responseText, options);
                break;
            case 'purchase_ai_chatter':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 2
                userState[chatId].price = 450
                userState[chatId].productDescription = "AI Chatter"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;

            case 'purchase_ai_chatter_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 2
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((450 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 450
                }
                userState[chatId].productDescription = "AI Chatter"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_verification_tool':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 3
                userState[chatId].price = 250
                userState[chatId].productDescription = "Verification tool"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_verification_tool_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 3
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((250 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 250
                }
                userState[chatId].productDescription = "Verification tool"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_boost_scheduler':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 4
                userState[chatId].price = 200
                userState[chatId].productDescription = "Boost Scheduler"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_boost_scheduler_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 4
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((200 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 200
                }
                userState[chatId].productDescription = "Boost Scheduler"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_scraper':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 5
                userState[chatId].price = 150
                userState[chatId].productDescription = "Bio & Social Scraper"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_scraper_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 5
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((150 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 150
                }
                userState[chatId].productDescription = "Bio & Social Scraper"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_base':
                userState[chatId] = {}
                userState[chatId].mode = "PURCHASE"
                userState[chatId].creditedDays = 0
                userState[chatId].productId = 0
                userState[chatId].price = 50
                userState[chatId].productDescription = "SwipeRight Base"
                adminMessage(bot, `is interested in purchasing *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId)
                break;
            case 'purchase_base_upgrade':
                userState[chatId].mode = "UPGRADE"
                userState[chatId].productId = 0
                if (userState[chatId].diffDays >= 30) {
                    userState[chatId].price = parseFloat(((50 / 30) * userState[chatId].diffDays).toFixed(2))
                } else {
                    userState[chatId].price = 50
                }
                userState[chatId].productDescription = "SwipeRight Base"
                adminMessage(bot, `is interested in upgrading to *${userState[chatId].productDescription}*`, username, userId, userState[chatId].price, null)
                handlePurchase(bot, chatId, messageId)
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
                var price = userState[chatId].price;
                if (userState[chatId].creditedDays) {
                    price -= userState[chatId].creditedDays; // Adjust price based on credited days
                }

                console.log("Stripe price: " + price)

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
                                        name: userState[chatId].productDescription,
                                    },
                                    unit_amount: parseFloat((price * 100).toFixed(2))
                                },
                                quantity: 1,
                            }],
                            mode: 'payment',
                            success_url: 'https://t.me/SwipeRight_PurchaseBot',
                            cancel_url: 'https://t.me/SwipeRight_PurchaseBot',
                            metadata: {
                                chatId: chatId,
                                userId: userId,
                                photoMessageId: photoMessageId.toString(),
                                textMessageId: textMessageId.toString(),
                                username: username,
                                productId: userState[chatId].productId,
                                licenseKey: userState[chatId].licensekey,
                                expiration: userState[chatId].expiration,
                                scraperSheet: userState[chatId].scraperSheet,
                                mode: userState[chatId].mode,
                                productDescription: userState[chatId].productDescription,
                                price: userState[chatId].price,
                                bot: "SwipeRight"
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
                        var discountText = userState[chatId].creditedDays ? ` (-$${userState[chatId].creditedDays} Credit)` : "";

                        return bot.editMessageText(`Product: *${userState[chatId].productDescription}*\nPrice: $${parseFloat((price).toFixed(2))}${discountText}\n\nPlease proceed with the payment:`, {
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
                    });


                break;
            case 'upgrade_license':

                responseText = `Enter your license key:`;
                bot.sendMessage(chatId, responseText)
                    .then(sentMessage => {
                        userState[chatId].lastMessageId = sentMessage.message_id
                        userState[chatId].awaitingLicenseUpgrade = true
                    });


                break;

            case 'hide_referral':
                responseText = '1. Type @SwipeRight_PurchaseBot\n2. Highlight it and right click -> Transformations -> Make Link\n3. Add your referral link as the URL';
                bot.sendMessage(chatId, responseText);
                break;
            default:
                break;
        }

        bot.answerCallbackQuery(callbackQuery.id);
    };

    bot.on('message', handleMessage);
    bot.on('callback_query', handleCallbackQuery);

    return {
        handleMessage,
        handleCallbackQuery
    };
};

module.exports = { init };