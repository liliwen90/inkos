// llm-manager.js - LLM API调用管理
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class LLMManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/llm-config.json');
        this.config = this._loadConfig();
    }

    _loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        } catch (e) {
            return { providers: {}, taskRouting: {} };
        }
    }

    reloadConfig() {
        this.config = this._loadConfig();
    }

    saveConfig(config) {
        this.config = config;
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    getProviderForTask(taskType) {
        const routing = this.config.taskRouting || {};
        const route = routing[taskType];

        if (route && route.apiKey && route.baseUrl && route.model) {
            return {
                type: 'openai',
                apiKey: route.apiKey,
                baseUrl: route.baseUrl,
                model: route.model,
                temperature: 0.7
            };
        }

        const currentId = this.config.currentProvider || 'custom_openai';
        const provider = this.config.providers[currentId];
        if (provider) return provider;

        return null;
    }

    async callLLM(messages, taskType, options = {}) {
        const provider = this.getProviderForTask(taskType);
        if (!provider) throw new Error('未配置LLM提供商');

        const maxRetries = 2;
        const retryDelay = 10000;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (provider.type === 'ollama') {
                    return await this.callOllama(provider, messages, options);
                } else {
                    return await this.callOpenAI(provider, messages, options);
                }
            } catch (error) {
                const isRetryable = error.code === 'ECONNABORTED' ||
                    error.code === 'ETIMEDOUT' ||
                    (error.response && error.response.status >= 500);

                if (attempt < maxRetries && isRetryable) {
                    console.log(`LLM调用失败 (${attempt + 1}/${maxRetries})，${retryDelay / 1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    throw error;
                }
            }
        }
    }

    async callOpenAI(provider, messages, options = {}) {
        const url = `${provider.baseUrl}/chat/completions`;
        const temperature = options.temperature || provider.temperature || 0.7;

        const axiosOptions = {
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 300000 // 5分钟超时
        };
        if (options.signal) {
            axiosOptions.signal = options.signal;
        }

        const response = await axios.post(url, {
            model: provider.model,
            messages: messages,
            temperature: temperature,
            max_tokens: options.max_tokens || 8192
        }, axiosOptions);

        return response.data.choices[0].message.content;
    }

    async callOllama(provider, messages, options = {}) {
        const url = `${provider.baseUrl || 'http://localhost:11434'}/api/chat`;

        const axiosOptions = {
            timeout: 600000 // 10分钟超时
        };
        if (options.signal) {
            axiosOptions.signal = options.signal;
        }

        const response = await axios.post(url, {
            model: provider.model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature || provider.temperature || 0.7
            }
        }, axiosOptions);

        return response.data.message.content;
    }

    async healthCheck(provider) {
        try {
            if (provider.type === 'ollama') {
                const url = `${provider.baseUrl || 'http://localhost:11434'}/api/tags`;
                const response = await axios.get(url, { timeout: 10000 });
                return { success: true, models: response.data.models };
            } else {
                const url = `${provider.baseUrl}/models`;
                const response = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${provider.apiKey}` },
                    timeout: 10000
                });
                return { success: true };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

// 单例导出 — 所有模块共用同一个实例，避免重复读配置
let _instance = null;
module.exports = {
    getInstance() {
        if (!_instance) _instance = new LLMManager();
        return _instance;
    },
    LLMManager
};
