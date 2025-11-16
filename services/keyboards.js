const i18n = require('../services/i18n');

// --- THIS IS THE FIX ---
// This function is no longer used globally.
// We will pass the user and `__` function to each keyboard.
// --- END OF FIX ---

const getLanguageKeyboard = () => {
    return {
        inline_keyboard: [
            [{ text: "🇺🇸 English", callback_data: "set_lang_en" }, { text: "🇷🇺 Русский", callback_data: "set_lang_ru" }],
            [{ text: "🇪🇸 Español", callback_data: "set_lang_es" }, { text: "🇫🇷 Français", callback_data: "set_lang_fr" }],
            [{ text: "🇮🇩 Bahasa Indonesia", callback_data: "set_lang_id" }, { text: "🇧🇩 বাংলা", callback_data: "set_lang_bn" }],
            [{ text: "🇮🇳 हिंदी", callback_data: "set_lang_hi" }]
        ]
    };
};

// --- THIS IS THE FIX ---
// Accept `__` (language function) as an argument
const getMainMenuKeyboard = (user, __) => {
// --- END OF FIX ---
    return {
        keyboard: [
            [{ text: __('menu.make_investment') }],
            [{ text: __('menu.my_investments') }, { text: __('menu.my_balance') }],
            [{ text: __('menu.referral_program') }, { text: __('menu.faq') }],
            [{ text: __('menu.support') }, { text: __('menu.change_language') }]
        ],
        resize_keyboard: true
    };
};

const getBalanceKeyboard = (user, __) => {
    return {
        inline_keyboard: [
            [{ text: __('balance.deposit'), callback_data: "deposit" }, { text: __('balance.withdraw'), callback_data: "withdraw" }],
            [{ text: __('balance.transactions'), callback_data: "transactions" }]
        ]
    };
};

const getInvestmentPlansKeyboard = (user, __) => {
    return {
        inline_keyboard: [
            [{ text: __('plans.plan_1_button'), callback_data: "invest_plan_1" }, { text: __('plans.plan_2_button'), callback_data: "invest_plan_2" }],
            [{ text: __('plans.plan_3_button'), callback_data: "invest_plan_3" }, { text: __('plans.plan_4_button'), callback_data: "invest_plan_4" }],
            [{ text: __('plans.plan_5_button'), callback_data: "invest_plan_5" }],
            [{ text: __('common.back'), callback_data: "back_to_main" }]
        ]
    };
};

const getWithdrawNetworkKeyboard = (user, __) => {
    return {
         inline_keyboard: [
            [{ text: "TRC20 (Tron)", callback_data: "set_network_trc20" }, { text: "BEP20 (BSC)", callback_data: "set_network_bep20" }],
            [{ text: __('common.cancel'), callback_data: "cancel_action" }]
        ]
    };
};

const getCancelKeyboard = (user, __) => {
    return {
        inline_keyboard: [
            [{ text: __('common.cancel'), callback_data: "cancel_action" }]
        ]
    };
};

const getBackKeyboard = (user, callback_data = "back_to_main", __) => {
    return {
        inline_keyboard: [
            [{ text: __('common.back'), callback_data: callback_data }]
        ]
    };
};

const getMakeInvestmentButton = (user, __) => {
    return {
        inline_keyboard: [
            [{ text: __('menu.make_investment'), callback_data: "show_invest_plans" }]
        ]
    };
}

const getAdminReviewKeyboard = (transactionId, i18nInstance) => {
    const __ = i18nInstance; // This one is correct, it uses the admin's language
    return {
        inline_keyboard: [
            [
                { text: __("withdraw.admin_approve"), callback_data: `admin_approve_${transactionId}` },
                { text: __("withdraw.admin_reject"), callback_data: `admin_reject_${transactionId}` }
            ]
        ]
    };
};

module.exports = {
    getLanguageKeyboard,
    getMainMenuKeyboard,
    getBalanceKeyboard,
    getInvestmentPlansKeyboard,
    getWithdrawNetworkKeyboard,
    getCancelKeyboard,
    getBackKeyboard,
    getMakeInvestmentButton,
    getAdminReviewKeyboard
};
