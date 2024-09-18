const axios = require('axios');
const pool = require('./config/dbPool');
const { google } = require('googleapis');
require('dotenv').config();

const X_API_KEY = process.env.X_API_KEY
const BACKEND_URL = process.env.BACKEND_URL
const ADMIN_USER = process.env.ADMIN_USER

function handlePurchase(bot, chatId) {
    const responseText = 'Choose your preferred payment method:';
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
        }
    };

    bot.sendMessage(chatId, responseText, options);

}

async function cryptoPayment(bot, chatId, messageId, userId, username, userState, cryptoName, crypto) {
    console.log("CRYPTO PAYMENT S")
    let price = userState.price || 500;
    let discountText = ""
    if (userState.creditedDays) {
        price -= userState.creditedDays
        discountText = ` (-$${userState.creditedDays} Credit)`
    }

    try {
        const minPaymentResponse = await axios.get(`https://api-sandbox.nowpayments.io/v1/min-amount?currency_from=${crypto}&currency_to=USD`, {
            headers: {
                'x-api-key': X_API_KEY
            }
        });
        const minAmount = minPaymentResponse.data.min_amount;

        const estimateResponse = await axios.get(`https://api-sandbox.nowpayments.io/v1/estimate?amount=${price}&currency_from=USD&currency_to=${crypto}`, {
            headers: {
                'x-api-key': X_API_KEY
            }
        });
        const estimatedAmountInCrypto = estimateResponse.data.estimated_amount;

        if (estimatedAmountInCrypto < minAmount) {
            throw new Error('Estimated amount is less than minimum required payment');
        }

        axios.post('https://api-sandbox.nowpayments.io/v1/payment', {
            price_amount: price,
            price_currency: 'usd',
            pay_currency: crypto,
            ipn_callback_url: `${BACKEND_URL}/nowpayments/ipn`,
            order_description: userState.productDescription
        }, {
            headers: {
                'x-api-key': X_API_KEY
            }
        }).then(response => {
            const paymentAddress = response.data.pay_address;
            const paymentId = response.data.payment_id;  // Get the payment ID from the response

            const responseText = `Product: *${userState.productDescription}*\nPayment id: ${paymentId}\n Price: $${price}${discountText}\n\nTransfer ${estimatedAmountInCrypto} ${cryptoName} to:\n\n\`${paymentAddress}\`\n\n⚠️ Ensure to pay any fees charged by your crypto exchange\n\nWe will sent you the .zip file and the license key after we received the payment.`;


            let photoMessageId, textMessageId;

            bot.deleteMessage(chatId, messageId)
                .then(() => {
                    // After successfully deleting the previous message, send a new photo
                    return bot.sendPhoto(chatId, `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${paymentAddress}`, { caption: responseText, parse_mode: 'Markdown' });
                })
                .then(sentPhotoMessage => {
                    photoMessageId = sentPhotoMessage.message_id; // Store the message ID of the photo

                    // After the photo is sent, send the next text message
                    return bot.sendMessage(chatId, `Waiting for payment...`);
                })
                .then(sentTextMessage => {
                    textMessageId = sentTextMessage.message_id; // Store the message ID of the text message
                    savePaymentStatus(bot, userState, paymentId, chatId, userId, price, photoMessageId, textMessageId, username);
                })
                .catch(error => {
                    // If there is an error at any point in the chain, log it
                    console.error('Error in message chain:', error);
                });
        }).catch(error => {
            console.error('Error while creating payment:', error);
            bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again later.');
        });

    } catch (error) {
        console.error('Error while processing payment:', error);
        bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again later.');
    }
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function getFutureTimestamp(days) {
    const currentDate = new Date();
    const futureDate = new Date(currentDate.getTime() + (days * 24 * 60 * 60 * 1000));
    const futureTimestamp = Math.floor(futureDate.getTime() / 1000);
    return futureTimestamp
}
function formatDate(date) {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}
async function savePaymentStatus(bot, userState, paymentId, chatId, userId, price, photoMessageId, textMessageId, username) {
    try {
        const { productId, licenseKey, expiration, scraperSheet, mode, productDescription } = userState;

        console.log("USERSTATE:", userState);

        // Execute the query with error handling
        await pool.query(
            'INSERT INTO PaymentStatus (chatId, paymentId, userId, price, photoMessageId, textMessageId, licenseKey, scraperSheet, username, productId, productDescription, expiration, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [chatId, paymentId, userId, price, photoMessageId, textMessageId, licenseKey, scraperSheet, username, productId, productDescription, expiration, mode]
        );
    } catch (error) {
        console.error("Error saving payment status:", error);
        await bot.sendMessage(chatId, `Failed to save payment status. Please try again later.\n ${error.message}`);
    }
}

async function checkPaymentStatus(bot, paymentId, status) {
    bot.sendMessage(ADMIN_USER, `Payment status is successfully saved, ${status} ${paymentId}`);
    // Query the database for the payment status using paymentId
    const [result] = await pool.query('SELECT * FROM PaymentStatus WHERE paymentId = ?', [paymentId]);

    console.log(result);

    if (result.length === 0) {
        console.error(`No record found for paymentId: ${paymentId}`);
        return;
    }

    const newPaymentStatus = result[0];

    console.log(newPaymentStatus);

    if (status === true) {
        paymentReceived(bot, newPaymentStatus.chatId, newPaymentStatus.userId, newPaymentStatus.price, newPaymentStatus.photoMessageId, newPaymentStatus.textMessageId, newPaymentStatus.licenseKey, newPaymentStatus.scraperSheet, null, newPaymentStatus.username, newPaymentStatus.productId, newPaymentStatus.productDescription, newPaymentStatus.expiration, newPaymentStatus.mode)
    } else {
        bot.sendMessage(newPaymentStatus.chatId, `Payment of ${paymentId} failed. Please try again.`);
    }
}

async function paymentReceived(bot, chatId, userId, price, photoMessageId, textMessageId, licenseKey, scraperSheets, mMessageSheet, username, productId, productDescription, mExpiration, mode) {
    console.log("PAYMENT RECEIVED ", productDescription, mode)

    if (productDescription === "FetBot" || productDescription === "FetBot Base") {
        var currentTimestamp = Math.floor(Date.now() / 1000)

        var license_key = licenseKey
        if (!licenseKey) {
            license_key = generateUUID()
        }

        var expiration = getFutureTimestamp(30)

        var activations = 0


        var commentsSheet = ""
        var messageSheet = ""
        if (scraperSheets && mMessageSheet) {
            commentsSheet = scraperSheets
            messageSheet = mMessageSheet
        }



        if (mode === "EXTEND" && licenseKey) {

            if (mExpiration > currentTimestamp) {
                expiration = mExpiration + 30 * 24 * 60 * 60;
            } else {
                expiration = getFutureTimestamp(30);
            }

            console.log("HE1", expiration)

            const newUser = await pool.query('UPDATE FetBotLicenses SET expiration = ?, activations = 0 WHERE license_key = ?',
                [expiration, licenseKey]);
            if (newUser) {
                console.log('License extended');
            } else {
                console.log('Failed to extend license');
            }

        } else {
            commentsSheet = await copyAndShareSheet(`FetBot Comments @${username}`, "1PH7G-OJCFt38FSwo0zHYfYhHFIxYrzmwaJPZHP3ZfIM")
            messageSheet = await copyAndShareSheet(`FetBot Messages @${username}`, "1KdCl6mu4kMEzxePUHkWEt_c5Gan3IroRBYrOsDTsiV0")


            const newUser = await pool.query('INSERT INTO FetBotLicenses (id, name, license_key, expiration, activations, commentsSheet, messageSheet) VALUES (NULL, ?, ?, ?, ?, ?, ?)', [username, license_key, expiration, activations, commentsSheet, messageSheet]);
            if (newUser) {
                console.log('New license created');
            } else {
                console.log('Failed to create new license');
            }
        }


        const [refereeRows] = await pool.query('SELECT referee FROM TelegramReferrals WHERE userId = ?', [userId]);

        let referee = refereeRows[0].referee
        var refereeUsername = ""
        if (refereeRows.length > 0 && referee) {

            var result = await pool.query('SELECT * FROM TelegramReferees WHERE userId = ?', [referee])
            refereeUsername = result[0][0].username
            //test
            await pool.query('UPDATE TelegramReferrals SET balance = balance + ? WHERE userId = ?', [500, userId]);
            if (result.length > 0) {
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
                if (salesTeam.includes(result[0][0].username)) {
                    await pool.query('UPDATE TelegramReferees SET referrals = referrals + 1, balance = balance + ? WHERE userId = ?', [parseFloat((500 * 0.30).toFixed(2)), referee]);
                }
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Contact Support', url: 'https://t.me/aarontells' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };
                updatedResult = await pool.query('SELECT * FROM TelegramReferees WHERE userId = ?', [referee])
                var message
                if (salesTeam.includes(updatedResult[0][0].username)) {
                    message = `${username} purchased through your referral link\n\nProduct: *FetBot*\nPrice: *$500*\nYour share: *$${parseFloat((500 * 0.30).toFixed(2))}*\n\n💰 Balance: *$${updatedResult[0][0].balance}* 👤 Referrals: *${updatedResult[0][0].referrals}* 🖱️ Clicks: *${updatedResult[0][0].clicks}*`
                } else {
                    message = `${username} purchased through your referral link\n\nProduct: *FetBot*\nYour current referrals: 👤 *${updatedResult[0][0].referrals}*`

                }
                bot.sendMessage(referee, message, options);

            }

        }






        Promise.all([
            bot.deleteMessage(chatId, photoMessageId).catch(error => console.error('Error deleting photo message:', error)),
            bot.deleteMessage(chatId, textMessageId).catch(error => console.error('Error deleting text message:', error))
        ])
            .then(() => {
                // Both messages have been deleted, now you can continue with other actions

                // Send the first message
                return bot.sendMessage(chatId, "🤝");
            })
            .then(() => {
                // After the first message is sent, prepare and send the second message
                var infoText = ""
                if (mode === "PURCHASE") {
                    console.log("111")
                    adminMessage(bot, `succesfully purchased: *FetBot*`, username, userId, referee, refereeUsername)
                    infoText = `Succesfully purchased:\n*FetBot*\nValid until:\n${formatDate(new Date(expiration * 1000))}`
                } else if (mode === "EXTEND") {
                    console.log("222")
                    adminMessage(bot, `succesfully extended: *FetBot*\nValid until:\n${formatDate(new Date(expiration * 1000))}`, username, userId, referee, refereeUsername)
                    infoText = `Succesfully extended:\n*FetBot*`
                    //Sucesfully extended your license
                }

                const commentsSheetUrl = `https://docs.google.com/spreadsheets/d/${commentsSheet}/edit`.replace(/_/g, "\\_");
                const messageSheetSheetUrl = `https://docs.google.com/spreadsheets/d/${messageSheet}/edit`.replace(/_/g, "\\_");

                var downloadFolder = "https://drive.google.com/drive/u/1/folders/11W5M_ftdcLi9xlVEtZbYlr69K6wGos9n".replace(/_/g, "\\_");
                var optionsText = `*Payment received*\n\n${infoText}\n\nYour license key is:\n\`${license_key}\`\n\nValid until:\n${formatDate(new Date(expiration * 1000))}\n\nDownload FetBot + Guide:\n${downloadFolder}\nCheck the READ-ME.pdf for installation instructions and commonly asked questions\n\nComments Google Sheets:\n${commentsSheetUrl}\n\nMessages Google Sheets (in case you don't use AI chatting):\n${messageSheetSheetUrl}`;

                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Contact Support', url: 'https://t.me/aarontells' }]
                        ]
                    },
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                };

                return bot.sendMessage(chatId, optionsText, options);
            })
            .then(() => {
                // After the second message is sent, send the third message
                return bot.sendMessage(chatId, "Join the FetBot Channel to get notified about updates:\nhttps://t.me/fetbotextension", {
                    disable_web_page_preview: false
                });
            })
            .catch(error => {
                console.error("Error in sending messages:", error);
            });
    } else {
        //1702371971
        var currentTimestamp = Math.floor(Date.now() / 1000)

        var license_key = licenseKey
        if (!licenseKey) {
            license_key = generateUUID()
        }

        var expiration = getFutureTimestamp(30)

        var activations = 0
        var aiPurchased = 0
        var aiGenerations = 0
        var verificationTool = 0
        var boostScheduler = 0
        var scraper = 0
        var newSpreadsheetId = ""
        if (scraperSheets) {
            newSpreadsheetId = scraperSheets
        }
        var trial_expiration = 0
        var trial_activations = 0
        if (productId === 1) {
            //SwipeRight Pro
            aiPurchased = 1
            verificationTool = 1
            boostScheduler = 1
            scraper = 1
            if (!newSpreadsheetId) {
                newSpreadsheetId = await copyAndShareSheet(`SwipeRight Pro @${username}`, "1UgMuKLs4_ZiK42n7gG6rcX40Oj65lgA_bvC2JCZ1R6k")
            }


        } else if (productId === 2) {
            //Ai Chatter
            aiPurchased = 1
            trial_expiration = getFutureTimestamp(3)
        } else if (productId === 3) {
            //Verification tool
            verificationTool = 1
            trial_expiration = getFutureTimestamp(3)
        } else if (productId === 4) {
            //Boost Scheduler
            boostScheduler = 1
            trial_expiration = getFutureTimestamp(3)
        } else if (productId === 5) {
            //scraper
            scraper = 1
            trial_expiration = getFutureTimestamp(3)
            if (!newSpreadsheetId) {
                newSpreadsheetId = await copyAndShareSheet(`Bio & Social Scraper @${username}`, "1UgMuKLs4_ZiK42n7gG6rcX40Oj65lgA_bvC2JCZ1R6k")
            }
        } else {
            //base version
            trial_expiration = getFutureTimestamp(3)
        }



        const publicUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;



        if (mode === "EXTEND" && licenseKey) {

            if (mExpiration > currentTimestamp) {
                expiration = mExpiration + 30 * 24 * 60 * 60;
            } else {
                expiration = getFutureTimestamp(30);
            }

            console.log("HE1", expiration)

            const newUser = await pool.query('UPDATE Licenses SET expiration = ?, activations = 0 WHERE license_key = ?',
                [expiration, licenseKey]);
            if (newUser) {
                console.log('License extended');
            } else {
                console.log('Failed to extend license');
            }

        } else if (mode === "UPGRADE" && licenseKey) {
            if (mExpiration && mExpiration > expiration) {
                expiration = mExpiration
            }
            const newUser = await pool.query('UPDATE Licenses SET name = ?, expiration = ?, activations = ?, aiPurchased = ?, aiGenerations = ?, verificationTool = ?, boostScheduler = ?, scraper = ?, scraperSheets = ? WHERE license_key = ?',
                [username, expiration, activations, aiPurchased, aiGenerations, verificationTool, boostScheduler, scraper, newSpreadsheetId, licenseKey]);

            if (newUser) {
                console.log('License updated');
            } else {
                console.log('Failed to updatew license');
            }

        } else {
            const newUser = await pool.query('INSERT INTO Licenses (id, name, license_key, expiration, activations, aiPurchased, aiGenerations, verificationTool, boostScheduler, scraper, scraperSheets, trial_expiration, trial_activations) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [username, license_key, expiration, activations, aiPurchased, aiGenerations, verificationTool, boostScheduler, scraper, newSpreadsheetId, trial_expiration, trial_activations]);
            if (newUser) {
                console.log('New license created');
            } else {
                console.log('Failed to create new license');
            }
        }


        const [refereeRows] = await pool.query('SELECT referee FROM TelegramReferrals WHERE userId = ?', [userId]);

        let referee = refereeRows[0].referee

        if (refereeRows.length > 0 && referee) {

            var result = await pool.query('SELECT * FROM TelegramReferees WHERE userId = ?', [referee])

            await pool.query('UPDATE TelegramReferrals SET balance = balance + ? WHERE userId = ?', [price, userId]);
            if (result.length > 0) {
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
                if (salesTeam.includes(result[0][0].username) || productId === 1) {
                    await pool.query('UPDATE TelegramReferees SET referrals = referrals + 1, balance = balance + ? WHERE userId = ?', [parseFloat((price * 0.30).toFixed(2)), referee]);
                }
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Contact Support', url: 'https://t.me/aarontells' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };
                updatedResult = await pool.query('SELECT * FROM TelegramReferees WHERE userId = ?', [referee])
                var message
                if (salesTeam.includes(updatedResult[0][0].username)) {
                    message = `${username} purchased through your referral link\n\nProduct: *${productDescription}*\nPrice: *$${price}*\nYour share: *$${parseFloat((price * 0.30).toFixed(2))}*\n\n💰 Balance: *$${updatedResult[0][0].balance}* 👤 Referrals: *${updatedResult[0][0].referrals}* 🖱️ Clicks: *${updatedResult[0][0].clicks}*`
                } else if (productId === 1) {
                    message = `${username} purchased through your referral link\n\nProduct: *${productDescription}*\nYour current referrals: 👤 *${updatedResult[0][0].referrals}*`

                }
                bot.sendMessage(referee, message, options);

            }

        }






        Promise.all([
            bot.deleteMessage(chatId, photoMessageId).catch(error => console.error('Error deleting photo message:', error)),
            bot.deleteMessage(chatId, textMessageId).catch(error => console.error('Error deleting text message:', error))
        ])
            .then(() => {
                // Both messages have been deleted, now you can continue with other actions

                // Send the first message
                return bot.sendMessage(chatId, "🤝");
            })
            .then(() => {
                // After the first message is sent, prepare and send the second message
                var infoText = ""
                if (mode === "PURCHASE") {
                    console.log("111")
                    //You purchased 1 Month Social & Bio Scraper
                    adminMessage(bot, `succesfully purchased: *${productDescription}*`, username, userId, price, referee)
                    infoText = `Succesfully purchased:\n*${productDescription}*`
                } else if (mode === "EXTEND") {
                    console.log("222")
                    adminMessage(bot, `succesfully extended: *${productDescription}*`, username, userId, price, referee)
                    infoText = `Succesfully extended:\n*${productDescription}*`
                    //Sucesfully extended your license
                } else if (mode === "UPGRADE") {
                    console.log("333")
                    adminMessage(bot, `succesfully upgraded to: *${productDescription}*`, username, userId, price, referee)
                    infoText = `Succesfully upgraded to:\n*${productDescription}*`
                    //Succesfully upgraded to SwipeRight Pro
                }
                //test

                var downloadFolder = "https://drive.google.com/drive/folders/1R5ccjFAzHxKOh_5zV9CujZgzF4_Eiw8I?usp=sharing".replace(/_/g, "\\_");
                var optionsText = `*Payment received*\n\n${infoText}\n\nYour license key is:\n\`${license_key}\`\n\nValid until:\n${formatDate(new Date(expiration * 1000))}\n\nDownload SwipeRight:\n${downloadFolder}\nCheck the READ-ME.pdf for installation instructions and commonly asked questions`;

                if (productId === 1 || productId === 5) {
                    var sheetUrl = publicUrl.replace(/_/g, "\\_");
                    optionsText += `\nHere is where your scraped bios and usernames get saved:\n${sheetUrl}`;
                }

                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Contact Support', url: 'https://t.me/aarontells' }]
                        ]
                    },
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                };

                return bot.sendMessage(chatId, optionsText, options);
            })
            .then(() => {
                // After the second message is sent, send the third message
                return bot.sendMessage(chatId, "Join the SwipeRight Channel to get notified about updates:\nhttps://t.me/swiperightextension", {
                    disable_web_page_preview: false
                });
            })
            .catch(error => {
                console.error("Error in sending messages:", error);
            });
    }


}


