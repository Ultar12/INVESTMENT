const i18n = require('../services/i18n');
const { sequelize, User, Transaction, Investment } = require('../models');
const { 
    getMainMenuKeyboard,
    getBalanceKeyboard,
    getInvestmentPlansKeyboard, 
    getCancelKeyboard,
    getBackKeyboard,
    getWithdrawNetworkKeyboard,
    getAdminReviewKeyboard, // For Withdrawals
    getAdminDepositReviewKeyboard // --- FIX: Import new keyboard ---
} = require('../services/keyboards');
const { PLANS, MIN_WITHDRAWAL, MIN_DEPOSIT, ADMIN_CHAT_ID, WELCOME_BONUS } = require('../config');

// Safety function to prevent .toFixed crash
const toFixedSafe = (num, digits = 2) => (typeof num === 'number' ? num : 0).toFixed(digits);

// Helper to edit message
async function editOrSend(bot, chatId, msgId, text, options) {
    try {
        await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...options });
    } catch (error) {
        await bot.sendMessage(chatId, text, options);
    }
}

// Accept `user` and `__` (language function) as arguments
const handleCallback = async (bot, callbackQuery, user, __) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const msgId = msg.message_id;
    const data = callbackQuery.data;
    const from = callbackQuery.from;
    
    if (!user) return bot.answerCallbackQuery(callbackQuery.id);

    // --- Admin Approval Logic (WITHDRAWAL) ---
    if (data.startsWith('admin_approve_') || data.startsWith('admin_reject_')) {
        
        if (!ADMIN_CHAT_ID || from.id.toString() !== ADMIN_CHAT_ID.toString()) {
            return bot.answerCallbackQuery(callbackQuery.id, "You are not authorized for this action.", true);
        }

        const action = data.split('_')[1];
        const txId = data.split('_')[2];
        const tx = await Transaction.findOne({ where: { id: txId }, include: User });
        
        if (!tx) { 
            await bot.editMessageText(msg.text + "\n\nError: Transaction not found.", { chat_id: chatId, message_id: msgId });
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        if (tx.status !== 'pending') { 
            await bot.editMessageText(msg.text + "\n\nError: This transaction has already been processed.", { chat_id: chatId, message_id: msgId });
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        
        const txUser = tx.User;
        i18n.setLocale(txUser.language);
        const admin__ = i18n.__; 
        
        const t = await sequelize.transaction();
        try {
            if (action === 'approve') {
                tx.status = 'completed';
                await tx.save({ transaction: t });
                txUser.totalWithdrawn = (txUser.totalWithdrawn || 0) + tx.amount;
                await txUser.save({ transaction: t });
                await t.commit();
                await bot.editMessageText(msg.text + `\n\nApproved by ${from.first_name}`, {
                    chat_id: chatId, message_id: msgId, reply_markup: null
                });
                await bot.sendMessage(txUser.telegramId, admin__("withdraw.notify_user_approved", toFixedSafe(tx.amount)));
            } else if (action === 'reject') {
                tx.status = 'failed';
                await tx.save({ transaction: t });
                txUser.mainBalance = (txUser.mainBalance || 0) + tx.amount; // Give money back
                await txUser.save({ transaction: t });
                await t.commit();
                await bot.editMessageText(msg.text + `\n\nRejected by ${from.first_name}`, {
                    chat_id: chatId, message_id: msgId, reply_markup: null
                });
                await bot.sendMessage(txUser.telegramId, admin__("withdraw.notify_user_rejected", toFixedSafe(tx.amount)));
            }
        } catch (e) {
            await t.rollback();
            console.error("Admin review processing error:", e);
            bot.answerCallbackQuery(callbackQuery.id, "Database error.", true);
        }
        return bot.answerCallbackQuery(callbackQuery.id, "Action processed.");
    }

    // --- FIX: Admin Approval Logic (DEPOSIT) ---
    if (data.startsWith('admin_approve_deposit_') || data.startsWith('admin_reject_deposit_')) {
        
        if (!ADMIN_CHAT_ID || from.id.toString() !== ADMIN_CHAT_ID.toString()) {
            return bot.answerCallbackQuery(callbackQuery.id, "You are not authorized for this action.", true);
        }

        const action = data.split('_')[1];
        const txId = data.split('_')[3]; // e.g., admin_approve_deposit_123
        const tx = await Transaction.findOne({ where: { id: txId }, include: User });
        
        if (!tx) { 
            await bot.editMessageText(msg.text + "\n\nError: Transaction not found.", { chat_id: chatId, message_id: msgId });
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        if (tx.status !== 'pending') { 
            await bot.editMessageText(msg.text + "\n\nError: This transaction has already been processed.", { chat_id: chatId, message_id: msgId });
            return bot.answerCallbackQuery(callbackQuery.id);
        }
        
        const txUser = tx.User;
        i18n.setLocale(txUser.language);
        const admin__ = i18n.__;
        
        const t = await sequelize.transaction();
        try {
            if (action === 'approve') {
                tx.status = 'completed';
                await tx.save({ transaction: t });
                txUser.mainBalance = (txUser.mainBalance || 0) + tx.amount; // Add money
                await txUser.save({ transaction: t });
                await t.commit();
                await bot.editMessageText(msg.text + `\n\nApproved by ${from.first_name}`, {
                    chat_id: chatId, message_id: msgId, reply_markup: null
                });
                await bot.sendMessage(txUser.telegramId, admin__("deposit.notify_user_approved", toFixedSafe(tx.amount)));
            } else if (action === 'reject') {
                tx.status = 'failed';
                await tx.save({ transaction: t });
                // No money to give back, just mark as failed
                await t.commit();
                await bot.editMessageText(msg.text + `\n\nRejected by ${from.first_name}`, {
                    chat_id: chatId, message_id: msgId, reply_markup: null
                });
                await bot.sendMessage(txUser.telegramId, admin__("deposit.notify_user_rejected"));
            }
        } catch (e) {
            await t.rollback();
            console.error("Admin DEPOSIT review processing error:", e);
            bot.answerCallbackQuery(callbackQuery.id, "Database error.", true);
        }
        return bot.answerCallbackQuery(callbackQuery.id, "Action processed.");
    }
    // --- END OF FIX ---
    
    // --- End of Admin Logic ---

    // const __ = i18n.__; // <-- REMOVED! We use the one passed from index.js

    try {
        // --- Language Selection ---
        if (data.startsWith('set_lang_')) {
            const newLang = data.split('_')[2];
            user.language = newLang;
            user.state = 'none'; // Reset state
            user.stateContext = user.stateContext || {};
            await user.save();
            
            // Re-set locale with the NEW language for this response
            i18n.setLocale(newLang);
            
            // Create a NEW translation function bound to the new locale
            const newLocale__ = (key, ...args) => i18n.__({ phrase: key, locale: newLang }, ...args);
            
            // Delete old message
            try {
                await bot.deleteMessage(chatId, msgId);
            } catch (e) {
                // Message might already be deleted, ignore
            }
            
            // Get language name and send messages using the new locale function
            const langName = newLocale__("language_name");
            console.log(`Language changed to: ${newLang}, language name: ${langName}`); // DEBUG
            
            // Send confirmation with new language
            await bot.sendMessage(chatId, newLocale__("language_set", langName, from.first_name));

            // Send welcome description
            await bot.sendMessage(chatId, newLocale__("welcome_description"), { parse_mode: 'HTML' });

            // If new user, send welcome bonus message
            if (user.stateContext && user.stateContext.isNewUser) {
                await bot.sendMessage(chatId, newLocale__("welcome_bonus_message", toFixedSafe(WELCOME_BONUS)));
                user.stateContext = {};
                await user.save();
            }
            
            // Send main menu with updated language
            const mainMenuText = newLocale__("main_menu_title", from.first_name);
            await bot.sendMessage(chatId, mainMenuText, {
                reply_markup: getMainMenuKeyboard(user, newLocale__) // Pass the new locale function
            });
            
            return bot.answerCallbackQuery(callbackQuery.id, "Language changed!");
        }

        // --- Back to Main Menu ---
        else if (data === 'back_to_main') {
            user.state = 'none';
            await user.save();
            const text = __("main_menu_title", from.first_name);
            await editOrSend(bot, chatId, msgId, text, { reply_markup: undefined });
            await bot.sendMessage(chatId, __("main_menu_title", from.first_name), {
                reply_markup: getMainMenuKeyboard(user, __) // Pass `__`
            });
        }
        
        // --- Back to Balance Menu ---
        else if (data === 'back_to_balance') {
            user.state = 'none';
            await user.save();
            const text = __("balance.title", 
                toFixedSafe(user.mainBalance), 
                toFixedSafe(user.bonusBalance), 
                toFixedSafe(user.totalInvested), 
                toFixedSafe(user.totalWithdrawn)
            );
            await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getBalanceKeyboard(user, __) // Pass `__`
            });
        }
        
        // --- Back to Investment Plans ---
        else if (data === 'back_to_plans') {
            user.state = 'none';
            await user.save();
            const balanceText = toFixedSafe(user.mainBalance);
            const text = __("plans.title") + "\n\n" + __("common.balance", balanceText);
            await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getInvestmentPlansKeyboard(user, __) // Pass `__`
            });
        }
        
        // --- Show Investment Plans ---
        else if (data === 'show_invest_plans') {
             const balanceText = toFixedSafe(user.mainBalance);
             const text = __("plans.title") + "\n\n" + __("common.balance", balanceText);
             await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getInvestmentPlansKeyboard(user, __) // Pass `__`
            });
        }

        // --- Select Investment Plan ---
        else if (data.startsWith('invest_plan_')) {
            const planId = data.replace('invest_', '');
            const plan = PLANS[planId];
            if (!plan) return bot.answerCallbackQuery(callbackQuery.id, "Invalid plan.");
            user.state = 'awaiting_investment_amount';
            user.stateContext = { planId: plan.id };
            await user.save();
            
            const balanceText = toFixedSafe(user.mainBalance);
            // --- FIX: Your config doesn't have `plan.max` so I removed it ---
            const text = __("plans.details", 
                plan.percent, 
                plan.hours, 
                plan.min, 
                // plan.max, // This field is not in your config.js
                "Unlimited", // Placeholder
                __("common.balance", balanceText)
            );
            // --- END OF FIX ---
            await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getCancelKeyboard(user, __) // Pass `__`
            });
        }

        // --- Cancel Action ---
        else if (data === 'cancel_action') {
            user.state = 'none';
            user.stateContext = {};
            await user.save();
            await editOrSend(bot, chatId, msgId, __("action_canceled"), { reply_markup: undefined });
            
            // Go back to balance menu if coming from deposit/withdraw, else go to main menu
            const previousContext = callbackQuery.message.text || '';
            if (previousContext.includes(__('balance.title')) || previousContext.includes(__('deposit.ask_amount')) || previousContext.includes(__('withdraw.ask_wallet'))) {
                // Return to balance menu
                const text = __("balance.title", 
                    toFixedSafe(user.mainBalance), 
                    toFixedSafe(user.bonusBalance), 
                    toFixedSafe(user.totalInvested), 
                    toFixedSafe(user.totalWithdrawn)
                );
                await bot.sendMessage(chatId, text, {
                    reply_markup: getBalanceKeyboard(user, __)
                });
            } else {
                // Return to main menu
                await bot.sendMessage(chatId, __("main_menu_title", from.first_name), {
                    reply_markup: getMainMenuKeyboard(user, __) // Pass `__`
                });
            }
        }

        // --- Deposit (Step 1) ---
        else if (data === 'deposit') {
            user.state = 'awaiting_deposit_amount';
            await user.save();
            await editOrSend(bot, chatId, msgId, __("deposit.ask_amount", MIN_DEPOSIT), { 
                reply_markup: getCancelKeyboard(user, __) // Pass `__`
            });
        }

        // --- FIX: User clicks "I Have Paid" ---
        else if (data.startsWith('deposit_paid_')) {
            const txId = data.split('_')[2];
            const tx = await Transaction.findOne({ where: { id: txId }, include: User });

            if (!tx || tx.User.id !== user.id) {
                return bot.answerCallbackQuery(callbackQuery.id, "Transaction not found.", true);
            }
            if (tx.status !== 'pending') {
                return bot.answerCallbackQuery(callbackQuery.id, "This deposit is already being processed.", true);
            }
            
            // 1. Reset user state
            user.state = 'none';
            user.stateContext = {}; // Clear context
            await user.save();
            
            // 2. Tell user to wait
            await editOrSend(bot, chatId, msgId, __("deposit.admin_notified"), { reply_markup: undefined });
            
            // 3. Send main menu (using your new logic)
            const mainMenuText = __("main_menu_title", from.first_name);
            await bot.sendMessage(chatId, mainMenuText, {
                reply_markup: getMainMenuKeyboard(user, __)
            });

            // 4. Notify Admin
            if (ADMIN_CHAT_ID) {
                try {
                    i18n.setLocale('en'); // Use admin's language
                    const admin__ = i18n.__;
                    const notifyText = admin__("deposit.notify_admin", 
                        tx.User.firstName || 'N/A', 
                        tx.User.telegramId, 
                        toFixedSafe(tx.amount),
                        tx.id
                    );
                    const adminKeyboard = getAdminDepositReviewKeyboard(tx.id, admin__);
                    await bot.sendMessage(ADMIN_CHAT_ID, notifyText, {
                        reply_markup: adminKeyboard
                    });
                } catch (adminError) {
                    console.error("Failed to notify admin of deposit:", adminError.message);
                }
            } else {
                console.warn("ADMIN_CHAT_ID is not set. Cannot notify admin for deposit.");
            }
        }
        // --- END OF FIX ---
        
        // --- Withdraw (Step 1) ---
        else if (data === 'withdraw') {
            
            const bonus = user.bonusBalance || 0;
            if (bonus > 0) {
                const activeInvestments = await Investment.count({
                    where: { userId: user.id, status: 'running' }
                });

                if (activeInvestments > 0) {
                    user.mainBalance = (user.mainBalance || 0) + bonus;
                    user.bonusBalance = 0;
                    await user.save();
                    
                    await bot.sendMessage(chatId, __("bonus_unlocked", toFixedSafe(bonus)));
                }
            }
            
            const mainBalance = user.mainBalance || 0;
            const minWithdrawalText = toFixedSafe(MIN_WITHDRAWAL);
            if (mainBalance < MIN_WITHDRAWAL) { 
                return bot.answerCallbackQuery(callbackQuery.id, __("withdraw.min_error", minWithdrawalText), true);
            }

            if (!user.walletAddress) {
                user.state = 'awaiting_wallet_address';
                await user.save();
                await editOrSend(bot, chatId, msgId, __("withdraw.ask_wallet"), {
                    reply_markup: getCancelKeyboard(user, __) // Pass `__`
                });
            } else {
                user.state = 'awaiting_withdrawal_amount';
                await user.save();
                const balanceText = toFixedSafe(user.mainBalance);
                const networkText = user.walletNetwork ? user.walletNetwork.toUpperCase() : "N/A";
                const text = __("withdraw.ask_amount", 
                    user.walletAddress, 
                    networkText, 
                    __("common.balance", balanceText),
                    minWithdrawalText
                );
                await editOrSend(bot, chatId, msgId, text, {
                    reply_markup: getCancelKeyboard(user, __) // Pass `__`
                });
            }
        }

        // --- Set Withdraw Network (Step 2.5) ---
        else if (data.startsWith('set_network_')) {
            if (user.state !== 'awaiting_wallet_network') {
                 return bot.answerCallbackQuery(callbackQuery.id, "This request has expired.", true);
            }
            const network = data.split('_')[2];
            const wallet = user.stateContext.wallet;
            
            user.walletAddress = wallet;
            user.walletNetwork = network;
            user.state = 'awaiting_withdrawal_amount';
            user.stateContext = {};
            await user.save();
            
            const minWithdrawalText = toFixedSafe(MIN_WITHDRAWAL);
            const text = __("withdraw.wallet_set_success", user.walletAddress, network.toUpperCase(), minWithdrawalText);
            await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getCancelKeyboard(user, __) // Pass `__`
            });
        }
        
        // --- Transaction History ---
        else if (data === 'transactions') {
            const txs = await Transaction.findAll({ 
                where: { userId: user.id }, 
                order: [['createdAt', 'DESC']], 
                limit: 10 
            });
            if (txs.length === 0) {
                return editOrSend(bot, chatId, msgId, __("transactions.no_transactions"), {
                    reply_markup: getBackKeyboard(user, "back_to_balance", __) // Pass `__`
                });
            }
            let text = __("transactions.title") + "\n\n";
            txs.forEach(tx => {
                const date = tx.createdAt.toLocaleDateString('en-GB');
                text += __("transactions.entry", date, tx.type, toFixedSafe(tx.amount), tx.status) + "\n";
            });
            await editOrSend(bot, chatId, msgId, text, {
                reply_markup: getBackKeyboard(user, "back_to_balance", __) // Pass `__`
            });
        }

    } catch (error) {
        console.error("Callback handler error:", error);
        bot.answerCallbackQuery(callbackQuery.id, __("error_generic"), true);
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
};

module.exports = { handleCallback };
