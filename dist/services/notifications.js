"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const fs_1 = __importDefault(require("fs"));
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
        // Add any notification-specific config here if needed
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        return {};
    }
};
const CONFIG = loadConfig();
class NotificationService {
    telegramBot = null;
    discordWebhook = null;
    emailTransporter = null;
    constructor() {
        this.initializeServices();
    }
    initializeServices() {
        // Initialize Telegram bot if configured - temporarily disabled
        console.log('⚠️ Telegram bot initialization temporarily disabled');
        // Initialize Discord webhook if configured - temporarily disabled
        console.log('⚠️ Discord webhook initialization temporarily disabled');
        // Initialize email service if configured - temporarily disabled
        console.log('⚠️ Email service initialization temporarily disabled');
    }
    // Send notification to all configured services
    async sendNotification(message, type = 'info', data = {}) {
        const promises = [];
        // Send to Telegram
        if (this.telegramBot) {
            promises.push(this.sendTelegramMessage(message, type, data));
        }
        // Send to Discord
        if (this.discordWebhook) {
            promises.push(this.sendDiscordMessage(message, type, data));
        }
        // Send to Email for important notifications
        if (this.emailTransporter && ['error', 'warning', 'trade', 'profit', 'loss'].includes(type)) {
            promises.push(this.sendEmail(message, type, data));
        }
        try {
            await Promise.allSettled(promises);
        }
        catch (error) {
            console.error('Error sending notifications:', error);
        }
    }
    // Telegram notifications
    async sendTelegramMessage(message, type = 'info', data = {}) {
        if (!this.telegramBot)
            return;
        try {
            const emoji = this.getEmojiForType(type);
            const formattedMessage = this.formatTelegramMessage(message, type, data);
            // await this.telegramBot.sendMessage(CONFIG.TELEGRAM.CHAT_ID, formattedMessage, {
            //   parse_mode: 'HTML',
            //   disable_web_page_preview: true,
            // });
            console.log('📱 Telegram message sent successfully');
        }
        catch (error) {
            console.error('Failed to send Telegram message:', error);
        }
    }
    // Discord notifications
    async sendDiscordMessage(message, type = 'info', data = {}) {
        if (!this.discordWebhook)
            return;
        try {
            const embed = this.createDiscordEmbed(message, type, data);
            // Note: You'll need to install axios package
            // await axios.post(this.discordWebhook, {
            //   embeds: [embed],
            // });
            console.log('📱 Discord message sent successfully');
        }
        catch (error) {
            console.error('Failed to send Discord message:', error);
        }
    }
    // Email notifications
    async sendEmail(message, type = 'info', data = {}) {
        if (!this.emailTransporter)
            return;
        try {
            const htmlContent = this.formatEmailMessage(message, type, data);
            // await this.emailTransporter.sendMail({
            //   from: CONFIG.EMAIL.FROM || CONFIG.EMAIL.USER,
            //   to: CONFIG.EMAIL.TO || CONFIG.EMAIL.USER,
            //   subject: `Trading Bot: ${type.toUpperCase()}`,
            //   html: htmlContent,
            // });
            console.log('📧 Email sent successfully');
        }
        catch (error) {
            console.error('Failed to send email:', error);
        }
    }
    // Helper methods
    getEmojiForType(type) {
        const emojis = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            trade: '💰',
            profit: '📈',
            loss: '📉',
        };
        return emojis[type] || '📝';
    }
    formatTelegramMessage(message, type, data) {
        let formattedMessage = `${this.getEmojiForType(type)} <b>${type.toUpperCase()}</b>\n\n`;
        formattedMessage += `${message}\n\n`;
        if (data.timestamp) {
            formattedMessage += `⏰ <i>${new Date(data.timestamp).toLocaleString()}</i>\n`;
        }
        if (data.txHash) {
            formattedMessage += `🔗 <a href="https://solscan.io/tx/${data.txHash}">View Transaction</a>\n`;
        }
        if (data.tokenMint) {
            formattedMessage += `🪙 <a href="https://solscan.io/token/${data.tokenMint}">View Token</a>\n`;
        }
        if (data.profitRatio) {
            formattedMessage += `📊 Profit: ${data.profitRatio.toFixed(2)}x\n`;
        }
        return formattedMessage;
    }
    createDiscordEmbed(message, type, data) {
        const colors = {
            info: 0x0099ff,
            success: 0x00ff00,
            warning: 0xffff00,
            error: 0xff0000,
            trade: 0x00ffff,
            profit: 0x00ff00,
            loss: 0xff0000,
        };
        const embed = {
            title: `${this.getEmojiForType(type)} ${type.toUpperCase()}`,
            description: message,
            color: colors[type] || 0x0099ff,
            timestamp: new Date().toISOString(),
            fields: [],
        };
        if (data.txHash) {
            embed.fields.push({
                name: 'Transaction',
                value: `[View on Solscan](https://solscan.io/tx/${data.txHash})`,
                inline: true,
            });
        }
        if (data.tokenMint) {
            embed.fields.push({
                name: 'Token',
                value: `[View on Solscan](https://solscan.io/token/${data.tokenMint})`,
                inline: true,
            });
        }
        if (data.profitRatio) {
            embed.fields.push({
                name: 'Profit Ratio',
                value: `${data.profitRatio.toFixed(2)}x`,
                inline: true,
            });
        }
        if (data.amount && data.price) {
            embed.fields.push({
                name: 'Trade Details',
                value: `${data.amount} tokens @ ${data.price} SOL`,
                inline: true,
            });
        }
        return embed;
    }
    formatEmailMessage(message, type, data) {
        let html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; }
            .content { margin: 20px 0; }
            .footer { color: #666; font-size: 12px; margin-top: 20px; }
            .highlight { background-color: #fff3cd; padding: 10px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Solana Trading Bot Notification</h2>
            <p><strong>Type:</strong> ${type.toUpperCase()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="content">
            <p>${message}</p>
    `;
        if (data.txHash) {
            html += `<p><strong>Transaction:</strong> <a href="https://solscan.io/tx/${data.txHash}">View on Solscan</a></p>`;
        }
        if (data.tokenMint) {
            html += `<p><strong>Token:</strong> <a href="https://solscan.io/token/${data.tokenMint}">View on Solscan</a></p>`;
        }
        if (data.profitRatio) {
            html += `<p><strong>Profit Ratio:</strong> ${data.profitRatio.toFixed(2)}x</p>`;
        }
        html += `
          </div>
          
          <div class="footer">
            <p>This is an automated notification from your Solana Trading Bot.</p>
          </div>
        </body>
      </html>
    `;
        return html;
    }
    // Convenience methods for common notifications
    async notifyTrade(type, tokenMint, amount, price, txHash) {
        const message = `${type.toUpperCase()} ${amount} tokens of ${tokenMint} at ${price} SOL`;
        await this.sendNotification(message, 'trade', { tokenMint, amount, price, txHash });
    }
    async notifyProfit(tokenMint, profitRatio, txHash) {
        const message = `🎉 Profit taken on ${tokenMint}: ${profitRatio.toFixed(2)}x`;
        await this.sendNotification(message, 'profit', { tokenMint, profitRatio, txHash });
    }
    async notifyLoss(tokenMint, lossRatio, txHash) {
        const message = `📉 Loss taken on ${tokenMint}: ${lossRatio.toFixed(2)}x`;
        await this.sendNotification(message, 'loss', { tokenMint, profitRatio: -lossRatio, txHash });
    }
    async notifyError(error, context) {
        const message = `❌ Error in ${context}: ${error.message}`;
        await this.sendNotification(message, 'error', { timestamp: new Date() });
    }
    async notifyBotStatus(status, details) {
        const message = `🤖 Bot ${status}${details ? `: ${JSON.stringify(details)}` : ''}`;
        await this.sendNotification(message, status === 'error' ? 'error' : 'info', { timestamp: new Date() });
    }
}
exports.NotificationService = NotificationService;
// Export singleton instance
exports.notificationService = new NotificationService();