function getExpiryDiffDays(expiryTimestamp, currentTimestamp) {
    const expiryDate = new Date(expiryTimestamp * 1000);
    const currentDate = new Date(currentTimestamp * 1000);

    const diff = expiryDate - currentDate;
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return diffDays
}
function getExpirationStatus(expiryTimestamp, currentTimestamp) {
    const expiryDate = new Date(expiryTimestamp * 1000);
    const currentDate = new Date(currentTimestamp * 1000);

    const diff = expiryDate - currentDate;
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        return `Expires in ${diffDays} Days`;
    } else if (diffDays === 1) {
        return 'Expires: Tomorrow';
    } else if (diffDays === 0) {
        return 'Expires: Today';
    } else {
        return `Expired: ${Math.abs(diffDays)} days ago`;
    }
}

async function copyAndShareSheet(title, sheetId) {

    // Set up the client
    const client = new google.auth.GoogleAuth({
        credentials: {
            "type": "service_account",
            "project_id": "swiperight-393717",
            "private_key_id": process.env.GOOGLE_PRIVATE_KEY_ID,
            "private_key": process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            "client_email": process.env.GOOGLE_CLIENT_EMAIL,
            "client_id": process.env.GOOGLE_CLIENT_ID,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/swiperight%40swiperight-393717.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    try {
        const drive = google.drive({ version: 'v3', auth: client });

        // Step 1: Copy the entire spreadsheet using the Drive API
        const copyResponse = await drive.files.copy({
            fileId: sheetId,
            requestBody: {
                name: title,
            }
        });
        const newSpreadsheetId = copyResponse.data.id;

        // Step 2: Make the new spreadsheet public
        await drive.permissions.create({
            fileId: newSpreadsheetId,
            requestBody: {
                type: 'anyone',
                role: 'writer',
            },
        });

        // Construct the public URL

        return newSpreadsheetId;
    } catch (error) {
        console.error('Error copying and sharing the sheet:', error);
        throw error;
    }
}

function adminMessage(bot, msg, username, userId, price, referee, refereeUsername) {
    const options = {
        parse_mode: 'Markdown'
    };
    var addon1 = ""
    var addon2 = ""
    if (referee) {
        addon1 = `\nReferred by: *${referee}*`
    }
    if (price) {
        addon2 = `\nPrice: *${price}*`
    }

    console.log("username is: ", username)
    var message = `${username.replace(/_/g, "\\_")} ${msg}\n\nUser ID: ${userId}${addon1}${addon2}`
    bot.sendMessage(ADMIN_USER, message, options);
}
// Export your shared functions
module.exports = {
    handlePurchase,
    cryptoPayment,
    getExpirationStatus,
    getExpiryDiffDays,
    paymentReceived,
    adminMessage,
    checkPaymentStatus
};