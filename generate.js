/**
 * AI Image Caption Generator Application
 *
 * This script encapsulates all the logic for the AI Image Caption Generator tool
 * into a single 'app' object to avoid polluting the global namespace.
 * It handles UI interactions, internationalization (i18n), and API calls to Gemini.
 *
 * @author Gemini
 * @version 2.0
 */
const app = {
    // --- CONFIGURATION ---
    config: {
        // IMPORTANT: API_KEY is REMOVED from the frontend for security.
        // It should be handled by a backend proxy (like a Cloudflare Worker).
        // This URL should point to your proxy.
        API_URL: "https://imgcaption-com.shaoneng-wu.workers.dev", // <-- Replace with your actual Cloudflare Worker URL
        FLAGS: { en: '🇺🇸', es: '🇪🇸', pt: '🇧🇷', ru: '🇷🇺', de: '🇩🇪', fr: '🇫🇷', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳' },
    },

    // --- APPLICATION STATE ---
    state: {
        promptTemplate: '',
        translations: {},
        imageFile: null,
        imageBase64: null,
        currentLang: 'zh',
    },

    // --- DOM ELEMENT CACHE ---
    dom: {},

    /**
     * Initializes the application.
     * Fetches required resources, caches DOM elements, and binds event listeners.
     */
    async init() {
        this.cacheDom();
        
        // Load external resources in parallel for faster startup
        await Promise.all([
            this.loadTranslations(),
            this.loadPromptTemplate()
        ]);
        
        this.bindEvents();
        this.initializeLangSwitcher();

        const urlParams = new URLSearchParams(window.location.search);
        this.state.currentLang = urlParams.get('lang') || 'zh';
        this.setLanguage(this.state.currentLang);
        
        this.dom.footerYear.textContent = new Date().getFullYear();
    },

    /**
     * Caches frequently accessed DOM elements.
     */
    cacheDom() {
        this.dom = {
            dropArea: document.getElementById('drop-area'),
            fileInput: document.getElementById('file-input'),
            uploadContainer: document.getElementById('upload-container'),
            previewContainer: document.getElementById('preview-container'),
            imagePreview: document.getElementById('image-preview'),
            resetBtn: document.getElementById('reset-btn'),
            extraPrompt: document.getElementById('extra-prompt'),
            charCounter: document.getElementById('char-counter'),
            generateBtn: document.getElementById('generate-btn'),
            loadingContainer: document.getElementById('loading-container'),
            resultContainer: document.getElementById('result-container'),
            resultText: document.getElementById('result-text'),
            copyBtn: document.getElementById('copy-btn'),
            copyIcon: document.getElementById('copy-icon'),
            copySuccessIcon: document.getElementById('copy-success-icon'),
            errorToast: document.getElementById('error-toast'),
            errorMessage: document.getElementById('error-message'),
            languageSelect: document.getElementById('language-select'),
            toneSelect: document.getElementById('tone-select'),
            langSwitcherBtn: document.getElementById('lang-switcher-btn'),
            langSwitcherMenu: document.getElementById('lang-switcher-menu'),
            currentLangFlag: document.getElementById('current-lang-flag'),
            footerYear: document.getElementById('footer-year'),
        };
    },

    /**
     * Binds all necessary event listeners.
     */
    bindEvents() {
        this.dom.dropArea.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        // Drag and drop events
        const dragEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
        dragEvents.forEach(eventName => {
            this.dom.dropArea.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        this.dom.dropArea.addEventListener('dragenter', () => this.dom.dropArea.classList.add('drag-over'));
        this.dom.dropArea.addEventListener('dragleave', () => this.dom.dropArea.classList.remove('drag-over'));
        this.dom.dropArea.addEventListener('drop', (e) => {
            this.dom.dropArea.classList.remove('drag-over');
            this.handleFile(e.dataTransfer.files[0]);
        });

        this.dom.resetBtn.addEventListener('click', () => this.resetUI());
        this.dom.extraPrompt.addEventListener('input', () => {
            this.dom.charCounter.textContent = `${this.dom.extraPrompt.value.length} / 128`;
        });
        this.dom.copyBtn.addEventListener('click', () => this.copyResultToClipboard());
        this.dom.generateBtn.addEventListener('click', () => this.handleGenerate());
    },

    // --- RESOURCE LOADING ---

    async loadTranslations() {
        try {
            const response = await fetch('translations.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.state.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations:', error);
            this.state.translations = {
                en: { errorGeneric: "An unexpected error occurred.", errorAPI: "AI is on strike.", errorFormat: "Unsupported file format." },
                zh: { errorGeneric: "发生未知错误。", errorAPI: "AI 罢工了。", errorFormat: "不支持的文件格式。" }
            };
        }
    },

    async loadPromptTemplate() {
        try {
            const response = await fetch('prompt.txt');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.state.promptTemplate = await response.text();
        } catch (error) {
            console.error('Failed to load prompt template:', error);
            this.state.promptTemplate = `You are a social media expert. Your task is to generate a single, concise sentence for the following image. Do not provide multiple options. Language: {{lang}}. Tone: {{tone}}. {{extra_instructions}}. The output must be only one sentence.`;
        }
    },

    // --- I18N & UI POPULATION ---

    setLanguage(lang) {
        this.state.currentLang = (this.state.translations && this.state.translations[lang]) ? lang : "zh";
        const translationData = this.state.translations[this.state.currentLang];

        document.querySelectorAll("[data-lang-key]").forEach(elem => {
            const key = elem.getAttribute("data-lang-key");
            if (translationData[key]) {
                 elem.innerHTML = translationData[key];
            }
        });
        
        document.title = translationData.pageTitle || "AI Image Caption Generator";
        document.documentElement.lang = this.state.currentLang;
        this.dom.currentLangFlag.textContent = this.config.FLAGS[this.state.currentLang];
        this.dom.langSwitcherMenu.classList.add("hidden", "opacity-0", "scale-95");
        
        this.populateLanguageSelector();
        this.populateToneSelector();
        this.updateNavLinks();
    },

    populateLanguageSelector() {
    const translationData = this.state.translations[this.state.currentLang];
    // 如果在当前语言配置中找不到 languageOptions，则回退使用英文的配置
    const languageOptions = translationData.languageOptions || (this.state.translations.en && this.state.translations.en.languageOptions) || {};
    this.dom.languageSelect.innerHTML = '';
    for (const [value, text] of Object.entries(languageOptions)) {
        const option = new Option(text, value);
        this.dom.languageSelect.add(option);
        }
    },

    populateToneSelector() {
        const translationData = this.state.translations[this.state.currentLang];
        const toneKeys = Object.keys(translationData).filter(key => key.startsWith('tone') && key !== 'toneLabel');
        this.dom.toneSelect.innerHTML = '';
        toneKeys.forEach(key => {
            const value = key.charAt(4).toUpperCase() + key.slice(5);
            const option = new Option(translationData[key], value);
            this.dom.toneSelect.add(option);
        });
    },

    initializeLangSwitcher() {
    const langNames = {en: "English",es: "Spanish",pt: "Portuguese",ru: "Russian",de: "German",fr: "French",
    ja: "Japanese",ko: "Korean",zh: "中文 (简体)"}; // 同时修复了之前提到的日语 key 的拼写错误
    
    let menuHtml = `<div class='py-1' role='menu'>`;
    for (const code in this.config.FLAGS) {
        menuHtml += `<a href="#" class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem" data-lang="${code}"><span class="mr-3">${this.config.FLAGS[code]}</span> ${langNames[code]}</a>`;
    }
    menuHtml += `</div>`;
    this.dom.langSwitcherMenu.innerHTML = menuHtml;

    const menu = this.dom.langSwitcherMenu;

    // 修复后的按钮点击事件
    this.dom.langSwitcherBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // 阻止事件冒泡，以免被 document 的点击事件立即捕获
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden');
            // 需要一个短暂的延时，以确保浏览器在开始CSS过渡动画之前已应用 display 属性
            setTimeout(() => {
                menu.classList.remove('opacity-0', 'scale-95');
            }, 10);
        } else {
            menu.classList.add('opacity-0', 'scale-95');
            // 等待动画（0.2秒）结束后再添加 hidden 类 (display: none)
            setTimeout(() => {
                menu.classList.add('hidden');
            }, 200);
        }
    });

    // 修复后的“点击外部”关闭菜单的事件
    document.addEventListener("click", () => {
        if (!menu.classList.contains('hidden')) {
             menu.classList.add('opacity-0', 'scale-95');
             setTimeout(() => {
                menu.classList.add('hidden');
            }, 200);
        }
    });

    // 为菜单项添加点击事件
    menu.addEventListener("click", e => {
        e.preventDefault();
        const link = e.target.closest("a");
        if (link && link.dataset.lang) {
            this.setLanguage(link.dataset.lang);
            const url = new URL(window.location);
            url.searchParams.set("lang", link.dataset.lang);
            window.history.pushState({}, "", url);
            // setLanguage 函数会自动关闭菜单
        }
    });
},
    
    updateNavLinks() {
        document.querySelectorAll(".nav-link").forEach(link => {
            const originalHref = link.getAttribute("href").split("?")[0];
            link.setAttribute("href", `${originalHref}?lang=${this.state.currentLang}`);
        });
    },

    // --- CORE APP LOGIC ---

    handleFile(file) {
        if (!file) return;
        const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic'];
        if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.imageFile = file;
                this.state.imageBase64 = e.target.result.split(',')[1];
                this.dom.imagePreview.src = e.target.result;
                this.dom.uploadContainer.classList.add('hidden');
                this.dom.previewContainer.classList.remove('hidden');
                this.dom.generateBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        } else {
            this.showError('errorFormat');
        }
    },

    async handleGenerate() {
        if (!this.state.imageBase64 || !this.state.promptTemplate) return;

        this.dom.loadingContainer.classList.remove('hidden');
        this.dom.resultContainer.classList.add('hidden');
        this.dom.generateBtn.disabled = true;

        const lang = this.dom.languageSelect.value;
        const tone = this.dom.toneSelect.value;
        const extra = this.dom.extraPrompt.value;
        
        const extraInstructions = extra ? `Additional instructions: ${extra}` : '';
        const prompt = this.state.promptTemplate
            .replace('{{lang}}', lang)
            .replace('{{tone}}', tone)
            .replace('{{extra_instructions}}', extraInstructions.trim());

        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }, { inlineData: { mimeType: this.state.imageFile.type, data: this.state.imageBase64 } }]
            }],
        };

        try {
            const response = await fetch(this.config.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            
            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                this.dom.resultText.textContent = text.trim();
                this.dom.resultContainer.classList.remove('hidden');
            } else {
                console.error("Unexpected API response structure:", result);
                this.showError('errorAPI');
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            this.showError('errorAPI');
        } finally {
            this.dom.loadingContainer.classList.add('hidden');
            this.dom.generateBtn.disabled = false;
        }
    },

    // --- UI HELPERS ---

    resetUI() {
        this.state.imageFile = null;
        this.state.imageBase64 = null;
        this.dom.fileInput.value = '';
        this.dom.uploadContainer.classList.remove('hidden');
        this.dom.previewContainer.classList.add('hidden');
        this.dom.generateBtn.disabled = true;
        this.dom.resultContainer.classList.add('hidden');
        this.dom.loadingContainer.classList.add('hidden');
        this.dom.resultText.textContent = '';
    },

    showError(messageKey) {
        const errorMessages = this.state.translations[this.state.currentLang] || this.state.translations.zh;
        this.dom.errorMessage.textContent = errorMessages[messageKey] || errorMessages['errorGeneric'];
        this.dom.errorToast.classList.remove('hidden');
        setTimeout(() => {
            this.dom.errorToast.classList.add('hidden');
        }, 3000);
    },

    copyResultToClipboard() {
        try {
            navigator.clipboard.writeText(this.dom.resultText.textContent).then(() => {
                this.dom.copyIcon.classList.add('hidden');
                this.dom.copySuccessIcon.classList.remove('hidden');
                setTimeout(() => {
                    this.dom.copyIcon.classList.remove('hidden');
                    this.dom.copySuccessIcon.classList.add('hidden');
                }, 2000);
            });
        } catch (err) {
            console.error('Failed to copy text using navigator.clipboard: ', err);
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = this.dom.resultText.textContent;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.dom.copyIcon.classList.add('hidden');
                this.dom.copySuccessIcon.classList.remove('hidden');
                setTimeout(() => {
                    this.dom.copyIcon.classList.remove('hidden');
                    this.dom.copySuccessIcon.classList.add('hidden');
                }, 2000);
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }
            document.body.removeChild(textArea);
        }
    },
};

// --- APPLICATION ENTRY POINT ---
document.addEventListener("DOMContentLoaded", () => {
    app.init();
});
