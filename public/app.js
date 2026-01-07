// FarmerPanel App v9.12.37 - Fix Scan All stats calculation
// - Removed slow avatar lookups from GET /api/sync (was loading ALL avatars from DB)
// - Removed Roblox API calls from GET request (only done on POST sync from script)
// - GET sync now does single DB query instead of N+1 queries
// API Base URL - auto-detect for local dev or production
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : '/api';

// Brainrot images base URL
const BRAINROT_IMAGES_BASE = window.location.origin + '/brainrots';

// ============ LOCALIZATION SYSTEM (i18n) ============
const SUPPORTED_LANGUAGES = ['en', 'ru'];
const DEFAULT_LANGUAGE = 'en';

const i18n = {
    en: {
        // Navigation
        nav_dashboard: 'Dashboard',
        nav_collection: 'Collection',
        nav_offers: 'Offers',
        nav_top: 'Top',
        nav_accounts: 'Accounts',
        nav_farm_keys: 'Farm Keys',
        logout: 'Logout',
        settings: 'Settings',
        switch_account: 'Switch Account',
        
        // Stats
        total_accounts: 'Total Accounts',
        total_brainrots: 'Total Brainrots',
        est_value: 'Est. Value',
        combined_income: 'Combined Income',
        online: 'Online',
        active_farmers: 'Active Farmers',
        
        // Balance Chart
        balance_history: 'Balance History',
        collecting_data: 'Collecting data...',
        change_for: 'Change for',
        period_5min: '5 minutes',
        period_hour: 'hour',
        period_day: 'day',
        period_week: 'week',
        period_month: 'month',
        
        // Collection filters
        all_brainrots: 'All Brainrots',
        search_placeholder: 'Search by name or income (e.g. 100, >50, <200)...',
        refresh_prices: 'Refresh Prices',
        refresh_prices_title: 'Refresh prices from Eldorado',
        suggested: 'Suggested',
        suggested_default: 'Suggested (Default)',
        income_high_low: 'Income: High to Low',
        income_low_high: 'Income: Low to High',
        price_high_low: 'Price: High to Low',
        price_low_high: 'Price: Low to High',
        name_az: 'Name: A-Z',
        name_za: 'Name: Z-A',
        by_account: 'By Account',
        all_prices: 'All Prices',
        has_price: 'Has Price',
        no_price: 'No Price',
        under_1: 'Under $1',
        over_25: 'Over $25',
        all_mutations: 'All Mutations',
        no_mutation: 'No Mutation',
        any_mutation: 'Any Mutation',
        all_status: 'All Status',
        listed: 'Listed',
        not_listed: 'Not Listed',
        total: 'total',
        unique: 'unique',
        
        // Leaderboards
        leaderboards: 'Leaderboards',
        best_income_brainrot: 'Best Income Brainrot',
        most_valuable_brainrot: 'Most Valuable Brainrot',
        total_panel_income: 'Total Panel Income',
        all_accounts: 'All Accounts',
        
        // Farm Keys
        saved_farm_keys: 'Saved Farm Keys',
        add_key: 'Add Key',
        add_farm_key: 'Add Farm Key',
        cancel: 'Cancel',
        
        // Offers page
        eldorado_offers: 'Eldorado Offers',
        refresh: 'Refresh',
        cron_timer_tooltip: 'Time until next automatic update of prices and your offers',
        your_shop: 'Your Shop:',
        not_configured: 'Not configured',
        edit_shop_name: 'Edit shop name',
        generator_settings: 'Generator settings',
        configure_shop_hint: 'Configure your shop name to create offers',
        universal_tracking: 'Universal Tracking System:',
        universal_tracking_desc: 'Codes are auto-generated when you create offers through the panel. The scanner automatically detects and tracks your offers on Eldorado.',
        select_all: 'Select All',
        adjust_selected: 'Adjust Selected',
        delete_selected: 'Delete Selected',
        search_offers_placeholder: 'Search offers by name or code...',
        newest_first: 'Newest First',
        oldest_first: 'Oldest First',
        diff_high_low: 'Diff %: High to Low',
        diff_low_high: 'Diff %: Low to High',
        all_offers: 'All Offers',
        active_on_eldorado: 'Active (on Eldorado)',
        pending_not_found: 'Pending (not found yet)',
        paused: 'Paused',
        needs_price_update: 'Needs Price Update',
        in_stock: 'In Stock (have in collection)',
        out_of_stock: 'Out of Stock (0 in collection)',
        scan_all: 'Scan All',
        scan_all_title: 'Scan all Eldorado offers and match codes',
        
        // Offer card buttons
        adjust_price: 'Adjust Price',
        delete: 'Delete',
        auto_delete_in: 'Auto-delete in',
        
        // Bulk Price Adjustment Modal
        bulk_price_adjustment: 'Bulk Price Adjustment',
        recommended: 'Recommended',
        market_based_price: 'Market-based optimal price',
        median_from_competitor: 'Median from competitor page',
        next_competitor_price: 'Price of next competitor',
        custom: 'Custom',
        individual_prices: 'Individual prices',
        apply_changes: 'Apply Changes',
        offers: 'offers',
        
        // Single Offer Price Modal
        adjust_offer_price: 'Adjust Offer Price',
        custom_price: 'Custom Price:',
        current: 'current',
        update_on_eldorado: 'Update on Eldorado',
        
        // Mass Generation Modal
        mass_generation: 'Mass Generation',
        price_type_for_all: 'Price type for all:',
        individual: 'Individual',
        download_all: 'Download All',
        post_to_eldorado: 'Post to Eldorado',
        mass_gen_footer: 'After generation click "Post to Eldorado" to create offers',
        generate: 'Generate',
        
        // Shop Name Modal
        configure_shop_name: 'Configure Shop Name',
        shop_name_desc: 'Your shop name appears in offer titles and descriptions on Eldorado. Format: Emoji + Name + Emoji',
        left_emoji: 'Left Emoji',
        shop_name: 'Shop Name',
        right_emoji: 'Right Emoji',
        use_same_emoji: 'Use same emoji on both sides',
        preview: 'Preview:',
        save_shop_name: 'Save Shop Name',
        
        // Generator Settings Modal
        generator_settings_title: 'Generator Settings',
        generator_settings_desc: 'Configure your image generator template. Leave empty to use the default template.',
        supa_template_id: 'Supa Template ID',
        template_hint: 'Enter your custom Supa.ru template ID or leave empty for default',
        save_settings: 'Save Settings',
        
        // Emoji Picker
        select_emoji: 'Select Emoji',
        search_emoji: 'Search emoji...',
        
        // Mass select
        mass_select_title: 'Mass selection for generation',
        exit_selection_mode: 'Exit selection mode',
        selected: 'Selected:',
        
        // Settings
        settings_title: 'Settings',
        language: 'Language',
        theme: 'Theme',
        theme_dark: 'Dark',
        theme_light: 'Light', 
        theme_purple: 'Purple',
        theme_green: 'Green',
        theme_changed: 'Theme changed',
        
        // Login
        login_subtitle: 'Enter your farm key to access the panel',
        access_panel: 'Access Panel',
        login_footer: 'Your farm key is generated by the farm script',
        
        // Loading
        loading_data: 'Loading your farm data...',
        
        // Misc & Tooltips
        median: 'Median',
        next_competitor: 'Next Competitor',
        default: 'DEFAULT',
        save: 'Save',
        close: 'Close',
        edit_username: 'Edit Username',
        enter_new_username: 'Enter new username',
        username_hint: '3-20 characters, letters, numbers and underscore only',
        
        // Price labels
        current_price: 'Current Price',
        recommended_price: 'Recommended',
        recommended_old: 'Recommended (old)',
        ai_validated: 'AI validated price from next M/s range',
        price_next_range: 'Price from next M/s range',
        ai_tooltip: 'AI',
        ai_determined: 'Price determined by AI',
        ai_next_range_tooltip: 'AI + Next Range',
        next_range_tooltip: 'Next Range',
        hybrid_tooltip: 'AI + Regex hybrid',
        median_not_available: 'Median not available',
        has_brainrots_in_collection: 'in collection',
        no_brainrots_in_collection: 'No brainrots in collection',
        will_be_deleted_soon: 'Will be deleted soon',
        add_offer_id_hint: 'Add #{id} to your Eldorado offer title',
        
        // Stats labels
        total_offers: 'total',
        paused_offers: 'paused',
        need_update: 'need update',
        selected_offers: 'selected',
        
        // Time ago
        just_now: 'Just now',
        minutes_ago: 'm ago',
        hours_ago: 'h ago',
        days_ago: 'd ago',
        
        // Account cards
        brainrots: 'Brainrots',
        value: 'Value',
        income_label: 'INCOME',
        brainrots_label: 'BRAINROTS',
        value_label: 'VALUE',
        no_accounts: 'No accounts',
        no_brainrots_yet: 'No brainrots yet',
        online_status: 'Online',
        offline_status: 'Offline',
        
        // Farm keys
        accounts_label: 'accounts',
        value_lower: 'value',
        active_status: 'Active',
        select_btn: 'Select',
        
        // Notifications
        key_copied: 'Key copied to clipboard!',
        key_copy_failed: 'Failed to copy key',
        language_changed_en: 'Language changed to English',
        language_changed_ru: 'Язык изменён на русский',
        switched_to_account: 'Switched to',
        farmer_deleted: 'Farmer deleted successfully',
        farmer_delete_failed: 'Failed to delete farmer',
        max_selection: 'Maximum brainrots for mass generation:',
        generated_success: 'Generated',
        click_post_eldorado: 'Click "Post to Eldorado" to create offers',
        no_images_download: 'No images to download',
        downloaded_images: 'Downloaded images',
        download_error: 'Download error',
        configure_shop_first: 'Please configure your shop name first',
        queue_empty: 'Queue is empty',
        queue_empty_generate: 'Queue is empty. Generate first with "Create queue for Eldorado" enabled',
        queue_started: 'Eldorado queue started',
        offers_updated: 'Offers updated',
        no_farm_key: 'No farm key selected',
        done: 'Done',
        errors_during_generation: 'errors during generation',
        download_error_msg: 'Download error',
        loading_error: 'Loading Error',
        failed_to_load_top: 'Failed to load top data',
        retry: 'Retry',
        no_data_yet: 'No data yet',
        top_description: 'Top is formed from all panel users data',
        
        // Supa Generator
        supa_generator: 'Supa Generator',
        preview: 'Preview',
        account_label: 'Account',
        name_label: 'Name',
        income_form: 'Income',
        image_url: 'Image URL',
        price_variant: 'Price variant',
        price_for_eldorado: 'Price for Eldorado',
        supa_recommended: 'Recommended',
        supa_median: 'Median',
        supa_next_competitor: 'Next Competitor',
        supa_custom: 'Custom price',
        supa_generate: 'Generate',
        supa_download: 'Download (800x800)',
        supa_post_eldorado: 'Post to Eldorado',
        supa_processing: 'Processing...',
        
        // Mass select
        items: 'items',
        generate_n: 'Generate',
        selection_mode: 'Selection mode',
        groups: 'groups',
        
        // Collection empty states
        no_brainrots_found: 'No brainrots found',
        no_matches: 'No matches',
        brainrots_will_appear: 'Brainrots will appear here when accounts have them.',
        try_adjusting_filters: 'Try adjusting your search or filters.',
        shown: 'shown',
        start_farm_hint: 'Start the farm script to see your accounts here.',
        
        // Farm Keys empty state
        no_saved_farm_keys: 'No saved farm keys',
        add_keys_hint: 'Add farm keys to monitor multiple farmers.',
        
        // Offers empty states
        no_offers_yet: 'No offers yet',
        offers_will_appear: 'Offers created via Eldorado will appear here',
        
        // Offer card statuses
        pending_status: 'Pending',
        active_status_offer: 'Active',
        unverified_status: 'Unverified',
        needs_update_status: 'Needs Update',
        
        // Scanning progress
        scanning: 'Scanning...',
        starting: 'Starting...',
        scanning_eldorado: 'Scanning Eldorado...',
        processing_results: 'Processing results...',
        loading_offers: 'Loading offers...',
        no_farm_key_selected: 'No farm key selected',
        no_registered_codes: 'No registered codes found. Scanned {count} offers.',
        
        // Top list
        waiting_for_player: 'Waiting for player...',
        
        // Accounts empty state
        accounts_will_appear: 'Accounts will appear here when the farm script is running.'
    },
    ru: {
        // Navigation
        nav_dashboard: 'Панель',
        nav_collection: 'Коллекция',
        nav_offers: 'Офферы',
        nav_top: 'Топ',
        nav_accounts: 'Аккаунты',
        nav_farm_keys: 'Ключи',
        logout: 'Выход',
        settings: 'Настройки',
        switch_account: 'Сменить аккаунт',
        
        // Stats
        total_accounts: 'Всего аккаунтов',
        total_brainrots: 'Всего брейнротов',
        est_value: 'Ориент. стоим.',
        combined_income: 'Общий доход',
        online: 'Онлайн',
        active_farmers: 'Активные фермеры',
        
        // Balance Chart
        balance_history: 'История баланса',
        collecting_data: 'Сбор данных...',
        change_for: 'Изменение за',
        period_5min: '5 минут',
        period_hour: 'час',
        period_day: 'день',
        period_week: 'неделю',
        period_month: 'месяц',
        
        // Collection filters
        all_brainrots: 'Все брейнроты',
        search_placeholder: 'Поиск по имени или доходу (100, >50, <200)...',
        refresh_prices: 'Обновить цены',
        refresh_prices_title: 'Обновить цены с Eldorado',
        suggested: 'Рекоменд.',
        suggested_default: 'Рекомендуемая (По умолч.)',
        income_high_low: 'Доход: По убыванию',
        income_low_high: 'Доход: По возрастанию',
        price_high_low: 'Цена: По убыванию',
        price_low_high: 'Цена: По возрастанию',
        name_az: 'Имя: А-Я',
        name_za: 'Имя: Я-А',
        by_account: 'По аккаунту',
        all_prices: 'Все цены',
        has_price: 'Есть цена',
        no_price: 'Нет цены',
        under_1: 'До $1',
        over_25: 'Свыше $25',
        all_mutations: 'Все мутации',
        no_mutation: 'Без мутации',
        any_mutation: 'Любая мутация',
        all_status: 'Все статусы',
        listed: 'Выставлены',
        not_listed: 'Не выставлены',
        total: 'всего',
        unique: 'уникальных',
        
        // Leaderboards
        leaderboards: 'Рейтинги',
        best_income_brainrot: 'Лучший доход',
        most_valuable_brainrot: 'Самый ценный',
        total_panel_income: 'Общий доход панели',
        all_accounts: 'Все аккаунты',
        
        // Farm Keys
        saved_farm_keys: 'Сохранённые ключи',
        add_key: 'Добавить ключ',
        add_farm_key: 'Добавить ключ фермы',
        cancel: 'Отмена',
        
        // Offers page
        eldorado_offers: 'Офферы Eldorado',
        refresh: 'Обновление',
        cron_timer_tooltip: 'Время до автообновления цен и ваших офферов',
        your_shop: 'Ваш магазин:',
        not_configured: 'Не настроен',
        edit_shop_name: 'Изменить название',
        generator_settings: 'Настройки генератора',
        configure_shop_hint: 'Настройте название магазина для создания офферов',
        universal_tracking: 'Универсальная система отслеживания:',
        universal_tracking_desc: 'Коды генерируются автоматически при создании офферов через панель. Сканер автоматически находит и отслеживает ваши офферы на Eldorado.',
        select_all: 'Выбрать все',
        adjust_selected: 'Изменить выбранные',
        delete_selected: 'Удалить выбранные',
        search_offers_placeholder: 'Поиск офферов по имени или коду...',
        newest_first: 'Сначала новые',
        oldest_first: 'Сначала старые',
        diff_high_low: 'Разница %: По убыв.',
        diff_low_high: 'Разница %: По возр.',
        all_offers: 'Все офферы',
        active_on_eldorado: 'Активные (на Eldorado)',
        pending_not_found: 'Ожидающие (не найдены)',
        paused: 'Приостановлены',
        needs_price_update: 'Требует обновления цены',
        in_stock: 'В наличии (есть в коллекции)',
        out_of_stock: 'Нет в наличии (0 в коллекции)',
        scan_all: 'Сканировать',
        scan_all_title: 'Сканировать все офферы на Eldorado',
        
        // Offer card buttons
        adjust_price: 'Изменить цену',
        delete: 'Удалить',
        auto_delete_in: 'Авто-удаление через',
        
        // Bulk Price Adjustment Modal
        bulk_price_adjustment: 'Массовое изменение цен',
        recommended: 'Рекомендуемая',
        market_based_price: 'Оптимальная рыночная цена',
        median_from_competitor: 'Медиана со страницы конкурентов',
        next_competitor_price: 'Цена следующего конкурента',
        custom: 'Своя цена',
        individual_prices: 'Индивидуальные цены',
        apply_changes: 'Применить изменения',
        offers: 'офферов',
        
        // Single Offer Price Modal
        adjust_offer_price: 'Изменение цены оффера',
        custom_price: 'Своя цена:',
        current: 'текущая',
        update_on_eldorado: 'Обновить на Eldorado',
        
        // Mass Generation Modal
        mass_generation: 'Массовая генерация',
        price_type_for_all: 'Тип цены для всех:',
        individual: 'Индивидуально',
        download_all: 'Скачать все',
        post_to_eldorado: 'Выложить на Eldorado',
        mass_gen_footer: 'После генерации нажмите "Выложить на Eldorado" для создания офферов',
        generate: 'Генерировать',
        
        // Shop Name Modal
        configure_shop_name: 'Настройка названия магазина',
        shop_name_desc: 'Название магазина отображается в заголовках и описаниях офферов на Eldorado. Формат: Эмодзи + Название + Эмодзи',
        left_emoji: 'Левый эмодзи',
        shop_name: 'Название магазина',
        right_emoji: 'Правый эмодзи',
        use_same_emoji: 'Использовать одинаковый эмодзи с обеих сторон',
        preview: 'Предпросмотр:',
        save_shop_name: 'Сохранить название',
        
        // Generator Settings Modal
        generator_settings_title: 'Настройки генератора',
        generator_settings_desc: 'Настройте шаблон генератора изображений. Оставьте пустым для использования шаблона по умолчанию.',
        supa_template_id: 'ID шаблона Supa',
        template_hint: 'Введите свой ID шаблона Supa.ru или оставьте пустым',
        save_settings: 'Сохранить настройки',
        
        // Emoji Picker
        select_emoji: 'Выберите эмодзи',
        search_emoji: 'Поиск эмодзи...',
        
        // Mass select
        mass_select_title: 'Массовый выбор для генерации',
        exit_selection_mode: 'Выйти из режима выбора',
        selected: 'Выбрано:',
        
        // Settings
        settings_title: 'Настройки',
        language: 'Язык',
        theme: 'Тема',
        theme_dark: 'Тёмная',
        theme_light: 'Светлая',
        theme_purple: 'Фиолетовая',
        theme_green: 'Зелёная',
        theme_changed: 'Тема изменена',
        
        // Login
        login_subtitle: 'Введите ключ фермы для доступа',
        access_panel: 'Войти',
        login_footer: 'Ключ фермы генерируется скриптом',
        
        // Loading
        loading_data: 'Загрузка данных фермы...',
        
        // Misc & Tooltips
        median: 'Медиана',
        next_competitor: 'След. конкурент',
        default: 'ОБЫЧНЫЙ',
        save: 'Сохранить',
        close: 'Закрыть',
        edit_username: 'Изменить имя',
        enter_new_username: 'Введите новое имя',
        username_hint: '3-20 символов, буквы, цифры и подчёркивание',
        
        // Price labels
        current_price: 'Текущая цена',
        recommended_price: 'Рекоменд.',
        recommended_old: 'Рекоменд. (старая)',
        ai_validated: 'AI цена из следующего диапазона M/s',
        price_next_range: 'Цена из следующего диапазона M/s',
        ai_tooltip: 'AI',
        ai_determined: 'Цена определена с помощью AI',
        ai_next_range_tooltip: 'AI + След. диапазон',
        next_range_tooltip: 'След. диапазон',
        hybrid_tooltip: 'AI + Regex гибрид',
        median_not_available: 'Медиана недоступна',
        has_brainrots_in_collection: 'в коллекции',
        no_brainrots_in_collection: 'Нет брейнротов в коллекции',
        will_be_deleted_soon: 'Будет удалён скоро',
        add_offer_id_hint: 'Добавьте #{id} в название оффера на Eldorado',
        
        // Stats labels
        total_offers: 'всего',
        paused_offers: 'приостановлено',
        need_update: 'нужно обновить',
        selected_offers: 'выбрано',
        
        // Time ago
        just_now: 'Только что',
        minutes_ago: 'мин. назад',
        hours_ago: 'ч. назад',
        days_ago: 'д. назад',
        
        // Account cards
        brainrots: 'Брейнроты',
        value: 'Стоимость',
        income_label: 'ДОХОД',
        brainrots_label: 'БРЕЙНРОТЫ',
        value_label: 'СТОИМОСТЬ',
        no_accounts: 'Нет аккаунтов',
        no_brainrots_yet: 'Пока нет брейнротов',
        online_status: 'Онлайн',
        offline_status: 'Оффлайн',
        
        // Farm keys
        accounts_label: 'аккаунтов',
        value_lower: 'стоимость',
        active_status: 'Активен',
        select_btn: 'Выбрать',
        
        // Notifications
        key_copied: 'Ключ скопирован!',
        key_copy_failed: 'Не удалось скопировать ключ',
        language_changed_en: 'Language changed to English',
        language_changed_ru: 'Язык изменён на русский',
        switched_to_account: 'Переключено на',
        farmer_deleted: 'Фермер успешно удалён',
        farmer_delete_failed: 'Не удалось удалить фермера',
        max_selection: 'Максимум брейнротов для массовой генерации:',
        generated_success: 'Сгенерировано',
        click_post_eldorado: 'Нажмите "Выложить на Eldorado" для создания офферов',
        no_images_download: 'Нет изображений для скачивания',
        downloaded_images: 'Скачано изображений',
        download_error: 'Ошибка при скачивании',
        configure_shop_first: 'Сначала настройте название магазина',
        queue_empty: 'Очередь пуста',
        queue_empty_generate: 'Очередь пуста. Сначала выполните генерацию с включённой опцией "Создать очередь для Eldorado"',
        queue_started: 'Запущена очередь Eldorado',
        offers_updated: 'Офферы обновлены',
        no_farm_key: 'Не выбран ключ фермы',
        done: 'Готово',
        errors_during_generation: 'ошибок при генерации',
        download_error_msg: 'Ошибка скачивания',
        loading_error: 'Ошибка загрузки',
        failed_to_load_top: 'Не удалось загрузить данные топа',
        retry: 'Повторить',
        no_data_yet: 'Пока нет данных',
        top_description: 'Топ формируется из данных всех пользователей панели',
        
        // Supa Generator
        supa_generator: 'Supa Генератор',
        preview: 'Предпросмотр',
        account_label: 'Аккаунт',
        name_label: 'Название',
        income_form: 'Доходность',
        image_url: 'URL изображения',
        price_variant: 'Вариант цены',
        price_for_eldorado: 'Цена для Eldorado',
        supa_recommended: 'Рекомендованная',
        supa_median: 'Медианная',
        supa_next_competitor: 'След. компетитор',
        supa_custom: 'Своя цена',
        supa_generate: 'Генерировать',
        supa_download: 'Скачать (800x800)',
        supa_post_eldorado: 'Post to Eldorado',
        supa_processing: 'Обработка...',
        
        // Mass select
        items: 'шт',
        generate_n: 'Генерировать',
        selection_mode: 'Режим выбора',
        groups: 'групп',
        
        // Collection empty states
        no_brainrots_found: 'Брейнроты не найдены',
        no_matches: 'Нет совпадений',
        brainrots_will_appear: 'Брейнроты появятся здесь, когда они есть на аккаунтах.',
        try_adjusting_filters: 'Попробуйте изменить поиск или фильтры.',
        shown: 'показано',
        
        // Farm Keys empty state
        no_saved_farm_keys: 'Нет сохранённых ключей',
        add_keys_hint: 'Добавьте ключи фермы для мониторинга нескольких фермеров.',
        
        // Offers empty states
        no_offers_yet: 'Офферов пока нет',
        offers_will_appear: 'Офферы созданные через Eldorado появятся здесь',
        
        // Offer card statuses
        pending_status: 'Ожидание',
        active_status_offer: 'Активен',
        unverified_status: 'Не проверен',
        needs_update_status: 'Нужно обновить',
        
        // Scanning progress
        scanning: 'Сканирование...',
        starting: 'Начинаем...',
        scanning_eldorado: 'Сканируем Eldorado...',
        processing_results: 'Обрабатываем результаты...',
        loading_offers: 'Загружаем офферы...',
        no_farm_key_selected: 'Ключ фермы не выбран',
        no_registered_codes: 'Зарегистрированные коды не найдены. Просканировано {count} офферов.',
        
        // Top list
        waiting_for_player: 'Ожидание игрока...',
        
        // Accounts empty state
        accounts_will_appear: 'Аккаунты появятся здесь после запуска скрипта фермы.',
        start_farm_hint: 'Запустите скрипт фермы, чтобы увидеть аккаунты.'
    }
};

// Current language
let currentLanguage = DEFAULT_LANGUAGE;

// Get translation
function t(key) {
    return i18n[currentLanguage]?.[key] || i18n[DEFAULT_LANGUAGE]?.[key] || key;
}

// Load saved language
function loadLanguage() {
    const saved = localStorage.getItem('farmerPanel_language');
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
        currentLanguage = saved;
    }
    return currentLanguage;
}

// Save language
function saveLanguage(lang) {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
        currentLanguage = lang;
        localStorage.setItem('farmerPanel_language', lang);
    }
}

// Apply localization to all elements with data-i18n attribute
function applyLocalization() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            // Skip shop name if it has a saved value (not_configured is the default key)
            if (el.id === 'shopNameValue' && key === 'not_configured' && shopNameState.isConfigured) {
                return; // Don't overwrite saved shop name
            }
            el.textContent = t(key);
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.placeholder = t(key);
        }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            el.title = t(key);
        }
    });
    
    // Update Mass Generation global price select
    const massGenSelect = document.getElementById('massGenGlobalPriceType');
    if (massGenSelect) {
        const options = massGenSelect.querySelectorAll('option');
        if (options.length >= 4) {
            options[0].textContent = t('individual');
            options[1].textContent = '💰 ' + t('recommended');
            options[2].textContent = '📊 ' + t('median');
            options[3].textContent = '⬆️ ' + t('next_competitor');
        }
    }
}

// Re-render all dynamic elements on language change (without reloading data)
function rerenderDynamicElements() {
    // Re-render collection (has dynamic stats with total/unique)
    if (typeof renderCollection === 'function' && collectionState?.filteredBrainrots) {
        renderCollection();
    }
    
    // Re-render offers (has dynamic labels)
    if (typeof filterAndRenderOffers === 'function' && offersState?.offers) {
        filterAndRenderOffers();
    }
    
    // Re-render farm keys (has dynamic labels)
    if (typeof renderFarmKeys === 'function') {
        renderFarmKeys();
    }
    
    // Re-render accounts if on accounts tab
    if (typeof renderAccountsGrid === 'function' && state?.farmersData?.[state.currentKey]?.accounts) {
        renderAccountsGrid(state.farmersData[state.currentKey].accounts);
        renderAccountsList(state.farmersData[state.currentKey].accounts);
    }
    
    // Update shop name display (to restore custom name if any)
    if (typeof updateShopNameDisplay === 'function') {
        updateShopNameDisplay();
    }
    
    // Update mass selection UI if active
    if (massSelectionState?.isActive && typeof updateMassSelectionUI === 'function') {
        updateMassSelectionUI();
    }
}

// ============ THEME SYSTEM ============
const THEMES = {
    dark: {
        name: 'Dark',
        bgPrimary: '#0f0f14',
        bgSecondary: '#16161d',
        bgTertiary: '#1a1a24',
        bgCard: '#1e1e2a',
        bgHover: '#252532',
        borderColor: '#2a2a3a',
        textPrimary: '#ffffff',
        textSecondary: '#a0a0b0',
        textMuted: '#6b6b7d',
        accentPrimary: '#6366f1',
        accentSecondary: '#8b5cf6'
    },
    light: {
        name: 'Light',
        bgPrimary: '#f5f5f7',
        bgSecondary: '#ffffff',
        bgTertiary: '#f0f0f2',
        bgCard: '#ffffff',
        bgHover: '#e8e8ec',
        borderColor: '#d1d1d6',
        textPrimary: '#1a1a1a',
        textSecondary: '#4a4a4a',
        textMuted: '#8a8a8a',
        accentPrimary: '#6366f1',
        accentSecondary: '#8b5cf6'
    },
    purple: {
        name: 'Purple',
        bgPrimary: '#1a1025',
        bgSecondary: '#231432',
        bgTertiary: '#2d1b40',
        bgCard: '#35204d',
        bgHover: '#42285f',
        borderColor: '#4a2d6e',
        textPrimary: '#ffffff',
        textSecondary: '#c9b8db',
        textMuted: '#8b7a9e',
        accentPrimary: '#a855f7',
        accentSecondary: '#c084fc'
    },
    green: {
        name: 'Green',
        bgPrimary: '#0a1410',
        bgSecondary: '#0f1f18',
        bgTertiary: '#142a20',
        bgCard: '#1a3528',
        bgHover: '#204030',
        borderColor: '#2a5040',
        textPrimary: '#ffffff',
        textSecondary: '#a8d4b8',
        textMuted: '#6b9a7d',
        accentPrimary: '#22c55e',
        accentSecondary: '#4ade80'
    }
};

const DEFAULT_THEME = 'dark';
let currentTheme = DEFAULT_THEME;

// Load saved theme
function loadTheme() {
    const saved = localStorage.getItem('farmerPanel_theme');
    if (saved && THEMES[saved]) {
        currentTheme = saved;
    }
    return currentTheme;
}

// Save theme
function saveTheme(themeName) {
    if (THEMES[themeName]) {
        currentTheme = themeName;
        localStorage.setItem('farmerPanel_theme', themeName);
    }
}

// Apply theme CSS variables
function applyTheme(themeName) {
    const theme = THEMES[themeName];
    if (!theme) return;
    
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', theme.bgPrimary);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.style.setProperty('--bg-tertiary', theme.bgTertiary);
    root.style.setProperty('--bg-card', theme.bgCard);
    root.style.setProperty('--bg-hover', theme.bgHover);
    root.style.setProperty('--border-color', theme.borderColor);
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--accent-primary', theme.accentPrimary);
    root.style.setProperty('--accent-secondary', theme.accentSecondary);
    
    // Update body class for theme-specific styles
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);
}

// Simple notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const existing = document.querySelector('.panel-notification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.className = `panel-notification panel-notification-${type}`;
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ${type === 'success' ? 'background: linear-gradient(135deg, #11998e, #38ef7d); color: white;' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #eb3349, #f45c43); color: white;' : ''}
        ${type === 'warning' ? 'background: linear-gradient(135deg, #f59e0b, #f97316); color: white;' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #667eea, #764ba2); color: white;' : ''}
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 5000);
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Format money with K/M/B suffixes (for prices)
function formatMoney(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(2) + 'B';
    } else if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + 'M';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(1) + 'K';
    }
    return sign + absNum.toLocaleString();
}

// Mutation styles for brainrot variants - includes background, text color, and glow color
function getMutationStyles(mutation) {
    if (!mutation) return null;
    
    // Clean from HTML tags
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    // Normalize Yin Yang
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        clean = 'YinYang';
    }
    
    const styles = {
        'Gold': {
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            textColor: '#4a3500',
            glowColor: '#FFD700'
        },
        'Diamond': {
            background: 'linear-gradient(135deg, #00BFFF, #87CEEB)',
            textColor: '#003366',
            glowColor: '#00BFFF'
        },
        'Bloodrot': {
            background: 'linear-gradient(135deg, #8B0000, #DC143C)',
            textColor: '#ffcccc',
            glowColor: '#DC143C'
        },
        'Rainbow': {
            background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)',
            textColor: '#ffffff',
            textShadow: '0 0 3px #000, 0 0 5px #000',
            glowColor: '#ff00ff'
        },
        'Candy': {
            background: 'linear-gradient(135deg, #FF69B4, #FF1493)',
            textColor: '#4a0020',
            glowColor: '#FF69B4'
        },
        'Lava': {
            background: 'linear-gradient(135deg, #FF4500, #FF6347)',
            textColor: '#3d0000',
            glowColor: '#FF4500'
        },
        'Galaxy': {
            background: 'linear-gradient(135deg, #9400D3, #4B0082)',
            textColor: '#e0c0ff',
            glowColor: '#9400D3'
        },
        'YinYang': {
            background: 'linear-gradient(135deg, #333, #fff, #333)',
            textColor: '#000000',
            textShadow: '0 0 2px #fff',
            glowColor: '#888888'
        },
        'Yin Yang': {
            background: 'linear-gradient(135deg, #333, #fff, #333)',
            textColor: '#000000',
            textShadow: '0 0 2px #fff',
            glowColor: '#888888'
        },
        'Radioactive': {
            background: 'linear-gradient(135deg, #32CD32, #00FF00)',
            textColor: '#003300',
            glowColor: '#32CD32'
        },
        'Cursed': {
            background: 'linear-gradient(135deg, #1a0000, #4a0a0a, #8b0000)',
            textColor: '#ff6666',
            textShadow: '0 0 4px #ff0000, 0 0 8px #990000',
            glowColor: '#ff0000'
        }
    };
    return styles[clean] || { background: '#888', textColor: '#fff', glowColor: '#888' };
}

// Get just the background color/gradient for mutation
function getMutationColor(mutation) {
    const styles = getMutationStyles(mutation);
    return styles ? styles.background : '#888';
}

// Clean mutation text for display
function cleanMutationText(mutation) {
    if (!mutation) return null;
    let clean = mutation.replace(/<[^>]+>/g, '').trim();
    if (clean.toLowerCase().includes('yin') && clean.toLowerCase().includes('yang')) {
        return 'YinYang';
    }
    return clean || null;
}

// Format income with K/M/B/T suffixes and /s unit (with space)
function formatIncomeSec(num) {
    if (num === null || num === undefined || isNaN(num)) return '0 /s';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e12) {
        return sign + (absNum / 1e12).toFixed(2) + ' T/s';
    } else if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(2) + ' B/s';
    } else if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + ' M/s';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(1) + ' K/s';
    }
    return sign + absNum.toFixed(0) + ' /s';
}

// Format income from M/s format (number in millions) to display format
// API stores income as "390" meaning 390 M/s, need to convert to display "390 M/s"
function formatIncomeFromMs(num) {
    if (num === null || num === undefined || isNaN(num)) return '0 /s';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    // Convert from M/s stored format back to raw, then format
    // If number is small (< 10000), it's already in M/s format
    // If large, it's raw format
    if (absNum >= 10000) {
        // Raw format - use formatIncomeSec directly
        return formatIncomeSec(num);
    }
    
    // M/s format - number represents millions per second
    if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(2) + ' T/s';
    } else if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(2) + ' B/s';
    } else if (absNum >= 1) {
        return sign + absNum.toFixed(1) + ' M/s';
    } else if (absNum >= 0.001) {
        return sign + (absNum * 1000).toFixed(0) + ' K/s';
    }
    return sign + (absNum * 1e6).toFixed(0) + ' /s';
}

// State
let state = {
    currentKey: null,
    savedKeys: [],
    farmersData: {},
    brainrotImages: {},
    eldoradoPrices: {}, // Кэш цен Eldorado по ключу (name_income)
    brainrotPrices: {}, // Кэш цен по имени брейнрота для отображения
    previousPrices: {}, // Предыдущие цены для расчёта % изменения
    previousTotalValue: null, // Предыдущее общее значение
    avatarCache: {}, // Кэш аватаров по userId
    balanceHistory: {}, // История баланса по farmKey {farmKey: [{timestamp, value}]}
    currentTotalValue: 0, // Текущий баланс (синхронизирован везде)
    currentBalanceChange: null, // Текущее изменение баланса
    isManualPriceRefresh: false, // Флаг ручного рефреша цен (не записываем в историю)
    frozenBalance: null, // Замороженный баланс во время ручного рефреша
    lastRecordedPrices: {} // Последние записанные цены для сравнения
};

// Кэш цен Eldorado (время жизни 10 минут для свежих, но показываем устаревшие сразу)
const PRICE_CACHE_TTL = 10 * 60 * 1000; // 10 минут вместо 3
const PRICE_AUTO_REFRESH_INTERVAL = 10 * 60 * 1000; // Автообновление каждые 10 минут
const PRICE_INCREMENTAL_INTERVAL = 60 * 1000; // v9.12.24: Проверка обновлённых цен каждую минуту
const PRICE_STORAGE_KEY = 'eldoradoPriceCache';
const PRICE_CACHE_VERSION = 6; // v9.12.50: Increment to invalidate cache - add _serverUpdatedAt field
const PREVIOUS_PRICES_KEY = 'previousPricesCache';
const AVATAR_STORAGE_KEY = 'avatarCache';
const BALANCE_HISTORY_KEY = 'balanceHistoryCache';
const BALANCE_HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 минут кэш для истории баланса
const CHART_PERIOD_KEY = 'chartPeriodCache';

// v9.12.24: Время последней загрузки цен для инкрементального обновления
let lastPricesLoadTime = 0;

// Периоды для графика
const PERIODS = {
    realtime: 5 * 60 * 1000,      // 5 минут - Real Time
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
};

/**
 * Проверить, является ли строка base64 изображением
 */
function isBase64Avatar(url) {
    return url && url.startsWith('data:image/');
}

/**
 * Загрузить кэш аватаров из localStorage
 */
function loadAvatarCache() {
    try {
        const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Фильтруем только base64 аватары (они не истекают)
            // URL аватары от Roblox CDN истекают
            for (const [userId, data] of Object.entries(parsed)) {
                if (data && data.url && isBase64Avatar(data.url)) {
                    state.avatarCache[userId] = data;
                }
            }
            console.log(`Loaded ${Object.keys(state.avatarCache).length} base64 avatars from cache`);
        }
    } catch (e) {
        console.warn('Failed to load avatar cache:', e);
    }
}

/**
 * Сохранить аватар в кэш (только base64)
 */
function saveAvatarToCache(userId, avatarUrl) {
    // Сохраняем только base64 аватары (они не истекают)
    // URL аватары от Roblox CDN временные и истекают
    if (!isBase64Avatar(avatarUrl)) {
        return; // Не кэшируем временные URL
    }
    
    state.avatarCache[userId] = {
        url: avatarUrl,
        timestamp: Date.now()
    };
    
    try {
        // v2.5: Ограничиваем размер кэша - максимум 20 аватаров
        const cacheKeys = Object.keys(state.avatarCache);
        if (cacheKeys.length > 20) {
            // Удаляем старые записи
            const sorted = cacheKeys.sort((a, b) => 
                (state.avatarCache[a].timestamp || 0) - (state.avatarCache[b].timestamp || 0)
            );
            // Удаляем 10 старых
            for (let i = 0; i < 10; i++) {
                delete state.avatarCache[sorted[i]];
            }
        }
        localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(state.avatarCache));
    } catch (e) {
        // v2.5: При любой ошибке (включая QuotaExceeded) очищаем кэш
        console.warn('Avatar cache save failed, clearing:', e.name);
        state.avatarCache = {};
        try {
            localStorage.removeItem(AVATAR_STORAGE_KEY);
        } catch (e2) {}
    }
}

/**
 * Получить аватар из кэша
 * Base64 аватары не имеют срока действия
 */
function getCachedAvatar(userId) {
    const cached = state.avatarCache[userId];
    if (cached && cached.url) {
        // Base64 аватары не истекают
        if (isBase64Avatar(cached.url)) {
            return cached.url;
        }
        // URL аватары истекают через 24 часа
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            return cached.url;
        }
    }
    return null;
}

/**
 * Загрузить аватар через серверный API (конвертирует в base64 и сохраняет)
 */
async function fetchRobloxAvatar(userId) {
    try {
        // Используем серверный API который конвертирует в base64 и сохраняет в MongoDB
        const response = await fetch(`${API_BASE}/account-avatar?userId=${userId}`);
        const data = await response.json();
        
        if (data.avatarUrl) {
            saveAvatarToCache(userId, data.avatarUrl);
            return data.avatarUrl;
        }
        
        // Fallback: прямой запрос к Roblox API (менее надёжно, URL временные)
        const robloxResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        const robloxData = await robloxResponse.json();
        if (robloxData.data?.[0]?.imageUrl) {
            const url = robloxData.data[0].imageUrl;
            saveAvatarToCache(userId, url);
            return url;
        }
    } catch (e) {
        console.warn('Failed to fetch Roblox avatar for', userId, e);
    }
    return null;
}

/**
 * Получить аватар: сначала из сервера/кэша, затем с Roblox
 */
async function getAccountAvatar(userId, serverAvatars) {
    if (!userId) return null;
    
    const key = String(userId);
    
    // 1. Проверяем серверные данные (base64)
    const serverAvatar = serverAvatars?.[key];
    if (serverAvatar?.base64) {
        return serverAvatar.base64;
    }
    if (serverAvatar?.url) {
        return serverAvatar.url;
    }
    
    // 2. Проверяем локальный кэш
    const cached = getCachedAvatar(userId);
    if (cached) {
        return cached;
    }
    
    // 3. Загружаем с Roblox (в фоне)
    return fetchRobloxAvatar(userId);
}

// ============ Balance History Functions v2.0 ============

/**
 * v2.0: Новая архитектура истории баланса
 * 
 * Принципы:
 * 1. БД - единственный источник правды (сервер хранит всё)
 * 2. localStorage - только для мгновенного показа при загрузке
 * 3. Очистка старых данных (>30 дней) происходит на сервере
 * 4. Периоды: RT (5min), 1H, 24H, 7D, 30D
 * 5. Агрегация данных на сервере для оптимизации
 */

// Текущий выбранный период графика объявлен ниже в секции графиков (currentChartPeriod)

/**
 * Загрузить историю баланса из localStorage кэша (для мгновенного отображения)
 * v2.0: Теперь хранит данные для каждого периода отдельно
 */
function loadBalanceHistoryFromCache() {
    if (!state.currentKey) return false;
    
    try {
        const stored = localStorage.getItem(BALANCE_HISTORY_KEY);
        if (stored) {
            const cache = JSON.parse(stored);
            if (cache[state.currentKey]) {
                const cacheData = cache[state.currentKey];
                
                // v2.7: Мержим 30d и 24h из кэша
                const cached30d = cacheData.history30d || cacheData.history || [];
                const cached24h = cacheData.history24h || [];
                
                let mergedHistory = [];
                
                if (cached30d.length > 0 && cached24h.length > 0) {
                    // Мержим: старые 30d + детальные 24h
                    const cutoff24h = Date.now() - PERIODS.day;
                    const older30d = cached30d.filter(r => {
                        const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
                        return ts < cutoff24h;
                    });
                    mergedHistory = [...older30d, ...cached24h];
                    mergedHistory.sort((a, b) => {
                        const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                        const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                        return tsA - tsB;
                    });
                } else {
                    mergedHistory = cached30d.length > 0 ? cached30d : cached24h;
                }
                
                // Не перезаписываем если в памяти уже больше данных
                const currentHistory = state.balanceHistory[state.currentKey] || [];
                if (currentHistory.length >= mergedHistory.length) {
                    console.log(`📊 Skipping cache (memory: ${currentHistory.length} >= cache: ${mergedHistory.length})`);
                    return currentHistory.length >= 5;
                }
                
                state.balanceHistory[state.currentKey] = mergedHistory;
                
                // Восстанавливаем период
                const savedPeriod = cacheData.period;
                if (typeof savedPeriod === 'number' && Object.values(PERIODS).includes(savedPeriod)) {
                    currentChartPeriod = savedPeriod;
                } else {
                    currentChartPeriod = PERIODS.week;
                }
                
                console.log(`📊 Loaded from cache: 30d=${cached30d.length}, 24h=${cached24h.length}, merged=${mergedHistory.length}`);
                return mergedHistory.length >= 5;
            }
        }
    } catch (e) {
        console.warn('Failed to load balance history cache:', e);
    }
    return false;
}

/**
 * Сохранить историю баланса в localStorage кэш
 * v2.7: Сохраняем отдельно 30d и 24h данные
 */
function saveBalanceHistoryToCache() {
    if (!state.currentKey || !state.balanceHistory[state.currentKey]) return;
    
    try {
        let cache = {};
        const stored = localStorage.getItem(BALANCE_HISTORY_KEY);
        if (stored) {
            cache = JSON.parse(stored);
        }
        
        const history = state.balanceHistory[state.currentKey];
        const now = Date.now();
        const cutoff24h = now - PERIODS.day;
        
        // v2.7: Разделяем на 30d и 24h для правильного кэширования
        // 24h - детальные данные за последние 24 часа
        const history24h = history.filter(r => {
            const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
            return ts >= cutoff24h;
        });
        
        // 30d - все данные, но лимитируем до 500 записей
        const history30d = history.length > 500 ? history.slice(-500) : history;
        
        cache[state.currentKey] = {
            history30d: history30d,
            history24h: history24h,
            period: currentChartPeriod,
            timestamp: now
        };
        
        // Очищаем кэш других ключей если слишком много
        const keys = Object.keys(cache);
        if (keys.length > 3) {
            const sorted = keys.sort((a, b) => (cache[b].timestamp || 0) - (cache[a].timestamp || 0));
            for (let i = 3; i < sorted.length; i++) {
                delete cache[sorted[i]];
            }
        }
        
        localStorage.setItem(BALANCE_HISTORY_KEY, JSON.stringify(cache));
        console.log(`📊 Cached: 30d=${history30d.length}, 24h=${history24h.length} for ${state.currentKey}`);
    } catch (e) {
        console.warn('Failed to save balance history cache:', e);
        try {
            localStorage.removeItem(BALANCE_HISTORY_KEY);
        } catch (e2) {}
    }
}

/**
 * Загрузить историю баланса из сервера v2.0
 * Использует новый API с агрегацией и автоочисткой
 * 
 * @param {string} period - Период: 'realtime', 'hour', 'day', 'week', 'month'
 * @param {boolean} forceRefresh - Игнорировать кэш
 */
async function loadBalanceHistory(period = null, forceRefresh = false) {
    if (!state.currentKey) {
        console.log('loadBalanceHistory: no currentKey, skipping');
        return;
    }
    
    console.log(`loadBalanceHistory: loading data for ${state.currentKey}`);
    
    // v2.7: Сначала загружаем из кэша для мгновенного отображения
    if (!forceRefresh) {
        const hasCachedData = loadBalanceHistoryFromCache();
        if (hasCachedData) {
            const cachedHistory = state.balanceHistory[state.currentKey];
            if (cachedHistory && cachedHistory.length >= 2) {
                console.log('📊 Showing cached data while loading fresh...');
                updateBalanceChart();
            }
        }
    }
    
    // v2.7: Параллельно загружаем 30d и 24h данные
    // 30d - агрегированные для 7D/30D графиков
    // 24h - детальные для RT/1H/24H графиков
    try {
        const farmKey = encodeURIComponent(state.currentKey);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        // Параллельные запросы
        const [response30d, response24h] = await Promise.all([
            fetch(`${API_BASE}/balance-history-v2?farmKey=${farmKey}&period=30d`, { signal: controller.signal }),
            fetch(`${API_BASE}/balance-history-v2?farmKey=${farmKey}&period=24h`, { signal: controller.signal })
        ]);
        clearTimeout(timeout);
        
        let allRecords = [];
        
        // Обрабатываем 30d данные
        if (response30d.ok) {
            const data30d = await response30d.json();
            if (data30d.success && data30d.history) {
                allRecords = [...data30d.history];
                console.log(`✅ Loaded ${data30d.history.length} records (30d)`);
            }
        }
        
        // Обрабатываем 24h данные (более детальные, добавляем к 30d)
        if (response24h.ok) {
            const data24h = await response24h.json();
            if (data24h.success && data24h.history && data24h.history.length > 0) {
                console.log(`✅ Loaded ${data24h.history.length} records (24h detail)`);
                
                // Мержим: 24h данные более детальные, заменяем ими последние 24h из 30d
                const cutoff24h = Date.now() - PERIODS.day;
                // Оставляем из 30d только данные старше 24h
                const older30d = allRecords.filter(r => {
                    const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
                    return ts < cutoff24h;
                });
                // Добавляем все 24h данные
                allRecords = [...older30d, ...data24h.history];
            }
        }
        
        if (allRecords.length > 0) {
            // Сортируем по времени
            allRecords.sort((a, b) => {
                const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                return tsA - tsB;
            });
            
            // ВАЖНО: сохраняем локальные свежие записи (последние 10 минут)
            // Серверные данные могут быть агрегированы и не содержать самые свежие точки
            const currentHistory = state.balanceHistory[state.currentKey] || [];
            const nowMs = Date.now();
            const recentCutoff = nowMs - 10 * 60 * 1000; // 10 минут
            const localRecent = currentHistory.filter(r => {
                const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
                return ts >= recentCutoff;
            });
            
            // Находим самый свежий timestamp в серверных данных
            const serverMaxTs = allRecords.length > 0 ? Math.max(...allRecords.map(r => 
                typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime()
            )) : 0;
            
            // Добавляем локальные записи которые новее серверных
            const localNewer = localRecent.filter(r => {
                const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
                return ts > serverMaxTs;
            });
            
            if (localNewer.length > 0) {
                console.log(`📊 Preserving ${localNewer.length} local recent records`);
                allRecords = [...allRecords, ...localNewer];
                allRecords.sort((a, b) => {
                    const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                    const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                    return tsA - tsB;
                });
            }
            
            state.balanceHistory[state.currentKey] = allRecords;
            console.log(`📊 Total: ${allRecords.length} records merged`);
            
            saveBalanceHistoryToCache();
            updateBalanceChart();
            return;
        }
        
        console.log('loadBalanceHistory: no history records on server');
        
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('loadBalanceHistory: request timed out');
        } else {
            console.warn('Failed to load balance history:', e);
        }
        // Fallback на старый API
        await loadBalanceHistoryLegacy();
    }
}

/**
 * Fallback на старый API balance-history
 */
async function loadBalanceHistoryLegacy() {
    try {
        const url = `${API_BASE}/balance-history?farmKey=${encodeURIComponent(state.currentKey)}&period=${PERIODS.month}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            if (data.history && data.history.length > 0) {
                state.balanceHistory[state.currentKey] = data.history;
                saveBalanceHistoryToCache();
                updateBalanceChart();
            }
        }
    } catch (e) {
        console.warn('Legacy balance history also failed:', e);
    }
    
    // Инициализируем пустой массив если ничего не загрузилось
    if (!state.balanceHistory[state.currentKey]) {
        state.balanceHistory[state.currentKey] = [];
    }
}

/**
 * Сохранить запись истории баланса на сервер v2.0
 * Использует новый API с автоочисткой старых данных
 */
async function saveBalanceHistoryToServer(farmKey, value) {
    try {
        // Используем новый API v2
        const response = await fetch(`${API_BASE}/balance-history-v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                farmKey, 
                value, 
                timestamp: Date.now(),
                source: 'client'
            })
        });
        
        if (!response.ok) {
            // Fallback на старый API
            await fetch(`${API_BASE}/balance-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ farmKey, value, timestamp: Date.now() })
            });
        }
    } catch (e) {
        console.warn('Failed to save balance history to server:', e);
    }
}

/**
 * Сохранить историю баланса в localStorage (ОТКЛЮЧЕНО - данные на сервере)
 */
function saveBalanceHistory() {
    // История баланса хранится на сервере, локальный кэш не нужен
    // Это экономит ~500KB+ в localStorage
    return;
}

/**
 * Очистить всю историю баланса (для сброса тестовых данных)
 */
async function clearBalanceHistory() {
    state.balanceHistory = {};
    state.currentBalanceChange = null;
    localStorage.removeItem(BALANCE_HISTORY_KEY);
    
    // Очищаем на сервере
    try {
        await fetch(`${API_BASE}/balance-history?all=true&secret=cleanup-farmpanel-2024`, {
            method: 'DELETE'
        });
        console.log('Balance history cleared on server');
    } catch (e) {
        console.warn('Failed to clear balance history on server:', e);
    }
    
    console.log('Balance history cleared');
    updateBalanceChart();
    updateUI();
    renderFarmKeys();
}

/**
 * Добавить запись в историю баланса
 * Записывает ТОЛЬКО если:
 * 1. Это НЕ ручной рефреш цен
 * 2. Баланс реально изменился (цены изменились)
 */
function recordBalanceHistory(farmKey, value) {
    if (!farmKey || value === undefined || value === null) return;
    
    // При ручном рефреше не записываем в историю
    if (state.isManualPriceRefresh) {
        console.log('Skip balance history: manual price refresh');
        return;
    }
    
    if (!state.balanceHistory[farmKey]) {
        state.balanceHistory[farmKey] = [];
    }
    
    const history = state.balanceHistory[farmKey];
    const now = Date.now();
    
    // Записываем раз в 10 секунд для real-time графика
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (now - last.timestamp < 10000) return;
        
        // Не записываем если баланс не изменился (разница < $0.01)
        if (Math.abs(last.value - value) < 0.01) {
            return;
        }
    }
    
    history.push({ timestamp: now, value: value });
    console.log(`Balance history: recorded $${value.toFixed(2)} for ${farmKey}`);
    
    // Сохраняем на сервер (async, не блокируем)
    saveBalanceHistoryToServer(farmKey, value);
    
    // Ограничиваем размер истории (макс 2000 записей на аккаунт)
    if (history.length > 2000) {
        state.balanceHistory[farmKey] = history.slice(-1000);
    }
    
    // v2.3: Сохраняем в кэш ТОЛЬКО если у нас достаточно данных (5+)
    // Это предотвращает перезапись полного кэша 1-2 записями при первой загрузке
    if (history.length >= 5) {
        saveBalanceHistoryToCache();
    }
    
    // v2.1: Обновляем график если выбран RT период и это текущий ключ
    // RT реагирует на изменения в реальном времени без загрузки с сервера
    if (farmKey === state.currentKey && currentChartPeriod === PERIODS.realtime) {
        // Debounce - не чаще раза в 2 секунды для RT
        if (!recordBalanceHistory._lastRTUpdate || now - recordBalanceHistory._lastRTUpdate > 2000) {
            recordBalanceHistory._lastRTUpdate = now;
            updateBalanceChart();
        }
    }
}

/**
 * Получить изменение баланса за период
 */
function getBalanceChange(farmKey, periodMs) {
    const history = state.balanceHistory[farmKey];
    if (!history || history.length < 2) return null;
    
    const now = Date.now();
    const periodStart = now - periodMs;
    
    // Находим самую раннюю запись в периоде
    let oldestInPeriod = null;
    for (const entry of history) {
        if (entry.timestamp >= periodStart) {
            oldestInPeriod = entry;
            break;
        }
    }
    
    if (!oldestInPeriod) {
        // Если нет записей в периоде, берём самую старую
        oldestInPeriod = history[0];
    }
    
    const latest = history[history.length - 1];
    
    if (oldestInPeriod.value === 0) return null;
    
    const change = latest.value - oldestInPeriod.value;
    const changePercent = (change / oldestInPeriod.value) * 100;
    
    return {
        change: change,
        changePercent: changePercent,
        oldValue: oldestInPeriod.value,
        newValue: latest.value
    };
}

/**
 * Получить данные для графика
 */
function getChartData(farmKey, periodMs, points = 30) {
    const history = state.balanceHistory[farmKey];
    if (!history || history.length < 2) return { labels: [], values: [] };
    
    const now = Date.now();
    const periodStart = now - periodMs;
    
    // v2.4: Нормализуем timestamp (может быть Date, string или number)
    const normalizeTimestamp = (ts) => {
        if (typeof ts === 'number') return ts;
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === 'string') return new Date(ts).getTime();
        return 0;
    };
    
    // v2.5: RT работает только с данными за последние 5 минут (строго)
    const isRealtime = periodMs <= PERIODS.realtime;
    
    // Фильтруем записи в периоде
    let periodHistory = history.filter(e => {
        const ts = normalizeTimestamp(e.timestamp);
        return ts >= periodStart;
    });
    
    // v2.6: ВСЕ периоды показывают только данные строго в периоде (без fallback)
    // RT: минимум 2 точки, остальные: минимум 5
    const minRequired = isRealtime ? 2 : 5;
    
    if (periodHistory.length < minRequired) {
        // Недостаточно данных за период - показываем пустой график
        return { labels: [], values: [] };
    }
    
    if (periodHistory.length < 2) return { labels: [], values: [] };
    
    // Для realtime показываем все точки
    const maxPoints = isRealtime ? 100 : points;
    
    // Сэмплируем до нужного количества точек
    const step = Math.max(1, Math.floor(periodHistory.length / maxPoints));
    const sampled = [];
    for (let i = 0; i < periodHistory.length; i += step) {
        sampled.push(periodHistory[i]);
    }
    // Всегда включаем последнюю точку
    if (sampled[sampled.length - 1] !== periodHistory[periodHistory.length - 1]) {
        sampled.push(periodHistory[periodHistory.length - 1]);
    }
    
    // Форматируем метки времени (нормализуем timestamp)
    const labels = sampled.map(entry => {
        const ts = normalizeTimestamp(entry.timestamp);
        const date = new Date(ts);
        if (periodMs <= PERIODS.hour) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (periodMs <= PERIODS.day) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
    });
    
    const values = sampled.map(entry => entry.value);
    
    return { labels, values };
}

/**
 * Форматировать изменение баланса для отображения
 */
function formatBalanceChange(changePercent, compact = false) {
    if (changePercent === null || changePercent === undefined || isNaN(changePercent)) {
        return '';
    }
    
    const isPositive = changePercent >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const colorClass = isPositive ? 'change-positive' : 'change-negative';
    const absPercent = Math.abs(changePercent);
    
    if (compact) {
        return `<span class="${colorClass}">${arrow}${absPercent.toFixed(1)}%</span>`;
    }
    
    return `<span class="${colorClass}">${arrow} ${absPercent.toFixed(2)}%</span>`;
}

/**
 * Загрузить кэш цен из MongoDB (серверный централизованный кэш)
 * Сначала пробуем новый prices-cache API (от cron сканера)
 * Fallback на старый prices API
 */
async function loadPricesFromServer() {
    // Проверяем когда последний раз загружали с сервера
    const lastServerLoad = parseInt(localStorage.getItem('lastPricesServerLoad') || '0', 10);
    const now = Date.now();
    const timeSinceLastLoad = now - lastServerLoad;
    
    // Если загружали меньше 30 секунд назад - не перезаписываем previousPrices
    // (пользователь просто обновил страницу)
    const isQuickReload = timeSinceLastLoad < 30000;
    
    // Пробуем новый централизованный кэш
    try {
        const response = await fetch(`${API_BASE}/prices-cache?all=true`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.prices && Object.keys(data.prices).length > 0) {
                // Сохраняем текущие цены как предыдущие ТОЛЬКО если это не быстрая перезагрузка
                // и если цены реально изменились (не просто перезагрузка)
                if (!isQuickReload) {
                    savePreviousPrices();
                }
                
                // Загружаем цены в state (включая medianPrice, nextCompetitorPrice и др.)
                // ВАЖНО: _timestamp = Date.now() чтобы считать данные свежими
                // (updatedAt - время обновления на сервере cron'ом, может быть давно)
                const loadTime = Date.now();
                let hasUpdatedAt = 0;
                for (const [key, priceData] of Object.entries(data.prices)) {
                    if (priceData.updatedAt) hasUpdatedAt++;
                    state.brainrotPrices[key] = {
                        ...priceData,
                        _timestamp: loadTime, // Время загрузки клиентом, не сервера!
                        _serverUpdatedAt: priceData.updatedAt // Сохраняем оригинал для справки
                    };
                }
                console.log(`📊 Prices with updatedAt: ${hasUpdatedAt}/${Object.keys(data.prices).length}`);
                
                // ВАЖНО: Сохраняем в localStorage для мгновенной загрузки при следующем визите
                savePriceCacheToStorage();
                
                // Запоминаем время загрузки
                localStorage.setItem('lastPricesServerLoad', now.toString());
                
                // v9.12.24: Обновляем время для инкрементальных обновлений
                lastPricesLoadTime = loadTime;
                
                console.log(`Loaded ${Object.keys(data.prices).length} prices from centralized server cache`);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load from centralized cache, trying fallback:', e.message);
    }
    
    // Fallback на старый API (если cron не работает)
    try {
        const response = await fetch(`${API_BASE}/prices`);
        if (response.ok) {
            const data = await response.json();
            if (data.prices && Object.keys(data.prices).length > 0) {
                // Сохраняем текущие цены как предыдущие только если не быстрая перезагрузка
                if (!isQuickReload) {
                    savePreviousPrices();
                }
                
                // Загружаем цены в state (добавляем _timestamp для кэширования)
                // ВАЖНО: _timestamp = Date.now() - время загрузки клиентом
                const loadTime = Date.now();
                for (const [key, priceData] of Object.entries(data.prices)) {
                    state.brainrotPrices[key] = {
                        ...priceData,
                        _timestamp: loadTime // Время загрузки клиентом
                    };
                }
                
                // ВАЖНО: Сохраняем в localStorage для мгновенной загрузки при следующем визите
                savePriceCacheToStorage();
                
                // Запоминаем время загрузки
                localStorage.setItem('lastPricesServerLoad', now.toString());
                
                // v9.12.26: Обновляем время для инкрементальных обновлений
                lastPricesLoadTime = loadTime;
                
                console.log(`Loaded ${Object.keys(data.prices).length} prices from global server cache (fallback)`);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load prices from server:', e);
    }
    return false;
}

/**
 * v9.12.24: Загрузить только обновлённые цены с сервера (инкрементальное обновление)
 * Вызывается каждую минуту для синхронизации с cron scanner
 */
async function loadUpdatedPricesFromServer() {
    // Если нет времени последней загрузки - пропускаем (полная загрузка ещё не завершилась)
    if (!lastPricesLoadTime) {
        console.log('⏳ Incremental sync skipped: waiting for initial load');
        return 0;
    }
    
    try {
        // Запрашиваем цены обновлённые после lastPricesLoadTime
        const sinceTime = lastPricesLoadTime - 60000; // -1 минута для надёжности
        console.log(`🔄 Checking for price updates since ${new Date(sinceTime).toLocaleTimeString()}...`);
        
        const response = await fetch(`${API_BASE}/prices-cache?since=${sinceTime}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.prices) {
                const updatedCount = Object.keys(data.prices).length;
                
                if (updatedCount > 0) {
                    const loadTime = Date.now();
                    
                    // Обновляем только изменённые цены
                    for (const [key, priceData] of Object.entries(data.prices)) {
                        state.brainrotPrices[key] = {
                            ...priceData,
                            _timestamp: loadTime,
                            _serverUpdatedAt: priceData.updatedAt
                        };
                    }
                    
                    // Сохраняем в localStorage
                    savePriceCacheToStorage();
                    
                    console.log(`📊 Updated ${updatedCount} prices from cron scanner`);
                    
                    // Обновляем UI если на панели или коллекции
                    if (state.currentKey) {
                        updateUI();
                    }
                } else {
                    console.log('📊 No new price updates from cron');
                }
                
                // Обновляем время последней загрузки
                lastPricesLoadTime = Date.now();
                return updatedCount;
            }
        } else {
            console.warn('Failed to fetch price updates:', response.status);
        }
    } catch (e) {
        console.warn('Failed to load updated prices:', e.message);
    }
    return 0;
}

/**
 * Сохранить кэш цен в MongoDB
 */
async function savePricesToServer() {
    if (!state.currentKey) return;
    
    try {
        const pricesToSave = {};
        for (const [key, data] of Object.entries(state.brainrotPrices)) {
            if (data && data.suggestedPrice && !data.error) {
                pricesToSave[key] = {
                    suggestedPrice: data.suggestedPrice,
                    competitorPrice: data.competitorPrice,
                    competitorIncome: data.competitorIncome,
                    priceSource: data.priceSource,
                    nextRangeChecked: data.nextRangeChecked || false,
                    isInEldoradoList: data.isInEldoradoList !== false, // default true
                    medianPrice: data.medianPrice,
                    medianData: data.medianData,
                    nextCompetitorPrice: data.nextCompetitorPrice,
                    nextCompetitorData: data.nextCompetitorData,
                    _timestamp: data._timestamp || Date.now()
                };
            }
        }
        
        // Рассчитываем общую стоимость для синхронизации
        const data = state.farmersData[state.currentKey];
        let totalValue = 0;
        if (data && data.accounts) {
            data.accounts.forEach(account => {
                if (account.brainrots) {
                    totalValue += calculateAccountValue(account);
                }
            });
        }
        
        if (Object.keys(pricesToSave).length > 0) {
            await fetch(`${API_BASE}/prices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    farmKey: state.currentKey,
                    prices: pricesToSave,
                    totalValue: totalValue
                })
            });
            console.log(`Saved ${Object.keys(pricesToSave).length} prices and totalValue $${totalValue.toFixed(2)} to server`);
        }
    } catch (e) {
        console.warn('Failed to save prices to server:', e);
    }
}

/**
 * Загрузить кэш цен из localStorage
 * v9.11.14: Загружаем ВСЕ цены (даже устаревшие) для мгновенного отображения
 * Устаревшие цены будут обновлены в фоне
 */
function loadPriceCacheFromStorage() {
    try {
        const stored = localStorage.getItem(PRICE_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const now = Date.now();
            
            // Check cache version - invalidate if old structure
            if (!data.version || data.version < PRICE_CACHE_VERSION) {
                console.log(`Cache version mismatch (${data.version || 0} < ${PRICE_CACHE_VERSION}), clearing old cache`);
                localStorage.removeItem(PRICE_STORAGE_KEY);
                return;
            }
            
            // v9.11.14: Загружаем ВСЕ записи для мгновенного отображения
            // Устаревшие будут помечены и обновлены в фоне
            let freshCount = 0;
            let staleCount = 0;
            for (const [name, entry] of Object.entries(data.brainrotPrices || {})) {
                if (entry.data && entry.timestamp) {
                    state.brainrotPrices[name] = entry.data;
                    state.brainrotPrices[name]._timestamp = entry.timestamp;
                    
                    if (now - entry.timestamp < PRICE_CACHE_TTL) {
                        freshCount++;
                    } else {
                        staleCount++;
                        // Помечаем устаревшие для обновления в фоне
                        state.brainrotPrices[name]._stale = true;
                    }
                }
            }
            
            console.log(`Loaded ${freshCount} fresh + ${staleCount} stale prices from localStorage`);
            
            // v9.12.26: Устанавливаем lastPricesLoadTime из кэша чтобы инкрементальный sync работал сразу
            if (freshCount > 0 || staleCount > 0) {
                lastPricesLoadTime = Date.now();
            }
        }
        
        // Загружаем предыдущие цены для отображения % изменения
        const prevStored = localStorage.getItem(PREVIOUS_PRICES_KEY);
        if (prevStored) {
            const parsed = JSON.parse(prevStored);
            const twoHours = 2 * 60 * 60 * 1000;
            const now = Date.now();
            
            // Фильтруем - оставляем только записи за последние 2 часа
            for (const [key, data] of Object.entries(parsed)) {
                // Поддержка нового формата {price, timestamp} и старого (просто число)
                if (typeof data === 'object' && data.timestamp) {
                    if (now - data.timestamp < twoHours) {
                        state.previousPrices[key] = data;
                    }
                }
                // Старый формат (просто число) - пропускаем, т.к. нет timestamp
            }
            console.log(`Loaded ${Object.keys(state.previousPrices).length} recent previous prices`);
        }
    } catch (e) {
        console.warn('Failed to load price cache from storage:', e);
    }
}

/**
 * Сохранить кэш цен в localStorage
 */
function savePriceCacheToStorage() {
    try {
        const toStore = {
            version: PRICE_CACHE_VERSION,
            brainrotPrices: {}
        };
        
        const now = Date.now();
        for (const [name, data] of Object.entries(state.brainrotPrices)) {
            if (data && !data.error) {
                toStore.brainrotPrices[name] = {
                    data: data,
                    timestamp: data._timestamp || now
                };
            }
        }
        
        localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
        console.warn('Failed to save price cache to storage:', e);
    }
}

/**
 * Проверить нужно ли обновить цену (старше 10 минут)
 * v9.11.14: Также проверяем флаг _stale для устаревших записей
 * v9.12.4: Возвращает true только для реальной необходимости обновления
 *          Устаревшие цены всё равно показываются - это только для фоновой загрузки
 */
function isPriceStale(priceData) {
    if (!priceData || !priceData._timestamp) return true;
    // Если помечено как устаревшее - нужно обновить в фоне
    if (priceData._stale) return true;
    return Date.now() - priceData._timestamp > PRICE_CACHE_TTL;
}

/**
 * v9.12.4: Проверить есть ли цена для отображения (даже устаревшая)
 * Используется при рендере - показываем любую цену из кэша
 */
function hasPriceData(priceData) {
    return priceData && (priceData.suggestedPrice || priceData.medianPrice || priceData.nextCompetitorPrice);
}

/**
 * Рассчитать общую стоимость всех брейнротов
 */
function calculateTotalValue(brainrots) {
    let total = 0;
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(b.name, income);
        const priceData = state.brainrotPrices[cacheKey];
        // v9.9.7: Используем выбранный тип цены
        const price = getSelectedPrice(priceData);
        if (price) {
            total += price;
        }
    }
    return total;
}

/**
 * Рассчитать стоимость брейнротов для аккаунта
 */
function calculateAccountValue(account) {
    if (!account.brainrots) return 0;
    return calculateTotalValue(account.brainrots.map(b => ({
        ...b,
        income: b.income,
        incomeText: b.incomeText
    })));
}

/**
 * Сохранить предыдущие цены перед обновлением
 */
function savePreviousPrices() {
    const now = Date.now();
    for (const [key, data] of Object.entries(state.brainrotPrices)) {
        if (data && data.suggestedPrice) {
            state.previousPrices[key] = {
                price: data.suggestedPrice,
                timestamp: now
            };
        }
    }
    // Сохраняем в localStorage
    try {
        localStorage.setItem(PREVIOUS_PRICES_KEY, JSON.stringify(state.previousPrices));
    } catch (e) {
        console.warn('Failed to save previous prices:', e);
    }
}

/**
 * Получить % изменения цены (только если предыдущая цена была в последний час)
 */
function getPriceChangePercent(cacheKey, newPrice) {
    const prevData = state.previousPrices[cacheKey];
    if (!prevData) return null;
    
    // Поддержка старого формата (просто число)
    const oldPrice = typeof prevData === 'object' ? prevData.price : prevData;
    const timestamp = typeof prevData === 'object' ? prevData.timestamp : 0;
    
    // Если нет цены или цены равны - нет изменения
    if (!oldPrice || oldPrice === newPrice) return null;
    
    // Показываем изменение только если предыдущая цена была в последний час
    const oneHour = 60 * 60 * 1000;
    if (timestamp && Date.now() - timestamp > oneHour) return null;
    
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    
    // Игнорируем маленькие изменения (< 1%)
    if (Math.abs(change) < 1) return null;
    
    return change;
}

/**
 * Форматировать % изменения
 */
function formatPriceChange(percent) {
    if (percent === null || percent === undefined || isNaN(percent)) return '';
    const sign = percent >= 0 ? '+' : '';
    const colorClass = percent >= 0 ? 'price-change-up' : 'price-change-down';
    return `<span class="${colorClass}">${sign}${percent.toFixed(1)}%</span>`;
}

// Load brainrot images mapping
async function loadBrainrotMapping() {
    try {
        const response = await fetch('/brainrots-mapping.json');
        if (response.ok) {
            state.brainrotImages = await response.json();
            console.log(`Loaded ${Object.keys(state.brainrotImages).length} brainrot images`);
        }
    } catch (e) {
        console.warn('Could not load brainrot mapping:', e);
    }
}

/**
 * Предзагрузить изображения брейнротов для мгновенного отображения
 * Загружает только изображения для текущих брейнротов пользователя
 */
async function preloadBrainrotImages() {
    const data = state.farmersData[state.currentKey];
    if (!data || !data.accounts) return;
    
    // Собираем уникальные имена брейнротов
    const brainrotNames = new Set();
    data.accounts.forEach(account => {
        if (account.brainrots) {
            account.brainrots.forEach(b => {
                if (b.name) brainrotNames.add(b.name.toLowerCase().trim());
            });
        }
    });
    
    if (brainrotNames.size === 0) return;
    
    console.log(`🖼️ Preloading ${brainrotNames.size} brainrot images...`);
    
    // Создаём promise для каждого изображения
    const imagePromises = [];
    const maxPreload = 50; // Ограничиваем до 50 изображений
    let count = 0;
    
    for (const name of brainrotNames) {
        if (count >= maxPreload) break;
        
        const imageUrl = getBrainrotImageUrl(name);
        if (imageUrl) {
            const promise = new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = imageUrl;
                // Timeout на случай зависания
                setTimeout(() => resolve(false), 5000);
            });
            imagePromises.push(promise);
            count++;
        }
    }
    
    // Ждём загрузки всех изображений (с таймаутом 8 секунд общим)
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 8000));
    const result = await Promise.race([
        Promise.all(imagePromises),
        timeoutPromise
    ]);
    
    if (result === 'timeout') {
        console.log('⏱️ Image preload timeout, continuing...');
    } else {
        const loaded = result.filter(r => r === true).length;
        console.log(`✅ Preloaded ${loaded}/${imagePromises.length} images`);
    }
}

// Get brainrot image URL
function getBrainrotImageUrl(name) {
    if (!name) return null;
    const normalized = name.toLowerCase().trim();
    const image = state.brainrotImages[normalized] || 
                  state.brainrotImages[normalized.replace(/\s+/g, '_')] ||
                  state.brainrotImages[normalized.replace(/\s+/g, '')];
    return image ? `${BRAINROT_IMAGES_BASE}/${image}` : null;
}

// ===============================================
// ELDORADO PRICE SERVICE
// ===============================================

/**
 * Извлекает название пита из имени брейнрота
 * @param {string} name - полное имя брейнрота
 * @returns {string} - название пита
 */
function extractPitName(name) {
    if (!name) return 'other';
    
    // Известные питы (можно расширять)
    const knownPits = [
        'pot hotspot', 'lucky fountain', 'mythic aurora', 'atlantean',
        'crystal cavern', 'tech terrace', 'cosmic corner', 'nature nook',
        'fire pit', 'ice pit', 'void pit', 'rainbow pit'
    ];
    
    const lowerName = name.toLowerCase();
    
    for (const pit of knownPits) {
        if (lowerName.includes(pit)) {
            return pit;
        }
    }
    
    return 'other';
}

/**
 * Парсит доходность из incomeText
 * @param {string|number} incomeText - например "$112.5M/s", "$1.5B/s" или число
 * @returns {number} - доходность в M/s
 */
function parseIncomeValue(incomeText) {
    if (!incomeText && incomeText !== 0) return 0;
    
    // Если это число - возвращаем как есть или нормализуем
    if (typeof incomeText === 'number') {
        // Если очень большое число - это сырое значение, делим на 1M
        if (incomeText > 10000) {
            return Math.round(incomeText / 1000000 * 10) / 10;
        }
        return incomeText;
    }
    
    // Убираем пробелы и приводим к нижнему регистру
    const clean = String(incomeText).replace(/\s+/g, '').toLowerCase();
    
    // Сначала проверяем B/s (billions) - конвертируем в M/s (*1000)
    const bMatch = clean.match(/\$?([\d.]+)b/);
    if (bMatch) {
        return parseFloat(bMatch[1]) * 1000; // 1.5B -> 1500 M/s
    }
    
    // Паттерны: $112.5m/s, 112.5m/s, $112.5 m/s
    const match = clean.match(/\$?([\d.]+)m/);
    if (match) {
        return parseFloat(match[1]);
    }
    
    // Попробуем просто получить число
    const numMatch = clean.match(/[\d.]+/);
    if (numMatch) {
        return parseFloat(numMatch[0]);
    }
    
    return 0;
}

/**
 * Конвертирует raw income в M/s для API
 * income может быть большим числом (645000000) или уже в M/s (645)
 */
function normalizeIncomeForApi(income, incomeText) {
    // Если есть incomeText - парсим оттуда (самый надёжный способ)
    if (incomeText) {
        const parsed = parseIncomeValue(incomeText);
        if (parsed > 0) return parsed;
    }
    
    // Если income очень большой (>10000) - это сырое значение, делим на 1M
    if (income > 10000) {
        return Math.round(income / 1000000 * 10) / 10; // округляем до 0.1
    }
    
    // Иначе income уже в M/s
    return income;
}

/**
 * Получить ключ кэша для цены (имя + income)
 * @param {string} name - имя брейнрота
 * @param {number} income - доходность M/s
 * @param {string} mutation - мутация (опционально)
 */
function getPriceCacheKey(name, income, mutation = null) {
    // Округляем income до 10 для группировки близких значений
    const roundedIncome = Math.floor(income / 10) * 10;
    // v9.11.0: Добавляем мутацию в ключ для отдельного кэширования цен мутаций
    // v9.11.3: Нормализуем мутацию - очищаем и приводим к единому формату
    // v9.12.10: Приводим мутацию к lowercase для совместимости с серверным кэшем
    let mutationKey = '';
    if (mutation && mutation !== 'None' && mutation !== 'Default') {
        const cleanMut = cleanMutationText(mutation);
        if (cleanMut) {
            mutationKey = `_${cleanMut.toLowerCase()}`;
        }
    }
    return `${name.toLowerCase()}_${roundedIncome}${mutationKey}`;
}

/**
 * Получить цену с Eldorado для брейнрота
 * AI-FIRST: сначала пробуем AI эндпоинт, fallback на regex
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} income - доходность M/s
 * @param {string} mutation - v9.11.0: мутация для фильтрации (опционально)
 * @returns {Promise<object>} - данные о цене
 */
async function fetchEldoradoPrice(brainrotName, income, mutation = null) {
    const cacheKey = getPriceCacheKey(brainrotName, income, mutation);
    
    // Проверяем кэш
    const cached = state.eldoradoPrices[cacheKey];
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        // Если в кэше regex результат и AI pending - пробуем обновить
        if (cached.data && cached.data.aiPending && cached.data.source === 'regex') {
            // Проверяем AI статус в фоне (не блокируем)
            checkAIStatus(brainrotName, income, cacheKey, mutation);
        }
        return cached.data;
    }
    
    try {
        const params = new URLSearchParams({
            name: brainrotName,
            income: income.toString()
        });
        
        // v9.11.0: Добавляем мутацию в запрос
        if (mutation && mutation !== 'None' && mutation !== 'Default') {
            params.set('mutation', mutation);
        }
        
        // Пробуем AI-first эндпоинт
        let data = null;
        try {
            const aiResponse = await fetch(`${API_BASE}/ai-price?${params}`);
            if (aiResponse.ok) {
                data = await aiResponse.json();
                console.log(`🤖 AI price for ${brainrotName}${mutation ? ' (' + mutation + ')' : ''}: $${data.suggestedPrice} (source: ${data.source})`);
            }
        } catch (aiError) {
            console.warn('AI price endpoint failed, falling back to regex:', aiError.message);
        }
        
        // Fallback на обычный eldorado-price если AI не сработал
        if (!data || data.error) {
            const response = await fetch(`${API_BASE}/eldorado-price?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch price');
            }
            data = await response.json();
            data.source = data.source || 'regex';
        }
        
        // Сохраняем в кэш
        state.eldoradoPrices[cacheKey] = {
            data: data,
            timestamp: Date.now()
        };
        
        return data;
    } catch (error) {
        console.warn('Error fetching Eldorado price:', error);
        return null;
    }
}

/**
 * Проверяет статус AI парсинга в фоне и обновляет кэш
 */
async function checkAIStatus(brainrotName, income, cacheKey, mutation = null) {
    try {
        const params = new URLSearchParams({
            name: brainrotName,
            income: income.toString(),
            status: ''
        });
        
        // v9.11.0: Добавляем мутацию если есть
        if (mutation && mutation !== 'None' && mutation !== 'Default') {
            params.set('mutation', mutation);
        }
        
        const response = await fetch(`${API_BASE}/ai-price?${params}`);
        if (!response.ok) return;
        
        const status = await response.json();
        
        // Если AI закончил - обновляем данные
        if (status.status === 'cached' && status.source === 'ai') {
            // Получаем полные данные
            const aiParams = new URLSearchParams({
                name: brainrotName,
                income: income.toString()
            });
            if (mutation && mutation !== 'None' && mutation !== 'Default') {
                aiParams.set('mutation', mutation);
            }
            const aiResponse = await fetch(`${API_BASE}/ai-price?${aiParams}`);
            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                if (aiData.source === 'ai') {
                    console.log(`🤖 AI update for ${brainrotName}${mutation ? ' (' + mutation + ')' : ''}: $${aiData.suggestedPrice}`);
                    state.eldoradoPrices[cacheKey] = {
                        data: aiData,
                        timestamp: Date.now()
                    };
                    // Перерисовываем collection если нужно
                    if (typeof renderBrainrotCollection === 'function') {
                        // Не вызываем полную перерисовку, просто обновим при следующем рендере
                    }
                }
            }
        }
    } catch (e) {
        // Игнорируем ошибки фонового обновления
    }
}

/**
 * Получить цены для списка брейнротов
 * @param {Array} brainrots - [{name, income}]
 * @returns {Promise<Map>} - Map с ценами по ключу name
 */
async function fetchBulkEldoradoPrices(brainrots) {
    const pricesMap = new Map();
    
    // Группируем по уникальным названиям брейнротов
    const uniqueRequests = new Map();
    
    for (const b of brainrots) {
        // Используем полное имя брейнрота для поиска на Eldorado
        const brainrotName = b.name;
        // Нормализуем income к M/s
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const cacheKey = getPriceCacheKey(brainrotName, income);
        
        if (!uniqueRequests.has(cacheKey)) {
            uniqueRequests.set(cacheKey, { brainrotName, income, brainrots: [] });
        }
        uniqueRequests.get(cacheKey).brainrots.push(b.name);
    }
    
    // Получаем цены для уникальных запросов
    const requests = Array.from(uniqueRequests.values());
    
    // Ограничиваем параллельные запросы
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        
        const results = await Promise.all(
            batch.map(req => fetchEldoradoPrice(req.brainrotName, req.income))
        );
        
        // Связываем результаты с брейнротами
        results.forEach((result, idx) => {
            const req = batch[idx];
            if (result) {
                for (const brainrotFullName of req.brainrots) {
                    pricesMap.set(brainrotFullName, result);
                }
            }
        });
        
        // Небольшая задержка между батчами
        if (i + batchSize < requests.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    return pricesMap;
}

/**
 * Форматировать цену для отображения
 */
function formatPrice(price) {
    if (!price || price <= 0) return '—';
    return '$' + price.toFixed(2);
}

/**
 * v9.12.50: Форматировать время последнего обновления цены в компактном формате
 * @param {number|string} timestamp - timestamp или ISO строка
 * @returns {string} - "1m", "5m", "1h", "2h", "1d", "3d" etc
 */
function formatPriceUpdateTime(timestamp) {
    if (!timestamp) return '';
    
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(ts)) return '';
    
    const now = Date.now();
    const diffMs = now - ts;
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 0) return '<1m'; // Future time
    if (diffSeconds < 60) return '<1m';
    if (diffSeconds < 3600) return Math.floor(diffSeconds / 60) + 'm';
    if (diffSeconds < 86400) return Math.floor(diffSeconds / 3600) + 'h';
    return Math.floor(diffSeconds / 86400) + 'd';
}

/**
 * v9.11.1: Рендер единого блока цены для обычных карточек (без мутации)
 * Новый стиль, соответствующий карточкам с мутациями
 * v9.12.12: НИКОГДА не показываем Loading если есть хоть какие-то данные в кэше
 * 
 * @param {object} priceData - данные цены из кэша
 * @param {string} cacheKey - ключ кэша для изменений цены
 * @returns {string} - HTML блока цены
 */
function renderPriceBlock(priceData, cacheKey) {
    // v9.12.12: Если нет данных - показываем компактный placeholder без спиннера
    // Пользователь увидит цену как только она загрузится в фоне
    if (!priceData) {
        return `
            <div class="brainrot-price-block">
                <div class="brainrot-price-single price-pending" data-price-loading="true">
                    <div class="price-pending-text">—</div>
                </div>
            </div>`;
    }
    
    // Error state
    if (priceData.error) {
        return `
            <div class="brainrot-price-block">
                <div class="brainrot-price-single">
                    <div class="price-no-data">No data</div>
                </div>
            </div>`;
    }
    
    const selectedPrice = getSelectedPrice(priceData);
    if (!selectedPrice) {
        return `
            <div class="brainrot-price-block">
                <div class="brainrot-price-single">
                    <div class="price-no-data">No price</div>
                </div>
            </div>`;
    }
    
    const isAboveMarket = priceData.priceSource && priceData.priceSource.includes('above market');
    const competitorInfo = priceData.competitorPrice 
        ? `${isAboveMarket ? 'max ' : '~'}$${priceData.competitorPrice.toFixed(2)}` 
        : '';
    const priceChange = getPriceChangePercent(cacheKey, selectedPrice);
    const changeHtml = formatPriceChange(priceChange);
    
    // Source badge
    const source = priceData.source || priceData.parsingSource || 'regex';
    let sourceBadge = '';
    
    if (source === 'ai' && priceData.nextRangeChecked) {
        sourceBadge = `<span class="parsing-source-badge ai-next-range" title="${t('ai_next_range_tooltip')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>`;
    } else if (source === 'ai') {
        sourceBadge = `<span class="parsing-source-badge ai" title="${t('ai_determined')}"><i class="fas fa-brain"></i></span>`;
    } else if (source === 'hybrid') {
        sourceBadge = `<span class="parsing-source-badge hybrid" title="${t('hybrid_tooltip')}"><i class="fas fa-brain"></i></span>`;
    } else {
        sourceBadge = `<span class="parsing-source-badge regex" title="Regex"><i class="fas fa-robot"></i></span>`;
    }
    
    // Next range badge (only for regex when nextRangeChecked)
    const nextRangeBadge = (priceData.nextRangeChecked && source !== 'ai')
        ? `<span class="next-range-badge" title="${t('next_range_tooltip')}"><i class="fas fa-level-up-alt"></i></span>` 
        : '';
    
    // Price type badge
    const priceTypeLabel = collectionState.priceType !== 'suggested' ? getSelectedPriceLabel() : '';
    const priceTypeBadge = priceTypeLabel ? `<span class="price-type-badge">${priceTypeLabel}</span>` : '';
    
    // Additional prices - v9.11.19: Always show row for consistent height
    const hasNextOpportunity = priceData.nextCompetitorPrice && priceData.competitorPrice && 
        !priceData.nextRangeChecked &&
        ((priceData.nextCompetitorPrice / priceData.competitorPrice) > 2);
    
    // Always show additional row for consistent card height
    let additionalHtml = '<div class="price-additional">';
    // Median price (always show, even as --)
    const medianTooltip = priceData.medianData 
        ? `Median of ${priceData.medianData.offersUsed} offers` 
        : 'Median price';
    if (priceData.medianPrice) {
        additionalHtml += `<span class="additional-price median" title="${medianTooltip}"><i class="fas fa-chart-bar"></i>${formatPrice(priceData.medianPrice)}</span>`;
    } else {
        additionalHtml += `<span class="additional-price median empty" title="Median not available"><i class="fas fa-chart-bar"></i>--</span>`;
    }
    // Next competitor price (always show, even as --)
    if (priceData.nextCompetitorPrice) {
        const nextTooltip = priceData.nextCompetitorData 
            ? `Next: ${priceData.nextCompetitorData.income}M/s @ $${priceData.nextCompetitorData.price?.toFixed(2)}` 
            : 'Next competitor';
        additionalHtml += `<span class="additional-price next-comp ${hasNextOpportunity ? 'opportunity' : ''}" title="${nextTooltip}"><i class="fas fa-arrow-up"></i>${formatPrice(priceData.nextCompetitorPrice)}</span>`;
    } else {
        additionalHtml += `<span class="additional-price next-comp empty" title="No next competitor"><i class="fas fa-arrow-up"></i>--</span>`;
    }
    // v9.12.53: Use _timestamp (client load time) for freshness indicator
    const lastUpdateTime = formatPriceUpdateTime(priceData._timestamp);
    if (lastUpdateTime) {
        additionalHtml += `<span class="price-last-update" title="Data loaded ${lastUpdateTime} ago">${lastUpdateTime}</span>`;
    }
    additionalHtml += '</div>';
    
    return `
        <div class="brainrot-price-block">
            <div class="brainrot-price-single" 
                 title="${priceData.priceSource || ''}"
                 data-suggested="${priceData.suggestedPrice || 0}"
                 data-median="${priceData.medianPrice || 0}"
                 data-next="${priceData.nextCompetitorPrice || 0}">
                <div class="price-header">
                    <span class="price-label">PRICE</span>
                    <span class="price-badges">
                        ${priceTypeBadge}
                        ${sourceBadge}
                        ${nextRangeBadge}
                    </span>
                </div>
                <div class="price-main">
                    <span class="price-text">${formatPrice(selectedPrice)}</span>
                    ${competitorInfo ? `<span class="price-market">${competitorInfo}</span>` : ''}
                </div>
                <div class="price-change">${changeHtml}</div>
                ${additionalHtml}
            </div>
        </div>`;
}

/**
 * v9.11.0: Рендер блока цен с вариантами (Default и Mutation)
 * Используется когда у брейнрота есть мутация
 * 
 * @param {string} brainrotName - имя брейнрота
 * @param {number} income - доходность M/s  
 * @param {string} mutation - название мутации
 * @returns {string} - HTML блока цен
 */
function renderPriceVariants(brainrotName, income, mutation) {
    // Ключи кэша для default и mutation
    const defaultCacheKey = getPriceCacheKey(brainrotName, income);
    const mutationCacheKey = getPriceCacheKey(brainrotName, income, mutation);
    
    const defaultPrice = state.brainrotPrices[defaultCacheKey];
    const mutationPrice = state.brainrotPrices[mutationCacheKey];
    
    // Стили для мутации
    const mStyles = getMutationStyles(mutation);
    const cleanMutation = cleanMutationText(mutation);
    
    // v9.11.1: Рендер бейджей источника (AI/regex/next-range)
    const renderSourceBadges = (priceData) => {
        if (!priceData || priceData.error) return '';
        
        const source = priceData.source || priceData.parsingSource || 'regex';
        let badges = '<span class="price-variant-badges">';
        
        // AI + nextRangeChecked = brain + yellow arrow
        if (source === 'ai' && priceData.nextRangeChecked) {
            badges += `<span class="parsing-source-badge ai-next-range" title="${t('ai_next_range_tooltip')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>`;
        } else if (source === 'ai') {
            badges += `<span class="parsing-source-badge ai" title="${t('ai_determined')}"><i class="fas fa-brain"></i></span>`;
        } else if (source === 'hybrid') {
            badges += `<span class="parsing-source-badge hybrid" title="${t('hybrid_tooltip')}"><i class="fas fa-brain"></i></span>`;
        } else {
            badges += `<span class="parsing-source-badge regex" title="Regex"><i class="fas fa-robot"></i></span>`;
        }
        
        // Next range badge (only for regex)
        if (priceData.nextRangeChecked && source !== 'ai') {
            badges += `<span class="next-range-badge" title="${t('next_range_tooltip')}"><i class="fas fa-level-up-alt"></i></span>`;
        }
        
        badges += '</span>';
        return badges;
    };
    
    // Рендер одного варианта цены
    // v9.12.12: Компактный placeholder вместо Loading... спиннера
    // v9.12.33: Added price change percentage support
    const renderVariant = (priceData, type, label, cacheKey) => {
        if (!priceData) {
            return `
                <div class="price-variant ${type} price-pending" data-price-loading="true">
                    <div class="price-variant-header">
                        <span class="price-variant-label ${type === 'mutated' ? 'mutation' : type}" 
                              ${type === 'mutated' ? `style="background: ${mStyles.background}; color: ${mStyles.textColor};"` : ''}>${label}</span>
                    </div>
                    <div class="price-variant-main">
                        <span class="price-text price-pending-text">—</span>
                    </div>
                    <div class="price-variant-change"></div>
                </div>`;
        }
        
        if (priceData.error) {
            return `
                <div class="price-variant ${type}">
                    <div class="price-variant-header">
                        <span class="price-variant-label ${type}">${label}</span>
                    </div>
                    <div class="price-variant-no-data">No data</div>
                    <div class="price-variant-change"></div>
                </div>`;
        }
        
        const selectedPrice = getSelectedPrice(priceData);
        const isAboveMarket = priceData.priceSource && priceData.priceSource.includes('above market');
        const competitorInfo = priceData.competitorPrice 
            ? `${isAboveMarket ? 'max' : '~'}$${priceData.competitorPrice.toFixed(2)}` 
            : '';
        
        // Source badges
        const sourceBadges = renderSourceBadges(priceData);
        
        // v9.12.33: Price change percentage
        const priceChange = getPriceChangePercent(cacheKey, selectedPrice);
        const changeHtml = formatPriceChange(priceChange);
        
        // Additional prices (median, next competitor)
        // v9.11.7: Add opportunity class when nextCompetitor gap > 100%
        // v9.11.19: Always show row for consistent height
        let additionalHtml = '<div class="price-variant-additional">';
        // Median - always show
        if (priceData.medianPrice) {
            additionalHtml += `<span class="additional-price median" title="Median"><i class="fas fa-chart-bar"></i>${formatPrice(priceData.medianPrice)}</span>`;
        } else {
            additionalHtml += `<span class="additional-price median empty" title="No median"><i class="fas fa-chart-bar"></i>--</span>`;
        }
        // Next competitor - always show
        if (priceData.nextCompetitorPrice) {
            const hasOpportunity = priceData.competitorPrice && 
                (priceData.nextCompetitorPrice / priceData.competitorPrice) > 2;
            additionalHtml += `<span class="additional-price next-comp ${hasOpportunity ? 'opportunity' : ''}" title="Next"><i class="fas fa-arrow-up"></i>${formatPrice(priceData.nextCompetitorPrice)}</span>`;
        } else {
            additionalHtml += `<span class="additional-price next-comp empty" title="No next"><i class="fas fa-arrow-up"></i>--</span>`;
        }
        // v9.12.53: Use _timestamp (client load time) for freshness indicator
        const lastUpdateTime = formatPriceUpdateTime(priceData._timestamp);
        if (lastUpdateTime) {
            additionalHtml += `<span class="price-last-update" title="Data loaded ${lastUpdateTime} ago">${lastUpdateTime}</span>`;
        }
        additionalHtml += '</div>';
        
        return `
            <div class="price-variant ${type}" 
                 data-price-type="${type}"
                 data-suggested="${priceData.suggestedPrice || 0}"
                 data-median="${priceData.medianPrice || 0}"
                 data-next="${priceData.nextCompetitorPrice || 0}"
                 ${type === 'mutated' ? `style="--mutation-glow: ${mStyles.glowColor}40; --mutation-bg: ${mStyles.background}; --mutation-color: ${mStyles.textColor};"` : ''}>
                <div class="price-variant-header">
                    <span class="price-variant-label ${type === 'mutated' ? 'mutation' : type}" 
                          ${type === 'mutated' ? `style="background: ${mStyles.background}; color: ${mStyles.textColor};"` : ''}>${label}</span>
                    ${sourceBadges}
                </div>
                <div class="price-variant-main">
                    <span class="price-text">${formatPrice(selectedPrice)}</span>
                    ${competitorInfo ? `<span class="price-market">${competitorInfo}</span>` : ''}
                </div>
                <div class="price-variant-change">${changeHtml}</div>
                ${additionalHtml}
            </div>`;
    };
    
    return `
        <div class="brainrot-price-variants" 
             data-brainrot-name="${brainrotName}" 
             data-brainrot-income="${income}"
             data-brainrot-mutation="${mutation}">
            ${renderVariant(defaultPrice, 'default', 'DEFAULT', defaultCacheKey)}
            ${renderVariant(mutationPrice, 'mutated', cleanMutation, mutationCacheKey)}
        </div>`;
}

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const farmKeyInput = document.getElementById('farmKeyInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const currentFarmerEl = document.getElementById('currentFarmer');

const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');

const statsEls = {
    totalAccounts: document.getElementById('totalAccounts'),
    onlineAccounts: document.getElementById('onlineAccounts'),
    totalIncome: document.getElementById('totalIncome'),
    totalValue: document.getElementById('totalValue'),
    totalValueChange: document.getElementById('totalValueChange'),
    totalBrainrots: document.getElementById('totalBrainrots')
};
const accountsGridEl = document.getElementById('accountsGrid');
const accountsListEl = document.getElementById('accountsList');
const farmKeysListEl = document.getElementById('farmKeysList');

// Offers elements - Note: some elements may not exist at init time (loaded dynamically)
const offersGridEl = document.getElementById('offersGrid');
const offersStatsEl = document.getElementById('offersStats');
const offerSearchEl = document.getElementById('offerSearch');
const offerSortDropdown = document.getElementById('offerSortDropdown');
const offerStatusDropdown = document.getElementById('offerStatusDropdown');
const selectAllOffersEl = document.getElementById('selectAllOffers');
const bulkAdjustBtn = document.getElementById('bulkAdjustBtn');
// bulkDeleteBtn is found dynamically - may not exist at page load
const bulkPriceModal = document.getElementById('bulkPriceModal');
const offerPriceModal = document.getElementById('offerPriceModal');

const addKeyBtn = document.getElementById('addKeyBtn');
const addKeyModal = document.getElementById('addKeyModal');
const newKeyInput = document.getElementById('newKeyInput');
const modalError = document.getElementById('modalError');
const closeModal = document.getElementById('closeModal');
const cancelAddKey = document.getElementById('cancelAddKey');
const confirmAddKey = document.getElementById('confirmAddKey');

const editUsernameModal = document.getElementById('editUsernameModal');
const usernameInput = document.getElementById('usernameInput');
const usernameError = document.getElementById('usernameError');
const closeUsernameModal = document.getElementById('closeUsernameModal');
const cancelEditUsername = document.getElementById('cancelEditUsername');
const confirmEditUsername = document.getElementById('confirmEditUsername');

let editingKeyForUsername = null;

// Loading screen element
const loadingScreen = document.getElementById('loadingScreen');

// Hide loading screen
function hideLoadingScreen() {
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

// Update loading screen text
function updateLoadingText(text) {
    const loadingSubtitle = loadingScreen?.querySelector('.loading-subtitle');
    if (loadingSubtitle) {
        loadingSubtitle.textContent = text;
    }
}

/**
 * v9.11.20: Fetch с timeout чтобы не висеть вечно при MongoDB проблемах
 */
function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// Initialize - оптимизировано для быстрой загрузки
document.addEventListener('DOMContentLoaded', async () => {
    // === ЭТАП 0: Применяем тему и язык мгновенно ===
    loadLanguage(); // Загружаем сохранённый язык
    applyTheme(loadTheme()); // Загружаем и применяем тему
    applyLocalization(); // Применяем локализацию к статическим элементам
    
    // === ЭТАП 1: Синхронная загрузка из localStorage (мгновенная) ===
    loadState();
    const cacheResult = loadFarmersDataFromCache(); // Кэш данных фермеров (теперь возвращает объект)
    loadPriceCacheFromStorage(); // Кэш цен
    loadAvatarCache(); // Кэш аватаров
    loadOffersFromStorage(); // Кэш офферов
    loadShopNameFromCache(); // Кэш названия магазина (мгновенно)
    
    // v2.5: Загружаем кэш графиков СРАЗУ (до показа UI)
    if (state.currentKey) {
        const chartCacheLoaded = loadBalanceHistoryFromCache();
        if (chartCacheLoaded) {
            console.log('📊 Chart cache loaded at startup');
        }
    }
    
    setupEventListeners();
    
    // === ЭТАП 2: Загружаем критические ресурсы перед показом UI ===
    if (state.currentKey && state.savedKeys.length > 0) {
        updateLoadingText('Loading brainrot images...');
        
        // Загружаем маппинг брейнротов (нужен для изображений)
        await loadBrainrotMapping();
        
        // Предзагружаем изображения ДО показа UI
        await preloadBrainrotImages();
        
        // v9.12.5: Используем hasCurrentKeyData из результата загрузки кэша
        const hasCachedData = cacheResult.hasCurrentKeyData;
        
        // v9.12.5: Нужно грузить свежие данные если кэш устаревший ИЛИ нет данных для текущего ключа
        const needsFreshData = !cacheResult.isFresh || !cacheResult.hasCurrentKeyData;
        
        // v9.12.17: Цены грузим в фоне, НЕ блокируем показ UI
        // Цены из localStorage уже загружены (loadPriceCacheFromStorage выше)
        const hasCachedPrices = Object.keys(state.brainrotPrices).length > 0;
        if (!hasCachedPrices) {
            // Грузим цены в фоне (не await!)
            loadPricesFromServer().then(() => {
                console.log('✅ Loaded prices from server (background)');
                // Обновляем UI когда цены загрузятся
                if (collectionState.allBrainrots.length > 0) {
                    renderCollection();
                }
            }).catch(e => console.warn('Failed to load prices:', e.message));
        }
        
        // v9.12.5: Если есть кэш для текущего ключа - показываем UI СРАЗУ
        if (hasCachedData) {
            console.log('✅ Showing cached data immediately for', state.currentKey);
            showMainApp();
            hideLoadingScreen();
            updateUI();
        } else {
            // v9.12.17: Показываем UI СРАЗУ, даже без кэша
            // Данные загрузятся в фоне и UI обновится автоматически
            console.log('No cached data for', state.currentKey, '- showing UI, loading in background...');
            showMainApp();
            hideLoadingScreen();
            
            // Показываем индикатор загрузки в grid
            const grid = document.getElementById('brainrotsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #a0a0b0;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; display: block; color: #6366f1;"></i>
                        <div>Loading collection data...</div>
                    </div>
                `;
            }
            
            // v9.12.18: Используем быстрый sync-fast endpoint с in-memory кэшем
            fetchWithTimeout(
                `${API_BASE}/sync-fast?key=${encodeURIComponent(state.currentKey)}`,
                {},
                10000 // Меньший таймаут - данные должны приходить быстро
            ).then(async response => {
                if (response.ok) {
                    const data = await response.json();
                    state.farmersData[state.currentKey] = data;
                    saveFarmersDataToCache();
                    console.log('✅ Loaded farmer data from server (background)');
                    updateUI(); // Обновляем UI с новыми данными
                }
            }).catch(e => {
                console.warn('Failed to load farmer data:', e.message);
                // Показываем сообщение об ошибке в grid
                if (grid) {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #a0a0b0;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block; color: #f59e0b;"></i>
                            <div>Failed to load data. Waiting for sync from farm script...</div>
                        </div>
                    `;
                }
            });
        }
        
        // === ЭТАП 3: Последовательная фоновая загрузка (снижает нагрузку на MongoDB) ===
        // Загружаем данные с небольшими задержками чтобы избежать перегрузки
        // ВАЖНО: loadBrainrotMapping уже вызван выше (для preload изображений)
        
        // Запускаем polling с задержкой (даём время на первые загрузки)
        setTimeout(() => {
            startPolling();
        }, 2000);
        
        // Автообновление цен каждые 10 минут
        startAutoPriceRefresh();
        
        // Слушаем события обновления офферов от Tampermonkey скрипта
        setupOffersRefreshListener();
        
        // v9.12.3: Сохраняем начальный ключ для проверки при фоновой загрузке
        const initialKey = state.currentKey;
        
        // Последовательная загрузка фоновых данных с задержками
        // v9.11.20: Добавлены таймауты для каждой операции
        // v9.12.3: Добавлена проверка смены ключа
        // v9.12.4: Добавлена загрузка свежих данных если кэш устаревший
        (async function loadBackgroundData() {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            const withTimeout = (promise, ms) => Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
            ]);
            
            // v9.12.3: Проверка что ключ не изменился
            const keyChanged = () => state.currentKey !== initialKey;
            
            try {
                // v9.12.18: Используем быстрый sync-fast endpoint
                if (needsFreshData) {
                    console.log('🔄 Loading fresh data in background (cache was stale)...');
                    await delay(100);
                    try {
                        const response = await withTimeout(
                            fetch(`${API_BASE}/sync-fast?key=${encodeURIComponent(initialKey)}&_=${Date.now()}`, { cache: 'no-store' }),
                            10000 // 10 секунд - sync-fast должен быть быстрее
                        );
                        if (response.ok && !keyChanged()) {
                            const data = await response.json();
                            state.farmersData[initialKey] = data;
                            saveFarmersDataToCache();
                            console.log('✅ Loaded fresh farmer data in background');
                            updateUI(); // Обновляем UI свежими данными
                        }
                    } catch (e) {
                        console.warn('Background data refresh failed:', e.message);
                    }
                }
                
                if (keyChanged()) return;
                
                // 1. Цены (если не загружены ранее)
                if (Object.keys(state.brainrotPrices).length === 0) {
                    await withTimeout(loadPricesFromServer(), 10000).then(async loaded => {
                        if (loaded && !keyChanged()) {
                            console.log('✅ Loaded prices from server cache');
                            updateUI();
                            renderFarmKeys();
                            if (collectionState.allBrainrots.length > 0) {
                                renderCollection();
                            }
                        }
                    }).catch(e => console.warn('Prices load failed:', e.message));
                }
                
                if (keyChanged()) return; // v9.12.3: Прерываем если ключ изменился
                await delay(200);
                
                // 2. Офферы
                await withTimeout(loadOffers(false, true), 10000).then(() => {
                    if (!keyChanged() && collectionState.allBrainrots.length > 0) {
                        renderCollection();
                    }
                }).catch(e => console.warn('Offers load failed:', e.message));
                
                if (keyChanged()) return;
                await delay(200);
                
                // 3. История баланса - v9.11.26: увеличен timeout, updateChart внутри loadBalanceHistory
                await withTimeout(loadBalanceHistory(), 15000).catch(e => {
                    console.warn('Balance history:', e.message);
                    // v9.11.26: Пробуем обновить график даже при timeout (данные могли загрузиться)
                    if (!keyChanged() && state.balanceHistory[state.currentKey]?.length > 1) {
                        updateBalanceChart();
                    }
                });
                
                if (keyChanged()) return;
                await delay(200);
                
                // 4. Топ данные
                await withTimeout(preloadTopData(), 8000).catch(e => console.warn('Top data:', e.message));
                
                if (keyChanged()) return;
                await delay(200);
                
                // 5. Данные всех фермеров (не критично если не загрузится)
                await withTimeout(fetchAllFarmersData(), 10000).catch(e => console.warn('Farmers data:', e.message));
                
                if (keyChanged()) return;
                await delay(200);
                
                // 6. Название магазина
                await withTimeout(loadShopName(), 5000).catch(e => console.warn('Shop name:', e.message));
                
                if (!keyChanged()) {
                    console.log('✅ Background loading complete');
                }
            } catch (e) {
                console.warn('Background loading error:', e);
            }
        })();
    } else {
        // Если нет ключа - показываем логин, но всё равно грузим маппинг
        loadBrainrotMapping();
        showLoginScreen();
    }
});
// State Management
function loadState() {
    try {
        const saved = localStorage.getItem('farmerPanelState');
        if (saved) {
            const parsed = JSON.parse(saved);
            state.currentKey = parsed.currentKey || null;
            state.savedKeys = parsed.savedKeys || [];
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem('farmerPanelState', JSON.stringify({
            currentKey: state.currentKey,
            savedKeys: state.savedKeys
        }));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// Кэширование данных фермеров в localStorage
const FARMERS_CACHE_KEY = 'farmerPanelFarmersCache';
const FARMERS_CACHE_EXPIRY = 30 * 60 * 1000; // 30 минут (свежий кэш)
const FARMERS_CACHE_STALE_EXPIRY = 24 * 60 * 60 * 1000; // 24 часа (устаревший но всё ещё показываем)

function saveFarmersDataToCache() {
    try {
        // v9.12.5: Сохраняем данные для ВСЕХ загруженных ключей (не только текущего)
        // Это позволяет быстро переключаться между ключами
        const dataToSave = {};
        for (const [key, value] of Object.entries(state.farmersData)) {
            if (value && value.accounts && value.accounts.length > 0) {
                dataToSave[key] = value;
            }
        }
        
        if (Object.keys(dataToSave).length === 0) return;
        
        const cache = {
            timestamp: Date.now(),
            currentKey: state.currentKey,
            data: dataToSave
        };
        localStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        // Если QuotaExceeded - очищаем старые данные
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage full, clearing old cache...');
            try {
                localStorage.removeItem(FARMERS_CACHE_KEY);
                localStorage.removeItem('farmerPanelAvatarCache');
                localStorage.removeItem('farmerPanelBrainrotImages');
            } catch (clearError) {
                console.error('Failed to clear cache:', clearError);
            }
        } else {
            console.error('Failed to save farmers cache:', e);
        }
    }
}

function loadFarmersDataFromCache() {
    try {
        const cached = localStorage.getItem(FARMERS_CACHE_KEY);
        if (cached) {
            const { timestamp, currentKey: cachedKey, data } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            // Загружаем кэш даже если устаревший (до 24ч) - покажем что-то пока грузится свежее
            if (age < FARMERS_CACHE_STALE_EXPIRY && data) {
                // v9.12.5: Мёржим данные из кэша в state, не перезаписывая
                for (const [key, value] of Object.entries(data)) {
                    if (value && value.accounts) {
                        state.farmersData[key] = value;
                    }
                }
                
                const isFresh = age < FARMERS_CACHE_EXPIRY;
                const isStale = !isFresh;
                
                // v9.12.5: Проверяем есть ли данные для ТЕКУЩЕГО ключа
                const hasCurrentKeyData = state.currentKey && 
                    state.farmersData[state.currentKey] && 
                    state.farmersData[state.currentKey].accounts &&
                    state.farmersData[state.currentKey].accounts.length > 0;
                
                if (hasCurrentKeyData) {
                    console.log(`Loaded farmers data from cache for ${state.currentKey} (${isFresh ? 'fresh' : 'stale, ' + Math.round(age/60000) + 'min old'})`);
                    return { loaded: true, isFresh, isStale, hasCurrentKeyData: true };
                } else {
                    console.log(`Loaded farmers cache but no data for current key ${state.currentKey} (cached key: ${cachedKey})`);
                    return { loaded: true, isFresh: false, isStale: true, hasCurrentKeyData: false };
                }
            }
        }
    } catch (e) {
        console.error('Failed to load farmers cache:', e);
    }
    return { loaded: false, isFresh: false, isStale: false, hasCurrentKeyData: false };
}

// Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    
    // Add key modal
    addKeyBtn.addEventListener('click', () => openModal(addKeyModal));
    closeModal.addEventListener('click', () => closeModalFn(addKeyModal));
    cancelAddKey.addEventListener('click', () => closeModalFn(addKeyModal));
    confirmAddKey.addEventListener('click', handleAddKey);
    addKeyModal.querySelector('.modal-overlay').addEventListener('click', () => closeModalFn(addKeyModal));
    
    // Edit username modal
    closeUsernameModal.addEventListener('click', () => closeModalFn(editUsernameModal));
    cancelEditUsername.addEventListener('click', () => closeModalFn(editUsernameModal));
    confirmEditUsername.addEventListener('click', handleEditUsername);
    editUsernameModal.querySelector('.modal-overlay').addEventListener('click', () => closeModalFn(editUsernameModal));
    
    // Format key input
    farmKeyInput.addEventListener('input', formatKeyInput);
    newKeyInput.addEventListener('input', formatKeyInput);
    
    // Horizontal scroll with mouse wheel for brainrots-scroll elements
    document.addEventListener('wheel', (e) => {
        const scrollContainer = e.target.closest('.brainrots-scroll');
        if (scrollContainer) {
            e.preventDefault();
            scrollContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
    
    // Account switcher dropdown
    const farmerWrapper = document.getElementById('currentFarmerWrapper');
    if (farmerWrapper) {
        farmerWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAccountDropdown();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const switcher = document.getElementById('accountSwitcher');
        if (switcher && !switcher.contains(e.target)) {
            toggleAccountDropdown(false);
        }
    });
    
    // Mass selection FAB button
    const massSelectFab = document.getElementById('massSelectFab');
    if (massSelectFab) {
        massSelectFab.addEventListener('click', toggleMassSelectionMode);
    }
    
    // Mass generation modal close button
    const closeMassGenModal = document.getElementById('closeMassGenModal');
    if (closeMassGenModal) {
        closeMassGenModal.addEventListener('click', closeMassGenerationModal);
    }
    
    // Global price type selector for mass generation
    const massGenGlobalPriceType = document.getElementById('massGenGlobalPriceType');
    if (massGenGlobalPriceType) {
        massGenGlobalPriceType.addEventListener('change', (e) => {
            const globalType = e.target.value;
            if (globalType) {
                // Apply to all individual selectors
                document.querySelectorAll('.mass-gen-price-select').forEach(select => {
                    const option = select.querySelector(`option[value="${globalType}"]`);
                    if (option && !option.disabled) {
                        select.value = globalType;
                    }
                });
            }
        });
    }
    
    // Start mass generation button
    const startMassGenBtn = document.getElementById('startMassGenBtn');
    if (startMassGenBtn) {
        startMassGenBtn.addEventListener('click', startMassGeneration);
    }
    
    // Settings modal
    setupSettingsListeners();
}

// Settings modal handlers
function setupSettingsListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            openModal(settingsModal);
            updateSettingsUI();
        });
        
        closeSettingsModal?.addEventListener('click', () => closeModalFn(settingsModal));
        settingsModal.querySelector('.modal-overlay')?.addEventListener('click', () => closeModalFn(settingsModal));
        
        // Language buttons
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                saveLanguage(lang);
                applyLocalization();
                // Re-render dynamic elements with new translations (without reloading data)
                rerenderDynamicElements();
                updateSettingsUI();
                showNotification(lang === 'en' ? 'Language changed to English' : 'Язык изменён на русский', 'success');
            });
        });
        
        // Theme buttons
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                saveTheme(theme);
                applyTheme(theme);
                updateSettingsUI();
                const themeName = THEMES[theme]?.name || theme;
                showNotification(t('theme_changed') + ': ' + themeName, 'success');
            });
        });
    }
}

// Update settings modal UI to show current selections
function updateSettingsUI() {
    const currentLang = loadLanguage();
    const currentTheme = loadTheme();
    
    // Update language buttons
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    
    // Update theme buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
}

function formatKeyInput(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = 'FARM-';
    
    if (value.startsWith('FARM')) {
        value = value.slice(4);
    }
    
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) {
            formatted += '-';
        }
        formatted += value[i];
    }
    
    e.target.value = formatted;
}

// Auth
async function handleLogin(e) {
    e.preventDefault();
    const key = farmKeyInput.value.trim();
    
    if (!key) {
        loginError.textContent = 'Please enter a farm key';
        return;
    }
    
    loginError.textContent = 'Validating...';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: key })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            loginError.textContent = data.error || 'Invalid farm key';
            return;
        }
        
        // Проверяем новый ли это ключ
        const isNewKey = !state.savedKeys.find(k => k.farmKey === key);
        
        // Add key to saved keys if not exists
        if (isNewKey) {
            state.savedKeys.push({
                farmKey: key,
                username: data.username,
                avatar: data.avatar,
                addedAt: new Date().toISOString()
            });
            
            // Автоматически назначаем цвет рамки для нового пользователя
            try {
                await fetch(`${API_BASE}/user-color`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ farmKey: key })
                });
                console.log('Default color assigned for new user');
            } catch (e) {
                console.warn('Failed to assign default color:', e);
            }
        }
        
        state.currentKey = key;
        saveState();
        
        showMainApp();
        startPolling();
        
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Connection error. Please try again.';
    }
}

function handleLogout() {
    state.currentKey = null;
    state.farmersData = {};
    saveState();
    showLoginScreen();
    stopPolling();
}

// Полная очистка кэша (для решения проблем с отображением)
function clearAllCache() {
    try {
        // Очищаем ВСЁ из localStorage для чистоты
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Очищаем state
        state.farmersData = {};
        console.log('All localStorage cleared! Removed', keysToRemove.length, 'keys');
        
        // Перезагружаем страницу
        alert('Кэш очищен! Страница перезагрузится.');
        location.reload();
        return true;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return false;
    }
}

// Экспортируем в window для доступа из консоли
window.clearAllCache = clearAllCache;

// Views
function showLoginScreen() {
    hideLoadingScreen(); // Скрываем loading screen
    loginScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
    farmKeyInput.value = '';
    loginError.textContent = '';
}

function showMainApp() {
    hideLoadingScreen(); // Скрываем loading screen
    loginScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    updateCurrentFarmer();
    renderFarmKeys();
    
    // Запускаем cron таймер в хедере
    initCronTimer();
    
    // Восстанавливаем последнюю активную вкладку
    restoreLastView();
}

function switchView(viewName) {
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}View`);
    });
    
    // Сохраняем активную вкладку в localStorage
    try {
        localStorage.setItem('glitched_active_view', viewName);
    } catch (e) {
        console.warn('Failed to save active view:', e);
    }
    
    // Управление видимостью FAB кнопки массового выбора
    const massSelectFab = document.getElementById('massSelectFab');
    if (massSelectFab) {
        if (viewName === 'collection') {
            massSelectFab.classList.add('visible');
        } else {
            massSelectFab.classList.remove('visible');
            // При выходе из collection view - выключаем режим массового выбора
            if (typeof massSelectionState !== 'undefined' && massSelectionState.enabled) {
                toggleMassSelectionMode();
            }
        }
    }
    
    // При переключении на Farm Keys - обновляем данные всех фермеров
    if (viewName === 'farmers') {
        fetchAllFarmersData();
    }
    
    // При переключении на Offers - загружаем офферы и запускаем auto-refresh
    if (viewName === 'offers') {
        initOffersView();
    } else {
        // Останавливаем auto-refresh офферов при выходе с вкладки
        stopOffersAutoRefresh();
    }
    
    // При переключении на Top - инициализируем раздел
    if (viewName === 'top') {
        initTopView();
    }
}

// Восстановить последнюю активную вкладку
function restoreLastView() {
    try {
        const savedView = localStorage.getItem('glitched_active_view');
        if (savedView) {
            // Проверяем что такая вкладка существует
            const validViews = ['dashboard', 'accounts', 'collection', 'farmers', 'offers', 'top'];
            if (validViews.includes(savedView)) {
                switchView(savedView);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to restore active view:', e);
    }
    return false;
}

// Polling
let pollingInterval = null;
let statusPollingInterval = null; // Fast polling for status only
let currentFetchController = null; // AbortController для отмены запросов
let fetchRequestId = 0; // ID запроса для проверки актуальности

function startPolling() {
    fetchFarmerData();
    // Full data every 10 seconds (reduced from 5s to lower MongoDB load)
    pollingInterval = setInterval(fetchFarmerData, 10000);
    // Fast status updates every 6 seconds (reduced from 3s)
    statusPollingInterval = setInterval(fetchStatusOnly, 6000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

// Fast status-only fetch (lightweight endpoint)
let statusController = null;
let lastStatusRequestId = 0;
let statusErrorCount = 0; // Track consecutive errors
const MAX_STATUS_ERRORS = 3; // Skip polling after this many errors

async function fetchStatusOnly() {
    if (!state.currentKey) return;
    
    // Skip if too many consecutive errors (backoff)
    if (statusErrorCount >= MAX_STATUS_ERRORS) {
        statusErrorCount--; // Slowly decrease to allow retry
        return;
    }
    
    const thisStatusId = ++lastStatusRequestId;
    
    try {
        // Abort previous status request
        if (statusController) {
            statusController.abort();
        }
        statusController = new AbortController();
        
        const response = await fetch(`${API_BASE}/status?key=${encodeURIComponent(state.currentKey)}&_=${Date.now()}`, {
            cache: 'no-store',
            signal: statusController.signal
        });
        
        if (!response.ok) {
            statusErrorCount++;
            return;
        }
        
        statusErrorCount = 0; // Reset on success
        
        // Check if this is still the latest request
        if (thisStatusId !== lastStatusRequestId) {
            return;
        }
        
        const statusData = await response.json();
        
        // Update only status-related data in existing cards
        if (statusData.accounts && state.farmersData[state.currentKey]) {
            const existingAccounts = state.farmersData[state.currentKey].accounts || [];
            const now = Date.now();
            
            statusData.accounts.forEach(statusAcc => {
                const existing = existingAccounts.find(a => a.playerName === statusAcc.playerName);
                if (existing) {
                    // Only update if status data is fresher or same age
                    let shouldUpdate = true;
                    if (existing.lastUpdate && statusAcc.lastUpdate) {
                        try {
                            const existingTime = new Date(existing.lastUpdate).getTime();
                            const statusTime = new Date(statusAcc.lastUpdate).getTime();
                            // Don't overwrite with older data
                            if (statusTime < existingTime) {
                                shouldUpdate = false;
                            }
                        } catch (e) {}
                    }
                    
                    if (!shouldUpdate) return;
                    
                    // Calculate isOnline on frontend from lastUpdate
                    let calculatedOnline = false;
                    if (statusAcc.lastUpdate) {
                        try {
                            const lastUpdateTime = new Date(statusAcc.lastUpdate).getTime();
                            const diffSeconds = (now - lastUpdateTime) / 1000;
                            calculatedOnline = diffSeconds <= 180; // 3 minutes
                        } catch (e) {}
                    }
                    
                    // Update status fields
                    existing.isOnline = calculatedOnline;
                    existing._isOnline = calculatedOnline;
                    existing.lastUpdate = statusAcc.lastUpdate;
                    // status = действие фермера (idle, searching, walking и т.д.)
                    // НЕ "offline" - online/offline определяется по isOnline
                    existing.status = statusAcc.status || 'idle';
                    existing.action = statusAcc.action || '';
                    existing.totalIncome = statusAcc.totalIncome;
                    existing.totalIncomeFormatted = statusAcc.totalIncomeFormatted;
                    existing.totalBrainrots = statusAcc.totalBrainrots;
                    existing.maxSlots = statusAcc.maxSlots;
                    // ADDED: Update brainrots array for real-time updates
                    if (statusAcc.brainrots && Array.isArray(statusAcc.brainrots)) {
                        existing.brainrots = statusAcc.brainrots;
                    }
                }
            });
            
            // Quick UI update using requestAnimationFrame
            requestAnimationFrame(() => {
                const accounts = state.farmersData[state.currentKey].accounts || [];
                accounts.forEach(account => {
                    const cardId = getAccountCardId(account);
                    const cardEl = document.getElementById(cardId);
                    if (cardEl) {
                        updateAccountCard(cardEl, account);
                    }
                });
                
                // Update header stats
                updateHeaderStats(accounts);
            });
        }
    } catch (error) {
        // Ignore abort errors, silently fail for others
        if (error.name !== 'AbortError') {
            // Silent fail
        }
    } finally {
        statusController = null;
    }
}

// Update header stats quickly
function updateHeaderStats(accounts) {
    // ALWAYS use calculated _isOnline, never trust server's isOnline (may be stale)
    const online = accounts.filter(a => a._isOnline === true).length;
    const totalBrainrots = accounts.reduce((sum, acc) => sum + (acc.totalBrainrots || 0), 0);
    const totalSlots = accounts.reduce((sum, acc) => sum + (acc.maxSlots || 10), 0);
    
    if (statsEls.totalAccounts) statsEls.totalAccounts.textContent = accounts.length;
    if (statsEls.onlineAccounts) statsEls.onlineAccounts.textContent = online;
    if (statsEls.totalBrainrots) statsEls.totalBrainrots.textContent = `${totalBrainrots}/${totalSlots}`;
}

// Отменить текущий запрос (при переключении пользователя)
function abortCurrentFetch() {
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }
}

// Track if sync is in progress to prevent overlapping requests
let syncInProgress = false;
let lastSyncRequestId = 0;
let syncErrorCount = 0; // Track consecutive sync errors
const MAX_SYNC_ERRORS = 3; // Skip polling after this many errors

async function fetchFarmerData() {
    if (!state.currentKey) return;
    
    // Skip if too many consecutive errors (backoff)
    if (syncErrorCount >= MAX_SYNC_ERRORS) {
        syncErrorCount--; // Slowly decrease to allow retry
        return;
    }
    
    // Don't start new sync if one is already in progress
    if (syncInProgress) {
        // v9.12.3: Не логируем каждый skip - слишком много спама
        return;
    }
    
    const requestKey = state.currentKey;
    const fetchStart = performance.now();
    const thisRequestId = ++lastSyncRequestId;
    
    syncInProgress = true;
    
    try {
        // Abort any previous request
        if (currentFetchController) {
            currentFetchController.abort();
        }
        currentFetchController = new AbortController();
        
        // v9.12.3: Добавляем timeout через AbortController
        const timeoutId = setTimeout(() => {
            currentFetchController.abort();
        }, 6000); // 6 секунд таймаут (было бесконечно)
        
        // v9.12.18: Используем быстрый sync-fast endpoint
        // Add cache-busting timestamp to prevent browser caching
        const cacheBuster = Date.now();
        const response = await fetch(`${API_BASE}/sync-fast?key=${encodeURIComponent(requestKey)}&_=${cacheBuster}`, {
            cache: 'no-store',  // Disable HTTP caching
            signal: currentFetchController.signal,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        const networkTime = performance.now() - fetchStart;
        
        // Проверяем что ключ не изменился пока ждали ответ
        if (state.currentKey !== requestKey) {
            return;
        }
        
        if (!response.ok) {
            console.error('Failed to fetch farmer data, status:', response.status);
            syncErrorCount++;
            return;
        }
        
        syncErrorCount = 0; // Reset on success
        const data = await response.json();
        
        // Ещё раз проверяем что ключ не изменился
        if (state.currentKey !== requestKey) {
            return;
        }
        
        // Check if this is still the latest request
        if (thisRequestId !== lastSyncRequestId) {
            console.log('[Sync] Ignoring stale response');
            return;
        }
        
        // SMART MERGE: Don't overwrite fresher data with stale sync data
        // Compare lastUpdate timestamps for each account
        const existingData = state.farmersData[requestKey];
        if (existingData && existingData.accounts && data.accounts) {
            data.accounts = data.accounts.map(newAcc => {
                const existing = existingData.accounts.find(a => a.playerName === newAcc.playerName);
                if (existing && existing.lastUpdate && newAcc.lastUpdate) {
                    try {
                        const existingTime = new Date(existing.lastUpdate).getTime();
                        const newTime = new Date(newAcc.lastUpdate).getTime();
                        // If existing data is fresher, keep it
                        if (existingTime > newTime) {
                            return { ...newAcc, ...existing };
                        }
                    } catch (e) {}
                }
                return newAcc;
            });
        }
        
        state.farmersData[requestKey] = data;
        
        // Сохраняем в localStorage для быстрой загрузки
        saveFarmersDataToCache();
        
        // Кэшируем base64 аватары в localStorage для офлайн доступа
        if (data.accountAvatars) {
            for (const [userId, avatarData] of Object.entries(data.accountAvatars)) {
                const avatarUrl = avatarData?.base64 || avatarData?.url;
                if (avatarUrl && isBase64Avatar(avatarUrl)) {
                    saveAvatarToCache(userId, avatarUrl);
                }
            }
        }
        
        // Update saved key info
        const savedKey = state.savedKeys.find(k => k.farmKey === state.currentKey);
        if (savedKey) {
            savedKey.username = data.username;
            savedKey.avatar = data.avatar;
            saveState();
        }
        
        const uiStart = performance.now();
        updateUI();
        const uiTime = performance.now() - uiStart;
        
        // Log performance metrics (only every 10th call to reduce noise)
        if (!window._fetchCount) window._fetchCount = 0;
        window._fetchCount++;
        if (window._fetchCount % 10 === 1) {
            console.log(`[Perf] Network: ${networkTime.toFixed(0)}ms, UI: ${uiTime.toFixed(0)}ms, Total: ${(performance.now() - fetchStart).toFixed(0)}ms`);
        }
        
    } catch (error) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
            console.log('[Sync] Request aborted');
            return;
        }
        console.error('Fetch error:', error);
    } finally {
        // Always reset sync flag
        syncInProgress = false;
        currentFetchController = null;
    }
}

/**
 * Загрузить данные всех сохранённых фермеров для отображения в Farm Keys
 */
async function fetchAllFarmersData() {
    let currentKeyLoaded = false;
    
    const promises = state.savedKeys.map(async (key) => {
        // Пропускаем текущий ключ если данные уже есть
        if (key.farmKey === state.currentKey && state.farmersData[key.farmKey]) {
            return;
        }
        
        try {
            // v9.12.18: Используем быстрый sync-fast endpoint
            const response = await fetch(`${API_BASE}/sync-fast?key=${encodeURIComponent(key.farmKey)}`);
            if (response.ok) {
                const data = await response.json();
                state.farmersData[key.farmKey] = data;
                
                // Отмечаем что загрузили данные для текущего ключа
                if (key.farmKey === state.currentKey) {
                    currentKeyLoaded = true;
                }
                
                // Кэшируем base64 аватары для офлайн доступа
                if (data.accountAvatars) {
                    for (const [userId, avatarData] of Object.entries(data.accountAvatars)) {
                        const avatarUrl = avatarData?.base64 || avatarData?.url;
                        if (avatarUrl && isBase64Avatar(avatarUrl)) {
                            saveAvatarToCache(userId, avatarUrl);
                        }
                    }
                }
                
                // Записываем баланс в историю
                if (data.totalValue && data.totalValue > 0) {
                    recordBalanceHistory(key.farmKey, data.totalValue);
                } else if (data.accounts && data.accounts.length > 0) {
                    // Рассчитываем если нет totalValue
                    let totalValue = 0;
                    data.accounts.forEach(account => {
                        if (account.brainrots) {
                            totalValue += calculateAccountValue(account);
                        }
                    });
                    if (totalValue > 0) {
                        recordBalanceHistory(key.farmKey, totalValue);
                    }
                }
                
                // Обновляем savedKey
                key.username = data.username;
                key.avatar = data.avatar;
            }
        } catch (e) {
            console.warn(`Failed to fetch data for ${key.farmKey}:`, e);
        }
    });
    
    await Promise.all(promises);
    saveState();
    saveFarmersDataToCache(); // Сохраняем в кэш
    renderFarmKeys();
    
    // Если загрузили данные для текущего ключа - обновляем UI
    if (currentKeyLoaded) {
        console.log('Current key data loaded via fetchAllFarmersData, updating UI');
        updateUI();
    }
}

// Check if account is online based on lastUpdate timestamp (primary) and isOnline flag (secondary)
// Account is considered online only if lastUpdate is within last 2 minutes
// NOTE: lastUpdate comes as LOCAL time from server (not UTC), so we parse without adding Z
function isAccountOnline(account) {
    if (!account) return false;
    
    // Primary: always check lastUpdate first - if no recent update, account is offline
    if (!account.lastUpdate) {
        // No lastUpdate - fall back to isOnline flag only
        return account.isOnline === true;
    }
    
    try {
        let lastUpdateTime;
        // Parse as local time (server sends local time without timezone)
        if (account.lastUpdate.includes('T')) {
            // Already ISO format - parse directly
            lastUpdateTime = new Date(account.lastUpdate).getTime();
        } else {
            // Format: "2025-12-21 12:50:05" - parse as local time
            const parts = account.lastUpdate.split(/[- :]/);
            if (parts.length >= 6) {
                // Create date from parts: year, month (0-based), day, hour, min, sec
                lastUpdateTime = new Date(
                    parseInt(parts[0]), 
                    parseInt(parts[1]) - 1, 
                    parseInt(parts[2]),
                    parseInt(parts[3]),
                    parseInt(parts[4]),
                    parseInt(parts[5])
                ).getTime();
            } else {
                return account.isOnline === true;
            }
        }
        
        const now = Date.now();
        const diffSeconds = (now - lastUpdateTime) / 1000;
        
        // If last update was more than 3 minutes ago, account is offline
        // regardless of isOnline flag (script may have crashed without cleanup)
        // Must match panel_sync.lua threshold of 180 seconds
        if (diffSeconds > 180) {
            return false;
        }
        
        // Recent update - trust the isOnline flag, or assume online if flag not set
        return account.isOnline !== false;
    } catch (e) {
        return account.isOnline === true;
    }
}

// Format time ago for display
function formatTimeAgo(lastUpdate) {
    if (!lastUpdate) return 'Never';
    
    try {
        let lastUpdateTime;
        // Parse as local time (same as isAccountOnline)
        if (lastUpdate.includes('T')) {
            lastUpdateTime = new Date(lastUpdate).getTime();
        } else {
            // Format: "2025-12-21 12:50:05" - parse as local time
            const parts = lastUpdate.split(/[- :]/);
            if (parts.length >= 6) {
                lastUpdateTime = new Date(
                    parseInt(parts[0]), 
                    parseInt(parts[1]) - 1, 
                    parseInt(parts[2]),
                    parseInt(parts[3]),
                    parseInt(parts[4]),
                    parseInt(parts[5])
                ).getTime();
            } else {
                return lastUpdate;
            }
        }
        
        const now = Date.now();
        const diffSeconds = Math.floor((now - lastUpdateTime) / 1000);
        
        if (diffSeconds < 0) return t('just_now'); // Future time = just now
        if (diffSeconds < 60) return t('just_now');
        if (diffSeconds < 3600) return Math.floor(diffSeconds / 60) + ' ' + t('minutes_ago');
        if (diffSeconds < 86400) return Math.floor(diffSeconds / 3600) + ' ' + t('hours_ago');
        return Math.floor(diffSeconds / 86400) + ' ' + t('days_ago');
    } catch (e) {
        return lastUpdate;
    }
}

// Cache for avatar URLs to avoid refetching
const avatarCache = {};

// Generate unique key for account card
function getAccountCardId(account) {
    return 'account-' + (account.playerName || '').replace(/[^a-zA-Z0-9]/g, '_');
}

// Smart update - only update changed elements in existing card
function updateAccountCard(cardEl, account) {
    if (!cardEl) return false;
    
    const isOnline = account._isOnline;
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';
    const actionText = isOnline ? (account.action || account.status || '') : '';
    
    // Update status badge - completely rewrite innerHTML for reliability
    const statusBadge = cardEl.querySelector('.status-badge');
    if (statusBadge) {
        const currentClass = statusBadge.classList.contains('online') ? 'online' : 'offline';
        if (currentClass !== statusClass) {
            statusBadge.className = 'status-badge ' + statusClass;
            statusBadge.innerHTML = `<i class="fas fa-circle"></i> ${statusText}`;
        }
    }
    
    // Update action
    const statusContainer = cardEl.querySelector('.account-status');
    if (statusContainer) {
        let actionEl = statusContainer.querySelector('.account-action');
        if (isOnline && actionText) {
            if (actionEl) {
                actionEl.textContent = actionText;
            } else {
                actionEl = document.createElement('span');
                actionEl.className = 'account-action';
                actionEl.textContent = actionText;
                statusContainer.appendChild(actionEl);
            }
        } else if (actionEl) {
            actionEl.remove();
        }
    }
    
    // Update stats
    const statValues = cardEl.querySelectorAll('.account-stat-value');
    if (statValues[0]) {
        const newIncome = account.totalIncomeFormatted || formatIncome(account.totalIncome || 0);
        if (statValues[0].textContent !== newIncome) {
            statValues[0].textContent = newIncome;
        }
    }
    if (statValues[1]) {
        // Show brainrots as X/Y format (totalBrainrots/maxSlots)
        const newCount = `${account.totalBrainrots || 0}/${account.maxSlots || 10}`;
        if (statValues[1].textContent !== newCount) {
            statValues[1].textContent = newCount;
        }
    }
    
    // Update account value stat
    const accountValue = calculateAccountValue(account);
    let valueStat = cardEl.querySelector('.account-stat.account-value');
    if (accountValue > 0) {
        if (valueStat) {
            const valueEl = valueStat.querySelector('.account-stat-value');
            if (valueEl) valueEl.textContent = '$' + accountValue.toFixed(2);
        } else {
            // Create value stat if it doesn't exist
            const statsContainer = cardEl.querySelector('.account-stats');
            if (statsContainer) {
                const newValueStat = document.createElement('div');
                newValueStat.className = 'account-stat account-value';
                newValueStat.innerHTML = `
                    <div class="account-stat-value">$${accountValue.toFixed(2)}</div>
                    <div class="account-stat-label">Value</div>
                `;
                statsContainer.appendChild(newValueStat);
            }
        }
    } else if (valueStat) {
        valueStat.remove();
    }
    
    // Update brainrots section
    const brainrotsContainer = cardEl.querySelector('.account-brainrots');
    if (account.brainrots && account.brainrots.length > 0) {
        const brainrotsHtml = account.brainrots.slice(0, 10).map(b => {
            const imageUrl = b.imageUrl || getBrainrotImageUrl(b.name);
            // Mutation badge for mini brainrot with custom tooltip
            const mutationColor = b.mutation ? getMutationColor(b.mutation) : null;
            const mutationName = b.mutation ? cleanMutationText(b.mutation) : '';
            const mutationBadge = mutationColor ? `<div class="brainrot-mini-mutation" style="background: ${mutationColor};" data-mutation="${mutationName}"></div>` : '';
            return `
                <div class="brainrot-mini${b.mutation ? ' has-mutation' : ''}" title="${b.name}\n${b.incomeText || ''}">
                    ${mutationBadge}
                    <div class="brainrot-mini-img">
                        ${imageUrl 
                            ? `<img src="${imageUrl}" alt="${b.name}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                            : '<i class="fas fa-brain" style="color: var(--text-muted); font-size: 1.5rem;"></i>'
                        }
                    </div>
                    <div class="brainrot-mini-name">${truncate(b.name, 8)}</div>
                    <div class="brainrot-mini-income" style="${b.mutation ? 'color: ' + mutationColor : ''}">${b.incomeText || ''}</div>
                </div>
            `;
        }).join('');
        
        if (brainrotsContainer) {
            const scrollEl = brainrotsContainer.querySelector('.brainrots-scroll');
            if (scrollEl) scrollEl.innerHTML = brainrotsHtml;
        } else {
            // Create brainrots section if it doesn't exist
            const footer = cardEl.querySelector('.account-footer');
            const newBrainrots = document.createElement('div');
            newBrainrots.className = 'account-brainrots';
            newBrainrots.innerHTML = `
                <div class="brainrots-title">
                    <i class="fas fa-brain"></i>
                    ${t('brainrots')}
                </div>
                <div class="brainrots-scroll">
                    ${brainrotsHtml}
                </div>
            `;
            if (footer) {
                cardEl.insertBefore(newBrainrots, footer);
            } else {
                cardEl.appendChild(newBrainrots);
            }
        }
    } else if (brainrotsContainer) {
        brainrotsContainer.remove();
    }
    
    // Update footer time
    const footer = cardEl.querySelector('.account-footer');
    if (footer) {
        const timeText = formatTimeAgo(account.lastUpdate);
        const currentTime = footer.textContent.trim();
        if (!currentTime.includes(timeText)) {
            footer.innerHTML = `<i class="fas fa-clock"></i> ${timeText}`;
        }
    }
    
    return true;
}

// UI Updates
function updateUI() {
    const data = state.farmersData[state.currentKey];
    if (!data) return;
    
    const accounts = data.accounts || [];
    
    // Calculate isOnline based on lastUpdate timestamp (< 180 seconds = online)
    // Don't trust cached isOnline value - always recalculate from lastUpdate
    // If no update in 180 seconds (3 minutes), consider offline
    const now = Date.now();
    accounts.forEach(account => {
        // Calculate online status from lastUpdate
        let calculatedOnline = false;
        if (account.lastUpdate) {
            try {
                let lastUpdateTime;
                if (account.lastUpdate.includes('T')) {
                    lastUpdateTime = new Date(account.lastUpdate).getTime();
                } else {
                    // Format: "2025-12-21 14:04:43" - parse as local time
                    const parts = account.lastUpdate.split(/[- :]/);
                    if (parts.length >= 6) {
                        lastUpdateTime = new Date(
                            parseInt(parts[0]), 
                            parseInt(parts[1]) - 1, 
                            parseInt(parts[2]),
                            parseInt(parts[3]),
                            parseInt(parts[4]),
                            parseInt(parts[5])
                        ).getTime();
                    }
                }
                if (lastUpdateTime) {
                    const diffSeconds = (now - lastUpdateTime) / 1000;
                    calculatedOnline = diffSeconds <= 180; // 180 seconds (3 minutes)
                }
            } catch (e) {
                calculatedOnline = false;
            }
        }
        account._isOnline = calculatedOnline;
    });
    
    // Update stats (use calculated online status)
    const online = accounts.filter(a => a._isOnline).length;
    const totalIncome = accounts.reduce((sum, a) => sum + (a.totalIncome || 0), 0);
    const totalBrainrots = accounts.reduce((sum, a) => sum + (a.totalBrainrots || 0), 0);
    const totalSlots = accounts.reduce((sum, a) => sum + (a.maxSlots || 10), 0);
    
    // Собираем все брейнроты для расчета общей стоимости
    const allBrainrots = [];
    accounts.forEach(account => {
        if (account.brainrots) {
            account.brainrots.forEach(b => allBrainrots.push(b));
        }
    });
    let totalValue = calculateTotalValue(allBrainrots);
    
    // При ручном рефреше используем замороженный баланс чтобы не показывать $0
    if (state.isManualPriceRefresh && state.frozenBalance !== null) {
        totalValue = state.frozenBalance;
    }
    
    // Сохраняем в state для синхронизации везде (но не перезаписываем на 0 при рефреше)
    if (!state.isManualPriceRefresh || totalValue > 0) {
        state.currentTotalValue = totalValue;
    }
    state.currentBalanceChange = getBalanceChange(state.currentKey, PERIODS.hour);
    
    // Записываем в историю баланса
    if (totalValue > 0) {
        recordBalanceHistory(state.currentKey, totalValue);
    }
    
    statsEls.totalAccounts.textContent = accounts.length;
    statsEls.onlineAccounts.textContent = online;
    statsEls.totalIncome.textContent = formatIncome(totalIncome);
    statsEls.totalBrainrots.textContent = `${totalBrainrots}/${totalSlots}`;
    
    // Update total value with change indicator
    if (statsEls.totalValue) {
        const displayValue = state.isManualPriceRefresh && state.frozenBalance !== null ? state.frozenBalance : totalValue;
        statsEls.totalValue.textContent = displayValue > 0 ? `$${displayValue.toFixed(2)}` : '$0.00';
        
        // Show % change from history (hour period) - но НЕ при ручном рефреше
        if (statsEls.totalValueChange) {
            if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
                statsEls.totalValueChange.innerHTML = formatBalanceChange(state.currentBalanceChange.changePercent);
            } else {
                statsEls.totalValueChange.innerHTML = '';
            }
        }
    }
    
    // Render accounts - use requestAnimationFrame for smooth updates
    // All renders in same RAF to batch DOM updates
    requestAnimationFrame(() => {
        renderAccountsGrid(accounts);
        renderAccountsList(accounts);
        updateCurrentFarmer();
        
        // Update collection view (non-critical, can be slightly delayed)
        requestAnimationFrame(() => {
            updateCollection();
            updateBalanceChart();
        });
    });
}

function updateCurrentFarmer() {
    const savedKey = state.savedKeys.find(k => k.farmKey === state.currentKey);
    if (!savedKey) return;
    
    const avatar = savedKey.avatar || { icon: 'fa-user', color: '#6366f1' };
    const shortKey = state.currentKey.split('-').slice(-1)[0];
    
    // Get current farmer data
    const data = state.farmersData[state.currentKey];
    const accounts = data?.accounts || [];
    const accountCount = accounts.length;
    
    // Используем синхронизированное значение из state
    const totalValue = state.currentTotalValue;
    
    currentFarmerEl.innerHTML = `
        <div class="farmer-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
            <i class="fas ${avatar.icon}"></i>
        </div>
        <div class="farmer-info">
            <div class="farmer-name">${savedKey.username || 'Unknown'}</div>
            <div class="farmer-key">...${shortKey}</div>
        </div>
    `;
    
    // Update mini stats in header with % change (используем значение из state)
    // НЕ показываем изменения при ручном рефреше
    // При рефреше используем frozen balance
    const balanceEl = document.getElementById('farmerBalance');
    const countEl = document.getElementById('farmerAccountsCount');
    const displayBalance = state.isManualPriceRefresh && state.frozenBalance !== null ? state.frozenBalance : totalValue;
    
    if (balanceEl) {
        let changeHtml = '';
        if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
            changeHtml = ` ${formatBalanceChange(state.currentBalanceChange.changePercent, true)}`;
        }
        balanceEl.innerHTML = `$${displayBalance.toFixed(2)}${changeHtml}`;
    }
    
    const accountText = accountCount === 1 ? 'account' : 'accounts';
    if (countEl) countEl.textContent = `${accountCount} ${accountText}`;
    
    // Update account dropdown
    updateFarmerSwitcherDropdown();
}

function updateFarmerSwitcherDropdown() {
    const dropdownList = document.getElementById('accountDropdownList');
    if (!dropdownList) return;
    
    if (state.savedKeys.length === 0) {
        dropdownList.innerHTML = `
            <div class="account-dropdown-item" style="justify-content: center; color: var(--text-muted);">
                No saved accounts
            </div>
        `;
        return;
    }
    
    dropdownList.innerHTML = state.savedKeys.map(key => {
        const isActive = key.farmKey === state.currentKey;
        const avatar = key.avatar || { icon: 'fa-user', color: '#6366f1' };
        const data = state.farmersData[key.farmKey];
        const accounts = data?.accounts || [];
        const accountCount = accounts.length;
        const shortKey = key.farmKey.split('-').slice(-1)[0];
        const accountText = accountCount === 1 ? 'account' : 'accounts';
        
        // Для текущего аккаунта используем синхронизированное значение из state
        let farmerValue;
        if (isActive) {
            farmerValue = state.currentTotalValue;
        } else {
            farmerValue = data?.totalValue || 0;
            if (farmerValue === 0 && accounts.length > 0) {
                accounts.forEach(account => {
                    if (account.brainrots) {
                        farmerValue += calculateAccountValue(account);
                    }
                });
            }
        }
        
        return `
            <div class="account-dropdown-item ${isActive ? 'active' : ''}" onclick="quickSwitchAccount('${key.farmKey}')">
                <div class="dropdown-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
                    <i class="fas ${avatar.icon}"></i>
                </div>
                <div class="dropdown-info">
                    <div class="dropdown-name">${key.username || 'Unknown'}</div>
                    <div class="dropdown-key">...${shortKey}</div>
                </div>
                <div class="dropdown-stats">
                    <div class="dropdown-value">$${farmerValue.toFixed(2)}</div>
                    <div class="dropdown-accounts">${accountCount} ${accountText}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Quick switch account from dropdown
window.quickSwitchAccount = function(farmKey) {
    if (farmKey === state.currentKey) {
        // Close dropdown if clicking active account
        toggleAccountDropdown(false);
        return;
    }
    
    selectFarmKey(farmKey);
    toggleAccountDropdown(false);
    showNotification(`${t('switched_to_account')} ${state.savedKeys.find(k => k.farmKey === farmKey)?.username || 'account'}`, 'success');
};

// Toggle account dropdown
function toggleAccountDropdown(show) {
    const switcher = document.getElementById('accountSwitcher');
    const dropdown = document.getElementById('accountDropdownPanel');
    
    if (show === undefined) {
        show = dropdown.classList.contains('hidden');
    }
    
    if (show) {
        dropdown.classList.remove('hidden');
        switcher.classList.add('open');
    } else {
        dropdown.classList.add('hidden');
        switcher.classList.remove('open');
    }
}

// Render Functions
async function renderAccountsGrid(accounts) {
    if (!accounts || accounts.length === 0) {
        accountsGridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <i class="fas fa-users-slash"></i>
                <h3>${t('no_accounts')}</h3>
                <p>${t('start_farm_hint')}</p>
            </div>
        `;
        return;
    }
    
    // Получаем аватары из данных сервера (теперь base64)
    const data = state.farmersData[state.currentKey];
    const serverAvatars = data?.accountAvatars || {};
    const playerUserIdMap = data?.playerUserIdMap || {}; // Маппинг playerName -> userId
    
    // Применяем серверные аватары к аккаунтам
    accounts.forEach(account => {
        // Определяем userId: напрямую из account или через маппинг по имени
        let userId = account.userId;
        if (!userId && account.playerName && playerUserIdMap[account.playerName]) {
            userId = playerUserIdMap[account.playerName];
        }
        
        if (userId) {
            const avatarData = serverAvatars[String(userId)];
            // Предпочитаем base64 (новый формат), fallback на url (старый формат)
            const avatarUrl = avatarData?.base64 || avatarData?.url;
            if (avatarUrl) {
                account.avatarUrl = avatarUrl;
                // Также сохраняем в локальный кэш для быстрого доступа
                saveAvatarToCache(userId, avatarUrl);
            } else {
                // Fallback на локальный кэш
                const cachedAvatar = getCachedAvatar(userId);
                if (cachedAvatar) {
                    account.avatarUrl = cachedAvatar;
                } else {
                    // Загружаем с Roblox в фоне
                    fetchRobloxAvatar(userId).then(url => {
                        if (url) {
                            // Обновляем изображение в DOM если карточка существует
                            const cardId = getAccountCardId(account);
                            const cardEl = document.getElementById(cardId);
                            if (cardEl) {
                                const img = cardEl.querySelector('.account-avatar img');
                                if (img) img.src = url;
                            }
                        }
                    });
                }
            }
        }
    });
    
    // Check if we can do smart update (same accounts exist)
    const existingCards = accountsGridEl.querySelectorAll('.account-card');
    const existingPlayerNames = new Set();
    existingCards.forEach(card => {
        const name = card.dataset.player;
        if (name) existingPlayerNames.add(name);
    });
    
    const newPlayerNames = new Set(accounts.map(a => a.playerName));
    const sameAccounts = existingPlayerNames.size === newPlayerNames.size && 
        existingPlayerNames.size > 0 &&
        [...existingPlayerNames].every(name => newPlayerNames.has(name));
    
    // Smart update - update existing cards without full DOM rebuild
    if (sameAccounts) {
        // Smart update - just update values in existing cards
        accounts.forEach(account => {
            const cardId = getAccountCardId(account);
            const cardEl = document.getElementById(cardId);
            updateAccountCard(cardEl, account);
        });
        return;
    }
    
    // Full render (first time or accounts changed)
    console.log('[Dashboard] Rendering accounts:');
    accounts.forEach(acc => {
        console.log('  ' + acc.playerName + ': brainrots=' + (acc.brainrots ? acc.brainrots.length : 0));
    });
    
    accountsGridEl.innerHTML = accounts.map(account => {
        const brainrotsHtml = (account.brainrots || []).slice(0, 10).map(b => {
            const imageUrl = b.imageUrl || getBrainrotImageUrl(b.name);
            return `
                <div class="brainrot-mini" title="${b.name}\n${b.incomeText || ''}">
                    <div class="brainrot-mini-img">
                        ${imageUrl 
                            ? `<img src="${imageUrl}" alt="${b.name}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                            : '<i class="fas fa-brain" style="color: var(--text-muted); font-size: 1.5rem;"></i>'
                        }
                    </div>
                    <div class="brainrot-mini-name">${truncate(b.name, 8)}</div>
                    <div class="brainrot-mini-income">${b.incomeText || ''}</div>
                </div>
            `;
        }).join('');
        
        const isOnline = account._isOnline;
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? t('online_status') : t('offline_status');
        const actionText = isOnline ? (account.action || account.status || '') : '';
        
        const avatarSrc = account.avatarUrl || getDefaultAvatar(account.playerName);
        const accountValue = calculateAccountValue(account);
        
        return `
            <div class="account-card" id="${getAccountCardId(account)}" data-player="${account.playerName}">
                <button class="account-delete-btn" onclick="deleteFarmer('${account.playerName}')" title="Delete farmer">
                    <i class="fas fa-times"></i>
                </button>
                <div class="account-header">
                    <div class="account-avatar">
                        <img src="${avatarSrc}" alt="${account.playerName}" onerror="this.src='${getDefaultAvatar(account.playerName)}'">
                    </div>
                    <div class="account-info">
                        <div class="account-name">${account.playerName || 'Unknown'}</div>
                        <div class="account-status">
                            <span class="status-badge ${statusClass}">
                                <i class="fas fa-circle"></i>
                                ${statusText}
                            </span>
                            ${isOnline && actionText ? `<span class="account-action">${actionText}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="account-stats">
                    <div class="account-stat">
                        <div class="account-stat-value">${account.totalIncomeFormatted || formatIncome(account.totalIncome || 0)}</div>
                        <div class="account-stat-label">${t('income_label')}</div>
                    </div>
                    <div class="account-stat">
                        <div class="account-stat-value">${account.totalBrainrots || 0}/${account.maxSlots || 10}</div>
                        <div class="account-stat-label">${t('brainrots_label')}</div>
                    </div>
                    <div class="account-stat account-value">
                        <div class="account-stat-value">$${accountValue.toFixed(2)}</div>
                        <div class="account-stat-label">${t('value_label')}</div>
                    </div>
                </div>
                <div class="account-brainrots">
                    <div class="brainrots-title">
                        <i class="fas fa-brain"></i>
                        ${t('brainrots')}
                    </div>
                    <div class="brainrots-scroll">
                        ${account.brainrots && account.brainrots.length > 0 ? brainrotsHtml : '<span class="no-brainrots">' + t('no_brainrots_yet') + '</span>'}
                    </div>
                </div>
                <div class="account-footer">
                    <i class="fas fa-clock"></i>
                    ${formatTimeAgo(account.lastUpdate)}
                </div>
            </div>
        `;
    }).join('');
}

function renderAccountsList(accounts) {
    if (!accounts || accounts.length === 0) {
        accountsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list"></i>
                <h3>${t('no_accounts')}</h3>
                <p>${t('accounts_will_appear')}</p>
            </div>
        `;
        return;
    }
    
    // Получаем аватары из данных сервера
    const data = state.farmersData[state.currentKey];
    const serverAvatars = data?.accountAvatars || {};
    const playerUserIdMap = data?.playerUserIdMap || {}; // Маппинг playerName -> userId
    
    accountsListEl.innerHTML = accounts.map(account => {
        // Получаем аватар из серверных данных (предпочитаем base64)
        let avatarSrc = getDefaultAvatar(account.playerName);
        
        // Определяем userId: напрямую из account или через маппинг по имени
        let userId = account.userId;
        if (!userId && account.playerName && playerUserIdMap[account.playerName]) {
            userId = playerUserIdMap[account.playerName];
        }
        
        if (userId) {
            const avatarData = serverAvatars[String(userId)];
            // Предпочитаем base64, затем url
            const serverAvatar = avatarData?.base64 || avatarData?.url;
            if (serverAvatar) {
                avatarSrc = serverAvatar;
            } else if (account.avatarUrl) {
                avatarSrc = account.avatarUrl;
            } else {
                const cached = getCachedAvatar(userId);
                if (cached) avatarSrc = cached;
            }
        }
        
        const isOnline = account._isOnline;
        const statusClass = isOnline ? 'online' : 'offline';
        // actionText показывает последнее действие фермера, даже если offline
        const actionText = account.action || account.status || 'Idle';
        const accountValue = calculateAccountValue(account);
        
        return `
            <div class="account-list-item">
                <div class="account-list-avatar">
                    <img src="${avatarSrc}" alt="${account.playerName}" onerror="this.src='${getDefaultAvatar(account.playerName)}'">
                </div>
                <div class="account-list-info">
                    <h4>${account.playerName || 'Unknown'}</h4>
                    <p>${actionText}</p>
                </div>
                <span class="status-badge ${statusClass}">
                    <i class="fas fa-circle"></i>
                    ${isOnline ? t('online_status') : t('offline_status')}
                </span>
                <div class="account-list-income">
                    <div class="value">${account.totalIncomeFormatted || formatIncome(account.totalIncome || 0)}</div>
                    <div class="label">${t('income_label')}</div>
                </div>
                <div class="account-list-brainrots">
                    <div class="value">${account.totalBrainrots || 0}/${account.maxSlots || 10}</div>
                    <div class="label">${t('brainrots_label')}</div>
                </div>
                ${accountValue > 0 ? `
                <div class="account-list-value">
                    <div class="value">$${accountValue.toFixed(2)}</div>
                    <div class="label">${t('value_label')}</div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderFarmKeys() {
    if (state.savedKeys.length === 0) {
        farmKeysListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-key"></i>
                <h3>${t('no_saved_farm_keys')}</h3>
                <p>${t('add_keys_hint')}</p>
            </div>
        `;
        return;
    }
    
    farmKeysListEl.innerHTML = state.savedKeys.map(key => {
        const isActive = key.farmKey === state.currentKey;
        const avatar = key.avatar || { icon: 'fa-user', color: '#6366f1' };
        const data = state.farmersData[key.farmKey];
        const accounts = data?.accounts || [];
        const accountCount = accounts.length;
        
        // Для текущего аккаунта используем синхронизированное значение из state
        let farmerValue;
        let balanceChange;
        
        if (isActive) {
            farmerValue = state.currentTotalValue;
            balanceChange = state.currentBalanceChange;
        } else {
            farmerValue = data?.totalValue || 0;
            if (farmerValue === 0 && accounts.length > 0) {
                accounts.forEach(account => {
                    if (account.brainrots) {
                        farmerValue += calculateAccountValue(account);
                    }
                });
            }
            balanceChange = getBalanceChange(key.farmKey, PERIODS.hour);
        }
        
        // НЕ показываем изменения при ручном рефреше
        const changeHtml = !state.isManualPriceRefresh && balanceChange && Math.abs(balanceChange.changePercent) > 0.01 
            ? formatBalanceChange(balanceChange.changePercent, true) 
            : '';
        
        return `
            <div class="farm-key-card ${isActive ? 'active' : ''}" data-key="${key.farmKey}">
                <div class="farm-key-left">
                    <div class="farm-key-avatar" style="background: ${avatar.color}20; color: ${avatar.color}">
                        <i class="fas ${avatar.icon}"></i>
                    </div>
                    <div class="farm-key-info">
                        <div class="farm-key-username">
                            ${key.username || 'Unknown'}
                            <button class="edit-btn" onclick="openEditUsername('${key.farmKey}')" title="Edit username">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                        <div class="farm-key-code blurred" onclick="toggleAndCopyKey(this, '${key.farmKey}')" title="Click to reveal and copy">
                            <span class="key-text">${key.farmKey}</span>
                            <i class="fas fa-eye-slash key-icon"></i>
                        </div>
                    </div>
                </div>
                <div class="farm-key-right">
                    <div class="farm-key-stats">
                        <div class="farm-key-accounts">${accountCount}</div>
                        <div class="farm-key-label">${t('accounts_label').toLowerCase()}</div>
                    </div>
                    ${farmerValue > 0 ? `
                    <div class="farm-key-stats farm-key-value">
                        <div class="farm-key-accounts">$${farmerValue.toFixed(2)} ${changeHtml}</div>
                        <div class="farm-key-label">${t('value_lower')}</div>
                    </div>
                    ` : ''}
                    <button class="select-key-btn" onclick="selectFarmKey('${key.farmKey}')">
                        ${isActive ? t('active_status') : t('select_btn')}
                    </button>
                    <button class="delete-key-btn" onclick="deleteFarmKey('${key.farmKey}')" title="Remove key">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Modal Functions
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModalFn(modal) {
    modal.classList.add('hidden');
    modalError.textContent = '';
    usernameError.textContent = '';
    newKeyInput.value = '';
    usernameInput.value = '';
}

async function handleAddKey() {
    const key = newKeyInput.value.trim();
    
    if (!key) {
        modalError.textContent = 'Please enter a farm key';
        return;
    }
    
    if (state.savedKeys.find(k => k.farmKey === key)) {
        modalError.textContent = 'This key is already added';
        return;
    }
    
    modalError.textContent = 'Validating...';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: key })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            modalError.textContent = data.error || 'Invalid farm key';
            return;
        }
        
        state.savedKeys.push({
            farmKey: key,
            username: data.username,
            avatar: data.avatar,
            addedAt: new Date().toISOString()
        });
        
        saveState();
        renderFarmKeys();
        closeModalFn(addKeyModal);
        
    } catch (error) {
        console.error('Add key error:', error);
        modalError.textContent = 'Connection error. Please try again.';
    }
}

// Toggle blur and copy farm key
window.toggleAndCopyKey = function(element, farmKey) {
    const wasBlurred = element.classList.contains('blurred');
    const icon = element.querySelector('.key-icon');
    
    // Toggle blur
    element.classList.toggle('blurred');
    
    if (wasBlurred) {
        // Was blurred, now revealed - copy to clipboard
        navigator.clipboard.writeText(farmKey).then(() => {
            showNotification(t('key_copied'), 'success');
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            
            // Re-blur after 3 seconds
            setTimeout(() => {
                element.classList.add('blurred');
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }, 3000);
        }).catch(() => {
            showNotification(t('key_copy_failed'), 'error');
        });
    } else {
        // Was revealed, now blurred
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
};

// Global functions for onclick handlers
window.openEditUsername = function(farmKey) {
    editingKeyForUsername = farmKey;
    const key = state.savedKeys.find(k => k.farmKey === farmKey);
    if (key) {
        usernameInput.value = key.username || '';
    }
    openModal(editUsernameModal);
};

async function handleEditUsername() {
    const newUsername = usernameInput.value.trim();
    
    if (!newUsername) {
        usernameError.textContent = 'Please enter a username';
        return;
    }
    
    if (!/^[a-zA-Z]{1,15}$/.test(newUsername)) {
        usernameError.textContent = 'Max 15 English letters only (a-z, A-Z)';
        return;
    }
    
    usernameError.textContent = 'Saving...';
    
    try {
        const response = await fetch(`${API_BASE}/username`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                farmKey: editingKeyForUsername,
                username: newUsername 
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            usernameError.textContent = data.error || 'Failed to update username';
            return;
        }
        
        // Update local state
        const key = state.savedKeys.find(k => k.farmKey === editingKeyForUsername);
        if (key) {
            key.username = newUsername;
        }
        
        if (state.farmersData[editingKeyForUsername]) {
            state.farmersData[editingKeyForUsername].username = newUsername;
        }
        
        saveState();
        renderFarmKeys();
        updateCurrentFarmer();
        closeModalFn(editUsernameModal);
        
    } catch (error) {
        console.error('Update username error:', error);
        usernameError.textContent = 'Connection error. Please try again.';
    }
}

window.selectFarmKey = async function(farmKey) {
    // Если уже выбран этот ключ - ничего не делаем
    if (state.currentKey === farmKey) {
        return;
    }
    
    // Останавливаем текущий polling и отменяем ВСЕ запросы
    stopPolling();
    abortCurrentFetch();
    abortStatusFetch(); // v9.12.3: Также отменяем status запросы
    
    // v9.12.3: Сбрасываем счётчики ошибок при смене ключа
    syncErrorCount = 0;
    statusErrorCount = 0;
    syncInProgress = false;
    
    const previousKey = state.currentKey;
    state.currentKey = farmKey;
    saveState();
    
    // v9.12.4: Проверяем есть ли кэш для этого ключа (в localStorage или уже загруженный)
    const cachedData = state.farmersData[farmKey];
    const hasCachedData = cachedData && cachedData.accounts && cachedData.accounts.length > 0;
    
    // v9.12.4: Если есть кэш - показываем сразу и грузим свежее в фоне
    if (hasCachedData) {
        console.log('✅ Using cached data for', farmKey, '(will refresh in background)');
        updateUI();
        renderFarmKeys();
        
        // Запускаем polling сразу - он загрузит свежие данные
        setTimeout(() => startPolling(), 300);
        
        // v9.12.4: Также грузим свежие данные в фоне явно
        setTimeout(async () => {
            if (state.currentKey !== farmKey) return;
            try {
                const response = await fetch(`${API_BASE}/sync?key=${encodeURIComponent(farmKey)}&_=${Date.now()}`, { cache: 'no-store' });
                if (response.ok && state.currentKey === farmKey) {
                    const freshData = await response.json();
                    state.farmersData[farmKey] = freshData;
                    saveFarmersDataToCache();
                    console.log('✅ Refreshed data in background for:', farmKey);
                    updateUI();
                }
            } catch (e) {
                console.warn('Background refresh failed:', e.message);
            }
        }, 500);
    } else {
        // v9.12.4: Нет кэша - показываем лоадер и загружаем с увеличенным таймаутом
        console.log('No cache for', farmKey, '- loading fresh data...');
        renderFarmKeys();
        
        // Показываем индикатор загрузки в UI
        showQuickLoadingIndicator();
        
        try {
            // v9.12.4: Увеличенный таймаут с 5 до 12 секунд
            const response = await fetchWithTimeout(
                `${API_BASE}/sync?key=${encodeURIComponent(farmKey)}&_=${Date.now()}`,
                { cache: 'no-store' },
                12000 // 12 секунд таймаут (было 5)
            );
            
            if (response.ok) {
                const data = await response.json();
                state.farmersData[farmKey] = data;
                saveFarmersDataToCache();
                console.log('✅ Loaded data for new key:', farmKey);
                updateUI();
            } else {
                console.warn('Failed to load data for key:', farmKey, response.status);
            }
        } catch (e) {
            console.warn('Error loading data for new key:', e.message);
        } finally {
            hideQuickLoadingIndicator();
        }
        
        // Запускаем polling после загрузки
        startPolling();
    }
    
    // v9.12.3: Параллельная загрузка дополнительных данных для нового ключа
    loadKeySpecificData(farmKey);
};

// v9.12.3: Загрузка данных специфичных для ключа (история баланса, офферы)
async function loadKeySpecificData(farmKey) {
    // Проверяем что ключ не изменился
    if (state.currentKey !== farmKey) return;
    
    const delay = ms => new Promise(r => setTimeout(r, ms));
    
    try {
        // 1. Загружаем историю баланса
        await delay(300);
        if (state.currentKey === farmKey) {
            loadBalanceHistory().catch(e => console.warn('Balance history:', e.message));
        }
        
        // 2. Загружаем офферы
        await delay(300);
        if (state.currentKey === farmKey) {
            loadOffers(false, true).catch(e => console.warn('Offers:', e.message));
        }
        
        // 3. Загружаем название магазина
        await delay(200);
        if (state.currentKey === farmKey) {
            loadShopName().catch(e => console.warn('Shop name:', e.message));
        }
    } catch (e) {
        console.warn('Error loading key-specific data:', e);
    }
}

// v9.12.3: Быстрый индикатор загрузки (не полноэкранный)
function showQuickLoadingIndicator() {
    // Добавляем класс loading к dashboard
    const dashboard = document.querySelector('.dashboard-page');
    if (dashboard) {
        dashboard.classList.add('loading-data');
    }
    // Показываем текст в header stats
    if (statsEls.totalAccounts) {
        statsEls.totalAccounts.textContent = '...';
    }
}

function hideQuickLoadingIndicator() {
    const dashboard = document.querySelector('.dashboard-page');
    if (dashboard) {
        dashboard.classList.remove('loading-data');
    }
}

// v9.12.3: Отмена status запросов
function abortStatusFetch() {
    if (statusController) {
        statusController.abort();
        statusController = null;
    }
}

window.deleteFarmKey = function(farmKey) {
    if (state.savedKeys.length === 1) {
        alert('You cannot delete the last key. Add another key first or logout.');
        return;
    }
    
    if (!confirm('Are you sure you want to remove this farm key?')) {
        return;
    }
    
    state.savedKeys = state.savedKeys.filter(k => k.farmKey !== farmKey);
    
    if (state.currentKey === farmKey) {
        state.currentKey = state.savedKeys[0]?.farmKey || null;
    }
    
    delete state.farmersData[farmKey];
    
    saveState();
    renderFarmKeys();
    
    if (state.currentKey) {
        fetchFarmerData();
    } else {
        showLoginScreen();
    }
};

// Utility Functions
function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatIncome(value) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T/s`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B/s`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M/s`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K/s`;
    return `$${value}/s`;
}

function getDefaultAvatar(name) {
    const letter = name ? name[0].toUpperCase() : '?';
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a24" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="%236b6b7d">${letter}</text></svg>`;
}

// ==========================================
// ELDORADO PRICE API INTEGRATION
// ==========================================

// орматирование цены
// ==========================================
// COLLECTION VIEW - All Brainrots from all accounts
// ==========================================

// Additional DOM Elements for Collection
const brainrotSearchEl = document.getElementById('brainrotSearch');
const sortDropdown = document.getElementById('sortDropdown');
const accountDropdown = document.getElementById('accountDropdown');
const accountDropdownMenu = document.getElementById('accountDropdownMenu');
const priceFilterDropdown = document.getElementById('priceFilterDropdown');
const brainrotsGridEl = document.getElementById('brainrotsGrid');
const collectionStatsEl = document.getElementById('collectionStats');

// Collection state
let collectionState = {
    allBrainrots: [],
    filteredBrainrots: [],
    searchQuery: '',
    sortBy: 'income-desc',
    accountFilter: 'all',
    priceFilter: 'all',
    mutationFilter: 'all',  // v9.11.11: Filter by mutation type
    listedFilter: 'all',    // v9.11.11: Filter by listed/not listed status
    priceType: 'suggested', // v9.9.7: 'suggested', 'median', or 'nextCompetitor'
    pricesLoading: false,
    pricesLoaded: new Set(), // Кэш загруженных цен по имени
    generations: {},  // Stores which brainrots have been generated
    panelColor: null  // Unique color for this panel (based on farmKey)
};

// Custom Dropdown functionality
function initDropdown(dropdown, onChange) {
    if (!dropdown) return;
    
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    if (!toggle || !menu) return;
    
    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Close other dropdowns
        document.querySelectorAll('.custom-dropdown').forEach(function(d) {
            if (d !== dropdown) {
                const t = d.querySelector('.dropdown-toggle');
                const m = d.querySelector('.dropdown-menu');
                if (t) t.classList.remove('open');
                if (m) m.classList.remove('show');
            }
        });
        
        toggle.classList.toggle('open');
        menu.classList.toggle('show');
    });
    
    menu.addEventListener('click', function(e) {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        const value = item.dataset.value;
        const text = item.textContent;
        
        // Update active state
        menu.querySelectorAll('.dropdown-item').forEach(function(i) {
            i.classList.remove('active');
        });
        item.classList.add('active');
        
        // Update toggle text
        toggle.querySelector('span').textContent = text;
        
        // Close dropdown
        toggle.classList.remove('open');
        menu.classList.remove('show');
        
        // Callback
        if (onChange) onChange(value);
    });
}

// Close dropdowns on outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(function(d) {
            const t = d.querySelector('.dropdown-toggle');
            const m = d.querySelector('.dropdown-menu');
            if (t) t.classList.remove('open');
            if (m) m.classList.remove('show');
        });
    }
});

// ==========================================
// GENERATIONS TRACKING
// ==========================================

// Track last loaded key to avoid repeated loads
let lastLoadedGenerationsKey = null;
let lastLoadedColorKey = null;

// Load generations data for current user (with caching)
async function loadGenerationsData(forceRefresh = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        // Skip if already loaded for this key (unless forced)
        if (!forceRefresh && lastLoadedGenerationsKey === farmKey && Object.keys(collectionState.generations).length > 0) {
            return;
        }
        
        const response = await fetch(`/api/generations?farmKey=${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        collectionState.generations = data.generations || {};
        lastLoadedGenerationsKey = farmKey;
        console.log('Loaded generations:', Object.keys(collectionState.generations).length);
    } catch (err) {
        console.error('Error loading generations:', err);
        collectionState.generations = {};
    }
}

// Load panel color (single color for entire panel based on farmKey) - with caching
async function loadPanelColor(forceRefresh = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) {
            collectionState.panelColor = '#4ade80';
            return;
        }
        
        // Skip if already loaded for this key (unless forced)
        if (!forceRefresh && lastLoadedColorKey === farmKey && collectionState.panelColor) {
            return;
        }
        
        // Пробуем новый API
        try {
            const response = await fetch(`${API_BASE}/user-color?farmKey=${encodeURIComponent(farmKey)}`);
            if (response.ok) {
                const result = await response.json();
                collectionState.panelColor = result.color || '#4ade80';
                collectionState.colorPalette = result.palette || [];
                lastLoadedColorKey = farmKey;
                console.log('User color:', collectionState.panelColor, result.isCustom ? '(custom)' : '(default)');
                return;
            }
        } catch (e) {
            console.warn('New color API failed, using fallback');
        }
        
        // Fallback на старый API
        const response = await fetch(`${API_BASE}/account-colors?farmKey=${encodeURIComponent(farmKey)}`);
        const result = await response.json();
        collectionState.panelColor = result.color || '#4ade80';
        collectionState.colorPalette = result.palette || [];
        lastLoadedColorKey = farmKey;
        console.log('Panel color:', collectionState.panelColor);
    } catch (err) {
        console.error('Error loading panel color:', err);
        collectionState.panelColor = '#4ade80';
    }
}

// Сохранить цвет пользователя
async function saveUserColor(color) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return false;
        
        const response = await fetch(`${API_BASE}/user-color`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey, color })
        });
        
        if (response.ok) {
            const result = await response.json();
            collectionState.panelColor = result.color;
            console.log('User color saved:', result.color);
            return true;
        }
    } catch (err) {
        console.error('Error saving user color:', err);
    }
    return false;
}

// Save generation record
async function saveGeneration(brainrotName, accountId, resultUrl, income) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const normalizedIncome = normalizeIncomeForApi(income, '');
        
        const response = await fetch('/api/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey,
                brainrotName,
                accountId,
                income: normalizedIncome,
                resultUrl,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        if (data.success) {
            // Используем уникальный ключ accountId + name + income
            const genKey = getGenerationKey(accountId, brainrotName, normalizedIncome);
            collectionState.generations[genKey] = data.generation;
            renderCollection();
        }
    } catch (err) {
        console.error('Error saving generation:', err);
    }
}

// Генерация уникального ключа для брейнрота
// ВАЖНО: Заменяем точки на подчёркивания (MongoDB не позволяет точки в ключах)
function getGenerationKey(accountId, name, income) {
    if (!name) return null;
    const normalizedIncome = String(normalizeIncomeForApi(income, '')).replace(/\./g, '_');
    return `${accountId}_${name.toLowerCase().trim().replace(/\./g, '_')}_${normalizedIncome}`;
}

// NOTE: getGroupKey is defined later in MASS SELECTION MODE section

// Check if specific brainrot was generated (by accountId + name + income)
function isGenerated(accountId, name, income) {
    const key = getGenerationKey(accountId, name, income);
    if (!key) return false;
    return !!collectionState.generations[key];
}

// Check if ANY brainrot in group was generated (for grouped cards)
function isGroupGenerated(name, income) {
    const groupKey = getGroupKey(name, income);
    if (!groupKey) return false;
    for (const [key, gen] of Object.entries(collectionState.generations)) {
        if (key.endsWith('_' + groupKey)) {
            return true;
        }
    }
    return false;
}

// Get generation info for specific brainrot
function getGenerationInfo(accountId, name, income) {
    const key = getGenerationKey(accountId, name, income);
    return collectionState.generations[key] || null;
}

// Get all generation infos for a group (returns array)
function getGroupGenerationInfos(name, income) {
    const groupKey = getGroupKey(name, income);
    if (!groupKey) return [];
    const infos = [];
    for (const [key, gen] of Object.entries(collectionState.generations)) {
        if (key.endsWith('_' + groupKey)) {
            infos.push(gen);
        }
    }
    return infos;
}

// Get total generation count for a group (sum of all count values)
function getGroupTotalGenerationCount(name, income) {
    const infos = getGroupGenerationInfos(name, income);
    return infos.reduce((sum, gen) => sum + (gen.count || 1), 0);
}

// Current brainrot data for generation
let currentSupaBrainrot = null;

// Setup Collection event listeners
function setupCollectionListeners() {
    if (brainrotSearchEl) {
        brainrotSearchEl.addEventListener('input', function(e) {
            collectionState.searchQuery = e.target.value.trim();
            filterAndRenderCollection();
        });
    }

    initDropdown(sortDropdown, function(value) {
        collectionState.sortBy = value;
        filterAndRenderCollection();
    });

    initDropdown(accountDropdown, function(value) {
        collectionState.accountFilter = value;
        filterAndRenderCollection();
    });

    initDropdown(priceFilterDropdown, function(value) {
        collectionState.priceFilter = value;
        filterAndRenderCollection();
    });
    
    // v9.11.11: Mutation filter dropdown
    const mutationFilterDropdown = document.getElementById('mutationFilterDropdown');
    initDropdown(mutationFilterDropdown, function(value) {
        collectionState.mutationFilter = value;
        filterAndRenderCollection();
    });
    
    // v9.11.11: Listed/Not Listed filter dropdown
    const listedFilterDropdown = document.getElementById('listedFilterDropdown');
    initDropdown(listedFilterDropdown, function(value) {
        collectionState.listedFilter = value;
        filterAndRenderCollection();
    });
    
    // v9.9.7: Price type selector (suggested/median/nextCompetitor)
    const priceTypeDropdown = document.getElementById('priceTypeDropdown');
    initDropdown(priceTypeDropdown, function(value) {
        collectionState.priceType = value;
        localStorage.setItem('farmerpanel_priceType', value);
        filterAndRenderCollection();
        // Also refresh offers to update diff calculations
        if (typeof updateOffersPrices === 'function') {
            updateOffersPrices();
            renderOffers();
        }
    });
    
    // Restore saved price type
    const savedPriceType = localStorage.getItem('farmerpanel_priceType');
    if (savedPriceType && ['suggested', 'median', 'nextCompetitor'].includes(savedPriceType)) {
        collectionState.priceType = savedPriceType;
        // Update dropdown visual
        if (priceTypeDropdown) {
            const toggle = priceTypeDropdown.querySelector('.dropdown-toggle span');
            const items = priceTypeDropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.value === savedPriceType) {
                    item.classList.add('active');
                    if (toggle) {
                        const labels = { suggested: 'Suggested', median: 'Median', nextCompetitor: 'Next Comp' };
                        toggle.textContent = labels[savedPriceType] || 'Suggested';
                    }
                }
            });
        }
    }
}

// Collect all brainrots from all accounts
function collectAllBrainrots() {
    const data = state.farmersData[state.currentKey];
    if (!data || !data.accounts) {
        collectionState.allBrainrots = [];
        collectionState.groupedBrainrots = [];
        return;
    }

    const brainrots = [];
    const accounts = data.accounts;
    let mutationCount = 0;

    for (const account of accounts) {
        if (!account.brainrots) continue;
        
        for (const b of account.brainrots) {
            if (b.mutation) mutationCount++;
            brainrots.push({
                name: b.name,
                income: b.income || 0,
                incomeText: b.incomeText || '',
                imageUrl: b.imageUrl || getBrainrotImageUrl(b.name),
                accountName: account.playerName || 'Unknown',
                accountId: account.visibleUsername || account.userId,
                mutation: b.mutation || null
            });
        }
    }
    
    console.log('[Collection] Total brainrots:', brainrots.length, 'with mutations:', mutationCount);

    collectionState.allBrainrots = brainrots;
    
    // Группируем одинаковые брейнроты (по имени + income)
    collectionState.groupedBrainrots = groupBrainrots(brainrots);
    
    updateAccountDropdown(accounts);
}

// Группировка одинаковых брейнротов по имени, доходу И мутации
// Разные мутации НЕ стакаются - каждая мутация отдельная карточка
function groupBrainrots(brainrots) {
    const groups = new Map();
    
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        // Теперь ключ включает мутацию - разные мутации = разные группы
        const groupKey = getGroupKey(b.name, income, b.mutation);
        
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                name: b.name,
                income: income, // Use normalized income, not raw
                incomeText: b.incomeText,
                imageUrl: b.imageUrl,
                mutation: b.mutation || null, // Мутация фиксируется при создании группы
                items: [],
                quantity: 0
            });
        }
        
        const group = groups.get(groupKey);
        group.items.push({
            accountId: b.accountId,
            accountName: b.accountName,
            imageUrl: b.imageUrl,
            mutation: b.mutation
        });
        group.quantity++;
        
        // НЕ перезаписываем мутацию группы - она уже установлена правильно при создании
    }
    
    return Array.from(groups.values());
}

// Update account filter dropdown
function updateAccountDropdown(accounts) {
    if (!accountDropdownMenu) return;

    const currentValue = collectionState.accountFilter;
    const uniqueAccounts = [...new Set(accounts.map(a => a.playerName))].sort();
    
    let html = '<div class="dropdown-item' + (currentValue === 'all' ? ' active' : '') + '" data-value="all">All Accounts</div>';
    
    for (const name of uniqueAccounts) {
        html += '<div class="dropdown-item' + (currentValue === name ? ' active' : '') + '" data-value="' + name + '">' + name + '</div>';
    }
    
    accountDropdownMenu.innerHTML = html;
}

/**
 * Генерация ссылки на Eldorado для конкретного брейнрота
 * attr_ids mapping для M/s диапазонов:
 * 0-0 = Any, 0-1 = 0-24, 0-2 = 25-49, 0-3 = 50-99, 0-4 = 100-249, 
 * 0-5 = 250-499, 0-6 = 500-749, 0-7 = 750-999, 0-8 = 1+ B/s
 */
/**
 * v9.11.4: Mapping мутаций на attr_id для Eldorado URL
 */
const MUTATION_ATTR_IDS = {
    'None': '1-0',
    'Gold': '1-1',
    'Diamond': '1-2',
    'Bloodrot': '1-3',
    'Candy': '1-4',
    'Lava': '1-5',
    'Galaxy': '1-6',
    'Yin-Yang': '1-7',
    'YinYang': '1-7',
    'Radioactive': '1-8',
    'Rainbow': '1-9',
    'Cursed': '1-10'
};

/**
 * v9.11.4: Возвращает attr_id для мутации
 */
function getMutationAttrId(mutation) {
    if (!mutation || mutation === 'None' || mutation === 'Default' || mutation === '') {
        return null;
    }
    const cleanMut = cleanMutationText(mutation);
    return MUTATION_ATTR_IDS[cleanMut] || null;
}

function getEldoradoSearchLink(brainrotName, income, isInEldoradoList = true, mutation = null) {
    const incomeValue = typeof income === 'string' ? parseFloat(income) : income;
    
    // Определяем attr_ids на основе income
    let attrIds = '0-0'; // default = Any
    if (incomeValue >= 1000) attrIds = '0-8';      // 1+ B/s
    else if (incomeValue >= 750) attrIds = '0-7';  // 750-999 M/s
    else if (incomeValue >= 500) attrIds = '0-6';  // 500-749 M/s
    else if (incomeValue >= 250) attrIds = '0-5';  // 250-499 M/s
    else if (incomeValue >= 100) attrIds = '0-4';  // 100-249 M/s
    else if (incomeValue >= 50) attrIds = '0-3';   // 50-99 M/s
    else if (incomeValue >= 25) attrIds = '0-2';   // 25-49 M/s
    else if (incomeValue > 0) attrIds = '0-1';     // 0-24 M/s
    
    // v9.11.4: Добавляем mutation attr_id если есть мутация
    const mutationAttrId = getMutationAttrId(mutation);
    if (mutationAttrId) {
        attrIds = `${attrIds},${mutationAttrId}`;
    }
    
    const encodedName = encodeURIComponent(brainrotName);
    
    // v9.9.6: Если brainrot не в списке Eldorado, используем Other + searchQuery
    if (!isInEldoradoList) {
        return `https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?attr_ids=${attrIds}&te_v2=Other&searchQuery=${encodedName}&offerSortingCriterion=Price&isAscending=true&gamePageOfferIndex=1&gamePageOfferSize=24`;
    }
    
    return `https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?attr_ids=${attrIds}&te_v2=${encodedName}&offerSortingCriterion=Price&isAscending=true&gamePageOfferIndex=1&gamePageOfferSize=24`;
}

/**
 * v9.9.7: Получить выбранную цену на основе настройки priceType
 * @param {Object} priceData - данные цены из кэша
 * @returns {number|null} - выбранная цена
 */
function getSelectedPrice(priceData) {
    if (!priceData) return null;
    
    const priceType = collectionState.priceType || 'suggested';
    
    switch (priceType) {
        case 'median':
            return priceData.medianPrice || priceData.suggestedPrice || null;
        case 'nextCompetitor':
            return priceData.nextCompetitorPrice || priceData.suggestedPrice || null;
        case 'suggested':
        default:
            return priceData.suggestedPrice || null;
    }
}

/**
 * v9.9.7: Получить название выбранного типа цены
 */
function getSelectedPriceLabel() {
    const priceType = collectionState.priceType || 'suggested';
    switch (priceType) {
        case 'median': return 'Median';
        case 'nextCompetitor': return 'Next Comp';
        default: return 'Suggested';
    }
}

/**
 * Открыть ссылку Eldorado для брейнрота
 * v9.11.4: Добавлена поддержка mutation для фильтрации
 */
function openEldoradoLink(brainrotName, income, mutation = null) {
    // v9.9.6: Проверяем isInEldoradoList из кэша цен
    const normalizedIncome = normalizeIncomeForApi(income);
    const cacheKey = getPriceCacheKey(brainrotName, normalizedIncome, mutation);
    const priceData = state.brainrotPrices[cacheKey];
    const isInEldoradoList = priceData ? priceData.isInEldoradoList !== false : true;
    
    const link = getEldoradoSearchLink(brainrotName, income, isInEldoradoList, mutation);
    window.open(link, '_blank');
}

// Filter and sort brainrots
/**
 * Получить цену брейнрота из кэша
 */
function getBrainrotPrice(brainrot) {
    const income = normalizeIncomeForApi(brainrot.income, brainrot.incomeText);
    const cacheKey = getPriceCacheKey(brainrot.name, income);
    const priceData = state.brainrotPrices[cacheKey];
    return priceData && priceData.suggestedPrice ? priceData.suggestedPrice : null;
}

/**
 * Парсинг поискового запроса для поддержки income фильтров
 */
function parseSearchQuery(query) {
    // Поддержка форматов: >100, <50, 100-200, =150, просто число или текст
    const result = { text: '', incomeFilter: null };
    
    if (!query) return result;
    
    // Проверяем на диапазон (100-200)
    const rangeMatch = query.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        result.incomeFilter = { type: 'range', min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
        return result;
    }
    
    // Проверяем на сравнение (>100, <50, >=100, <=50, =100)
    const compareMatch = query.match(/^([<>=]+)\s*(\d+\.?\d*)$/);
    if (compareMatch) {
        const op = compareMatch[1];
        const val = parseFloat(compareMatch[2]);
        if (op === '>') result.incomeFilter = { type: 'gt', value: val };
        else if (op === '>=') result.incomeFilter = { type: 'gte', value: val };
        else if (op === '<') result.incomeFilter = { type: 'lt', value: val };
        else if (op === '<=') result.incomeFilter = { type: 'lte', value: val };
        else if (op === '=') result.incomeFilter = { type: 'eq', value: val };
        return result;
    }
    
    // Проверяем на просто число
    const numMatch = query.match(/^(\d+\.?\d*)$/);
    if (numMatch) {
        // Если просто число - ищем точное совпадение или близкое
        result.incomeFilter = { type: 'approx', value: parseFloat(numMatch[1]) };
        return result;
    }
    
    // Иначе это текстовый поиск
    result.text = query.toLowerCase();
    return result;
}

/**
 * Проверка income по фильтру
 */
function matchesIncomeFilter(income, filter) {
    if (!filter) return true;
    
    switch (filter.type) {
        case 'gt': return income > filter.value;
        case 'gte': return income >= filter.value;
        case 'lt': return income < filter.value;
        case 'lte': return income <= filter.value;
        case 'eq': return Math.abs(income - filter.value) < 0.1;
        case 'approx': return Math.abs(income - filter.value) < Math.max(filter.value * 0.1, 5);
        case 'range': return income >= filter.min && income <= filter.max;
        default: return true;
    }
}

function filterAndRenderCollection() {
    let filtered = [...collectionState.allBrainrots];

    // Parse search query
    const searchParsed = parseSearchQuery(collectionState.searchQuery);

    // Filter by search (text or income)
    if (searchParsed.text) {
        const searchText = searchParsed.text;
        const isShortNumeric = /^\d{1,3}$/.test(searchText); // 1-3 digit numbers like 67, 25
        
        filtered = filtered.filter(b => {
            const nameLower = b.name.toLowerCase();
            const accountLower = b.accountName.toLowerCase();
            
            if (isShortNumeric) {
                // For short numeric names, use exact match or word boundary match
                // "67" should match "67" but not "167" or "567"
                const exactMatch = nameLower === searchText;
                const wordBoundaryMatch = new RegExp(`(^|[^\\d])${searchText}([^\\d]|$)`).test(nameLower);
                return exactMatch || wordBoundaryMatch || accountLower.includes(searchText);
            }
            
            // Default includes search for longer queries
            return nameLower.includes(searchText) || accountLower.includes(searchText);
        });
    }
    
    if (searchParsed.incomeFilter) {
        filtered = filtered.filter(b => matchesIncomeFilter(b.income, searchParsed.incomeFilter));
    }

    // Filter by account
    if (collectionState.accountFilter !== 'all') {
        filtered = filtered.filter(b => 
            b.accountName === collectionState.accountFilter
        );
    }

    // Filter by price
    if (collectionState.priceFilter !== 'all') {
        filtered = filtered.filter(b => {
            const price = getBrainrotPrice(b);
            
            switch (collectionState.priceFilter) {
                case 'has-price': return price !== null;
                case 'no-price': return price === null;
                case 'under-1': return price !== null && price < 1;
                case '1-5': return price !== null && price >= 1 && price < 5;
                case '5-10': return price !== null && price >= 5 && price < 10;
                case '10-25': return price !== null && price >= 10 && price < 25;
                case 'over-25': return price !== null && price >= 25;
                default: return true;
            }
        });
    }
    
    // v9.11.11: Filter by mutation
    if (collectionState.mutationFilter !== 'all') {
        filtered = filtered.filter(b => {
            const hasMutation = b.mutation && cleanMutationText(b.mutation);
            const mutationType = hasMutation ? cleanMutationText(b.mutation) : null;
            
            switch (collectionState.mutationFilter) {
                case 'none': return !hasMutation;
                case 'any': return hasMutation;
                default: 
                    // Specific mutation type (Gold, Diamond, etc.)
                    return mutationType && mutationType.toLowerCase() === collectionState.mutationFilter.toLowerCase();
            }
        });
    }
    
    // v9.11.11: Filter by listed/not listed status
    // v9.12.13: Now considers mutation
    if (collectionState.listedFilter !== 'all') {
        filtered = filtered.filter(b => {
            const isListed = hasActiveOffer(b.name, b.income, b.mutation);
            return collectionState.listedFilter === 'listed' ? isListed : !isListed;
        });
    }

    // Sort
    switch (collectionState.sortBy) {
        case 'income-desc':
            filtered.sort((a, b) => b.income - a.income);
            break;
        case 'income-asc':
            filtered.sort((a, b) => a.income - b.income);
            break;
        case 'price-desc':
            filtered.sort((a, b) => {
                const priceA = getBrainrotPrice(a) || 0;
                const priceB = getBrainrotPrice(b) || 0;
                return priceB - priceA;
            });
            break;
        case 'price-asc':
            filtered.sort((a, b) => {
                const priceA = getBrainrotPrice(a) || 0;
                const priceB = getBrainrotPrice(b) || 0;
                return priceA - priceB;
            });
            break;
        case 'name-asc':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filtered.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'account':
            filtered.sort((a, b) => a.accountName.localeCompare(b.accountName) || b.income - a.income);
            break;
    }

    collectionState.filteredBrainrots = filtered;
    renderCollection();
}

// Render collection
async function renderCollection() {
    if (!brainrotsGridEl) return;

    const brainrots = collectionState.filteredBrainrots;
    const isSelectionMode = massSelectionState && massSelectionState.isActive;
    
    // Update stats (используем синхронизированное значение из state)
    // При ручном рефреше используем frozen balance
    if (collectionStatsEl) {
        const uniqueNames = new Set(collectionState.allBrainrots.map(b => b.name.toLowerCase()));
        const totalValue = state.isManualPriceRefresh && state.frozenBalance !== null 
            ? state.frozenBalance 
            : state.currentTotalValue;
        
        // Get balance change for collection (используем из state) - НЕ при ручном рефреше
        let changeHtml = '';
        if (!state.isManualPriceRefresh && state.currentBalanceChange && Math.abs(state.currentBalanceChange.changePercent) > 0.01) {
            changeHtml = ' ' + formatBalanceChange(state.currentBalanceChange.changePercent, true);
        }
        
        let statsHtml = '<span><i class="fas fa-layer-group"></i> ' + collectionState.allBrainrots.length + ' ' + t('total') + '</span>';
        statsHtml += '<span><i class="fas fa-fingerprint"></i> ' + uniqueNames.size + ' ' + t('unique') + '</span>';
        if (totalValue > 0) {
            statsHtml += '<span class="total-value"><i class="fas fa-dollar-sign"></i> ' + totalValue.toFixed(2) + changeHtml + '</span>';
        }
        if (collectionState.searchQuery || collectionState.accountFilter !== 'all' || collectionState.priceFilter !== 'all') {
            statsHtml += '<span><i class="fas fa-filter"></i> ' + brainrots.length + ' ' + t('shown') + '</span>';
        }
        if (isSelectionMode) {
            statsHtml += '<span style="color: var(--accent-primary);"><i class="fas fa-check-square"></i> ' + t('selection_mode') + '</span>';
        }
        collectionStatsEl.innerHTML = statsHtml;
    }

    if (brainrots.length === 0) {
        brainrotsGridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <i class="fas fa-search"></i>
                <h3>${collectionState.allBrainrots.length === 0 ? t('no_brainrots_found') : t('no_matches')}</h3>
                <p>${collectionState.allBrainrots.length === 0 
                    ? t('brainrots_will_appear') 
                    : t('try_adjusting_filters')}</p>
            </div>
        `;
        return;
    }

    // Группируем отфильтрованные брейнроты для отображения
    const groupedFiltered = groupBrainrots(brainrots);
    
    // Рендер карточек с группировкой
    brainrotsGridEl.innerHTML = groupedFiltered.map((group, index) => {
        const income = normalizeIncomeForApi(group.income, group.incomeText);
        const cacheKey = getPriceCacheKey(group.name, income);
        const cachedPrice = state.brainrotPrices[cacheKey];
        
        // Проверяем генерацию для всей группы
        const groupGenerated = isGroupGenerated(group.name, income);
        const generatedCount = getGroupGenerationInfos(group.name, income).length;
        
        // Сколько в группе НЕ сгенерировано
        const notGeneratedCount = group.items.filter(item => 
            !isGenerated(item.accountId, group.name, income)
        ).length;
        
        // Selection mode variables - use group key for stable selection
        const groupKey = getGroupKey(group);
        const isSelected = isSelectionMode && massSelectionState.selectedItems.has(groupKey);
        
        // Check if brainrot has active offer (v9.12.13: now considers mutation)
        const hasOffer = hasActiveOffer(group.name, group.income, group.mutation);
        
        let priceHtml;
        
        // v9.11.0: Если есть мутация - показываем два варианта цен (Default + Mutation)
        const hasMutation = group.mutation && cleanMutationText(group.mutation);
        
        if (hasMutation) {
            // Используем новый рендер с вариантами
            priceHtml = renderPriceVariants(group.name, income, group.mutation);
        } else {
            // v9.11.1: Используем унифицированный блок цены для обычных карточек
            priceHtml = renderPriceBlock(cachedPrice, cacheKey);
        }
        
        // Определяем статус генерации: все сгенерированы, частично, или ни одного
        const allGenerated = notGeneratedCount === 0;
        const partialGenerated = generatedCount > 0 && notGeneratedCount > 0;
        
        // Собираем детальную информацию по аккаунтам для tooltip
        const accountsDetails = group.items.map(item => {
            const isGen = isGenerated(item.accountId, group.name, income);
            const statusIcon = isGen ? '✅' : '⏳';
            return `${statusIcon} ${item.accountName}`;
        }).join('\n');
        
        const accountsList = group.items.map(i => i.accountName).join(', ');
        
        // Build class list for selection mode
        const cardClasses = ['brainrot-card'];
        if (allGenerated) cardClasses.push('brainrot-generated');
        if (partialGenerated) cardClasses.push('brainrot-partial');
        if (isSelectionMode) cardClasses.push('selectable');
        if (isSelected) cardClasses.push('selected');
        if (hasOffer) cardClasses.push('has-offer');
        
        // Click handler for selection mode
        const clickHandler = isSelectionMode 
            ? `onclick="toggleBrainrotSelection(${index})"` 
            : '';
        
        // v9.11.2: Restructured card layout - price block at bottom of full card width
        return `
        <div class="${cardClasses.join(' ')} ${group.mutation ? 'brainrot-mutated' : ''}" 
             data-brainrot-name="${group.name}" 
             data-brainrot-income="${income}" 
             data-brainrot-index="${index}"
             data-brainrot-key="${groupKey}"
             data-quantity="${group.quantity}"
             ${clickHandler}>
            ${hasOffer ? `<div class="brainrot-offer-badge" title="На продаже"><i class="fas fa-shopping-cart"></i></div>` : ''}
            <div class="brainrot-generate-btn" onclick="event.stopPropagation(); handleGroupGenerateClick(${index})" title="Генерировать изображение${group.quantity > 1 ? ' (x' + group.quantity + ')' : ''}">
                <i class="fas fa-plus"></i>
            </div>
            ${group.quantity > 1 ? `
            <div class="brainrot-quantity-badge" data-tooltip="Фермеры:\n${accountsDetails}">
                x${group.quantity}
            </div>
            ` : ''}
            <button class="brainrot-eldorado-link" onclick="event.stopPropagation(); openEldoradoLink('${group.name.replace(/'/g, "\\'")}', ${income}, ${group.mutation ? `'${cleanMutationText(group.mutation)}'` : 'null'})" title="View on Eldorado">
                <i class="fas fa-external-link-alt"></i>
            </button>
            <div class="brainrot-card-content">
                <div class="brainrot-image">
                    ${group.imageUrl 
                        ? `<img src="${group.imageUrl}" alt="${group.name}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-brain\\'></i>'">`
                        : '<i class="fas fa-brain"></i>'
                    }
                </div>
                <div class="brainrot-details">
                    <div class="brainrot-name" title="${group.name}">${group.name}</div>
                    ${group.mutation ? (() => {
                        const mStyles = getMutationStyles(group.mutation);
                        const textShadow = mStyles.textShadow ? `text-shadow: ${mStyles.textShadow};` : '';
                        return `<div class="brainrot-mutation-line"><span class="brainrot-mutation-badge-inline" style="background: ${mStyles.background}; color: ${mStyles.textColor}; ${textShadow} --glow-color: ${mStyles.glowColor};">${cleanMutationText(group.mutation)}</span></div>`;
                    })() : '<div class="brainrot-mutation-line brainrot-mutation-placeholder"></div>'}
                    <div class="brainrot-income">${group.incomeText || formatIncome(group.income)}</div>
                    <div class="brainrot-account" title="${accountsList}">
                        <i class="fas fa-user${group.quantity > 1 ? 's' : ''}"></i>
                        ${group.quantity > 1 ? group.quantity + ' accounts' : group.items[0]?.accountName || 'Unknown'}
                    </div>
                </div>
            </div>
            ${priceHtml}
        </div>`;
    }).join('');
    
    // Сохраняем сгруппированные данные для обработчиков
    collectionState.displayedGroups = groupedFiltered;
    
    // Загружаем цены только для тех у кого ещё нет
    loadBrainrotPrices(brainrots);
}

/**
 * Загрузить и отобразить цены для брейнротов - ПОСЛЕДОВАТЕЛЬНО
 */
async function loadBrainrotPrices(brainrots) {
    // Защита от повторной загрузки
    if (collectionState.pricesLoading) {
        return;
    }
    
    // v9.11.0: Собираем задачи загрузки
    // Для брейнротов с мутациями добавляем ДВЕ задачи: default + mutation
    const toLoad = [];
    for (const b of brainrots) {
        const income = normalizeIncomeForApi(b.income, b.incomeText);
        const hasMutation = b.mutation && cleanMutationText(b.mutation);
        
        // 1. Default price (всегда)
        const defaultCacheKey = getPriceCacheKey(b.name, income);
        const defaultCached = state.brainrotPrices[defaultCacheKey];
        if (!defaultCached || isPriceStale(defaultCached)) {
            toLoad.push({ 
                ...b, 
                _income: income, 
                _cacheKey: defaultCacheKey,
                _mutation: null,
                _type: 'default'
            });
        }
        
        // 2. Mutation price (только если есть мутация)
        if (hasMutation) {
            const mutationCacheKey = getPriceCacheKey(b.name, income, b.mutation);
            const mutationCached = state.brainrotPrices[mutationCacheKey];
            if (!mutationCached || isPriceStale(mutationCached)) {
                toLoad.push({ 
                    ...b, 
                    _income: income, 
                    _cacheKey: mutationCacheKey,
                    _mutation: b.mutation,
                    _type: 'mutation'
                });
            }
        }
    }
    
    if (toLoad.length === 0) {
        return;
    }
    
    // Сохраняем текущие цены как предыдущие ПЕРЕД загрузкой новых
    savePreviousPrices();
    
    const defaultCount = toLoad.filter(t => t._type === 'default').length;
    const mutationCount = toLoad.filter(t => t._type === 'mutation').length;
    console.log(`[Prices] Loading ${toLoad.length} prices: ${defaultCount} default, ${mutationCount} mutation`);
    collectionState.pricesLoading = true;
    
    // v9.12.11: Оптимизация - batch size 20, delay 30ms
    // 406 цен / 20 = 21 batch × 30ms = 0.63 сек задержек
    const BATCH_SIZE = 20;
    const BATCH_DELAY = 30; // ms между batch'ами
    const SAVE_INTERVAL = 40; // сохраняем в localStorage каждые N загрузок
    
    try {
        let loadedCount = 0;
        
        for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
            const batch = toLoad.slice(i, i + BATCH_SIZE);
            
            // Загружаем batch параллельно
            const promises = batch.map(async (b) => {
                const cacheKey = b._cacheKey;
                const income = b._income;
                const mutation = b._mutation; // v9.11.0: Может быть null или название мутации
                
                // Пропускаем если уже загружено свежее
                const cached = state.brainrotPrices[cacheKey];
                if (cached && !isPriceStale(cached)) return;
                
                try {
                    // v9.11.0: Передаем мутацию в API
                    const priceData = await fetchEldoradoPrice(b.name, income, mutation);
                    
                    // Сохраняем в глобальный кэш с timestamp
                    if (priceData) {
                        priceData._timestamp = Date.now();
                        state.brainrotPrices[cacheKey] = priceData;
                    } else {
                        state.brainrotPrices[cacheKey] = { error: true, _timestamp: Date.now() };
                    }
                    
                    // v9.11.0: Обновляем DOM - для мутаций обновится весь блок вариантов
                    updatePriceInDOM(b.name, income, priceData, mutation);
                    loadedCount++;
                    
                } catch (err) {
                    console.warn('Error loading price for', b.name, income, mutation || 'default', err);
                    state.brainrotPrices[cacheKey] = { error: true, _timestamp: Date.now() };
                    updatePriceInDOM(b.name, income, null, mutation);
                }
            });
            
            await Promise.all(promises);
            
            // Сохраняем в localStorage периодически (не после каждого запроса)
            if (loadedCount > 0 && loadedCount % SAVE_INTERVAL === 0) {
                savePriceCacheToStorage();
            }
            
            // Задержка между batch'ами чтобы не упереться в rate limit
            if (i + BATCH_SIZE < toLoad.length) {
                await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
        }
        
        // Финальное сохранение
        savePriceCacheToStorage();
        savePricesToServer(); // Также сохраняем на сервер
        
        // v9.8.10: Update offers with new prices from collection
        if (offersState.offers.length > 0) {
            await updateOffersRecommendedPrices();
            filterAndRenderOffers();
        }
        
        // Обновляем UI для отображения обновленных значений
        updateUI();
        renderFarmKeys();
        
    } finally {
        collectionState.pricesLoading = false;
    }
}

/**
 * Обновить цену в DOM для конкретного брейнрота
 */
function updatePriceInDOM(brainrotName, income, priceData, mutation = null) {
    // Округляем income для поиска (так же как при рендере)
    const roundedIncome = Math.floor(income / 10) * 10;
    const cacheKey = getPriceCacheKey(brainrotName, income, mutation);
    
    // Ищем карточку по имени и income
    const cards = brainrotsGridEl?.querySelectorAll(`[data-brainrot-name="${CSS.escape(brainrotName)}"]`);
    if (!cards || cards.length === 0) return;
    
    // Находим карточку с нужным income
    let card = null;
    for (const c of cards) {
        const cardIncome = parseFloat(c.dataset.brainrotIncome) || 0;
        const cardRoundedIncome = Math.floor(cardIncome / 10) * 10;
        if (cardRoundedIncome === roundedIncome) {
            card = c;
            break;
        }
    }
    
    // Если не нашли по точному income, берём первую карточку с таким именем
    if (!card) card = cards[0];
    
    // v9.11.0: Проверяем есть ли у карточки мутация (класс brainrot-mutated)
    const isMutatedCard = card.classList.contains('brainrot-mutated');
    
    // Если карточка с мутацией - перерендериваем весь блок вариантов цен
    if (isMutatedCard) {
        // Находим блок с вариантами или .brainrot-price
        const variantsEl = card.querySelector('.brainrot-price-variants');
        const priceEl = card.querySelector('.brainrot-price');
        
        // Получаем мутацию из карточки (ищем бейдж)
        const mutationBadge = card.querySelector('.brainrot-mutation-badge-inline');
        const cardMutation = mutationBadge ? mutationBadge.textContent.trim() : null;
        
        if (cardMutation) {
            // Рендерим обновленный блок вариантов
            const newVariantsHtml = renderPriceVariants(brainrotName, income, cardMutation);
            
            if (variantsEl) {
                variantsEl.outerHTML = newVariantsHtml;
            } else if (priceEl) {
                priceEl.outerHTML = newVariantsHtml;
            }
        }
        return;
    }
    
    // Обычная логика для карточек без мутации
    const priceEl = card.querySelector('.brainrot-price');
    if (!priceEl) return;
    
    priceEl.removeAttribute('data-price-loading');
    
    if (priceData && priceData.suggestedPrice) {
        // competitorPrice это цена upper оффера (ближайший конкурент с income >= наш)
        const competitorInfo = priceData.competitorPrice 
            ? `~$${priceData.competitorPrice.toFixed(2)}` 
            : '';
        const priceChange = getPriceChangePercent(cacheKey, priceData.suggestedPrice);
        const changeHtml = formatPriceChange(priceChange);
        
        // Check for spike
        const isSpikePrice = priceData.isSpike || false;
        const spikeHtml = isSpikePrice 
            ? `<span class="price-spike-badge" title="Price spike detected!">⚠️ Spike</span>` 
            : '';
        const pendingInfo = isSpikePrice && priceData.pendingPrice 
            ? `<span class="price-pending">→ $${priceData.pendingPrice.toFixed(2)}</span>` 
            : '';
        
        // Parsing source badge (regex, ai, or hybrid)
        // Приоритет: source (новый AI-first API) > parsingSource (старый)
        const source = priceData.source || priceData.parsingSource || 'regex';
        let sourceBadge = '';
        
        // v9.10.5: При AI + nextRangeChecked показываем brain + желтую стрелку вместе
        if (source === 'ai' && priceData.nextRangeChecked) {
            sourceBadge = `<span class="parsing-source-badge ai-next-range" title="${t('ai_validated')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>`;
        } else if (source === 'ai') {
            sourceBadge = `<span class="parsing-source-badge ai" title="${t('ai_determined')}"><i class="fas fa-brain"></i></span>`;
        } else if (source === 'hybrid') {
            sourceBadge = `<span class="parsing-source-badge hybrid" title="${t('hybrid_tooltip')}"><i class="fas fa-brain"></i><i class="fas fa-robot"></i></span>`;
        } else {
            sourceBadge = `<span class="parsing-source-badge regex" title="Price by Bot (Regex)"><i class="fas fa-robot"></i></span>`;
        }
        
        // v9.9.5: Иконка для цены из следующего диапазона (только для regex, AI уже включает стрелку)
        const nextRangeBadge = (priceData.nextRangeChecked && source !== 'ai')
            ? `<span class="next-range-badge" title="${t('price_next_range')}"><i class="fas fa-level-up-alt"></i></span>` 
            : '';
        
        if (isSpikePrice) {
            priceEl.classList.add('spike-warning');
        } else {
            priceEl.classList.remove('spike-warning');
        }
        
        priceEl.innerHTML = `
            <i class="fas fa-tag"></i>
            <span class="price-text suggested">${formatPrice(priceData.suggestedPrice)}</span>
            ${sourceBadge}
            ${nextRangeBadge}
            ${isSpikePrice ? spikeHtml : changeHtml}
            ${pendingInfo}
            ${competitorInfo ? `<span class="price-market">${competitorInfo}</span>` : ''}
        `;
        priceEl.title = priceData.priceSource || `Suggested: ${formatPrice(priceData.suggestedPrice)}`;
    } else {
        priceEl.innerHTML = `
            <i class="fas fa-tag" style="opacity: 0.5"></i>
            <span class="price-text" style="opacity: 0.5">No data</span>
        `;
    }
}

/**
 * Удалить фермера из системы
 */
async function deleteFarmer(playerName) {
    if (!confirm(`Are you sure you want to delete farmer "${playerName}"?\n\nThis will remove all their brainrot data from the panel. They will reappear if the script runs again.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/delete-farmer?playerName=${encodeURIComponent(playerName)}&key=${encodeURIComponent(state.currentKey)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification(`${t('farmer_deleted')}: "${playerName}"`, 'success');
            // Force refresh data
            await fetchFarmerData();
        } else {
            showNotification(result.error || t('farmer_delete_failed'), 'error');
        }
    } catch (err) {
        console.error('Error deleting farmer:', err);
        showNotification(`${t('farmer_delete_failed')}: ${err.message}`, 'error');
    }
}

/**
 * Очистить кэш цен и перезагрузить
 */
function clearPriceCache() {
    // РУЧНОЙ РЕФРЕШ - не записываем изменения в историю баланса
    state.isManualPriceRefresh = true;
    
    // ЗАМОРАЖИВАЕМ баланс ПЕРЕД очисткой цен - он будет отображаться пока цены загружаются
    state.frozenBalance = state.currentTotalValue;
    console.log('Manual price refresh started - balance frozen at $' + state.frozenBalance.toFixed(2));
    
    // Сохраняем текущие цены как предыдущие для отображения % изменения
    savePreviousPrices();
    
    // Сохраняем текущую общую стоимость
    const data = state.farmersData[state.currentKey];
    if (data && data.accounts) {
        const allBrainrots = [];
        data.accounts.forEach(account => {
            if (account.brainrots) {
                account.brainrots.forEach(b => allBrainrots.push(b));
            }
        });
        state.previousTotalValue = calculateTotalValue(allBrainrots);
    }
    
    state.brainrotPrices = {};
    state.eldoradoPrices = {};
    localStorage.removeItem(PRICE_STORAGE_KEY);
    console.log('Price cache cleared');
    // Перезагружаем цены
    filterAndRenderCollection();
    
    // Сбрасываем флаг после завершения рефреша (с задержкой чтобы все обновления прошли)
    setTimeout(() => {
        state.isManualPriceRefresh = false;
        state.frozenBalance = null;
        console.log('Manual price refresh completed - balance unfrozen');
    }, 30000); // 30 секунд на загрузку всех цен
}

/**
 * Автоматическое обновление цен каждые 10 минут
 * Постепенно обновляет цены для всех брейнротов в коллекции
 */
let autoPriceRefreshInterval = null;
let incrementalPriceRefreshInterval = null; // v9.12.24: Инкрементальное обновление каждую минуту
let isAutoRefreshing = false;

function startAutoPriceRefresh() {
    if (autoPriceRefreshInterval) {
        clearInterval(autoPriceRefreshInterval);
    }
    if (incrementalPriceRefreshInterval) {
        clearInterval(incrementalPriceRefreshInterval);
    }
    
    // v9.12.24: Инкрементальное обновление каждую минуту - забираем обновлённые цены от cron
    incrementalPriceRefreshInterval = setInterval(async () => {
        if (!state.currentKey || isAutoRefreshing) return;
        await loadUpdatedPricesFromServer();
    }, PRICE_INCREMENTAL_INTERVAL);
    
    console.log('⏰ Incremental price sync scheduled every 1 minute');
    
    // Полное обновление каждые 10 минут (на случай если что-то не синхронизировалось)
    autoPriceRefreshInterval = setInterval(async () => {
        if (!state.currentKey || isAutoRefreshing) return;
        
        console.log('🔄 Starting automatic price refresh...');
        await refreshAllPricesGradually();
    }, PRICE_AUTO_REFRESH_INTERVAL);
    
    console.log('⏰ Full price refresh scheduled every 10 minutes');
}

function stopAutoPriceRefresh() {
    if (autoPriceRefreshInterval) {
        clearInterval(autoPriceRefreshInterval);
        autoPriceRefreshInterval = null;
    }
    // v9.12.24: Также останавливаем инкрементальное обновление
    if (incrementalPriceRefreshInterval) {
        clearInterval(incrementalPriceRefreshInterval);
        incrementalPriceRefreshInterval = null;
    }
}

/**
 * Постепенное обновление цен для всех уникальных брейнротов
 * Обновляет по одному брейнроту с задержкой между запросами
 */
async function refreshAllPricesGradually() {
    if (isAutoRefreshing) {
        console.log('Auto refresh already in progress, skipping');
        return;
    }
    
    isAutoRefreshing = true;
    
    try {
        // Собираем все уникальные брейнроты с income
        const uniqueBrainrots = new Map();
        const data = state.farmersData[state.currentKey];
        
        if (!data || !data.accounts) {
            isAutoRefreshing = false;
            return;
        }
        
        for (const account of data.accounts) {
            if (!account.brainrots) continue;
            for (const b of account.brainrots) {
                const income = normalizeIncomeForApi(b.income, b.incomeText);
                const key = `${b.name.toLowerCase()}_${income}`;
                if (!uniqueBrainrots.has(key)) {
                    uniqueBrainrots.set(key, { name: b.name, income, incomeText: b.incomeText });
                }
            }
        }
        
        const total = uniqueBrainrots.size;
        let refreshed = 0;
        
        console.log(`🔄 Refreshing prices for ${total} unique brainrots...`);
        
        // Обновляем по одному с задержкой 500ms между запросами
        for (const [key, brainrot] of uniqueBrainrots) {
            try {
                const cacheKey = getPriceCacheKey(brainrot.name, brainrot.income);
                
                // Проверяем возраст кэша
                const cached = state.eldoradoPrices[cacheKey];
                const cacheAge = cached?.timestamp ? Date.now() - cached.timestamp : Infinity;
                
                // Обновляем только если кэш старше 10 минут
                if (cacheAge > PRICE_CACHE_TTL) {
                    // Удаляем из кэша чтобы принудить новый запрос
                    delete state.eldoradoPrices[cacheKey];
                    delete state.brainrotPrices[cacheKey];
                    
                    // Запрашиваем новую цену
                    const priceData = await fetchEldoradoPrice(brainrot.name, brainrot.income);
                    
                    if (priceData && priceData.suggestedPrice) {
                        // Сохраняем в brainrotPrices для отображения
                        state.brainrotPrices[cacheKey] = {
                            ...priceData,
                            timestamp: Date.now()
                        };
                        refreshed++;
                        console.log(`   ${brainrot.name} (${brainrot.income}M/s): $${priceData.suggestedPrice} [${priceData.source || 'regex'}]`);
                    }
                    
                    // Задержка между запросами чтобы не перегружать API
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.warn(`Failed to refresh price for ${brainrot.name}:`, e.message);
            }
        }
        
        console.log(`✅ Auto price refresh complete: ${refreshed}/${total} updated`);
        
        // Обновляем UI после всех обновлений
        if (refreshed > 0) {
            savePriceCacheToStorage();
            updateUI();
        }
        
    } catch (error) {
        console.error('Auto price refresh error:', error);
    } finally {
        isAutoRefreshing = false;
    }
}

// Update collection when data changes
async function updateCollection() {
    // Собираем брейнроты и рендерим СРАЗУ (без ожидания)
    collectAllBrainrots();
    filterAndRenderCollection();
    
    // Загружаем generations и panel color в фоне (не блокируем)
    Promise.all([
        loadGenerationsData(),
        loadPanelColor()
    ]).then(() => {
        // Перерендериваем с badges если они изменились
        if (collectionState.filteredBrainrots.length > 0) {
            renderCollection();
        }
    }).catch(err => console.warn('Background load error:', err));
    
    // v9.8.22: Update offers prices from collection prices cache
    if (offersState.offers.length > 0) {
        await updateOffersRecommendedPrices();
        filterAndRenderOffers();
    }
}

// Handle generate button click (for individual brainrots - deprecated, use handleGroupGenerateClick)
function handleGenerateClick(index) {
    const brainrot = collectionState.filteredBrainrots[index];
    if (brainrot) {
        openSupaGenerator(brainrot);
    }
}

// Handle generate button click for grouped brainrots
function handleGroupGenerateClick(index) {
    const group = collectionState.displayedGroups?.[index];
    if (!group) return;
    
    const income = normalizeIncomeForApi(group.income, group.incomeText);
    
    // Находим первый не сгенерированный брейнрот в группе
    const notGeneratedItem = group.items.find(item => 
        !isGenerated(item.accountId, group.name, income)
    );
    
    // Если все сгенерированы - берём первый
    const itemToGenerate = notGeneratedItem || group.items[0];
    
    const brainrotData = {
        name: group.name,
        income: group.income,
        incomeText: group.incomeText,
        imageUrl: group.imageUrl,
        accountName: itemToGenerate.accountName,
        accountId: itemToGenerate.accountId,
        quantity: group.quantity, // Передаём количество для Eldorado
        mutation: group.mutation || '', // v9.8.28: Передаём мутацию для Eldorado
        groupItems: group.items // Все элементы группы
    };
    
    openSupaGenerator(brainrotData);
}

// ==========================================
// SUPA GENERATOR MODAL
// ==========================================

// Open Supa Generator modal for a brainrot
function openSupaGenerator(brainrotData) {
    console.log('Opening Supa Generator for:', brainrotData);
    
    currentSupaBrainrot = brainrotData;
    
    let modal = document.getElementById('supaGeneratorModal');
    if (!modal) {
        modal = createSupaGeneratorModal();
        document.body.appendChild(modal);
    }
    
    document.getElementById('supaName').value = brainrotData.name || '';
    document.getElementById('supaIncome').value = brainrotData.incomeText || formatIncome(brainrotData.income);
    document.getElementById('supaImageUrl').value = brainrotData.imageUrl || '';
    
    // v9.9.0: Заполняем варианты цен
    const normalizedIncome = normalizeIncomeForApi(brainrotData.income, brainrotData.incomeText);
    const hasMutation = brainrotData.mutation && cleanMutationText(brainrotData.mutation);
    
    // v9.11.1: Настройка mutation selector
    const mutationSelectorEl = document.getElementById('supaMutationSelector');
    const mutationLabelEl = document.getElementById('supaMutationLabel');
    const defaultVariantRadio = document.querySelector('input[name="supaPriceVariant"][value="default"]');
    
    if (hasMutation && mutationSelectorEl) {
        mutationSelectorEl.classList.remove('hidden');
        if (mutationLabelEl) {
            const mStyles = getMutationStyles(brainrotData.mutation);
            mutationLabelEl.textContent = cleanMutationText(brainrotData.mutation);
            mutationLabelEl.style.background = mStyles.background;
            mutationLabelEl.style.color = mStyles.textColor;
        }
        if (defaultVariantRadio) defaultVariantRadio.checked = true;
    } else if (mutationSelectorEl) {
        mutationSelectorEl.classList.add('hidden');
    }
    
    // v9.11.1: Функция обновления цен на основе выбранного варианта
    const updatePricesForVariant = () => {
        const selectedVariant = document.querySelector('input[name="supaPriceVariant"]:checked')?.value || 'default';
        let priceKey;
        
        if (selectedVariant === 'mutation' && hasMutation) {
            priceKey = getPriceCacheKey(brainrotData.name, normalizedIncome, brainrotData.mutation);
        } else {
            priceKey = getPriceCacheKey(brainrotData.name, normalizedIncome);
        }
        
        const priceData = state.brainrotPrices[priceKey];
        
        const suggestedEl = document.getElementById('supaPriceSuggested');
        const medianEl = document.getElementById('supaPriceMedian');
        const nextEl = document.getElementById('supaPriceNext');
        
        if (suggestedEl) suggestedEl.textContent = priceData?.suggestedPrice ? `$${priceData.suggestedPrice.toFixed(2)}` : 'N/A';
        if (medianEl) medianEl.textContent = priceData?.medianPrice ? `$${priceData.medianPrice.toFixed(2)}` : 'N/A';
        if (nextEl) nextEl.textContent = priceData?.nextCompetitorPrice ? `$${priceData.nextCompetitorPrice.toFixed(2)}` : 'N/A';
        
        // Disable options if price not available
        const medianOption = document.querySelector('input[name="supaPriceType"][value="median"]');
        const nextOption = document.querySelector('input[name="supaPriceType"][value="nextCompetitor"]');
        if (medianOption) {
            medianOption.disabled = !priceData?.medianPrice;
            medianOption.closest('.supa-price-option')?.classList.toggle('disabled', !priceData?.medianPrice);
        }
        if (nextOption) {
            nextOption.disabled = !priceData?.nextCompetitorPrice;
            nextOption.closest('.supa-price-option')?.classList.toggle('disabled', !priceData?.nextCompetitorPrice);
        }
    };
    
    // Вызываем начальное обновление
    updatePricesForVariant();
    
    // Добавляем listener для смены варианта
    document.querySelectorAll('input[name="supaPriceVariant"]').forEach(radio => {
        radio.onchange = updatePricesForVariant;
    });
    
    // Reset to suggested
    document.querySelector('input[name="supaPriceType"][value="suggested"]').checked = true;
    
    // Reset custom price
    const customPriceInput = document.getElementById('supaCustomPrice');
    if (customPriceInput) customPriceInput.value = '';
    
    // Используем единый цвет панели для границы
    const panelColor = collectionState.panelColor || '#4ade80';
    const accountInfoEl = document.getElementById('supaAccountInfo');
    if (accountInfoEl) {
        // Показываем информацию о количестве если > 1
        const quantity = brainrotData.quantity || 1;
        const accountsInfo = quantity > 1 
            ? `${quantity} ${t('items')} (${brainrotData.groupItems?.map(i => i.accountName).join(', ')})`
            : brainrotData.accountName;
        
        accountInfoEl.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${panelColor};"></span>
                ${accountsInfo}
            </span>
            ${quantity > 1 ? `<span class="quantity-badge" style="background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">x${quantity}</span>` : ''}
        `;
    }
    
    updateSupaImagePreview(brainrotData.imageUrl);
    
    document.getElementById('supaGenerateBtn').disabled = false;
    document.getElementById('supaStatus').classList.add('hidden');
    document.getElementById('supaError').classList.add('hidden');
    document.getElementById('supaDownloadSection').classList.add('hidden');
    document.getElementById('supaResultImage').classList.add('hidden');
    document.getElementById('supaPreviewPlaceholder').classList.remove('hidden');
    
    modal.classList.remove('hidden');
}

// Create Supa Generator Modal
function createSupaGeneratorModal() {
    const modal = document.createElement('div');
    modal.id = 'supaGeneratorModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeSupaModal()"></div>
        <div class="modal-content supa-modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-wand-magic-sparkles"></i> ${t('supa_generator')}</h3>
                <button class="modal-close" onclick="closeSupaModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body supa-modal-body">
                <div class="supa-preview-section">
                    <div class="supa-preview-frame">
                        <div class="supa-preview-placeholder" id="supaPreviewPlaceholder">
                            <i class="fas fa-image"></i>
                            <p>${t('preview')}</p>
                        </div>
                        <img id="supaPreviewImage" class="supa-preview-image hidden" src="" alt="Preview">
                        <img id="supaResultImage" class="supa-result-image hidden" src="" alt="Result">
                    </div>
                    <div id="supaDownloadSection" class="supa-download-section hidden">
                        <button id="supaDownloadBtn" class="supa-download-btn" onclick="downloadSupaImage()">
                            <i class="fas fa-download"></i>
                            ${t('supa_download')}
                        </button>
                        <button id="supaPostEldoradoBtn" class="supa-eldorado-btn" onclick="postToEldorado()">
                            <i class="fas fa-store"></i>
                            ${t('supa_post_eldorado')}
                        </button>
                    </div>
                </div>
                <div class="supa-form-section">
                    <div class="supa-form-group supa-account-group">
                        <label><i class="fas fa-user"></i> ${t('account_label')}</label>
                        <div id="supaAccountInfo" class="supa-account-info">-</div>
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-tag"></i> ${t('name_label')}</label>
                        <input type="text" id="supaName" placeholder="${t('name_label')}">
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-coins"></i> ${t('income_form')}</label>
                        <input type="text" id="supaIncome" placeholder="338M/s">
                    </div>
                    <div class="supa-form-group">
                        <label><i class="fas fa-image"></i> ${t('image_url')}</label>
                        <input type="url" id="supaImageUrl" placeholder="https://..." onchange="updateSupaImagePreview(this.value)">
                    </div>
                    <!-- v9.11.1: Mutation price selector (hidden if no mutation) -->
                    <div class="supa-form-group supa-mutation-selector hidden" id="supaMutationSelector">
                        <label><i class="fas fa-dna"></i> ${t('price_variant')}</label>
                        <div class="supa-variant-options">
                            <label class="supa-variant-option">
                                <input type="radio" name="supaPriceVariant" value="default" checked>
                                <span class="supa-variant-label default">${t('default')}</span>
                            </label>
                            <label class="supa-variant-option" id="supaMutationOption">
                                <input type="radio" name="supaPriceVariant" value="mutation">
                                <span class="supa-variant-label mutation" id="supaMutationLabel">MUTATION</span>
                            </label>
                        </div>
                    </div>
                    <div class="supa-form-group supa-price-selector">
                        <label><i class="fas fa-dollar-sign"></i> ${t('price_for_eldorado')}</label>
                        <div class="supa-price-options" id="supaPriceOptions">
                            <label class="supa-price-option">
                                <input type="radio" name="supaPriceType" value="suggested" checked>
                                <span class="supa-price-label">
                                    <i class="fas fa-tag"></i>
                                    <span>${t('supa_recommended')}</span>
                                    <strong id="supaPriceSuggested">$0.00</strong>
                                </span>
                            </label>
                            <label class="supa-price-option median">
                                <input type="radio" name="supaPriceType" value="median">
                                <span class="supa-price-label">
                                    <i class="fas fa-chart-bar"></i>
                                    <span>${t('supa_median')}</span>
                                    <strong id="supaPriceMedian">$0.00</strong>
                                </span>
                            </label>
                            <label class="supa-price-option next-comp">
                                <input type="radio" name="supaPriceType" value="nextCompetitor">
                                <span class="supa-price-label">
                                    <i class="fas fa-arrow-up"></i>
                                    <span>${t('supa_next_competitor')}</span>
                                    <strong id="supaPriceNext">$0.00</strong>
                                </span>
                            </label>
                            <label class="supa-price-option custom">
                                <input type="radio" name="supaPriceType" value="custom">
                                <span class="supa-price-label">
                                    <i class="fas fa-edit"></i>
                                    <span>${t('supa_custom')}</span>
                                    <input type="number" step="0.01" min="0" id="supaCustomPrice" class="supa-custom-price-input" placeholder="$0.00" onclick="event.stopPropagation(); document.querySelector('input[name=supaPriceType][value=custom]').checked = true;">
                                </span>
                            </label>
                        </div>
                    </div>
                    <button id="supaGenerateBtn" class="supa-generate-btn" onclick="generateSupaImage()">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        ${t('supa_generate')}
                    </button>
                    <div id="supaStatus" class="supa-status hidden">
                        <div class="supa-spinner"></div>
                        <span id="supaStatusText">${t('supa_processing')}</span>
                    </div>
                    <div id="supaError" class="supa-error hidden">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="supaErrorText"></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    return modal;
}

function closeSupaModal() {
    const modal = document.getElementById('supaGeneratorModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function updateSupaImagePreview(url) {
    const previewImg = document.getElementById('supaPreviewImage');
    const placeholder = document.getElementById('supaPreviewPlaceholder');
    const resultImg = document.getElementById('supaResultImage');
    
    if (!url) {
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        previewImg.src = url;
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
        resultImg.classList.add('hidden');
    };
    img.onerror = () => {
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
    };
    img.src = url;
}

let currentSupaResult = null;

// Poll for render status (client-side polling to avoid Vercel timeout)
async function pollForResult(taskId, statusText, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            statusText.textContent = `Рендеринг... (${i + 1}/${maxAttempts})`;
            
            const response = await fetch(`/api/supa-status?taskId=${taskId}`);
            const status = await response.json();
            
            console.log(`Poll attempt ${i + 1}:`, status.state);
            
            if (status.state === 'done' && status.resultUrl) {
                return status;
            }
            
            if (status.state === 'error') {
                throw new Error('Render failed on server');
            }
            
            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
            console.error('Poll error:', err);
            // Continue polling on network errors
        }
    }
    
    return null; // Timeout
}

async function generateSupaImage() {
    const name = document.getElementById('supaName').value.trim();
    const income = document.getElementById('supaIncome').value.trim();
    const imageUrl = document.getElementById('supaImageUrl').value.trim();
    
    if (!name || !income) {
        showSupaError('Заполните название и доходность');
        return;
    }
    
    const accountId = currentSupaBrainrot?.accountId;
    const accountName = currentSupaBrainrot?.accountName;
    // Используем единый цвет панели
    const borderColor = collectionState.panelColor || '#4ade80';
    
    const generateBtn = document.getElementById('supaGenerateBtn');
    const statusEl = document.getElementById('supaStatus');
    const statusText = document.getElementById('supaStatusText');
    const errorEl = document.getElementById('supaError');
    const downloadSection = document.getElementById('supaDownloadSection');
    const resultImg = document.getElementById('supaResultImage');
    const previewImg = document.getElementById('supaPreviewImage');
    const placeholder = document.getElementById('supaPreviewPlaceholder');
    
    generateBtn.disabled = true;
    statusEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    downloadSection.classList.add('hidden');
    statusText.textContent = 'Загрузка изображения...';
    
    try {
        // v9.9.5: Get custom template ID
        const templateId = getTemplateId();
        
        const response = await fetch('/api/supa-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                income, 
                imageUrl,
                borderColor,
                accountId,
                accountName,
                templateId // v9.9.5: Custom template support
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Generation failed');
        }
        
        statusText.textContent = 'Рендеринг...';
        
        // If pending, poll for status
        if (result.pending && result.taskId) {
            const finalResult = await pollForResult(result.taskId, statusText);
            if (finalResult && finalResult.resultUrl) {
                currentSupaResult = { ...result, resultUrl: finalResult.resultUrl };
                
                resultImg.onload = async () => {
                    resultImg.classList.remove('hidden');
                    previewImg.classList.add('hidden');
                    placeholder.classList.add('hidden');
                    downloadSection.classList.remove('hidden');
                    statusEl.classList.add('hidden');
                    
                    await saveGeneration(name, accountId, finalResult.resultUrl, income);
                };
                resultImg.src = finalResult.resultUrl;
            } else {
                throw new Error('Render failed or timeout');
            }
        } else if (result.success && result.resultUrl) {
            currentSupaResult = result;
            
            resultImg.onload = async () => {
                resultImg.classList.remove('hidden');
                previewImg.classList.add('hidden');
                placeholder.classList.add('hidden');
                downloadSection.classList.remove('hidden');
                statusEl.classList.add('hidden');
                
                await saveGeneration(name, accountId, result.resultUrl, income);
            };
            resultImg.src = result.resultUrl;
        } else {
            throw new Error('No result received');
        }
        
    } catch (error) {
        console.error('Supa Generate error:', error);
        showSupaError(error.message);
        statusEl.classList.add('hidden');
    } finally {
        generateBtn.disabled = false;
    }
}

async function downloadSupaImage() {
    if (!currentSupaResult || !currentSupaResult.resultUrl) {
        showSupaError('Нет изображения для скачивания');
        return;
    }
    
    const downloadBtn = document.getElementById('supaDownloadBtn');
    const name = document.getElementById('supaName').value.trim();
    
    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('supa_processing')}`;
        
        const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        
        const response = await fetch(currentSupaResult.resultUrl);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Download error:', error);
        showSupaError(`${t('download_error_msg')}: ${error.message}`);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<i class="fas fa-download"></i> ${t('supa_download')}`;
    }
}

function showSupaError(message) {
    const errorEl = document.getElementById('supaError');
    const errorText = document.getElementById('supaErrorText');
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
}

// Post to Eldorado - opens eldorado.gg with brainrot data
async function postToEldorado() {
    // v9.9.3: Проверяем и загружаем имя магазина если нужно
    const hasShopName = await ensureShopNameLoaded();
    if (!hasShopName) {
        showSupaError('Please configure your shop name first');
        openShopNameModal(() => postToEldorado());
        return;
    }
    
    if (!currentSupaResult || !currentSupaResult.resultUrl) {
        showSupaError('Сначала сгенерируйте изображение');
        return;
    }
    
    const name = document.getElementById('supaName').value.trim();
    const income = document.getElementById('supaIncome').value.trim();
    const imageUrl = document.getElementById('supaImageUrl').value.trim();
    
    // v9.9.0: Получаем выбранный тип цены
    const selectedPriceType = document.querySelector('input[name="supaPriceType"]:checked')?.value || 'suggested';
    
    // v9.11.1: Получаем выбранный вариант цены (default/mutation)
    const selectedVariant = document.querySelector('input[name="supaPriceVariant"]:checked')?.value || 'default';
    const hasMutation = currentSupaBrainrot?.mutation && cleanMutationText(currentSupaBrainrot?.mutation);
    
    // Получаем цену из кэша или из данных брейнрота
    let minPrice = 0;
    let maxPrice = 0;
    
    // v9.11.1: Получаем цену по ключу с учетом варианта (default/mutation)
    const normalizedIncome = normalizeIncomeForApi(currentSupaBrainrot?.income, income);
    let priceKey;
    if (selectedVariant === 'mutation' && hasMutation) {
        priceKey = getPriceCacheKey(name, normalizedIncome, currentSupaBrainrot.mutation);
    } else {
        priceKey = getPriceCacheKey(name, normalizedIncome);
    }
    const priceData = state.brainrotPrices[priceKey];
    
    // v9.11.1: Проверяем кастомную цену
    const customPriceInput = document.getElementById('supaCustomPrice');
    const customPrice = customPriceInput ? parseFloat(customPriceInput.value) : 0;
    
    // v9.9.0: Выбираем цену в зависимости от типа
    if (selectedPriceType === 'custom' && customPrice > 0) {
        maxPrice = customPrice;
    } else if (priceData) {
        switch (selectedPriceType) {
            case 'median':
                maxPrice = priceData.medianPrice || priceData.suggestedPrice || 0;
                break;
            case 'nextCompetitor':
                maxPrice = priceData.nextCompetitorPrice || priceData.suggestedPrice || 0;
                break;
            default:
                maxPrice = priceData.suggestedPrice || 0;
        }
    }
    minPrice = Math.floor(maxPrice * 0.9);
    
    // Количество одинаковых брейнротов (для Eldorado Quantity)
    const quantity = currentSupaBrainrot?.quantity || 1;
    
    // Формируем данные для Tampermonkey скрипта
    const offerData = {
        name: name,
        income: income,
        imageUrl: imageUrl,
        generatedImageUrl: currentSupaResult.resultUrl,
        minPrice: minPrice,
        maxPrice: maxPrice,
        priceType: selectedPriceType, // v9.9.0: Тип выбранной цены
        priceVariant: selectedVariant, // v9.11.1: Вариант цены (default/mutation)
        quantity: quantity, // Количество для Eldorado Total Quantity
        rarity: currentSupaBrainrot?.rarity || '', // Secret, Mythical, etc
        mutation: currentSupaBrainrot?.mutation || '', // v9.8.27: Мутация брейнрота (YinYang, Diamond, etc)
        accountId: currentSupaBrainrot?.accountId,
        accountName: currentSupaBrainrot?.accountName,
        farmKey: state.currentKey, // Передаём farmKey для сохранения оффера в панель
        timestamp: Date.now()
    };
    
    // Сохраняем данные в localStorage для Tampermonkey скрипта
    localStorage.setItem('glitched_offer_data', JSON.stringify(offerData));
    
    // Также можно передать через URL параметры (менее надежно для больших данных)
    const encodedData = encodeURIComponent(JSON.stringify(offerData));
    
    // Открываем страницу Eldorado с данными
    const eldoradoUrl = `https://www.eldorado.gg/sell/offer/CustomItem/259?glitched_data=${encodedData}`;
    
    // Открываем в новой вкладке
    window.open(eldoradoUrl, '_blank');
    
    console.log('Opening Eldorado with offer data:', offerData);
}

// ==========================================
// MASS SELECTION MODE
// ==========================================

/**
 * Get unique key for a brainrot group (name + income + mutation)
 * Used for stable selection across search/filter operations
 * Can be called as getGroupKey(group) or getGroupKey(name, income, mutation)
 * Note: income is NOT rounded - each unique income value creates a separate group
 * Note: mutation is included - different mutations = different groups
 */
function getGroupKey(nameOrGroup, incomeArg, mutationArg) {
    let name, income, mutation;
    
    // Support both signatures: getGroupKey(group) and getGroupKey(name, income, mutation)
    if (typeof nameOrGroup === 'object' && nameOrGroup !== null) {
        // Called with group object
        if (!nameOrGroup.name) return '';
        name = nameOrGroup.name;
        income = normalizeIncomeForApi(nameOrGroup.income, nameOrGroup.incomeText);
        mutation = nameOrGroup.mutation || null;
    } else {
        // Called with name, income, and optionally mutation
        if (!nameOrGroup) return '';
        name = nameOrGroup;
        income = incomeArg || 0;
        mutation = mutationArg || null;
    }
    
    // Use exact income (with dots replaced by underscores) - NO rounding!
    // Each unique income value should be a separate group
    // Mutation is part of the key - different mutations = different groups
    const incomeStr = String(income).replace(/\./g, '_');
    const mutationStr = mutation ? `_${cleanMutationText(mutation).toLowerCase()}` : '';
    return `${name.toLowerCase()}_${incomeStr}${mutationStr}`;
}

/**
 * Check if brainrot has an active offer
 * v9.12.13: Now considers mutation - different mutations are different offers
 */
function hasActiveOffer(brainrotName, income, mutation = null) {
    if (!offersState.offers || offersState.offers.length === 0) return false;
    const normalizedIncome = normalizeIncomeForApi(income, null);
    const roundedIncome = Math.floor(normalizedIncome / 10) * 10;
    
    // Normalize mutation for comparison
    const cleanMut = mutation ? cleanMutationText(mutation)?.toLowerCase() : null;
    
    return offersState.offers.some(offer => {
        if (!offer.brainrotName) return false;
        const offerIncome = normalizeIncomeForApi(offer.income, offer.incomeRaw);
        const offerRoundedIncome = Math.floor(offerIncome / 10) * 10;
        
        // Check name and income match
        const nameMatch = offer.brainrotName.toLowerCase() === brainrotName.toLowerCase();
        const incomeMatch = offerRoundedIncome === roundedIncome;
        
        if (!nameMatch || !incomeMatch) return false;
        
        // Check mutation match
        const offerMut = offer.mutation ? cleanMutationText(offer.mutation)?.toLowerCase() : null;
        
        // Both null = default, both same mutation = match
        return cleanMut === offerMut;
    });
}

// Mass selection state
const MASS_SELECTION_MAX = 10; // Maximum items for mass generation
let massSelectionState = {
    isActive: false,
    selectedItems: new Set(), // Set of group keys (stable across search/filter)
    isGenerating: false
};

// Toggle mass selection mode
function toggleMassSelectionMode() {
    massSelectionState.isActive = !massSelectionState.isActive;
    
    const fab = document.getElementById('massSelectFab');
    const indicator = document.getElementById('massSelectIndicator');
    
    if (massSelectionState.isActive) {
        fab.classList.add('active');
        fab.innerHTML = '<i class="fas fa-times"></i>';
        fab.title = t('exit_selection_mode');
        indicator.classList.add('visible');
        massSelectionState.selectedItems = new Set();
        updateMassSelectionUI();
    } else {
        fab.classList.remove('active');
        fab.innerHTML = '<i class="fas fa-layer-group"></i>';
        fab.title = t('mass_select_title');
        indicator.classList.remove('visible');
        massSelectionState.selectedItems = new Set();
    }
    
    // Re-render collection to show/hide checkboxes
    renderCollection();
}

// Toggle brainrot group selection (now uses group key instead of index)
function toggleBrainrotSelection(index) {
    if (!massSelectionState.isActive) return;
    
    const group = collectionState.displayedGroups?.[index];
    if (!group) return;
    
    const key = getGroupKey(group);
    
    if (massSelectionState.selectedItems.has(key)) {
        massSelectionState.selectedItems.delete(key);
    } else {
        // Check limit before adding
        if (massSelectionState.selectedItems.size >= MASS_SELECTION_MAX) {
            showNotification(`${t('max_selection')} ${MASS_SELECTION_MAX}`, 'warning');
            return;
        }
        massSelectionState.selectedItems.add(key);
    }
    
    updateMassSelectionUI();
    
    // Update card appearance
    const card = document.querySelector(`[data-brainrot-index="${index}"]`);
    if (card) {
        card.classList.toggle('selected', massSelectionState.selectedItems.has(key));
    }
}

// Update mass selection UI (counter and button)
function updateMassSelectionUI() {
    const countEl = document.getElementById('massSelectCount');
    const btnEl = document.getElementById('massSelectGenerateBtn');
    const selectedCount = massSelectionState.selectedItems.size;
    
    // Calculate total quantity by finding groups with matching keys
    let totalQuantity = 0;
    if (collectionState.displayedGroups) {
        for (const group of collectionState.displayedGroups) {
            const key = getGroupKey(group);
            if (massSelectionState.selectedItems.has(key)) {
                totalQuantity += group.quantity || 1;
            }
        }
    }
    
    // Show: selected groups count (and total brainrots if different)
    if (countEl) {
        if (totalQuantity > selectedCount) {
            countEl.textContent = `${selectedCount} ${t('groups')} (${totalQuantity} ${t('items')})`;
        } else {
            countEl.textContent = `${selectedCount} ${t('items')}`;
        }
    }
    if (btnEl) {
        btnEl.disabled = selectedCount === 0;
        btnEl.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> ${t('generate_n')} ${selectedCount} ${t('items')}`;
    }
}

// Open mass generation modal
function openMassGenerationModal() {
    console.log('openMassGenerationModal called, selected items:', massSelectionState.selectedItems.size);
    
    if (massSelectionState.selectedItems.size === 0) {
        console.warn('No items selected');
        return;
    }
    
    const modal = document.getElementById('massGenerationModal');
    if (!modal) {
        console.error('Mass generation modal not found!');
        return;
    }
    
    console.log('Modal found:', modal);
    console.log('displayedGroups:', collectionState.displayedGroups?.length);
    
    const list = document.getElementById('massGenList');
    const countEl = document.getElementById('massGenCount');
    const progressEl = document.getElementById('massGenProgress');
    const errorEl = document.getElementById('massGenError');
    const startBtn = document.getElementById('startMassGen');
    const actionsEl = document.getElementById('massGenActions');
    const footerInfo = document.getElementById('massGenFooterInfo');
    
    // Reset state
    if (progressEl) progressEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (actionsEl) actionsEl.classList.add('hidden');
    if (footerInfo) footerInfo.classList.remove('hidden');
    if (startBtn) startBtn.disabled = false;
    massSelectionState.generationResults = [];
    
    // Get selected groups by key (find in displayedGroups)
    const selectedGroups = [];
    if (collectionState.displayedGroups) {
        for (const group of collectionState.displayedGroups) {
            const key = getGroupKey(group);
            if (massSelectionState.selectedItems.has(key)) {
                selectedGroups.push({ ...group, groupKey: key });
            }
        }
    }
    
    const totalItems = selectedGroups.reduce((sum, g) => sum + (g.quantity || 1), 0);
    
    // Update button text
    const btnText = document.getElementById('massGenBtnText');
    if (btnText) {
        btnText.textContent = `${t('generate_n')} ${selectedGroups.length} ${t('items')}`;
    }
    startBtn.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> <span id="massGenBtnText">${t('generate_n')} ${selectedGroups.length} ${t('items')}</span>`;
    
    // Render list of selected items with price type selector
    list.innerHTML = selectedGroups.map((group, i) => {
        const accountsList = group.items ? group.items.map(item => item.accountName).join(', ') : 'Unknown';
        
        // Get prices from cache
        const income = normalizeIncomeForApi(group.income, group.incomeText);
        const cacheKey = getPriceCacheKey(group.name, income);
        const cachedPrice = state.brainrotPrices[cacheKey];
        const suggestedPrice = cachedPrice?.suggestedPrice || 0;
        const medianPrice = cachedPrice?.medianPrice || 0;
        const nextCompPrice = cachedPrice?.nextCompetitorPrice || 0;
        
        // v9.11.1: Если есть мутация - также показываем цены мутации
        const hasMutation = group.mutation && cleanMutationText(group.mutation);
        let mutationPriceData = null;
        let mutSuggested = 0, mutMedian = 0, mutNext = 0;
        
        if (hasMutation) {
            const mutCacheKey = getPriceCacheKey(group.name, income, group.mutation);
            mutationPriceData = state.brainrotPrices[mutCacheKey];
            mutSuggested = mutationPriceData?.suggestedPrice || 0;
            mutMedian = mutationPriceData?.medianPrice || 0;
            mutNext = mutationPriceData?.nextCompetitorPrice || 0;
        }
        
        const mStyles = hasMutation ? getMutationStyles(group.mutation) : {};
        const cleanMut = hasMutation ? cleanMutationText(group.mutation) : '';
        
        return `
            <div class="mass-gen-item" data-item-index="${i}" data-group-key="${group.groupKey}" data-has-mutation="${hasMutation ? 'true' : 'false'}" data-mutation="${group.mutation || ''}">
                <img class="mass-gen-item-img" src="${group.imageUrl || ''}" alt="${group.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%231a1a2e%22 width=%2240%22 height=%2240%22/></svg>'">
                <div class="mass-gen-item-info">
                    <div class="mass-gen-item-name">
                        ${group.name}${group.quantity > 1 ? ` <span style="color:#f59e0b;">x${group.quantity}</span>` : ''}
                        ${hasMutation ? `<span class="mass-gen-mutation-badge" style="background:${mStyles.background};color:${mStyles.textColor};padding:1px 4px;border-radius:3px;font-size:0.6rem;margin-left:4px;">${cleanMut}</span>` : ''}
                    </div>
                    <div class="mass-gen-item-details">
                        <span><i class="fas fa-coins"></i> ${group.incomeText || formatIncome(group.income)}</span>
                        <span><i class="fas fa-user"></i> ${accountsList}</span>
                    </div>
                </div>
                <div class="mass-gen-price-selector" data-price-index="${i}">
                    ${hasMutation ? `
                    <select class="mass-gen-variant-select" data-index="${i}" onchange="updateMassGenPriceOptions(${i})">
                        <option value="default">DEFAULT</option>
                        <option value="mutation">${cleanMut}</option>
                    </select>
                    ` : ''}
                    <select class="mass-gen-price-select" data-index="${i}"
                            data-def-suggested="${suggestedPrice}" data-def-median="${medianPrice}" data-def-next="${nextCompPrice}"
                            data-mut-suggested="${mutSuggested}" data-mut-median="${mutMedian}" data-mut-next="${mutNext}">
                        <option value="suggested" ${suggestedPrice > 0 ? '' : 'disabled'}>💰 $${suggestedPrice.toFixed(2)}</option>
                        <option value="median" ${medianPrice > 0 ? '' : 'disabled'}>📊 $${medianPrice.toFixed(2)}</option>
                        <option value="nextCompetitor" ${nextCompPrice > 0 ? '' : 'disabled'}>⬆️ $${nextCompPrice.toFixed(2)}</option>
                        <option value="custom">✏️ Custom</option>
                    </select>
                    <input type="number" step="0.01" min="0" class="mass-gen-custom-price hidden" data-index="${i}" placeholder="$0.00">
                </div>
                <div class="mass-gen-item-status pending" data-status-index="${i}">
                    <i class="fas fa-clock"></i>
                </div>
                <button class="mass-gen-item-remove" onclick="removeMassGenItem(${i})" title="${t('delete')}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Update count in modal (if element exists)
    if (countEl) {
        countEl.textContent = selectedGroups.length;
    }
    modal.classList.remove('hidden');
}

// v9.11.1: Update price options when variant changes in mass gen
function updateMassGenPriceOptions(index) {
    const item = document.querySelector(`.mass-gen-item[data-item-index="${index}"]`);
    if (!item) return;
    
    const variantSelect = item.querySelector('.mass-gen-variant-select');
    const priceSelect = item.querySelector('.mass-gen-price-select');
    if (!priceSelect) return;
    
    const variant = variantSelect?.value || 'default';
    const isDefault = variant === 'default';
    
    const suggested = parseFloat(priceSelect.dataset[isDefault ? 'defSuggested' : 'mutSuggested']) || 0;
    const median = parseFloat(priceSelect.dataset[isDefault ? 'defMedian' : 'mutMedian']) || 0;
    const next = parseFloat(priceSelect.dataset[isDefault ? 'defNext' : 'mutNext']) || 0;
    
    // Update option text and disabled state
    const options = priceSelect.options;
    options[0].textContent = `💰 $${suggested.toFixed(2)}`;
    options[0].disabled = suggested <= 0;
    options[1].textContent = `📊 $${median.toFixed(2)}`;
    options[1].disabled = median <= 0;
    options[2].textContent = `⬆️ $${next.toFixed(2)}`;
    options[2].disabled = next <= 0;
    
    // Reset to suggested if current selection is disabled
    if (priceSelect.options[priceSelect.selectedIndex].disabled) {
        priceSelect.selectedIndex = 0;
    }
}

// v9.11.1: Toggle custom price input visibility and handle variant change
document.addEventListener('change', (e) => {
    // Handle price type select change - show/hide custom price input
    if (e.target.classList.contains('mass-gen-price-select')) {
        const index = e.target.dataset.index;
        const item = document.querySelector(`.mass-gen-item[data-item-index="${index}"]`);
        const customInput = item?.querySelector('.mass-gen-custom-price');
        if (customInput) {
            customInput.classList.toggle('hidden', e.target.value !== 'custom');
            if (e.target.value === 'custom') {
                customInput.focus();
            }
        }
    }
    
    // Handle variant select change - update price options
    if (e.target.classList.contains('mass-gen-variant-select')) {
        const index = e.target.dataset.index;
        updateMassGenPriceOptions(parseInt(index, 10));
    }
});

// Remove item from mass generation list
function removeMassGenItem(itemIndex) {
    const list = document.getElementById('massGenList');
    const item = list.querySelector(`[data-item-index="${itemIndex}"]`);
    
    if (item) {
        item.remove();
        
        // Update indices for remaining items
        const items = list.querySelectorAll('.mass-gen-item');
        items.forEach((el, newIdx) => {
            el.dataset.itemIndex = newIdx;
            const statusEl = el.querySelector('[data-status-index]');
            if (statusEl) statusEl.dataset.statusIndex = newIdx;
            const removeBtn = el.querySelector('.mass-gen-item-remove');
            if (removeBtn) removeBtn.setAttribute('onclick', `removeMassGenItem(${newIdx})`);
        });
        
        // Update count
        const countEl = document.getElementById('massGenCount');
        const startBtn = document.getElementById('startMassGen');
        const count = items.length;
        countEl.textContent = count;
        
        if (count === 0) {
            startBtn.disabled = true;
        }
    }
}

// Close mass generation modal
function closeMassGenerationModal() {
    const modal = document.getElementById('massGenerationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Reset generating state if was cancelled
    if (massSelectionState.isGenerating) {
        massSelectionState.isGenerating = false;
    }
}

// Start mass generation (with shop name check)
function startMassGenerationWithCheck() {
    requireShopName(() => {
        doStartMassGeneration();
    });
}

// Start mass generation (actual logic)
async function doStartMassGeneration() {
    const list = document.getElementById('massGenList');
    const items = list.querySelectorAll('.mass-gen-item');
    const progressEl = document.getElementById('massGenProgress');
    const progressFill = document.getElementById('massGenProgressFill');
    const progressText = document.getElementById('massGenProgressText');
    const progressPercent = document.getElementById('massGenProgressPercent');
    const startBtn = document.getElementById('startMassGen');
    const errorEl = document.getElementById('massGenError');
    const footerInfo = document.getElementById('massGenFooterInfo');
    
    if (items.length === 0) return;
    
    massSelectionState.isGenerating = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';
    progressEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    if (footerInfo) footerInfo.classList.add('hidden');
    
    // Disable remove buttons
    list.querySelectorAll('.mass-gen-item-remove').forEach(btn => btn.style.display = 'none');
    
    // Get groups to generate from DOM items using stored groupKey
    const groupsToGenerate = [];
    items.forEach((item, idx) => {
        const groupKey = item.dataset.groupKey;
        // Find the group in displayed groups by groupKey (unique identifier)
        const group = collectionState.displayedGroups?.find(g => getGroupKey(g) === groupKey);
        if (group) {
            console.log('[MassGen] Found group:', group.name, 'quantity:', group.quantity);
            groupsToGenerate.push({
                ...group,
                itemIndex: idx
            });
        } else {
            console.warn('[MassGen] Group not found for key:', groupKey);
        }
    });
    
    const total = groupsToGenerate.length;
    let completed = 0;
    let errors = 0;
    const results = [];
    
    // v9.9.4: Generate offer ID in panel for tracking
    function generateOfferId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
    
    // Queue for Eldorado
    const eldoradoQueue = [];
    
    for (const group of groupsToGenerate) {
        const idx = group.itemIndex;
        const statusEl = list.querySelector(`[data-status-index="${idx}"]`);
        
        // Update status to processing
        if (statusEl) {
            statusEl.className = 'mass-gen-item-status processing';
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        try {
            // v9.11.1: Get variant selection and use correct cache key
            const variantSelect = list.querySelector(`.mass-gen-variant-select[data-index="${idx}"]`);
            const selectedVariant = variantSelect?.value || 'default';
            const isUsingMutationPrice = selectedVariant === 'mutation';
            
            // Get price from cache based on selected variant and price type
            const income = normalizeIncomeForApi(group.income, group.incomeText);
            const cacheKey = getPriceCacheKey(group.name, income, isUsingMutationPrice ? (group.mutation || '') : '');
            const cachedPrice = state.brainrotPrices[cacheKey];
            
            // Get selected price type from dropdown
            const priceSelect = list.querySelector(`.mass-gen-price-select[data-index="${idx}"]`);
            const selectedPriceType = priceSelect?.value || 'suggested';
            
            // v9.11.1: Get custom price input
            const customPriceInput = list.querySelector(`.mass-gen-custom-price[data-index="${idx}"]`);
            const customPriceValue = parseFloat(customPriceInput?.value) || 0;
            
            let price = 0;
            if (selectedPriceType === 'custom' && customPriceValue > 0) {
                // v9.11.1: Use custom price if selected and valid
                price = customPriceValue;
            } else {
                switch (selectedPriceType) {
                    case 'median':
                        price = cachedPrice?.medianPrice || cachedPrice?.suggestedPrice || 0;
                        break;
                    case 'nextCompetitor':
                        price = cachedPrice?.nextCompetitorPrice || cachedPrice?.suggestedPrice || 0;
                        break;
                    case 'suggested':
                    default:
                        price = cachedPrice?.suggestedPrice || 0;
                }
            }
            
            // Use panel color
            const borderColor = collectionState.panelColor || '#4ade80';
            
            // v9.9.5: Get custom template ID if configured
            const templateId = getTemplateId();
            
            // Generate image
            const response = await fetch(`/api/supa-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: group.name, 
                    income: group.incomeText || formatIncome(group.income), 
                    price: price ? `$${price.toFixed(2)}` : '',
                    imageUrl: group.imageUrl,
                    borderColor,
                    quantity: group.quantity || 1,
                    templateId // v9.9.5: Custom template support
                })
            });
            
            let result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Generation failed');
            }
            
            // If pending, poll for result
            if (result.pending && result.taskId) {
                console.log('Generation pending, polling for result...');
                for (let attempt = 0; attempt < 20; attempt++) {
                    await new Promise(r => setTimeout(r, 1500));
                    const statusResponse = await fetch(`/api/supa-status?taskId=${result.taskId}`);
                    const statusData = await statusResponse.json();
                    
                    if (statusData.state === 'done' && statusData.resultUrl) {
                        result = { ...result, resultUrl: statusData.resultUrl, pending: false };
                        break;
                    } else if (statusData.state === 'error') {
                        throw new Error('Generation failed during polling');
                    }
                }
                
                if (!result.resultUrl) {
                    throw new Error('Generation timed out');
                }
            }
            
            // Save generation record for each item in the group
            if (group.items) {
                for (const item of group.items) {
                    await saveGeneration(group.name, item.accountId, result.resultUrl, income);
                }
            }
            
            // Always add to Eldorado queue
            const offerId = generateOfferId();
            // v9.11.1: Pass mutation only if using mutation variant
            const effectiveMutation = isUsingMutationPrice ? (group.mutation || '') : '';
            eldoradoQueue.push({
                name: group.name,
                income: group.incomeText || formatIncome(group.income),
                imageUrl: result.resultUrl,
                price: price || 0,
                quantity: group.quantity || 1,
                mutation: effectiveMutation, // v9.11.1: Use effective mutation based on variant selection
                accountName: group.items?.map(i => i.accountName).join(', ') || 'Unknown',
                offerId: offerId // v9.9.4: Track offer by code
            });
            
            results.push({ success: true, name: group.name, resultUrl: result.resultUrl });
            
            // Update status to done and update image
            if (statusEl) {
                statusEl.className = 'mass-gen-item-status done';
                statusEl.innerHTML = '<i class="fas fa-check"></i>';
            }
            
            // Update image in the modal to show generated result
            const itemEl = list.querySelector(`[data-item-index="${idx}"]`);
            if (itemEl) {
                const imgEl = itemEl.querySelector('.mass-gen-item-img');
                if (imgEl) {
                    imgEl.src = result.resultUrl;
                    imgEl.style.border = '2px solid #22c55e';
                }
            }
            
        } catch (error) {
            console.error('Mass gen error for', group.name, error);
            errors++;
            results.push({ success: false, name: group.name, error: error.message });
            
            // Update status to error
            if (statusEl) {
                statusEl.className = 'mass-gen-item-status error';
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            }
        }
        
        completed++;
        const percent = Math.round((completed / total) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${completed} / ${total}`;
        progressPercent.textContent = `${percent}%`;
        
        // Small delay between generations
        if (completed < total) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    // Save Eldorado queue to localStorage (always save if there are items)
    if (eldoradoQueue.length > 0) {
        localStorage.setItem('eldoradoQueue', JSON.stringify(eldoradoQueue));
        localStorage.setItem('eldoradoQueueIndex', '0');
        localStorage.setItem('eldoradoQueueCompleted', '[]');
        localStorage.setItem('eldoradoQueueTimestamp', Date.now().toString());
        console.log('Eldorado queue saved:', eldoradoQueue.length, 'items');
    }
    
    // Store results for download/eldorado actions
    massSelectionState.generationResults = results;
    massSelectionState.isGenerating = false;
    
    // Show results
    const successCount = results.filter(r => r.success).length;
    startBtn.innerHTML = `<i class="fas fa-check"></i> ${t('done')} ${successCount}/${total}`;
    
    if (errors > 0) {
        errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors} ${t('errors_during_generation')}`;
        errorEl.classList.remove('hidden');
    }
    
    // Update collection to show generated badges
    renderCollection();
    
    // Show action buttons if there are successful generations
    if (successCount > 0) {
        const actionsEl = document.getElementById('massGenActions');
        if (actionsEl) {
            actionsEl.classList.remove('hidden');
        }
    }
    
    // Show notification
    if (eldoradoQueue.length > 0) {
        showNotification(`✅ ${t('generated_success')} ${successCount}/${total}. ${t('click_post_eldorado')}`, 'success');
    } else {
        showNotification(`✅ ${t('generated_success')} ${successCount}/${total}`, successCount === total ? 'success' : 'info');
    }
}

// Download all generated images
async function downloadAllMassGenImages() {
    const results = massSelectionState.generationResults || [];
    const successResults = results.filter(r => r.success && r.resultUrl);
    
    if (successResults.length === 0) {
        showNotification(t('no_images_download'), 'error');
        return;
    }
    
    const downloadBtn = document.getElementById('massGenDownloadAll');
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Скачивание...';
    
    try {
        for (let i = 0; i < successResults.length; i++) {
            const result = successResults[i];
            const response = await fetch(result.resultUrl);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // Small delay between downloads
            if (i < successResults.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
        
        showNotification(`✅ ${t('downloaded_images')}: ${successResults.length}`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification(`${t('download_error')}: ${error.message}`, 'error');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<i class="fas fa-download"></i> ${t('download_all')}`;
    }
}

// Start Eldorado queue from mass generation
async function startMassEldoradoQueue() {
    // v9.9.3: Проверяем и загружаем имя магазина если нужно
    const hasShopName = await ensureShopNameLoaded();
    if (!hasShopName) {
        showNotification(t('configure_shop_first'), 'error');
        openShopNameModal(() => startMassEldoradoQueue());
        return;
    }
    
    const queue = localStorage.getItem('eldoradoQueue');
    if (!queue) {
        showNotification(t('queue_empty_generate'), 'error');
        return;
    }
    
    const queueData = JSON.parse(queue);
    if (queueData.length === 0) {
        showNotification(t('queue_empty'), 'error');
        return;
    }
    
    // Get first item
    const firstItem = queueData[0];
    
    // Save queue to API for cross-domain access
    try {
        await fetch(`${API_BASE}/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey: state.currentKey,
                queue: queueData
            })
        });
        console.log('Queue saved to API for cross-domain access');
    } catch (e) {
        console.warn('Failed to save queue to API:', e);
    }
    
    // Build offer data for URL - minimal data only, queue is in API
    const offerData = {
        name: firstItem.name,
        income: firstItem.income,
        generatedImageUrl: firstItem.imageUrl,
        maxPrice: parseFloat(firstItem.price) || 0,
        minPrice: parseFloat(firstItem.price) || 0,
        quantity: firstItem.quantity || 1,
        mutation: firstItem.mutation || '', // v9.8.27: Мутация брейнрота
        accountName: firstItem.accountName,
        farmKey: state.currentKey,
        fromQueue: true,
        queueIndex: 0,
        queueTotal: queueData.length
        // fullQueue removed - too long for URL, using API instead
    };
    
    const encodedData = encodeURIComponent(JSON.stringify(offerData));
    const url = `https://www.eldorado.gg/sell/offer/CustomItem/259?glitched_data=${encodedData}`;
    
    // Open in new tab
    window.open(url, '_blank');
    
    showNotification(`🚀 ${t('queue_started')}: ${queueData.length} ${t('offers')}`, 'success');
    
    // Close modal and exit selection mode
    closeMassGenerationModal();
    if (massSelectionState.isActive) {
        toggleMassSelectionMode();
    }
}

// Setup mass selection event listeners
function setupMassSelectionListeners() {
    const fab = document.getElementById('massSelectFab');
    const generateBtn = document.getElementById('massSelectGenerateBtn');
    const closeModalBtn = document.getElementById('closeMassGenModal');
    const cancelBtn = document.getElementById('cancelMassGen');
    const startBtn = document.getElementById('startMassGen');
    const modalOverlay = document.querySelector('#massGenerationModal .modal-overlay');
    const downloadAllBtn = document.getElementById('massGenDownloadAll');
    const startEldoradoBtn = document.getElementById('massGenStartEldorado');
    
    if (fab) {
        fab.addEventListener('click', toggleMassSelectionMode);
    }
    
    if (generateBtn) {
        generateBtn.addEventListener('click', openMassGenerationModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeMassGenerationModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeMassGenerationModal);
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', startMassGenerationWithCheck);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeMassGenerationModal);
    }
    
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAllMassGenImages);
    }
    
    if (startEldoradoBtn) {
        startEldoradoBtn.addEventListener('click', startMassEldoradoQueue);
    }
}

// Initialize collection listeners on DOM ready
setupCollectionListeners();
setupMassSelectionListeners();

// ==========================================
// OFFERS MANAGEMENT
// ==========================================

// Offers state
const offersState = {
    offers: [],
    filteredOffers: [],
    selectedOffers: new Set(),
    searchQuery: '',
    sortBy: 'newest',
    statusFilter: 'all',
    mutationFilter: 'all',  // v9.11.11: Filter by mutation type
    currentOffer: null,
    lastLoadedKey: null,  // Track which key offers were loaded for
    lastLoadTime: 0       // Track when offers were loaded
};

const OFFERS_CACHE_TTL = 10 * 1000; // 10 seconds cache for real-time updates
const OFFERS_STORAGE_KEY = 'farmpanel_offers_cache';
const OFFER_IMAGES_CACHE_KEY = 'farmpanel_offer_images';

// Image cache for offer images (base64)
let offerImagesCache = {};

// Load cached offer images from localStorage
function loadOfferImagesCache() {
    try {
        const cached = localStorage.getItem(OFFER_IMAGES_CACHE_KEY);
        if (cached) {
            offerImagesCache = JSON.parse(cached);
            console.log('Loaded', Object.keys(offerImagesCache).length, 'cached offer images');
        }
    } catch (e) {
        console.error('Error loading offer images cache:', e);
        offerImagesCache = {};
    }
}

// Save offer images cache to localStorage
function saveOfferImagesCache() {
    try {
        localStorage.setItem(OFFER_IMAGES_CACHE_KEY, JSON.stringify(offerImagesCache));
    } catch (e) {
        console.error('Error saving offer images cache:', e);
    }
}

// Get cached image or return original URL
// Note: External images (like Eldorado's Azure Blob) don't support CORS,
// so we can't fetch them to convert to base64. Just return the URL and let <img> display it.
function getCachedOfferImage(imageUrl, offerId) {
    if (!imageUrl) return null;
    
    // Use offerId as cache key
    const cacheKey = offerId || imageUrl;
    
    // Return cached base64 if available (for previously cached images)
    if (offerImagesCache[cacheKey]) {
        return offerImagesCache[cacheKey];
    }
    
    // Don't try to fetch external images - they block CORS
    // Just return the original URL for <img> tag to display
    return imageUrl;
}

// Disabled: External images don't support CORS, can't fetch to convert to base64
// async function cacheOfferImage(imageUrl, cacheKey) { ... }

// Initialize offer images cache
loadOfferImagesCache();

// Load offers from localStorage cache
// v9.12.35: Always force refresh from server on page load - localStorage is for instant render only
function loadOffersFromStorage() {
    try {
        const cached = localStorage.getItem(OFFERS_STORAGE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.farmKey === state.currentKey && data.offers) {
                offersState.offers = data.offers;
                offersState.lastLoadedKey = data.farmKey;
                // v9.12.35: Set lastLoadTime to 0 to ALWAYS fetch fresh data from server
                // localStorage is only for instant initial render, not for skipping server fetch
                offersState.lastLoadTime = 0;
                console.log('Loaded', data.offers.length, 'offers from localStorage cache (will refresh from server)');
                return true;
            }
        }
    } catch (e) {
        console.error('Error loading offers from storage:', e);
    }
    return false;
}

// Save offers to localStorage cache
function saveOffersToStorage() {
    try {
        const data = {
            farmKey: state.currentKey,
            offers: offersState.offers,
            timestamp: Date.now()
        };
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving offers to storage:', e);
    }
}

// Load offers from server (with caching) - silent mode for background loading
async function loadOffers(forceRefresh = false, silent = false) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const now = Date.now();
        const isSameKey = offersState.lastLoadedKey === farmKey;
        const cacheValid = now - offersState.lastLoadTime < OFFERS_CACHE_TTL;
        
        // Use cache if same key and not expired (unless force refresh)
        if (!forceRefresh && isSameKey && cacheValid && offersState.offers.length > 0) {
            // Just re-render from cache
            if (!silent) {
                filterAndRenderOffers();
            }
            return;
        }
        
        // Save previous state for comparison
        const previousOffers = [...offersState.offers];
        const hadOffers = previousOffers.length > 0;
        
        // v3.0.1: НЕ вызываем triggerServerScan - cron делает это автоматически
        // Раньше это вызывало Cloudflare rate limit 1015
        
        const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(farmKey)}`);
        const data = await response.json();
        
        // v9.12.27: НЕ перезаписываем кэш если сервер вернул 0 офферов, а у нас были офферы
        // Это защита от потери данных при timeout/ошибках сервера
        const serverOffers = data.offers || [];
        
        if (serverOffers.length === 0 && hadOffers) {
            console.warn('⚠️ Server returned 0 offers but we have cached offers - keeping cache');
            // Просто обновляем цены для существующих офферов
            await updateOffersRecommendedPrices();
            if (!silent) {
                filterAndRenderOffers();
            }
            return;
        }
        
        // Server already includes recommendedPrice from global_brainrot_prices
        offersState.offers = serverOffers;
        offersState.lastLoadedKey = farmKey;
        offersState.lastLoadTime = data.timestamp || now;
        
        // v9.8.10: Update with local price cache (may be fresher than server DB)
        await updateOffersRecommendedPrices();
        
        // Save to localStorage for persistence
        saveOffersToStorage();
        
        // Always update UI - compare with previous state for silent mode
        const offersChanged = hasOffersChanged(previousOffers, offersState.offers);
        if (!silent || offersChanged) {
            filterAndRenderOffers();
            if (silent && offersChanged) {
                console.log('🔄 Offers UI updated (changes detected)');
            }
        }
        console.log('Loaded offers from server:', offersState.offers.length, 'with prices from global cache');
    } catch (err) {
        console.error('Error loading offers:', err);
        // v9.12.27: НЕ очищаем офферы при ошибке - оставляем кэш
        // offersState.offers = [];
        console.warn('⚠️ Keeping cached offers due to error');
    }
}

// Check if offers have changed (for smart UI updates)
// v9.12.35: Added eldoradoOfferId check for pending state detection
function hasOffersChanged(oldOffers, newOffers) {
    if (!oldOffers || oldOffers.length !== newOffers.length) return true;
    
    for (let i = 0; i < newOffers.length; i++) {
        const newOffer = newOffers[i];
        const oldOffer = oldOffers.find(o => o.offerId === newOffer.offerId);
        
        if (!oldOffer) return true;
        if (oldOffer.status !== newOffer.status) return true;
        if (oldOffer.currentPrice !== newOffer.currentPrice) return true;
        if (oldOffer.imageUrl !== newOffer.imageUrl) return true;
        if (oldOffer.mutation !== newOffer.mutation) return true; // v9.12.34
        // v9.12.35: Check eldoradoOfferId change (affects pending state)
        if (Boolean(oldOffer.eldoradoOfferId) !== Boolean(newOffer.eldoradoOfferId)) return true;
    }
    
    return false;
}

// Setup listener for offers refresh from Tampermonkey script
function setupOffersRefreshListener() {
    // Listen for storage changes (cross-tab communication)
    window.addEventListener('storage', (e) => {
        if (e.key === 'glitched_refresh_offers') {
            console.log('Received offers refresh signal from Tampermonkey');
            // Force refresh offers
            setTimeout(() => {
                loadOffers(true, false).then(() => {
                    console.log('Offers refreshed after signal');
                    showNotification(`✅ ${t('offers_updated')}`, 'success');
                });
            }, 2000); // Wait 2 seconds for Eldorado to process the offer
        }
    });
    
    // Also check on focus (when user switches back to panel)
    window.addEventListener('focus', () => {
        const lastRefresh = localStorage.getItem('glitched_refresh_offers');
        if (lastRefresh) {
            const age = Date.now() - parseInt(lastRefresh, 10);
            if (age < 30000) { // Within 30 seconds
                console.log('Detected recent offers update on focus');
                loadOffers(true, false);
                localStorage.removeItem('glitched_refresh_offers');
            }
        }
    });
}

// Update recommended prices for offers
async function updateOffersRecommendedPrices() {
    let updated = 0;
    let notFound = 0;
    let mutationsFromCollection = 0;
    
    for (const offer of offersState.offers) {
        if (offer.brainrotName && offer.income) {
            // Use incomeRaw for proper parsing (handles "1.5B/s" etc)
            const normalizedIncome = normalizeIncomeForApi(offer.income, offer.incomeRaw);
            
            // v9.12.36: Only use collection fallback if mutation is UNDEFINED
            // mutation = null means "no mutation" from Eldorado API - don't override!
            // mutation = undefined means "unknown" - use collection as fallback
            if (offer.mutation === undefined) {
                const collectionMatch = findMutationFromCollection(offer.brainrotName, offer.income, offer.incomeRaw);
                if (collectionMatch.mutation) {
                    offer.mutation = collectionMatch.mutation;
                    offer._mutationSource = 'collection';
                    mutationsFromCollection++;
                    console.log(`🔮 Matched mutation for ${offer.brainrotName}: ${collectionMatch.mutation} (from collection, ${collectionMatch.count} matches)`);
                }
            }
            
            const hasMutation = cleanMutationText(offer.mutation);
            
            // v9.11.4: Get both default and mutation prices for mutated offers
            const defaultPriceKey = getPriceCacheKey(offer.brainrotName, normalizedIncome);
            const defaultPriceData = state.brainrotPrices[defaultPriceKey];
            
            // Get mutation price if offer has mutation
            let mutationPriceData = null;
            if (hasMutation) {
                const mutationPriceKey = getPriceCacheKey(offer.brainrotName, normalizedIncome, offer.mutation);
                mutationPriceData = state.brainrotPrices[mutationPriceKey];
            }
            
            // Store default price data
            if (defaultPriceData && defaultPriceData.suggestedPrice && defaultPriceData.suggestedPrice > 0) {
                // v9.11.7: Cache last known price for seamless updates
                offer._lastDefaultPrice = getSelectedPrice(defaultPriceData);
                offer.defaultSuggestedPrice = defaultPriceData.suggestedPrice;
                offer.defaultRecommendedPrice = getSelectedPrice(defaultPriceData);
                offer.defaultMedianPrice = defaultPriceData.medianPrice || null;
                offer.defaultNextCompetitorPrice = defaultPriceData.nextCompetitorPrice || null;
                offer.defaultSource = defaultPriceData.source || defaultPriceData.parsingSource || 'regex';
                offer.defaultNextRangeChecked = defaultPriceData.nextRangeChecked || false;
            }
            
            // Store mutation price data
            if (hasMutation && mutationPriceData && mutationPriceData.suggestedPrice && mutationPriceData.suggestedPrice > 0) {
                // v9.11.7: Cache last known price for seamless updates
                offer._lastMutationPrice = getSelectedPrice(mutationPriceData);
                offer.mutationSuggestedPrice = mutationPriceData.suggestedPrice;
                offer.mutationRecommendedPrice = getSelectedPrice(mutationPriceData);
                offer.mutationMedianPrice = mutationPriceData.medianPrice || null;
                offer.mutationNextCompetitorPrice = mutationPriceData.nextCompetitorPrice || null;
                offer.mutationSource = mutationPriceData.source || mutationPriceData.parsingSource || 'regex';
                offer.mutationNextRangeChecked = mutationPriceData.nextRangeChecked || false;
            }
            
            // Use mutation price as primary if available, otherwise default
            const primaryPriceData = (hasMutation && mutationPriceData) ? mutationPriceData : defaultPriceData;
            
            if (primaryPriceData && primaryPriceData.suggestedPrice && primaryPriceData.suggestedPrice > 0) {
                // Store previous recommended price before updating
                if (offer.recommendedPrice && offer.recommendedPrice !== primaryPriceData.suggestedPrice) {
                    offer.previousRecommendedPrice = offer.recommendedPrice;
                }
                // v9.9.7: Используем выбранный тип цены
                offer.recommendedPrice = getSelectedPrice(primaryPriceData);
                offer.suggestedPrice = primaryPriceData.suggestedPrice; // Сохраняем оригинал
                // v9.9.0: Сохраняем дополнительные варианты цен
                offer.medianPrice = primaryPriceData.medianPrice || null;
                offer.medianData = primaryPriceData.medianData || null;
                offer.nextCompetitorPrice = primaryPriceData.nextCompetitorPrice || null;
                offer.nextCompetitorData = primaryPriceData.nextCompetitorData || null;
                // v9.9.5: Флаг что цена из следующего диапазона
                offer.nextRangeChecked = primaryPriceData.nextRangeChecked || false;
                // v9.10.5: Source (ai/regex) для отображения бейджа
                offer.source = primaryPriceData.source || primaryPriceData.parsingSource || 'regex';
                // Spike logic removed - centralized cache has verified prices
                updated++;
            } else {
                // Keep existing recommendedPrice from DB if price not in cache
                // Don't overwrite with 0
                notFound++;
            }
        }
    }
    
    if (notFound > 0 || mutationsFromCollection > 0) {
        console.log(`Offers prices: ${updated} updated, ${notFound} not found in cache${mutationsFromCollection > 0 ? `, ${mutationsFromCollection} mutations matched from collection` : ''}`);
    }
}

// Filter and render offers
function filterAndRenderOffers() {
    let filtered = [...offersState.offers];
    
    // Search filter
    if (offersState.searchQuery) {
        const q = offersState.searchQuery.toLowerCase();
        const isShortNumeric = /^\d{1,3}$/.test(q); // 1-3 digit numbers like 67, 25
        
        filtered = filtered.filter(o => {
            const nameLower = o.brainrotName?.toLowerCase() || '';
            const offerIdLower = o.offerId?.toLowerCase() || '';
            
            if (isShortNumeric) {
                // For short numeric names, use exact match or word boundary match
                const exactMatch = nameLower === q;
                const wordBoundaryMatch = new RegExp(`(^|[^\\d])${q}([^\\d]|$)`).test(nameLower);
                return exactMatch || wordBoundaryMatch || offerIdLower.includes(q);
            }
            
            return nameLower.includes(q) || offerIdLower.includes(q);
        });
    }
    
    // Status filter
    if (offersState.statusFilter === 'active') {
        filtered = filtered.filter(o => o.status === 'active');
    } else if (offersState.statusFilter === 'pending') {
        // Pending = registered but not yet found on Eldorado
        filtered = filtered.filter(o => o.status === 'pending' || !o.eldoradoOfferId);
    } else if (offersState.statusFilter === 'paused') {
        filtered = filtered.filter(o => o.status === 'paused');
    } else if (offersState.statusFilter === 'needs-update') {
        filtered = filtered.filter(o => {
            const diff = calculatePriceDiff(o.currentPrice, o.recommendedPrice);
            return Math.abs(diff) > 5; // More than 5% difference
        });
    } else if (offersState.statusFilter === 'in-stock') {
        // v9.8.26: Filter offers that have brainrots in collection
        filtered = filtered.filter(o => {
            const count = countBrainrotsWithSameNameAndIncome(o.brainrotName, o.income, o.incomeRaw, o.mutation);
            return count > 0;
        });
    } else if (offersState.statusFilter === 'out-of-stock') {
        // v9.8.26: Filter offers that have NO brainrots in collection
        filtered = filtered.filter(o => {
            const count = countBrainrotsWithSameNameAndIncome(o.brainrotName, o.income, o.incomeRaw, o.mutation);
            return count === 0;
        });
    }
    
    // v9.11.11: Mutation filter
    if (offersState.mutationFilter !== 'all') {
        filtered = filtered.filter(o => {
            const hasMutation = o.mutation && cleanMutationText(o.mutation);
            const mutationType = hasMutation ? cleanMutationText(o.mutation) : null;
            
            switch (offersState.mutationFilter) {
                case 'none': return !hasMutation;
                case 'any': return hasMutation;
                default: 
                    // Specific mutation type (Gold, Diamond, etc.)
                    return mutationType && mutationType.toLowerCase() === offersState.mutationFilter.toLowerCase();
            }
        });
    }
    
    // Sort
    switch (offersState.sortBy) {
        case 'oldest':
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'price-desc':
            filtered.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
            break;
        case 'price-asc':
            filtered.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
            break;
        case 'diff-desc':
            filtered.sort((a, b) => {
                const diffA = Math.abs(calculatePriceDiff(a.currentPrice, a.recommendedPrice));
                const diffB = Math.abs(calculatePriceDiff(b.currentPrice, b.recommendedPrice));
                return diffB - diffA;
            });
            break;
        case 'diff-asc':
            filtered.sort((a, b) => {
                const diffA = Math.abs(calculatePriceDiff(a.currentPrice, a.recommendedPrice));
                const diffB = Math.abs(calculatePriceDiff(b.currentPrice, b.recommendedPrice));
                return diffA - diffB;
            });
            break;
        default: // newest
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    offersState.filteredOffers = filtered;
    renderOffers();
    updateOffersStats();
}
// Calculate price difference percentage
// Shows how much the price needs to change: positive = can raise price, negative = need to lower
function calculatePriceDiff(currentPrice, recommendedPrice) {
    if (!currentPrice || !recommendedPrice) return 0;
    // (recommended - current) / current * 100
    // If recommended > current → positive (green, can raise)
    // If recommended < current → negative (red, need to lower)
    return ((recommendedPrice - currentPrice) / currentPrice) * 100;
}

/**
 * v9.12.32: Find mutation from collection for offer by matching name + income
 * Returns: { mutation: string|null, source: 'collection'|'eldorado'|null }
 * 
 * Logic:
 * 1. Find all brainrots in collection with same name + income
 * 2. If found exactly 1 - use its mutation
 * 3. If found multiple with different mutations - we have ambiguity (need Eldorado check)
 * 4. If found multiple with same mutation - use it
 */
function findMutationFromCollection(offerBrainrotName, offerIncome, offerIncomeRaw) {
    if (!collectionState || !collectionState.allBrainrots || collectionState.allBrainrots.length === 0) {
        return { mutation: null, source: null, ambiguous: false };
    }
    
    if (!offerBrainrotName) return { mutation: null, source: null, ambiguous: false };
    
    // Normalize offer income
    const normalizedOfferIncome = normalizeIncomeForApi(offerIncome, offerIncomeRaw);
    const roundedOfferIncome = Math.floor(normalizedOfferIncome / 10) * 10;
    
    // Normalize brainrot name for comparison
    const normalizedOfferName = offerBrainrotName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const matchingBrainrots = [];
    
    for (const b of collectionState.allBrainrots) {
        if (!b.name) continue;
        const normalizedBrainrotName = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Match by name
        if (normalizedBrainrotName === normalizedOfferName) {
            // Also check income matches (rounded to 10)
            const normalizedBrainrotIncome = normalizeIncomeForApi(b.income, b.incomeText);
            const roundedBrainrotIncome = Math.floor(normalizedBrainrotIncome / 10) * 10;
            
            if (roundedBrainrotIncome === roundedOfferIncome) {
                matchingBrainrots.push(b);
            }
        }
    }
    
    if (matchingBrainrots.length === 0) {
        return { mutation: null, source: null, ambiguous: false };
    }
    
    // Check if all matching brainrots have same mutation (or no mutation)
    const mutations = new Set();
    for (const b of matchingBrainrots) {
        const mut = cleanMutationText(b.mutation) || 'default';
        mutations.add(mut.toLowerCase());
    }
    
    if (mutations.size === 1) {
        // All same mutation (or all default)
        const mutation = matchingBrainrots[0].mutation;
        const cleanMut = cleanMutationText(mutation);
        return { 
            mutation: cleanMut || null, 
            source: 'collection', 
            ambiguous: false,
            count: matchingBrainrots.length
        };
    }
    
    // Multiple different mutations - ambiguous case
    // Return the first mutated one found, but mark as ambiguous
    for (const b of matchingBrainrots) {
        const cleanMut = cleanMutationText(b.mutation);
        if (cleanMut) {
            return { 
                mutation: cleanMut, 
                source: 'collection', 
                ambiguous: true,
                mutations: Array.from(mutations),
                count: matchingBrainrots.length
            };
        }
    }
    
    // All are default
    return { mutation: null, source: 'collection', ambiguous: false, count: matchingBrainrots.length };
}

// v9.8.25: Count brainrots in collection with same name AND income (ignore mutation)
function countBrainrotsWithSameNameAndIncome(offerBrainrotName, offerIncome, offerIncomeRaw, offerMutation) {
    if (!collectionState || !collectionState.allBrainrots || collectionState.allBrainrots.length === 0) {
        return 0;
    }
    
    if (!offerBrainrotName) return 0;
    
    // Normalize offer income (same logic as price cache key)
    const normalizedOfferIncome = normalizeIncomeForApi(offerIncome, offerIncomeRaw);
    const roundedOfferIncome = Math.floor(normalizedOfferIncome / 10) * 10;
    
    // Normalize brainrot name for comparison (lowercase, remove special chars)
    const normalizedOfferName = offerBrainrotName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let count = 0;
    for (const b of collectionState.allBrainrots) {
        if (!b.name) continue;
        const normalizedBrainrotName = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Match by name
        if (normalizedBrainrotName === normalizedOfferName) {
            // Also check income matches (rounded to 10)
            const normalizedBrainrotIncome = normalizeIncomeForApi(b.income, b.incomeText);
            const roundedBrainrotIncome = Math.floor(normalizedBrainrotIncome / 10) * 10;
            
            if (roundedBrainrotIncome !== roundedOfferIncome) continue;
            
            // v9.8.25: Count all brainrots with same name+income, regardless of mutation
            // Mutation affects price, but for counting "how many do I have" - name+income is enough
            count++;
        }
    }
    
    return count;
}

// Check if price change is a suspicious spike (>100% change)
function isPriceSpike(currentPrice, recommendedPrice, previousRecommended) {
    if (!currentPrice || !recommendedPrice) return false;
    const diff = Math.abs(calculatePriceDiff(currentPrice, recommendedPrice));
    
    // If change is more than 100%, it's suspicious
    if (diff > 100) return true;
    
    // If we have previous recommended price, check the change between recommendations
    if (previousRecommended && previousRecommended > 0) {
        const recChange = Math.abs((recommendedPrice - previousRecommended) / previousRecommended * 100);
        if (recChange > 100) return true;
    }
    
    return false;
}

// Render offers grid
function renderOffers() {
    if (!offersGridEl) return;
    
    if (offersState.filteredOffers.length === 0) {
        offersGridEl.innerHTML = `
            <div class="offers-empty">
                <i class="fas fa-store"></i>
                <h3>${offersState.offers.length === 0 ? t('no_offers_yet') : t('no_matches')}</h3>
                <p>${offersState.offers.length === 0 
                    ? t('offers_will_appear') 
                    : t('try_adjusting_filters')}</p>
            </div>
        `;
        return;
    }
    
    offersGridEl.innerHTML = offersState.filteredOffers.map(offer => {
        const hasRecommendedPrice = offer.recommendedPrice && offer.recommendedPrice > 0;
        const diff = hasRecommendedPrice ? calculatePriceDiff(offer.currentPrice, offer.recommendedPrice) : 0;
        // Use isSpike from API data if available, otherwise calculate locally
        const isSpike = offer.isSpike || isPriceSpike(offer.currentPrice, offer.recommendedPrice, offer.previousRecommendedPrice);
        // Green (up) = can raise price (recommended > current, diff > 0)
        // Red (down) = need to lower price (recommended < current, diff < 0)
        const diffClass = !hasRecommendedPrice ? 'unknown' : (isSpike ? 'spike' : (diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'));
        const diffText = !hasRecommendedPrice ? '—' : (isSpike ? '⚠️ Spike' : (diff === 0 ? '0%' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`));
        const isSelected = offersState.selectedOffers.has(offer.offerId);
        const needsUpdate = hasRecommendedPrice && !isSpike && Math.abs(diff) > 5;
        
        // v9.6: Show paused status
        const isPaused = offer.status === 'paused';
        const isPending = offer.status === 'pending' || !offer.eldoradoOfferId;
        
        // v9.12.28: Removed Unverified status - it's not useful and confusing
        // Offers are either: Active, Paused, or Pending
        
        let statusBadgeClass = isPending ? 'pending' : (isPaused ? 'paused' : (needsUpdate ? 'needs-update' : 'active'));
        // v9.7: Better status icons using FontAwesome
        let statusBadgeText = isPending ? '<i class="fas fa-clock"></i> ' + t('pending_status') :
                              (isPaused ? '<i class="fas fa-pause-circle"></i> ' + t('paused') : 
                              (needsUpdate ? t('needs_update_status') : t('active_status_offer')));
        
        // v9.8.24: Count brainrots in collection with same name AND income for paused offers
        let brainrotsCountBadge = '';
        if (isPaused || isPending) {
            const brainrotsCount = countBrainrotsWithSameNameAndIncome(offer.brainrotName, offer.income, offer.incomeRaw, offer.mutation);
            if (brainrotsCount > 0) {
                brainrotsCountBadge = `<span class="offer-brainrots-badge has-brainrots" title="${brainrotsCount} '${offer.brainrotName}' ${t('has_brainrots_in_collection')}"><i class="fas fa-brain"></i> ${brainrotsCount}</span>`;
            } else {
                brainrotsCountBadge = `<span class="offer-brainrots-badge no-brainrots" title="${t('no_brainrots_in_collection')}: '${offer.brainrotName}'"><i class="fas fa-brain"></i> 0</span>`;
            }
        }
        
        // v9.7.6: Calculate time until auto-delete for paused offers
        let pausedInfo = '';
        if (isPaused) {
            // Use pausedAt if available, otherwise use updatedAt or fallback to 3 days from now
            const pausedDate = offer.pausedAt ? new Date(offer.pausedAt) : 
                              (offer.updatedAt ? new Date(offer.updatedAt) : new Date());
            const deleteDate = new Date(pausedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            const msLeft = deleteDate - Date.now();
            const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
            const daysLeft = Math.floor(hoursLeft / 24);
            const remainingHours = hoursLeft % 24;
            
            if (msLeft > 0) {
                let timeText = '';
                if (daysLeft > 0) {
                    timeText = `${daysLeft}d ${remainingHours}h`;
                } else if (hoursLeft > 0) {
                    timeText = `${hoursLeft}h`;
                } else {
                    const minsLeft = Math.floor(msLeft / (60 * 1000));
                    timeText = `${minsLeft}m`;
                }
                pausedInfo = `<div class="offer-paused-info">${t('auto_delete_in')} ${timeText}</div>`;
            } else {
                pausedInfo = `<div class="offer-paused-info urgent">${t('will_be_deleted_soon')}</div>`;
            }
        } else if (isPending) {
            pausedInfo = `<div class="offer-paused-info pending-info">${t('add_offer_id_hint').replace('{id}', offer.offerId)}</div>`;
        }
        
        return `
        <div class="offer-card ${isSelected ? 'selected' : ''} ${isPaused ? 'paused' : ''} ${isPending ? 'pending' : ''} ${offer.mutation ? 'has-mutation' : ''}" data-offer-id="${offer.offerId}" ${offer.mutation ? `style="border-color: ${getMutationColor(offer.mutation)}; box-shadow: 0 0 12px ${getMutationColor(offer.mutation)}40;"` : ''}>
            ${brainrotsCountBadge}
            <div class="offer-card-checkbox">
                <label class="checkbox-wrapper">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleOfferSelection('${offer.offerId}')">
                    <span class="checkmark"></span>
                </label>
            </div>
            <div class="offer-card-header">
                <span class="offer-status-badge ${statusBadgeClass}">
                    ${statusBadgeText}
                </span>
                <div class="offer-card-header-content">
                    <div class="offer-card-image">
                        ${offer.imageUrl 
                            ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}" loading="lazy">`
                            : '<i class="fas fa-brain" style="font-size: 1.5rem; color: var(--text-muted);"></i>'
                        }
                    </div>
                    <div class="offer-card-info">
                        <div class="offer-card-name" title="${offer.brainrotName}">${offer.brainrotName || 'Unknown'}</div>
                        ${cleanMutationText(offer.mutation) ? (() => {
                            const mStyles = getMutationStyles(offer.mutation);
                            const textShadow = mStyles.textShadow ? `text-shadow: ${mStyles.textShadow};` : '';
                            return `<div class="offer-mutation-line"><span class="offer-mutation-badge" style="background: ${mStyles.background}; color: ${mStyles.textColor}; ${textShadow} --glow-color: ${mStyles.glowColor};">${cleanMutationText(offer.mutation)}</span></div>`;
                        })() : '<div class="offer-mutation-line offer-mutation-placeholder"></div>'}
                        <div class="offer-card-id">${offer.offerId}</div>
                        <div class="offer-card-income">${offer.incomeRaw || formatIncomeSec(offer.income)}</div>
                    </div>
                </div>
            </div>
            <div class="offer-card-bottom">
                <div class="offer-current-price-row">
                    <div class="offer-price-label">${t('current_price')}</div>
                    <div class="offer-price-value current">$${(offer.currentPrice || 0).toFixed(2)}</div>
                    <div class="offer-diff-badge ${diffClass}">${diffText}</div>
                </div>
                ${cleanMutationText(offer.mutation) ? `
                <div class="offer-price-variants">
                    ${(() => {
                        // v9.11.7: Default variant with opportunity animation
                        const defPrice = offer.defaultRecommendedPrice || offer._lastDefaultPrice || 0;
                        const defHasOpportunity = offer.defaultNextCompetitorPrice && offer.defaultRecommendedPrice && 
                            (offer.defaultNextCompetitorPrice / offer.defaultRecommendedPrice) > 2;
                        return `
                        <div class="offer-price-variant default" data-price="${defPrice}">
                            <div class="offer-variant-header">
                                <span class="offer-variant-label default">${t('default')}</span>
                                ${offer.defaultNextRangeChecked 
                                    ? (offer.defaultSource === 'ai' 
                                        ? `<span class="parsing-source-badge ai-next-range" title="${t('ai_validated')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>`
                                        : `<span class="next-range-badge" title="${t('price_next_range')}"><i class="fas fa-level-up-alt"></i></span>`)
                                    : (offer.defaultSource === 'ai' 
                                        ? '<span class="parsing-source-badge ai" title="AI"><i class="fas fa-brain"></i></span>' 
                                        : '')}
                            </div>
                            <div class="offer-variant-price ${defPrice > 0 ? '' : 'no-price'}">${defPrice > 0 ? '$' + defPrice.toFixed(2) : 'N/A'}</div>
                            <div class="offer-variant-extras">
                                ${offer.defaultMedianPrice ? `<span class="offer-variant-extra median"><i class="fas fa-chart-bar"></i>$${offer.defaultMedianPrice.toFixed(2)}</span>` : ''}
                                ${offer.defaultNextCompetitorPrice ? `<span class="offer-variant-extra next-comp ${defHasOpportunity ? 'opportunity' : ''}"><i class="fas fa-arrow-up"></i>$${offer.defaultNextCompetitorPrice.toFixed(2)}</span>` : ''}
                            </div>
                        </div>`;
                    })()}
                    ${(() => {
                        // v9.11.7: Mutation variant with opportunity animation
                        const mutPrice = offer.mutationRecommendedPrice || offer._lastMutationPrice || 0;
                        const mutHasOpportunity = offer.mutationNextCompetitorPrice && offer.mutationRecommendedPrice && 
                            (offer.mutationNextCompetitorPrice / offer.mutationRecommendedPrice) > 2;
                        const mStyles = getMutationStyles(offer.mutation);
                        return `
                        <div class="offer-price-variant mutated" data-price="${mutPrice}" style="--mutation-glow: ${mStyles.glowColor}40; --mutation-bg: ${mStyles.background};">
                            <div class="offer-variant-header">
                                <span class="offer-variant-label mutation" style="background: ${mStyles.background}; color: ${mStyles.textColor};">${cleanMutationText(offer.mutation)}</span>
                                ${offer.mutationNextRangeChecked 
                                    ? (offer.mutationSource === 'ai' 
                                        ? `<span class="parsing-source-badge ai-next-range" title="${t('ai_next_range_tooltip')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>`
                                        : `<span class="next-range-badge" title="${t('next_range_tooltip')}"><i class="fas fa-level-up-alt"></i></span>`)
                                    : (offer.mutationSource === 'ai' 
                                        ? `<span class="parsing-source-badge ai" title="${t('ai_tooltip')}"><i class="fas fa-brain"></i></span>` 
                                        : '')}
                            </div>
                            <div class="offer-variant-price ${mutPrice > 0 ? '' : 'no-price'}">${mutPrice > 0 ? '$' + mutPrice.toFixed(2) : 'N/A'}</div>
                            <div class="offer-variant-extras">
                                ${offer.mutationMedianPrice ? `<span class="offer-variant-extra median"><i class="fas fa-chart-bar"></i>$${offer.mutationMedianPrice.toFixed(2)}</span>` : ''}
                                ${offer.mutationNextCompetitorPrice ? `<span class="offer-variant-extra next-comp ${mutHasOpportunity ? 'opportunity' : ''}"><i class="fas fa-arrow-up"></i>$${offer.mutationNextCompetitorPrice.toFixed(2)}</span>` : ''}
                            </div>
                        </div>`;
                    })()}
                </div>
                ` : `
                <div class="offer-card-prices">
                    <div class="offer-price-item">
                        <div class="offer-price-label">${isSpike ? t('recommended_old') : t('recommended_price')}${offer.nextRangeChecked 
                            ? (offer.source === 'ai' 
                                ? ` <span class="parsing-source-badge ai-next-range" title="${t('ai_validated')}"><i class="fas fa-brain"></i><i class="fas fa-level-up-alt next-range-arrow"></i></span>` 
                                : ` <span class="next-range-badge" title="${t('price_next_range')}"><i class="fas fa-level-up-alt"></i></span>`) 
                            : ''}</div>
                        <div class="offer-price-value recommended ${isSpike ? 'spike-value' : ''} ${!hasRecommendedPrice ? 'no-price' : ''}">${hasRecommendedPrice ? '$' + offer.recommendedPrice.toFixed(2) : 'N/A'}</div>
                    </div>
                    ${(offer.medianPrice || offer.nextCompetitorPrice) ? `
                    <div class="offer-additional-prices-inline">
                        ${offer.medianPrice ? `<span class="offer-alt-inline median" title="${t('median')}"><i class="fas fa-chart-bar"></i>$${offer.medianPrice.toFixed(2)}</span>` : ''}
                        ${offer.nextCompetitorPrice ? `<span class="offer-alt-inline next" title="${t('next_competitor')}"><i class="fas fa-arrow-up"></i>$${offer.nextCompetitorPrice.toFixed(2)}</span>` : ''}
                    </div>
                    ` : ''}
                </div>
                `}
                <div class="offer-card-actions">
                    <button class="btn btn-sm btn-adjust" onclick="openOfferPriceModal('${offer.offerId}')">
                        <i class="fas fa-edit"></i>
                        ${t('adjust_price')}
                    </button>
                    ${isPaused ? `
                    <button class="btn btn-sm btn-delete" onclick="deleteOffer('${offer.offerId}', '${(offer.brainrotName || 'Unknown').replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                        ${t('delete')}
                    </button>
                    ${pausedInfo}
                    ` : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Update offers stats
function updateOffersStats() {
    if (!offersStatsEl) return;
    
    const total = offersState.offers.length;
    const pausedCount = offersState.offers.filter(o => o.status === 'paused').length;
    const needsUpdate = offersState.offers.filter(o => {
        if (o.status === 'paused') return false;
        const diff = Math.abs(calculatePriceDiff(o.currentPrice, o.recommendedPrice));
        return diff > 5;
    }).length;
    
    offersStatsEl.innerHTML = `
        <span><i class="fas fa-store"></i> ${total} ${t('total_offers')}</span>
        ${pausedCount > 0 ? `<span style="color: #9ca3af;"><i class="fas fa-pause-circle"></i> ${pausedCount} ${t('paused_offers')}</span>` : ''}
        ${needsUpdate > 0 ? `<span style="color: #fbbf24;"><i class="fas fa-exclamation-triangle"></i> ${needsUpdate} ${t('need_update')}</span>` : ''}
        ${offersState.selectedOffers.size > 0 ? `<span style="color: var(--accent-primary);"><i class="fas fa-check-square"></i> ${offersState.selectedOffers.size} ${t('selected_offers')}</span>` : ''}
    `;
}

// Toggle offer selection
function toggleOfferSelection(offerId) {
    if (offersState.selectedOffers.has(offerId)) {
        offersState.selectedOffers.delete(offerId);
    } else {
        offersState.selectedOffers.add(offerId);
    }
    updateBulkActionsState();
    renderOffers();
}

// v9.7.6: Delete a paused offer from server (v10.2.0: no confirmations, always delete from both)
async function deleteOffer(offerId, brainrotName) {
    try {
        const currentFarmKey = state.currentKey;
        if (!currentFarmKey) {
            showNotification(`❌ ${t('no_farm_key')}`, 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(currentFarmKey)}&offerId=${encodeURIComponent(offerId)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete offer');
        }
        
        // Remove from local state immediately
        offersState.offers = offersState.offers.filter(o => o.offerId !== offerId);
        offersState.filteredOffers = offersState.filteredOffers.filter(o => o.offerId !== offerId);
        offersState.selectedOffers.delete(offerId);
        
        // Clear cache to force fresh data on next load
        offersCache = { data: null, timestamp: 0 };
        
        // Update UI immediately
        updateOffersStats();
        updateBulkActionsState();
        renderOffers();
        showNotification(`✅ Deleted "${brainrotName}"`, 'success');
        
        // Always delete from Eldorado too - save delete queue via API
        try {
            const deleteData = {
                farmKey: state.currentKey,
                offerCodes: [offerId],
                offerNames: [brainrotName]
            };
            
            // Save to API
            await fetch(`${API_BASE}/delete-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deleteData)
            });
            
            // Open Eldorado with flag to fetch delete queue
            window.open(`https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_delete_pending=1&farmKey=${encodeURIComponent(state.currentKey)}`, '_blank');
        } catch (err) {
            console.error('Failed to save delete queue:', err);
            showNotification('❌ Failed to prepare Eldorado cleanup', 'error');
        }
        
    } catch (error) {
        console.error('Delete offer error:', error);
        showNotification(`❌ Failed to delete offer: ${error.message}`, 'error');
    }
}

// v10.2.0: Bulk delete multiple paused offers - no confirmations, always delete from both
// v9.12.28: Removed unverified - only paused offers can be bulk deleted
async function bulkDeleteOffers() {
    const selectedOfferIds = Array.from(offersState.selectedOffers);
    const selectedOffers = offersState.offers.filter(o => selectedOfferIds.includes(o.offerId));
    
    // Filter only paused offers
    const deletableOffers = selectedOffers.filter(o => o.status === 'paused');
    
    if (deletableOffers.length === 0) {
        showNotification('⚠️ No paused offers selected', 'warning');
        return;
    }
    
    const currentFarmKey = state.currentKey;
    if (!currentFarmKey) {
        showNotification(`❌ ${t('no_farm_key')}`, 'error');
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    const deletedOfferIds = [];
    
    for (const offer of deletableOffers) {
        try {
            const response = await fetch(`${API_BASE}/offers?farmKey=${encodeURIComponent(currentFarmKey)}&offerId=${encodeURIComponent(offer.offerId)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                successCount++;
                deletedOfferIds.push(offer.offerId);
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`Failed to delete offer ${offer.offerId}:`, error);
            failCount++;
        }
    }
    
    // Remove deleted offers from local state
    offersState.offers = offersState.offers.filter(o => !deletedOfferIds.includes(o.offerId));
    offersState.filteredOffers = offersState.filteredOffers.filter(o => !deletedOfferIds.includes(o.offerId));
    deletedOfferIds.forEach(id => offersState.selectedOffers.delete(id));
    
    // Clear cache
    offersCache = { data: null, timestamp: 0 };
    
    // Update UI
    updateOffersStats();
    updateBulkActionsState();
    renderOffers();
    
    if (failCount === 0) {
        showNotification(`✅ ${successCount} offers deleted`, 'success');
    } else {
        showNotification(`⚠️ ${successCount} deleted, ${failCount} failed`, 'warning');
    }
    
    // Always delete from Eldorado too - save delete queue via API
    if (deletedOfferIds.length > 0) {
        try {
            // Get names for deleted offers
            const deletedOfferNames = deletableOffers.filter(o => deletedOfferIds.includes(o.offerId)).map(o => o.brainrotName);
            
            const deleteData = {
                farmKey: state.currentKey,
                offerCodes: deletedOfferIds,
                offerNames: deletedOfferNames
            };
            
            // Save to API
            await fetch(`${API_BASE}/delete-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deleteData)
            });
            
            // Open Eldorado with flag to fetch delete queue
            window.open(`https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_delete_pending=1&farmKey=${encodeURIComponent(state.currentKey)}`, '_blank');
        } catch (err) {
            console.error('Failed to save delete queue:', err);
            showNotification('❌ Failed to prepare Eldorado cleanup', 'error');
        }
    }
}

// Toggle select all offers
function toggleSelectAllOffers() {
    if (offersState.selectedOffers.size === offersState.filteredOffers.length) {
        offersState.selectedOffers.clear();
    } else {
        offersState.filteredOffers.forEach(o => offersState.selectedOffers.add(o.offerId));
    }
    updateBulkActionsState();
    renderOffers();
}

// Update bulk actions button state
function updateBulkActionsState() {
    // Always find button dynamically - it may be loaded after page init
    const deleteBtnEl = document.getElementById('bulkDeleteBtn');
    const adjustBtnEl = document.getElementById('bulkAdjustBtn');
    const selectAllEl = document.getElementById('selectAllOffers');
    
    if (adjustBtnEl) {
        adjustBtnEl.disabled = offersState.selectedOffers.size === 0;
    }
    
    // v10.0.3: Show bulk delete button ONLY when paused offers are selected
    // v9.12.28: Removed unverified status
    if (deleteBtnEl) {
        const selectedOfferIds = Array.from(offersState.selectedOffers);
        const selectedOffers = offersState.offers.filter(o => selectedOfferIds.includes(o.offerId));
        
        // Count only paused offers
        const deletableOffers = selectedOffers.filter(o => o.status === 'paused');
        
        console.log('updateBulkActionsState:', {
            selectedIds: selectedOfferIds,
            selectedOffers: selectedOffers.map(o => ({ id: o.offerId, status: o.status })),
            deletableCount: deletableOffers.length,
            btnFound: true
        });
        
        // Show button ONLY if paused offers are selected
        if (deletableOffers.length > 0) {
            deleteBtnEl.classList.remove('hidden');
            deleteBtnEl.disabled = false;
            deleteBtnEl.innerHTML = `<i class="fas fa-trash"></i> Delete ${deletableOffers.length}`;
        } else {
            deleteBtnEl.classList.add('hidden');
            deleteBtnEl.disabled = true;
            deleteBtnEl.innerHTML = `<i class="fas fa-trash"></i> Delete Selected`;
        }
    }
    // No warning if not found - button may not exist on current view
    
    if (selectAllEl) {
        selectAllEl.checked = offersState.selectedOffers.size === offersState.filteredOffers.length && offersState.filteredOffers.length > 0;
    }
    updateOffersStats();
}

// Open single offer price modal
function openOfferPriceModal(offerId) {
    const offer = offersState.offers.find(o => o.offerId === offerId);
    if (!offer) return;
    
    offersState.currentOffer = offer;
    
    const previewEl = document.getElementById('offerPreview');
    const recommendedValueEl = document.getElementById('recommendedPriceValue');
    const customInputEl = document.getElementById('customPriceInput');
    const hasMutation = cleanMutationText(offer.mutation);
    
    // v9.11.4: Setup mutation variant selector
    const variantSelectorContainer = document.getElementById('offerVariantSelector');
    if (variantSelectorContainer) {
        if (hasMutation) {
            const mStyles = getMutationStyles(offer.mutation);
            variantSelectorContainer.innerHTML = `
                <div class="variant-selector-label">Price Variant:</div>
                <div class="variant-selector-options">
                    <button class="variant-btn default active" data-variant="default">
                        <span class="variant-btn-label">DEFAULT</span>
                        <span class="variant-btn-price">$${(offer.defaultRecommendedPrice || 0).toFixed(2)}</span>
                    </button>
                    <button class="variant-btn mutation" data-variant="mutation" style="--mutation-bg: ${mStyles.background}; --mutation-color: ${mStyles.textColor}; --mutation-glow: ${mStyles.glowColor};">
                        <span class="variant-btn-label" style="background: ${mStyles.background}; color: ${mStyles.textColor};">${cleanMutationText(offer.mutation)}</span>
                        <span class="variant-btn-price">$${(offer.mutationRecommendedPrice || 0).toFixed(2)}</span>
                    </button>
                </div>
            `;
            variantSelectorContainer.classList.remove('hidden');
            
            // Add event listeners
            variantSelectorContainer.querySelectorAll('.variant-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    variantSelectorContainer.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateOfferModalPrices(offer, btn.dataset.variant);
                });
            });
        } else {
            variantSelectorContainer.classList.add('hidden');
            variantSelectorContainer.innerHTML = '';
        }
    }
    
    // Helper to update prices based on selected variant
    function updateOfferModalPrices(offer, variant) {
        const isMutation = variant === 'mutation';
        const recPrice = isMutation ? (offer.mutationRecommendedPrice || 0) : (offer.defaultRecommendedPrice || offer.recommendedPrice || 0);
        const medPrice = isMutation ? (offer.mutationMedianPrice || 0) : (offer.defaultMedianPrice || offer.medianPrice || 0);
        const nextPrice = isMutation ? (offer.mutationNextCompetitorPrice || 0) : (offer.defaultNextCompetitorPrice || offer.nextCompetitorPrice || 0);
        
        if (recommendedValueEl) {
            recommendedValueEl.textContent = `$${recPrice.toFixed(2)}`;
        }
        
        const medianValueEl = document.getElementById('medianPriceValue');
        const medianRadio = document.querySelector('input[name="priceType"][value="median"]');
        if (medianValueEl && medianRadio) {
            if (medPrice > 0) {
                medianValueEl.textContent = `$${medPrice.toFixed(2)}`;
                medianRadio.disabled = false;
                medianRadio.closest('.price-option')?.classList.remove('disabled');
            } else {
                medianValueEl.textContent = 'N/A';
                medianRadio.disabled = true;
                medianRadio.closest('.price-option')?.classList.add('disabled');
            }
        }
        
        const nextCompValueEl = document.getElementById('nextCompetitorPriceValue');
        const nextCompRadio = document.querySelector('input[name="priceType"][value="nextCompetitor"]');
        if (nextCompValueEl && nextCompRadio) {
            if (nextPrice > 0) {
                nextCompValueEl.textContent = `$${nextPrice.toFixed(2)}`;
                nextCompRadio.disabled = false;
                nextCompRadio.closest('.price-option')?.classList.remove('disabled');
            } else {
                nextCompValueEl.textContent = 'N/A';
                nextCompRadio.disabled = true;
                nextCompRadio.closest('.price-option')?.classList.add('disabled');
            }
        }
    }
    
    if (previewEl) {
        previewEl.innerHTML = `
            ${offer.imageUrl ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}">` : ''}
            <div class="offer-preview-info">
                <h4>${offer.brainrotName || 'Unknown'}</h4>
                ${hasMutation ? `<span class="offer-preview-mutation" style="background: ${getMutationStyles(offer.mutation).background}; color: ${getMutationStyles(offer.mutation).textColor};">${cleanMutationText(offer.mutation)}</span>` : ''}
                <p>${offer.incomeRaw || formatIncomeSec(offer.income)} • Current: $${(offer.currentPrice || 0).toFixed(2)}</p>
            </div>
        `;
    }
    
    // Set initial prices based on mutation status
    if (hasMutation) {
        updateOfferModalPrices(offer, 'default');
    } else {
        if (recommendedValueEl) {
            recommendedValueEl.textContent = `$${(offer.recommendedPrice || 0).toFixed(2)}`;
        }
        
        // Populate median price
        const medianValueEl = document.getElementById('medianPriceValue');
        const medianRadio = document.querySelector('input[name="priceType"][value="median"]');
        if (medianValueEl && medianRadio) {
            if (offer.medianPrice && offer.medianPrice > 0) {
                medianValueEl.textContent = `$${offer.medianPrice.toFixed(2)}`;
                medianRadio.disabled = false;
                medianRadio.closest('.price-option')?.classList.remove('disabled');
            } else {
                medianValueEl.textContent = 'N/A';
                medianRadio.disabled = true;
                medianRadio.closest('.price-option')?.classList.add('disabled');
            }
        }
        
        // Populate next competitor price
        const nextCompValueEl = document.getElementById('nextCompetitorPriceValue');
        const nextCompRadio = document.querySelector('input[name="priceType"][value="nextCompetitor"]');
        if (nextCompValueEl && nextCompRadio) {
            if (offer.nextCompetitorPrice && offer.nextCompetitorPrice > 0) {
                nextCompValueEl.textContent = `$${offer.nextCompetitorPrice.toFixed(2)}`;
                nextCompRadio.disabled = false;
                nextCompRadio.closest('.price-option')?.classList.remove('disabled');
            } else {
                nextCompValueEl.textContent = 'N/A';
                nextCompRadio.disabled = true;
                nextCompRadio.closest('.price-option')?.classList.add('disabled');
            }
        }
    }
    
    if (customInputEl) {
        customInputEl.value = offer.currentPrice || '';
    }
    
    // v9.11.4: Show current price hint
    const currentPriceHintEl = document.getElementById('currentPriceHintValue');
    if (currentPriceHintEl) {
        currentPriceHintEl.textContent = `$${(offer.currentPrice || 0).toFixed(2)}`;
    }
    
    // Reset radio to recommended
    document.querySelector('input[name="priceType"][value="recommended"]').checked = true;
    
    openModal(offerPriceModal);
}

// Open bulk price modal
function openBulkPriceModal() {
    const selectedOffers = offersState.offers.filter(o => offersState.selectedOffers.has(o.offerId));
    if (selectedOffers.length === 0) return;
    
    const bulkOffersListEl = document.getElementById('bulkOffersList');
    const bulkCountEl = document.getElementById('bulkCount');
    
    if (bulkCountEl) {
        bulkCountEl.textContent = selectedOffers.length;
    }
    
    // Count offers with each price type available
    const withMedian = selectedOffers.filter(o => o.medianPrice > 0).length;
    const withNextComp = selectedOffers.filter(o => o.nextCompetitorPrice > 0).length;
    
    // Update option availability indicators
    const medianOption = document.querySelector('.bulk-price-type-option[data-type="median"]');
    const nextCompOption = document.querySelector('.bulk-price-type-option[data-type="nextCompetitor"]');
    
    if (medianOption) {
        medianOption.classList.toggle('partially-available', withMedian > 0 && withMedian < selectedOffers.length);
        medianOption.classList.toggle('unavailable', withMedian === 0);
        const hint = medianOption.querySelector('.type-hint');
        if (hint) hint.textContent = withMedian === 0 ? 'Not available' : `Available for ${withMedian}/${selectedOffers.length}`;
    }
    
    if (nextCompOption) {
        nextCompOption.classList.toggle('partially-available', withNextComp > 0 && withNextComp < selectedOffers.length);
        nextCompOption.classList.toggle('unavailable', withNextComp === 0);
        const hint = nextCompOption.querySelector('.type-hint');
        if (hint) hint.textContent = withNextComp === 0 ? 'Not available' : `Available for ${withNextComp}/${selectedOffers.length}`;
    }
    
    if (bulkOffersListEl) {
        bulkOffersListEl.innerHTML = selectedOffers.map(offer => {
            // v9.11.8: Support mutation variants in bulk modal
            const hasMutation = cleanMutationText(offer.mutation);
            const selectedVariant = 'default'; // Start with default variant
            
            // Get prices based on variant
            const defRecPrice = offer.defaultRecommendedPrice || offer.recommendedPrice || 0;
            const defMedPrice = offer.defaultMedianPrice || offer.medianPrice || 0;
            const defNextPrice = offer.defaultNextCompetitorPrice || offer.nextCompetitorPrice || 0;
            const mutRecPrice = offer.mutationRecommendedPrice || 0;
            const mutMedPrice = offer.mutationMedianPrice || 0;
            const mutNextPrice = offer.mutationNextCompetitorPrice || 0;
            
            // Use default prices initially
            const recPrice = defRecPrice;
            const medPrice = defMedPrice;
            const nextPrice = defNextPrice;
            
            // Mutation styles
            const mStyles = hasMutation ? getMutationStyles(offer.mutation) : null;
            
            return `
            <div class="bulk-offer-item" data-offer-id="${offer.offerId}" 
                 data-rec-price="${recPrice}" data-med-price="${medPrice}" data-next-price="${nextPrice}"
                 data-def-rec="${defRecPrice}" data-def-med="${defMedPrice}" data-def-next="${defNextPrice}"
                 data-mut-rec="${mutRecPrice}" data-mut-med="${mutMedPrice}" data-mut-next="${mutNextPrice}"
                 data-has-mutation="${hasMutation ? '1' : '0'}" data-selected-variant="default">
                ${offer.imageUrl ? `<img src="${getCachedOfferImage(offer.imageUrl, offer.offerId)}" alt="${offer.brainrotName}">` : '<div class="bulk-offer-placeholder"></div>'}
                <div class="bulk-offer-info">
                    <div class="bulk-offer-name">${offer.brainrotName || 'Unknown'}</div>
                    <div class="bulk-offer-income">${offer.income || '0/s'}</div>
                    ${hasMutation ? `
                    <div class="bulk-offer-variant-toggle">
                        <button class="bulk-variant-btn active" data-variant="default" title="Default variant prices">DEF</button>
                        <button class="bulk-variant-btn mutation" data-variant="mutation" 
                                style="background: ${mStyles.background}; color: ${mStyles.textColor};" 
                                title="${cleanMutationText(offer.mutation)} variant prices">${cleanMutationText(offer.mutation).substring(0, 4)}</button>
                    </div>
                    ` : ''}
                </div>
                <div class="bulk-offer-prices">
                    <div class="bulk-price-cell current">
                        <span class="price-label">Current</span>
                        <span class="price-value">$${(offer.currentPrice || 0).toFixed(2)}</span>
                    </div>
                    <div class="bulk-price-cell recommended ${recPrice > 0 ? 'available' : 'na'}">
                        <span class="price-label"><i class="fas fa-tag"></i> Rec</span>
                        <span class="price-value">${recPrice > 0 ? '$' + recPrice.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="bulk-price-cell median ${medPrice > 0 ? 'available' : 'na'}">
                        <span class="price-label"><i class="fas fa-chart-bar"></i> Med</span>
                        <span class="price-value">${medPrice > 0 ? '$' + medPrice.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="bulk-price-cell next-comp ${nextPrice > 0 ? 'available' : 'na'}">
                        <span class="price-label"><i class="fas fa-arrow-up"></i> Next</span>
                        <span class="price-value">${nextPrice > 0 ? '$' + nextPrice.toFixed(2) : 'N/A'}</span>
                    </div>
                </div>
                <div class="bulk-offer-custom-input">
                    <div class="custom-price-wrapper">
                        <span>$</span>
                        <input type="number" step="0.01" min="0" class="offer-custom-price" 
                               placeholder="0.00" value="${recPrice > 0 ? recPrice.toFixed(2) : ''}">
                    </div>
                    <div class="price-quick-btns">
                        ${recPrice > 0 ? `<button class="price-quick-btn rec" data-price="${recPrice}" title="Recommended $${recPrice.toFixed(2)}">Rec</button>` : ''}
                        ${medPrice > 0 ? `<button class="price-quick-btn med" data-price="${medPrice}" title="Median $${medPrice.toFixed(2)}">Med</button>` : ''}
                        ${nextPrice > 0 ? `<button class="price-quick-btn next" data-price="${nextPrice}" title="Next Comp $${nextPrice.toFixed(2)}">Next</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
        
        // Add click handlers for quick price buttons
        bulkOffersListEl.querySelectorAll('.price-quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const price = parseFloat(e.target.dataset.price);
                const input = e.target.closest('.bulk-offer-custom-input').querySelector('.offer-custom-price');
                if (input && price > 0) {
                    input.value = price.toFixed(2);
                    // Update active state
                    e.target.closest('.price-quick-btns').querySelectorAll('.price-quick-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                }
            });
        });
        
        // v9.11.8: Add click handlers for variant toggle buttons
        bulkOffersListEl.querySelectorAll('.bulk-variant-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const variant = e.target.dataset.variant;
                const item = e.target.closest('.bulk-offer-item');
                if (!item) return;
                
                // Update active state
                item.querySelectorAll('.bulk-variant-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                item.dataset.selectedVariant = variant;
                
                // Get prices for selected variant
                const isMutation = variant === 'mutation';
                const recPrice = isMutation ? parseFloat(item.dataset.mutRec) : parseFloat(item.dataset.defRec);
                const medPrice = isMutation ? parseFloat(item.dataset.mutMed) : parseFloat(item.dataset.defMed);
                const nextPrice = isMutation ? parseFloat(item.dataset.mutNext) : parseFloat(item.dataset.defNext);
                
                // Update data attributes
                item.dataset.recPrice = recPrice;
                item.dataset.medPrice = medPrice;
                item.dataset.nextPrice = nextPrice;
                
                // Update displayed prices
                const recCell = item.querySelector('.bulk-price-cell.recommended');
                const medCell = item.querySelector('.bulk-price-cell.median');
                const nextCell = item.querySelector('.bulk-price-cell.next-comp');
                
                if (recCell) {
                    recCell.querySelector('.price-value').textContent = recPrice > 0 ? '$' + recPrice.toFixed(2) : 'N/A';
                    recCell.classList.toggle('available', recPrice > 0);
                    recCell.classList.toggle('na', recPrice <= 0);
                }
                if (medCell) {
                    medCell.querySelector('.price-value').textContent = medPrice > 0 ? '$' + medPrice.toFixed(2) : 'N/A';
                    medCell.classList.toggle('available', medPrice > 0);
                    medCell.classList.toggle('na', medPrice <= 0);
                }
                if (nextCell) {
                    nextCell.querySelector('.price-value').textContent = nextPrice > 0 ? '$' + nextPrice.toFixed(2) : 'N/A';
                    nextCell.classList.toggle('available', nextPrice > 0);
                    nextCell.classList.toggle('na', nextPrice <= 0);
                }
                
                // Update quick price buttons
                const quickBtns = item.querySelector('.price-quick-btns');
                if (quickBtns) {
                    quickBtns.innerHTML = `
                        ${recPrice > 0 ? `<button class="price-quick-btn rec" data-price="${recPrice}" title="Recommended $${recPrice.toFixed(2)}">Rec</button>` : ''}
                        ${medPrice > 0 ? `<button class="price-quick-btn med" data-price="${medPrice}" title="Median $${medPrice.toFixed(2)}">Med</button>` : ''}
                        ${nextPrice > 0 ? `<button class="price-quick-btn next" data-price="${nextPrice}" title="Next Comp $${nextPrice.toFixed(2)}">Next</button>` : ''}
                    `;
                    // Re-bind quick price button events
                    quickBtns.querySelectorAll('.price-quick-btn').forEach(qbtn => {
                        qbtn.addEventListener('click', (e) => {
                            const price = parseFloat(e.target.dataset.price);
                            const input = e.target.closest('.bulk-offer-custom-input').querySelector('.offer-custom-price');
                            if (input && price > 0) {
                                input.value = price.toFixed(2);
                                quickBtns.querySelectorAll('.price-quick-btn').forEach(b => b.classList.remove('active'));
                                e.target.classList.add('active');
                            }
                        });
                    });
                }
                
                // Update custom input value if currently showing recommended
                const input = item.querySelector('.offer-custom-price');
                if (input && recPrice > 0) {
                    input.value = recPrice.toFixed(2);
                }
            });
        });
    }
    
    // Reset to recommended
    document.querySelector('input[name="bulkPriceType"][value="recommended"]').checked = true;
    
    // Update visual selection
    updateBulkPriceTypeVisual('recommended');
    
    openModal(bulkPriceModal);
}

// Update bulk price type visual selection
function updateBulkPriceTypeVisual(type) {
    document.querySelectorAll('.bulk-price-type-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.type === type);
    });
    
    // Toggle custom mode for offer items (shows individual price inputs)
    const isCustomMode = type === 'custom-single';
    document.querySelectorAll('.bulk-offer-item').forEach(item => {
        item.classList.toggle('custom-mode', isCustomMode);
    });
    
    // Highlight corresponding price column in offers
    document.querySelectorAll('.bulk-price-cell').forEach(cell => {
        cell.classList.remove('highlighted');
    });
    
    const columnClass = type === 'recommended' ? 'recommended' : 
                        type === 'median' ? 'median' : 
                        type === 'nextCompetitor' ? 'next-comp' : null;
    
    if (columnClass) {
        document.querySelectorAll(`.bulk-price-cell.${columnClass}`).forEach(cell => {
            cell.classList.add('highlighted');
        });
    }
}

// Handle bulk price type change
function handleBulkPriceTypeChange(type) {
    updateBulkPriceTypeVisual(type);
}

// Confirm single offer price adjustment
async function confirmOfferPriceAdjustment() {
    const offer = offersState.currentOffer;
    if (!offer) return;
    
    const priceType = document.querySelector('input[name="priceType"]:checked')?.value;
    
    // v9.11.4: Get selected variant (default/mutation)
    const activeVariantBtn = document.querySelector('#offerVariantSelector .variant-btn.active');
    const selectedVariant = activeVariantBtn?.dataset.variant || 'default';
    const isMutationVariant = selectedVariant === 'mutation';
    
    // Get prices based on selected variant
    const recPrice = isMutationVariant ? (offer.mutationRecommendedPrice || offer.recommendedPrice) : (offer.defaultRecommendedPrice || offer.recommendedPrice);
    const medPrice = isMutationVariant ? (offer.mutationMedianPrice || offer.medianPrice) : (offer.defaultMedianPrice || offer.medianPrice);
    const nextPrice = isMutationVariant ? (offer.mutationNextCompetitorPrice || offer.nextCompetitorPrice) : (offer.defaultNextCompetitorPrice || offer.nextCompetitorPrice);
    
    let newPrice;
    
    switch (priceType) {
        case 'recommended':
            newPrice = recPrice;
            break;
        case 'median':
            newPrice = medPrice;
            break;
        case 'nextCompetitor':
            newPrice = nextPrice;
            break;
        case 'custom':
            newPrice = parseFloat(document.getElementById('customPriceInput')?.value);
            break;
        default:
            newPrice = recPrice;
    }
    
    if (!newPrice || newPrice <= 0) {
        document.getElementById('offerPriceError').textContent = 'Please enter a valid price';
        return;
    }
    
    // Create adjustment data for Tampermonkey
    const adjustmentData = {
        action: 'adjust_price',
        offers: [{
            offerId: offer.offerId,
            brainrotName: offer.brainrotName,
            income: offer.income,
            newPrice: newPrice,
            currentPrice: offer.currentPrice
        }],
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    
    // v9.12.2: Store via API (localStorage doesn't work cross-domain!)
    try {
        const response = await fetch(`${API_BASE}/adjustment-queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: state.currentKey, adjustmentData })
        });
        const result = await response.json();
        
        if (!result.success || !result.adjustmentId) {
            throw new Error('Failed to store adjustment data');
        }
        
        // Open Eldorado with adjustmentId in URL
        const eldoradoUrl = `https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_adj=${result.adjustmentId}`;
        window.open(eldoradoUrl, '_blank');
    } catch (err) {
        console.error('Failed to store adjustment:', err);
        showNotification('❌ Failed to prepare price adjustment', 'error');
        return;
    }
    
    closeModalFn(offerPriceModal);
}

// Confirm bulk price adjustment
async function confirmBulkPriceAdjustment() {
    const selectedOffers = offersState.offers.filter(o => offersState.selectedOffers.has(o.offerId));
    if (selectedOffers.length === 0) return;
    
    const priceType = document.querySelector('input[name="bulkPriceType"]:checked')?.value;
    const adjustments = [];
    
    for (const offer of selectedOffers) {
        let newPrice;
        
        // v9.11.8: Get selected variant from bulk offer item
        const offerItem = document.querySelector(`.bulk-offer-item[data-offer-id="${offer.offerId}"]`);
        const selectedVariant = offerItem?.dataset.selectedVariant || 'default';
        const isMutation = selectedVariant === 'mutation';
        
        // Get prices based on selected variant
        const recPrice = isMutation ? (offer.mutationRecommendedPrice || 0) : (offer.defaultRecommendedPrice || offer.recommendedPrice || 0);
        const medPrice = isMutation ? (offer.mutationMedianPrice || 0) : (offer.defaultMedianPrice || offer.medianPrice || 0);
        const nextPrice = isMutation ? (offer.mutationNextCompetitorPrice || 0) : (offer.defaultNextCompetitorPrice || offer.nextCompetitorPrice || 0);
        
        switch (priceType) {
            case 'recommended':
                newPrice = recPrice;
                break;
            case 'median':
                newPrice = medPrice || recPrice;
                break;
            case 'nextCompetitor':
                newPrice = nextPrice || recPrice;
                break;
            case 'custom-single':
                // Get individual price from each offer's input
                const priceInput = offerItem?.querySelector('.offer-custom-price');
                newPrice = parseFloat(priceInput?.value);
                break;
            default:
                newPrice = recPrice;
        }
        
        if (newPrice && newPrice > 0) {
            adjustments.push({
                offerId: offer.offerId,
                brainrotName: offer.brainrotName,
                income: offer.income,
                newPrice: newPrice,
                currentPrice: offer.currentPrice
            });
        }
    }
    
    if (adjustments.length === 0) {
        document.getElementById('bulkPriceError').textContent = 'Please enter valid prices';
        return;
    }
    
    // Create adjustment data for Tampermonkey
    const adjustmentData = {
        action: 'adjust_price',
        offers: adjustments,
        returnUrl: window.location.href,
        timestamp: Date.now()
    };
    
    // v9.12.2: Store via API (localStorage doesn't work cross-domain!)
    try {
        const response = await fetch(`${API_BASE}/adjustment-queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmKey: state.currentKey, adjustmentData })
        });
        const result = await response.json();
        
        if (!result.success || !result.adjustmentId) {
            throw new Error('Failed to store adjustment data');
        }
        
        console.log(`[Bulk Adjust] Stored ${adjustments.length} offers, id=${result.adjustmentId}`);
        
        // Open Eldorado with adjustmentId in URL
        const eldoradoUrl = `https://www.eldorado.gg/dashboard/offers?category=CustomItem&glitched_adj=${result.adjustmentId}`;
        window.open(eldoradoUrl, '_blank');
    } catch (err) {
        console.error('Failed to store adjustment:', err);
        document.getElementById('bulkPriceError').textContent = 'Failed to prepare adjustment: ' + err.message;
        return;
    }
    
    closeModalFn(bulkPriceModal);
}

// Save offer to server (called after creating offer via Tampermonkey)
async function saveOffer(offerData) {
    try {
        const farmKey = state.currentKey;
        if (!farmKey) return;
        
        const response = await fetch(`${API_BASE}/offers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey,
                ...offerData
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Offer saved:', offerData.offerId);
            await loadOffers();
        }
    } catch (err) {
        console.error('Error saving offer:', err);
    }
}

// ============================================
// UNIVERSAL CODE TRACKING SYSTEM
// ============================================

// Shop name state
let shopNameState = {
    leftEmoji: '👾',
    rightEmoji: '👾',
    text: '',
    fullName: null,  // Full shop name like "👾Glitched Store👾"
    isConfigured: false,
    pendingCallback: null  // Callback after shop name is configured
};

// Load shop name from localStorage cache FIRST (instant), then update from server
function loadShopNameFromCache() {
    const cached = localStorage.getItem('glitched_shop_name');
    if (cached && cached !== '👾Glitched Store👾' && cached.length > 3) {
        shopNameState.fullName = cached;
        shopNameState.isConfigured = true;
        parseShopName(cached);
        updateShopNameDisplay();
        console.log('[ShopName] Loaded from localStorage (instant):', cached);
        return true;
    }
    return false;
}

// Load shop name from server (background update)
async function loadShopName() {
    if (!state.currentKey) return;
    
    // First try localStorage for instant display
    const hadCached = loadShopNameFromCache();
    
    try {
        console.log('[ShopName] Loading from API for:', state.currentKey);
        const response = await fetch(`${API_BASE}/shop-name?farmKey=${encodeURIComponent(state.currentKey)}`);
        if (response.ok) {
            const data = await response.json();
            console.log('[ShopName] API response:', data);
            if (data.success && data.shopName) {
                // Only update if different from cached
                if (data.shopName !== shopNameState.fullName) {
                    shopNameState.fullName = data.shopName;
                    shopNameState.isConfigured = true;
                    parseShopName(data.shopName);
                    updateShopNameDisplay();
                    localStorage.setItem('glitched_shop_name', data.shopName);
                    console.log('[ShopName] Updated from server:', data.shopName);
                }
                return true;
            } else {
                console.log('[ShopName] No shop name in response');
            }
        }
    } catch (e) {
        console.warn('Failed to load shop name:', e);
    }
    
    // If no server response but had cached - keep using cached
    if (hadCached) {
        return true;
    }
    
    updateShopNameDisplay();
    return shopNameState.isConfigured;
}

// Ensure shop name is loaded before proceeding
async function ensureShopNameLoaded() {
    // If already configured, return true
    if (shopNameState.isConfigured && shopNameState.fullName) {
        console.log('[ShopName] Already configured:', shopNameState.fullName);
        return true;
    }
    
    // Try to load from server
    await loadShopName();
    
    return shopNameState.isConfigured && shopNameState.fullName;
}

// Parse shop name into components (best effort)
function parseShopName(fullName) {
    if (!fullName) return;
    
    // Try to extract emojis and text
    // Emoji regex pattern
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
    const emojis = fullName.match(emojiRegex) || [];
    
    if (emojis.length >= 2) {
        shopNameState.leftEmoji = emojis[0];
        shopNameState.rightEmoji = emojis[emojis.length - 1];
        // Extract text between emojis
        const text = fullName.replace(emojiRegex, '').trim();
        shopNameState.text = text;
    } else if (emojis.length === 1) {
        shopNameState.leftEmoji = emojis[0];
        shopNameState.rightEmoji = emojis[0];
        shopNameState.text = fullName.replace(emojiRegex, '').trim();
    } else {
        shopNameState.text = fullName;
    }
}

// Save shop name to server
async function saveShopName(fullName) {
    if (!state.currentKey) return false;
    
    try {
        const response = await fetch(`${API_BASE}/shop-name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                farmKey: state.currentKey,
                shopName: fullName
            })
        });
        
        if (response.ok) {
            shopNameState.fullName = fullName;
            shopNameState.isConfigured = true;
            localStorage.setItem('glitched_shop_name', fullName);
            updateShopNameDisplay();
            return true;
        }
    } catch (e) {
        console.error('Failed to save shop name:', e);
    }
    return false;
}

// Update shop name display in UI
function updateShopNameDisplay() {
    const valueEl = document.getElementById('shopNameValue');
    const hintEl = document.getElementById('shopNameHint');
    
    if (valueEl) {
        if (shopNameState.isConfigured && shopNameState.fullName) {
            valueEl.textContent = shopNameState.fullName;
            valueEl.classList.remove('not-configured');
        } else {
            valueEl.textContent = t('not_configured');
            valueEl.classList.add('not-configured');
        }
    }
    
    if (hintEl) {
        if (shopNameState.isConfigured) {
            hintEl.classList.add('hidden');
        } else {
            hintEl.classList.remove('hidden');
        }
    }
}

// Build full shop name from components
function buildShopName(leftEmoji, text, rightEmoji) {
    return `${leftEmoji}${text}${rightEmoji}`;
}

// Update preview in modal
function updateShopNamePreview() {
    const leftEmoji = document.getElementById('leftEmojiDisplay')?.textContent || shopNameState.leftEmoji || '👾';
    const text = document.getElementById('shopNameText')?.value || 'Your Shop';
    const rightEmoji = document.getElementById('rightEmojiDisplay')?.textContent || shopNameState.rightEmoji || '👾';
    
    const preview = buildShopName(leftEmoji, text, rightEmoji);
    const previewEl = document.getElementById('shopNamePreview');
    if (previewEl) {
        previewEl.textContent = preview;
    }
    
    // Update char counter
    const charCountEl = document.getElementById('shopNameCharCount');
    if (charCountEl) {
        charCountEl.textContent = text.length;
    }
}

// v9.11.16: Curated emoji list - only well-supported emojis
const EMOJI_LIST = [
    // Smileys & Emotion (well supported)
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
    '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '😝',
    '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
    '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
    '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
    '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
    '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤',
    '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
    '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    '🙈', '🙉', '🙊',
    // Gestures & Body
    '👋', '🤚', '✋', '🖖', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
    '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '👂', '👃', '🧠', '👀',
    '👁️', '👅', '👄', '💋',
    // Hearts & Love
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
    '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    // Animals (popular ones)
    '🐶', '🐕', '🐩', '🐺', '🦊', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴',
    '🐎', '🦄', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑',
    '🐐', '🐪', '🐫', '🐘', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🦔', '🦇',
    '🐻', '🐨', '🐼', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧',
    '🦅', '🦆', '🦢', '🦉', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕',
    '🦖', '🐳', '🐋', '🐬', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🐌', '🦋',
    '🐛', '🐜', '🐝', '🐞', '🕷️', '🕸️', '🦂',
    // Food & Drink
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭',
    '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥒', '🌶️', '🌽', '🥕', '🥔',
    '🍠', '🥐', '🍞', '🥖', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖',
    '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🍝', '🍜', '🍲',
    '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🍢', '🍡',
    '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿',
    '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🥤', '🍶', '🍺',
    '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾',
    // Activities & Sports
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸',
    '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹',
    '⛸️', '🥌', '🎿', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫',
    '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
    '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
    // Travel & Places
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛',
    '🚜', '🏍️', '🛵', '🚲', '🛴', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠',
    '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊',
    '🚉', '✈️', '🛫', '🛬', '💺', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🚢',
    '⚓', '⛽', '🚧', '🚦', '🚥', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰',
    '🏯', '🎡', '🎢', '🎠', '⛲', '🏖️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️',
    '⛺', '🏠', '🏡', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫',
    '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🕋', '⛩️', '🗾', '🎑', '🏞️', '🌅',
    '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁',
    // Objects
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🕹️', '💽', '💾', '💿',
    '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻',
    '🎙️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦',
    '🕯️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧',
    '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🔫', '💣', '🔪', '🗡️', '⚔️', '🛡️',
    '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️',
    '💊', '💉', '🧬', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁',
    '🛀', '🧼', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🛋️', '🛏️', '🛌', '🧸',
    '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐',
    '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫',
    '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈', '📉', '📆',
    '📅', '🗑️', '📇', '📋', '📁', '📂', '📰', '📓', '📔', '📒', '📕', '📗',
    '📘', '📙', '📚', '📖', '🔖', '🔗', '📎', '📐', '📏', '📌', '📍', '✂️',
    '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
    // Symbols
    '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '💭', '💤', '⚠️', '🚸',
    '⛔', '🚫', '🚳', '🚭', '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️', '⬆️',
    '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️',
    '⤵️', '🔃', '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '⚛️', '☯️', '✡️', '☸️',
    '✝️', '☦️', '☪️', '☮️', '🔯', '♈', '♉', '♊', '♋', '♌', '♍', '♎',
    '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '◀️',
    '⏪', '🔼', '⏫', '🔽', '⏬', '⏸️', '⏹️', '⏺️', '⏏️', '🎦', '🔅', '🔆',
    '📶', '📳', '📴', '♀️', '♂️', '✖️', '➕', '➖', '➗', '‼️', '⁉️', '❓',
    '❔', '❕', '❗', '💱', '💲', '⚕️', '♻️', '⚜️', '🔱', '📛', '🔰', '⭕',
    '✅', '☑️', '✔️', '❌', '❎', '➰', '➿', '✳️', '✴️', '❇️', '©️', '®️',
    '™️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧',
    '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️',
    '▫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲',
    // Flags
    '🏁', '🚩', '🎌', '🏴', '🏳️',
    // Nature & Weather
    '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️',
    '☃️', '⛄', '🌊', '💧', '💦', '☔', '🔥', '✨', '⭐', '🌟', '💫', '🌙',
    '🌛', '🌜', '🌝', '🌞', '💥', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔',
    '🌕', '🌖', '🌗', '🌘', '🌚', '🌻', '🌼', '🌷', '🌹', '🥀', '🌺', '🌸',
    '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃'
];

// Current emoji picker target
let currentEmojiPickerTarget = null;
let emojiGridPopulated = false; // v9.11.15: Track if grid is populated

// Open emoji picker popup
function openEmojiPicker(target, buttonEl) {
    const popup = document.getElementById('emojiPickerPopup');
    if (!popup) return;
    
    currentEmojiPickerTarget = target;
    
    // Position popup near the button - center it better
    const rect = buttonEl.getBoundingClientRect();
    const popupWidth = 360;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = rect.left + (rect.width / 2) - (popupWidth / 2);
    left = Math.max(10, Math.min(left, viewportWidth - popupWidth - 10));
    
    let top = rect.bottom + 10;
    // If popup would go off screen bottom, show above button
    if (top + 450 > viewportHeight) {
        top = rect.top - 460;
        if (top < 10) top = 10;
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    
    // v9.11.15: Populate grid only once
    const grid = document.getElementById('emojiPickerGrid');
    if (grid && !emojiGridPopulated) {
        grid.innerHTML = ''; // Clear any existing
        EMOJI_LIST.forEach(emoji => {
            const item = document.createElement('button');
            item.className = 'emoji-picker-item';
            item.textContent = emoji;
            item.type = 'button';
            item.addEventListener('click', () => selectEmoji(emoji));
            grid.appendChild(item);
        });
        emojiGridPopulated = true;
    }
    
    // Clear search
    const searchInput = document.getElementById('emojiSearchInput');
    if (searchInput) searchInput.value = '';
    filterEmojis('');
    
    popup.classList.remove('hidden');
}

// Close emoji picker popup
function closeEmojiPicker() {
    const popup = document.getElementById('emojiPickerPopup');
    if (popup) popup.classList.add('hidden');
    currentEmojiPickerTarget = null;
}

// Select emoji from picker
function selectEmoji(emoji) {
    if (currentEmojiPickerTarget === 'left') {
        const display = document.getElementById('leftEmojiDisplay');
        if (display) display.textContent = emoji;
        shopNameState.leftEmoji = emoji;
        
        // If "same emoji" is checked, also update right
        const sameCheckbox = document.getElementById('sameEmojiCheckbox');
        if (sameCheckbox?.checked) {
            const rightDisplay = document.getElementById('rightEmojiDisplay');
            if (rightDisplay) rightDisplay.textContent = emoji;
            shopNameState.rightEmoji = emoji;
        }
    } else if (currentEmojiPickerTarget === 'right') {
        const display = document.getElementById('rightEmojiDisplay');
        if (display) display.textContent = emoji;
        shopNameState.rightEmoji = emoji;
    }
    
    updateShopNamePreview();
    closeEmojiPicker();
}

// Filter emojis by search
function filterEmojis(query) {
    const grid = document.getElementById('emojiPickerGrid');
    if (!grid) return;
    
    const items = grid.querySelectorAll('.emoji-picker-item');
    const q = query.toLowerCase().trim();
    
    if (!q) {
        // Show all
        items.forEach(item => item.style.display = 'flex');
        return;
    }
    
    // Simple emoji search - match by emoji itself
    items.forEach(item => {
        const emoji = item.textContent;
        // Show if emoji contains query or matches common patterns
        const show = emoji.includes(q);
        item.style.display = show ? 'flex' : 'none';
    });
}

// Open shop name modal
function openShopNameModal(callback = null) {
    const modal = document.getElementById('shopNameModal');
    if (!modal) return;
    
    shopNameState.pendingCallback = callback;
    
    // Pre-fill with current values
    const leftDisplay = document.getElementById('leftEmojiDisplay');
    const textInput = document.getElementById('shopNameText');
    const rightDisplay = document.getElementById('rightEmojiDisplay');
    const sameCheckbox = document.getElementById('sameEmojiCheckbox');
    
    if (leftDisplay) leftDisplay.textContent = shopNameState.leftEmoji || '👾';
    if (textInput) textInput.value = shopNameState.text || '';
    if (rightDisplay) rightDisplay.textContent = shopNameState.rightEmoji || '👾';
    
    // Check if same emoji
    if (sameCheckbox) {
        sameCheckbox.checked = shopNameState.leftEmoji === shopNameState.rightEmoji;
    }
    
    // Clear error
    const errorEl = document.getElementById('shopNameError');
    if (errorEl) errorEl.textContent = '';
    
    updateShopNamePreview();
    modal.classList.remove('hidden');
}

// Close shop name modal
function closeShopNameModal() {
    const modal = document.getElementById('shopNameModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    closeEmojiPicker();
    shopNameState.pendingCallback = null;
}

// Confirm shop name from modal
async function confirmShopNameModal() {
    const leftEmoji = document.getElementById('leftEmojiDisplay')?.textContent || '👾';
    const text = document.getElementById('shopNameText')?.value?.trim() || '';
    const rightEmoji = document.getElementById('rightEmojiDisplay')?.textContent || '👾';
    const errorEl = document.getElementById('shopNameError');
    
    // Validation
    if (!text) {
        if (errorEl) errorEl.textContent = 'Please enter a shop name';
        return;
    }
    
    if (text.length > 15) {
        if (errorEl) errorEl.textContent = 'Shop name must be 15 characters or less';
        return;
    }
    
    const fullName = buildShopName(leftEmoji, text, rightEmoji);
    
    // Save to server
    const saved = await saveShopName(fullName);
    
    if (saved) {
        shopNameState.leftEmoji = leftEmoji;
        shopNameState.text = text;
        shopNameState.rightEmoji = rightEmoji;
        
        showNotification(`✅ Shop name saved: ${fullName}`, 'success');
        closeShopNameModal();
        
        // Execute callback if pending (e.g., continue with generation)
        if (shopNameState.pendingCallback) {
            const callback = shopNameState.pendingCallback;
            shopNameState.pendingCallback = null;
            callback();
        }
    } else {
        if (errorEl) errorEl.textContent = 'Failed to save shop name. Please try again.';
    }
}

// Setup shop name modal listeners
function setupShopNameModalListeners() {
    // Close button
    const closeBtn = document.getElementById('closeShopNameModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeShopNameModal);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancelShopName');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeShopNameModal);
    }
    
    // Confirm button
    const confirmBtn = document.getElementById('confirmShopName');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmShopNameModal);
    }
    
    // Modal overlay
    const modal = document.getElementById('shopNameModal');
    if (modal) {
        modal.querySelector('.modal-overlay')?.addEventListener('click', closeShopNameModal);
    }
    
    // Edit button in offers view
    const editBtn = document.getElementById('editShopNameBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => openShopNameModal());
    }
    
    // Left emoji button
    const leftEmojiBtn = document.getElementById('leftEmojiBtn');
    if (leftEmojiBtn) {
        leftEmojiBtn.addEventListener('click', () => openEmojiPicker('left', leftEmojiBtn));
    }
    
    // Right emoji button
    const rightEmojiBtn = document.getElementById('rightEmojiBtn');
    if (rightEmojiBtn) {
        rightEmojiBtn.addEventListener('click', () => openEmojiPicker('right', rightEmojiBtn));
    }
    
    // Same emoji checkbox
    const sameEmojiCheckbox = document.getElementById('sameEmojiCheckbox');
    if (sameEmojiCheckbox) {
        sameEmojiCheckbox.addEventListener('change', () => {
            if (sameEmojiCheckbox.checked) {
                // Copy left emoji to right
                const leftEmoji = document.getElementById('leftEmojiDisplay')?.textContent || '👾';
                const rightDisplay = document.getElementById('rightEmojiDisplay');
                if (rightDisplay) rightDisplay.textContent = leftEmoji;
                shopNameState.rightEmoji = leftEmoji;
                updateShopNamePreview();
            }
        });
    }
    
    // Text input change
    const textInput = document.getElementById('shopNameText');
    if (textInput) {
        textInput.addEventListener('input', updateShopNamePreview);
    }
    
    // Emoji picker close button
    const closePickerBtn = document.getElementById('closeEmojiPicker');
    if (closePickerBtn) {
        closePickerBtn.addEventListener('click', closeEmojiPicker);
    }
    
    // Emoji search
    const emojiSearch = document.getElementById('emojiSearchInput');
    if (emojiSearch) {
        emojiSearch.addEventListener('input', (e) => filterEmojis(e.target.value));
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('emojiPickerPopup');
        if (!popup || popup.classList.contains('hidden')) return;
        
        const isClickInside = popup.contains(e.target) || 
                             e.target.closest('#leftEmojiBtn') || 
                             e.target.closest('#rightEmojiBtn');
        
        if (!isClickInside) {
            closeEmojiPicker();
        }
    });
}

// Check if shop name is configured before generation
function requireShopName(callback) {
    if (shopNameState.isConfigured && shopNameState.fullName) {
        callback();
        return;
    }
    
    // Open modal and set callback
    openShopNameModal(callback);
}

// Setup info banner close listener
function setupInfoBannerListener() {
    const closeBannerBtn = document.getElementById('closeInfoBanner');
    const banner = document.getElementById('offersInfoBanner');
    if (closeBannerBtn && banner) {
        closeBannerBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
            localStorage.setItem('offers_banner_hidden', 'true');
        });
        
        // Check if banner was previously hidden
        if (localStorage.getItem('offers_banner_hidden') === 'true') {
            banner.classList.add('hidden');
        }
    }
}

// ============================================
// GENERATOR SETTINGS MODAL
// ============================================

// Generator settings state
let generatorSettings = {
    templateId: localStorage.getItem('supa_template_id') || ''
};

function openGeneratorSettingsModal() {
    const modal = document.getElementById('generatorSettingsModal');
    if (!modal) return;
    
    // Load current value
    const input = document.getElementById('templateIdInput');
    if (input) {
        input.value = generatorSettings.templateId;
    }
    
    // Clear error
    const errorEl = document.getElementById('generatorSettingsError');
    if (errorEl) errorEl.textContent = '';
    
    modal.classList.remove('hidden');
}

function closeGeneratorSettingsModal() {
    const modal = document.getElementById('generatorSettingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function saveGeneratorSettings() {
    const input = document.getElementById('templateIdInput');
    const errorEl = document.getElementById('generatorSettingsError');
    
    const value = input?.value?.trim() || '';
    
    // Validate if provided
    if (value && !/^\d+$/.test(value)) {
        if (errorEl) errorEl.textContent = 'Template ID must be a number';
        return;
    }
    
    // Save to localStorage
    generatorSettings.templateId = value;
    localStorage.setItem('supa_template_id', value);
    
    showNotification(`Generator settings saved${value ? ` (Template: ${value})` : ' (using default)'}`, 'success');
    closeGeneratorSettingsModal();
}

function setupGeneratorSettingsListeners() {
    // Open button
    const openBtn = document.getElementById('generatorSettingsBtn');
    if (openBtn) {
        openBtn.addEventListener('click', openGeneratorSettingsModal);
    }
    
    // Close button
    const closeBtn = document.getElementById('closeGeneratorSettingsModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGeneratorSettingsModal);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancelGeneratorSettings');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeGeneratorSettingsModal);
    }
    
    // Confirm button
    const confirmBtn = document.getElementById('confirmGeneratorSettings');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', saveGeneratorSettings);
    }
    
    // Modal overlay
    const modal = document.getElementById('generatorSettingsModal');
    if (modal) {
        modal.querySelector('.modal-overlay')?.addEventListener('click', closeGeneratorSettingsModal);
    }
}

// Get current template ID for generation
function getTemplateId() {
    return generatorSettings.templateId || null;
}

// Setup offers event listeners
function setupOffersListeners() {
    // Setup info banner listener
    setupInfoBannerListener();
    
    // Search
    if (offerSearchEl) {
        offerSearchEl.addEventListener('input', (e) => {
            offersState.searchQuery = e.target.value.trim();
            filterAndRenderOffers();
        });
    }
    
    // Sort dropdown
    initDropdown(offerSortDropdown, (value) => {
        offersState.sortBy = value;
        filterAndRenderOffers();
    });
    
    // Status dropdown
    initDropdown(offerStatusDropdown, (value) => {
        offersState.statusFilter = value;
        filterAndRenderOffers();
    });
    
    // v9.11.11: Mutation dropdown for offers
    const offerMutationDropdown = document.getElementById('offerMutationDropdown');
    initDropdown(offerMutationDropdown, (value) => {
        offersState.mutationFilter = value;
        filterAndRenderOffers();
    });
    
    // Select all - find dynamically
    const selectAllEl = document.getElementById('selectAllOffers');
    if (selectAllEl) {
        selectAllEl.addEventListener('change', toggleSelectAllOffers);
    }
    
    // Bulk adjust button - find dynamically
    const adjustBtnEl = document.getElementById('bulkAdjustBtn');
    if (adjustBtnEl) {
        adjustBtnEl.addEventListener('click', openBulkPriceModal);
    }
    
    // Bulk delete button - find dynamically
    const deleteBtnEl = document.getElementById('bulkDeleteBtn');
    if (deleteBtnEl) {
        deleteBtnEl.addEventListener('click', bulkDeleteOffers);
        console.log('Bulk delete button listener attached');
    } else {
        // Try again after a delay - element may be loading
        setTimeout(() => {
            const retryDeleteBtn = document.getElementById('bulkDeleteBtn');
            if (retryDeleteBtn) {
                retryDeleteBtn.addEventListener('click', bulkDeleteOffers);
                console.log('Bulk delete button listener attached (delayed)');
            }
        }, 1000);
    }
    
    // Scan Eldorado button (also refreshes offers after scan)
    const scanOffersBtn = document.getElementById('scanOffersBtn');
    if (scanOffersBtn) {
        scanOffersBtn.addEventListener('click', scanEldoradoOffers);
    }
    
    // Bulk price type radio buttons
    document.querySelectorAll('input[name="bulkPriceType"]').forEach(radio => {
        radio.addEventListener('change', (e) => handleBulkPriceTypeChange(e.target.value));
    });
    
    // Modal close buttons
    document.getElementById('closeBulkPriceModal')?.addEventListener('click', () => closeModalFn(bulkPriceModal));
    document.getElementById('cancelBulkPrice')?.addEventListener('click', () => closeModalFn(bulkPriceModal));
    document.getElementById('confirmBulkPrice')?.addEventListener('click', confirmBulkPriceAdjustment);
    
    document.getElementById('closeOfferPriceModal')?.addEventListener('click', () => closeModalFn(offerPriceModal));
    document.getElementById('cancelOfferPrice')?.addEventListener('click', () => closeModalFn(offerPriceModal));
    document.getElementById('confirmOfferPrice')?.addEventListener('click', confirmOfferPriceAdjustment);
    
    // Auto-select custom radio when user starts typing in custom price input
    document.getElementById('customPriceInput')?.addEventListener('input', () => {
        const customRadio = document.querySelector('input[name="priceType"][value="custom"]');
        if (customRadio) customRadio.checked = true;
    });
    
    // Auto-select custom-single radio when user types in single custom price
    document.getElementById('singleCustomPrice')?.addEventListener('input', () => {
        const customSingleRadio = document.querySelector('input[name="bulkPriceType"][value="custom-single"]');
        if (customSingleRadio) customSingleRadio.checked = true;
    });
    
    // Auto-select custom-each radio when user types in individual custom inputs
    document.getElementById('bulkOffersList')?.addEventListener('input', (e) => {
        if (e.target.matches('.custom-price-input input')) {
            const customEachRadio = document.querySelector('input[name="bulkPriceType"][value="custom-each"]');
            if (customEachRadio) customEachRadio.checked = true;
        }
    });
}

// v10.5.0: Scan All now fetches pre-scanned offers from database (instant!)
// Offers are scanned by cron job, not by this button
async function scanEldoradoOffers() {
    const scanBtn = document.getElementById('scanOffersBtn');
    const progressEl = document.getElementById('offersScanProgress');
    const progressFill = document.getElementById('offersScanProgressFill');
    const progressText = document.getElementById('offersScanProgressText');
    
    if (!scanBtn) return;
    
    if (!state.currentKey) {
        showNotification('❌ ' + t('no_farm_key_selected'), 'error');
        return;
    }
    
    const originalContent = scanBtn.innerHTML;
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('loading');
    
    // Show progress bar
    if (progressEl) {
        progressEl.classList.remove('hidden');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = t('loading');
    }
    
    const updateProgress = (percent, text) => {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = text || `${percent}%`;
    };
    
    try {
        updateProgress(30, t('fetching_offers'));
        
        // v10.5.0: Fetch pre-scanned offers from database (FAST!)
        const response = await fetch(`${API_BASE}/offers-fast?farmKey=${encodeURIComponent(state.currentKey)}`);
        const result = await response.json();
        
        updateProgress(70, t('processing_results'));
        
        if (result.success && result.offers) {
            // Update offers state
            offersState.offers = result.offers;
            offersState.lastFetch = Date.now();
            
            // Save to localStorage for cache
            saveOffersToStorage();
            
            console.log(`[Scan All] Loaded ${result.offers.length} offers from DB cache`);
        }
        
        updateProgress(90, t('rendering'));
        
        // Re-render offers
        filterAndRenderOffers();
        
        updateProgress(100, t('done'));
        
        const stats = result.stats || {};
        // v9.12.37: Use result.offers.length as fallback when stats not provided
        const total = stats.totalOffers || (result.offers?.length || 0);
        const activeCount = stats.activeOffers || result.offers?.filter(o => o.status === 'active').length || 0;
        const pausedCount = stats.pausedOffers || result.offers?.filter(o => o.status === 'paused').length || 0;
        const pendingCount = stats.pendingOffers || result.offers?.filter(o => o.status === 'pending').length || 0;
        
        // Build message
        let message = '';
        let type = 'success';
        
        if (total === 0) {
            message = `ℹ️ No offers found. Register codes first.`;
            type = 'info';
        } else {
            const parts = [];
            if (activeCount > 0) parts.push(`${activeCount} active`);
            if (pendingCount > 0) parts.push(`${pendingCount} pending`);
            if (pausedCount > 0) parts.push(`${pausedCount} paused`);
            message = `✅ ${parts.join(', ')} (from DB cache)`;
        }
        
        showNotification(message, type);
        
    } catch (err) {
        console.error('Scan error:', err);
        updateProgress(0, 'Error');
        showNotification('❌ Scan error: ' + err.message, 'error');
    } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = originalContent;
        
        // Hide progress bar after delay
        setTimeout(() => {
            if (progressEl) progressEl.classList.add('hidden');
        }, 1500);
    }
}

// v9.8.7: Smart auto-refresh for offers
let offersAutoRefreshInterval = null;
let lastOffersRefreshTime = 0;
const OFFERS_REFRESH_INTERVAL = 10000; // 10 seconds

function startOffersAutoRefresh() {
    // Check if we need immediate refresh (timer already passed while away)
    const timeSinceLastRefresh = Date.now() - lastOffersRefreshTime;
    
    if (lastOffersRefreshTime > 0 && timeSinceLastRefresh >= OFFERS_REFRESH_INTERVAL) {
        // Timer already passed - refresh immediately
        console.log('🔄 Returning to Offers - refreshing immediately (timer passed)');
        doOffersRefresh();
    } else if (lastOffersRefreshTime > 0) {
        // Timer not yet passed - wait for remaining time
        const remainingTime = OFFERS_REFRESH_INTERVAL - timeSinceLastRefresh;
        console.log(`⏳ Returning to Offers - waiting ${Math.round(remainingTime/1000)}s for next refresh`);
        
        // Set one-time timeout for remaining time, then start interval
        if (!offersAutoRefreshInterval) {
            offersAutoRefreshInterval = setTimeout(async () => {
                await doOffersRefresh();
                // Now start regular interval
                offersAutoRefreshInterval = setInterval(doOffersRefresh, OFFERS_REFRESH_INTERVAL);
            }, remainingTime);
        }
        return;
    }
    
    // First time or fresh start - just start interval
    if (!offersAutoRefreshInterval) {
        offersAutoRefreshInterval = setInterval(doOffersRefresh, OFFERS_REFRESH_INTERVAL);
        console.log('🔄 Offers auto-refresh started (every 10s)');
    }
}

async function doOffersRefresh() {
    if (state.currentKey && offersState.offers.length > 0) {
        console.log('🔄 Auto-refreshing offers from DB...');
        lastOffersRefreshTime = Date.now();
        // v3.0.1: Больше НЕ вызываем scan-glitched - cron делает это автоматически
        // await triggerServerScan();
        // Загружаем свежие данные из БД (обновлённые cron'ом)
        await loadOffers(true, true); // Force refresh, silent mode
    }
}

// v3.0.1: DEPRECATED - scan-glitched больше не нужен, cron сканирует офферы
// Оставлено для обратной совместимости но не вызывается
async function triggerServerScan() {
    // DISABLED: Cron scanner now handles offer scanning
    // This was causing Cloudflare rate limit 1015
    console.log('⚠️ triggerServerScan() is deprecated - cron handles scanning');
    return { success: true, cached: true };
}

function stopOffersAutoRefresh() {
    if (offersAutoRefreshInterval) {
        clearInterval(offersAutoRefreshInterval);
        clearTimeout(offersAutoRefreshInterval);
        offersAutoRefreshInterval = null;
        // DON'T reset lastOffersRefreshTime - keep it for smart resume!
        console.log('⏸️ Offers auto-refresh paused (timer preserved)');
    }
}

// ==================== CRON REFRESH TIMER ====================
let cronTimerInterval = null;

/**
 * Инициализирует таймер обратного отсчёта до следующего cron сканирования
 * Cron запускается каждую минуту в :00 секунд
 */
function initCronTimer() {
    const timerEl = document.getElementById('cronTimer');
    const valueEl = document.getElementById('cronTimerValue');
    
    if (!timerEl || !valueEl) return;
    
    // Установить tooltip
    timerEl.title = t('cron_timer_tooltip');
    
    // Обновить сразу
    updateCronTimer();
    
    // Обновлять каждую секунду
    if (cronTimerInterval) clearInterval(cronTimerInterval);
    cronTimerInterval = setInterval(updateCronTimer, 1000);
}

/**
 * Обновляет отображение таймера
 */
function updateCronTimer() {
    const timerEl = document.getElementById('cronTimer');
    const valueEl = document.getElementById('cronTimerValue');
    
    if (!timerEl || !valueEl) return;
    
    // Сколько секунд осталось до следующей минуты
    const now = new Date();
    const secondsRemaining = 60 - now.getSeconds();
    
    // Форматируем как M:SS
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    valueEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Меняем класс в зависимости от времени
    timerEl.classList.remove('soon', 'imminent', 'refreshing');
    
    if (secondsRemaining <= 5) {
        timerEl.classList.add('imminent');
    } else if (secondsRemaining <= 15) {
        timerEl.classList.add('soon');
    }
    
    // Анимация при обновлении (первые 3 секунды после :00)
    if (secondsRemaining >= 57) {
        timerEl.classList.add('refreshing');
    }
}

/**
 * Останавливает таймер
 */
function stopCronTimer() {
    if (cronTimerInterval) {
        clearInterval(cronTimerInterval);
        cronTimerInterval = null;
    }
}
// ==================== END CRON TIMER ====================

// Initialize offers when view is shown
function initOffersView() {
    console.log('📋 Offers view opened');
    
    // Load shop name for display
    loadShopName();
    
    // v9.8.7: Smart refresh - check if we need to load or use cache
    const timeSinceLastRefresh = Date.now() - lastOffersRefreshTime;
    const needsRefresh = lastOffersRefreshTime === 0 || timeSinceLastRefresh >= OFFERS_REFRESH_INTERVAL;
    
    if (needsRefresh) {
        console.log('Loading offers (first time or stale)...');
        loadOffers();
        lastOffersRefreshTime = Date.now();
    } else {
        console.log(`Using cached offers (${Math.round(timeSinceLastRefresh/1000)}s old)`);
    }
    
    startOffersAutoRefresh();
}

// Setup offers listeners on DOM ready
setupOffersListeners();
setupShopNameModalListeners();
setupGeneratorSettingsListeners();

// Check for returned data from Tampermonkey after price adjustment
function checkForPriceAdjustmentResult() {
    const result = localStorage.getItem('glitched_price_result');
    if (result) {
        try {
            const data = JSON.parse(result);
            if (data.success) {
                console.log('Price adjustment completed:', data);
                // Update local offer data
                for (const adjusted of data.adjusted || []) {
                    const offer = offersState.offers.find(o => o.offerId === adjusted.offerId);
                    if (offer) {
                        offer.currentPrice = adjusted.newPrice;
                    }
                }
                filterAndRenderOffers();
            }
            localStorage.removeItem('glitched_price_result');
        } catch (e) {
            console.error('Error parsing price result:', e);
        }
    }
}

// Check periodically for Tampermonkey results
setInterval(checkForPriceAdjustmentResult, 2000);

// ============================================
// TOP / LEADERBOARDS SECTION (Server-based)
// ============================================

let topState = {
    activeTab: 'income',
    initialized: false,
    cache: {
        income: null,
        value: null,
        total: null
    },
    loading: false
};

// Preload top data in background (silent, no UI updates) - OPTIMIZED: parallel requests
async function preloadTopData() {
    const types = ['income', 'value', 'total'];
    
    // Запускаем все запросы параллельно вместо последовательно
    const promises = types.map(async (type) => {
        // Skip if already cached
        if (topState.cache[type]) return;
        
        try {
            const response = await fetch(`${API_BASE}/top?type=${type}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    topState.cache[type] = result.data;
                }
            }
        } catch (error) {
            // Silent fail - will load on demand
        }
    });
    
    await Promise.all(promises);
    console.log('✅ Preloaded top data (parallel)');
}

function initTopView() {
    if (!topState.initialized) {
        setupTopTabListeners();
        topState.initialized = true;
    }
    loadAndRenderTop();
}

function setupTopTabListeners() {
    const topTabs = document.querySelectorAll('.top-tab');
    topTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            topTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            topState.activeTab = tab.dataset.top;
            loadAndRenderTop();
        });
    });
}

async function loadAndRenderTop() {
    const container = document.querySelector('.top-content');
    if (!container) return;
    
    const type = topState.activeTab;
    
    // Показываем загрузку
    if (!topState.cache[type]) {
        container.innerHTML = `
            <div class="top-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка топа...</p>
            </div>
        `;
    }
    
    // Если есть кэш - рендерим его сразу
    if (topState.cache[type]) {
        renderTopData(topState.cache[type], type);
    }
    
    // Загружаем с сервера
    try {
        const response = await fetch(`${API_BASE}/top?type=${type}`);
        if (!response.ok) {
            throw new Error('Failed to fetch top data');
        }
        
        const result = await response.json();
        if (result.success && result.data) {
            topState.cache[type] = result.data;
            renderTopData(result.data, type);
        }
    } catch (error) {
        console.error('Error loading top:', error);
        if (!topState.cache[type]) {
            container.innerHTML = `
                <div class="top-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>${t('loading_error')}</h3>
                    <p>${t('failed_to_load_top')}</p>
                    <button onclick="loadAndRenderTop()" class="retry-btn">
                        <i class="fas fa-redo"></i> ${t('retry')}
                    </button>
                </div>
            `;
        }
    }
}

function renderTopData(data, type) {
    const container = document.querySelector('.top-content');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="top-empty">
                <i class="fas fa-trophy"></i>
                <h3>${t('no_data_yet')}</h3>
                <p>${t('top_description')}</p>
            </div>
        `;
        return;
    }
    
    const top3 = data.slice(0, 3);
    const rest = data.slice(3, 10);
    
    let html = '';
    
    if (type === 'total') {
        html = renderTopPodiumTotal(top3);
    } else {
        html = renderTopPodium(top3, type);
    }
    
    // Render positions 4-10 (real data + placeholders)
    html += `<div class="top-list">`;
    for (let i = 0; i < 7; i++) {
        const rank = i + 4;
        const item = rest[i];
        
        if (item) {
            const avatarIcon = item.avatar?.icon || 'fa-user';
            const avatarColor = item.avatar?.color || '#6366f1';
            const accountText = item.accountsCount === 1 ? 'account' : 'accounts';
            
            if (type === 'total') {
                html += `
                    <div class="top-list-item">
                        <div class="top-list-rank">${rank}</div>
                        <div class="top-list-avatar-icon" style="background: ${avatarColor}20; color: ${avatarColor}">
                            <i class="fas ${avatarIcon}"></i>
                        </div>
                        <div class="top-list-info">
                            <div class="top-list-name">${item.username}</div>
                            <div class="top-list-brainrot">${item.accountsCount} ${accountText}</div>
                        </div>
                        <div class="top-list-stats">
                            <div class="top-list-value">${formatIncomeFromMs(item.value)}</div>
                        </div>
                    </div>
                `;
            } else {
                const valueDisplay = type === 'income' 
                    ? formatIncomeFromMs(item.value)
                    : `$${formatMoney(item.value)}`;
                    
                html += `
                    <div class="top-list-item">
                        <div class="top-list-rank">${rank}</div>
                        <div class="top-list-avatar-icon" style="background: ${avatarColor}20; color: ${avatarColor}">
                            <i class="fas ${avatarIcon}"></i>
                        </div>
                        <div class="top-list-info">
                            <div class="top-list-name">${item.username}</div>
                            <div class="top-list-brainrot">${item.brainrot?.name || 'Unknown'}${type === 'value' && item.brainrot?.income ? ` <span class="top-list-income">${formatIncomeFromMs(item.brainrot.income)}</span>` : ''}</div>
                        </div>
                        <div class="top-list-stats">
                            <div class="top-list-value">${valueDisplay}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            // Placeholder for empty position
            html += `
                <div class="top-list-item top-list-placeholder">
                    <div class="top-list-rank">${rank}</div>
                    <div class="top-list-avatar-icon placeholder-avatar">
                        <i class="fas fa-question"></i>
                    </div>
                    <div class="top-list-info">
                        <div class="top-list-name placeholder-text">???</div>
                        <div class="top-list-brainrot">${t('waiting_for_player')}</div>
                    </div>
                    <div class="top-list-stats">
                        <div class="top-list-value placeholder-text">---</div>
                    </div>
                </div>
            `;
        }
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

// Render top 3 podium for income/value tabs - brainrot images in round avatars
function renderTopPodium(top3, type) {
    if (top3.length === 0) return '';
    
    const positions = ['first', 'second', 'third'];
    
    let html = `<div class="top-podium">`;
    
    top3.forEach((item, index) => {
        const position = positions[index];
        const brainrotImg = getBrainrotImage(item.brainrot?.name);
        const valueDisplay = type === 'income' 
            ? formatIncomeFromMs(item.value)
            : `$${formatMoney(item.value)}`;
        const avatarIcon = item.avatar?.icon || 'fa-user';
        const avatarColor = item.avatar?.color || '#6366f1';
        
        // Для вкладки Value показываем также income
        const incomeInfo = type === 'value' && item.brainrot?.income
            ? `<div class="podium-income">${formatIncomeFromMs(item.brainrot.income)}</div>`
            : '';
        
        // Брейнрот отображается в круглом аватаре сверху, аватар юзера слева от никнейма
        html += `
            <div class="podium-item ${position}">
                <div class="podium-avatar podium-brainrot-avatar">
                    ${index === 0 ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : ''}
                    <img src="${brainrotImg}" class="podium-brainrot-circle podium-animated" alt="${item.brainrot?.name || ''}" onerror="this.src='https://via.placeholder.com/100'">
                </div>
                <div class="podium-rank">#${index + 1}</div>
                <div class="podium-user-row">
                    <div class="podium-user-mini" style="background: ${avatarColor}20; color: ${avatarColor}">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                    <span class="podium-name">${item.username}</span>
                </div>
                <div class="podium-brainrot-label">${item.brainrot?.name || 'Unknown'}</div>
                ${incomeInfo}
                <div class="podium-value">${valueDisplay}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    return html;
}

// Render top 3 podium for total tab (panel avatars in circles)
function renderTopPodiumTotal(top3) {
    if (top3.length === 0) return '';
    
    const positions = ['first', 'second', 'third'];
    
    let html = `<div class="top-podium">`;
    
    top3.forEach((item, index) => {
        const position = positions[index];
        const avatarIcon = item.avatar?.icon || 'fa-user';
        const avatarColor = item.avatar?.color || '#6366f1';
        
        const accountText = item.accountsCount === 1 ? 'account' : 'accounts';
        
        // Круглый аватар пользователя с иконкой (стиль как farmer-avatar)
        html += `
            <div class="podium-item ${position}">
                <div class="podium-avatar podium-user-avatar">
                    ${index === 0 ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : ''}
                    <div class="podium-user-circle podium-animated" style="background: ${avatarColor}20; color: ${avatarColor}; border-color: ${position === 'first' ? '#ffd700' : position === 'second' ? '#c0c0c0' : '#cd7f32'}">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                </div>
                <div class="podium-rank">#${index + 1}</div>
                <div class="podium-name">${item.username}</div>
                <div class="podium-brainrot-label">${item.accountsCount} ${accountText}</div>
                <div class="podium-value">${formatIncomeFromMs(item.value)}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    return html;
}

// Helper to get brainrot image
function getBrainrotImage(brainrotName) {
    if (!brainrotName) return 'https://via.placeholder.com/60';
    
    const normalizedName = brainrotName.toLowerCase();
    
    // Сначала пробуем брать из state.brainrotImages (уже загружен)
    if (state.brainrotImages && state.brainrotImages[normalizedName]) {
        return `${BRAINROT_IMAGES_BASE}/${state.brainrotImages[normalizedName]}`;
    }
    
    // Пробуем варианты имени
    const variations = [
        normalizedName,
        normalizedName.replace(/ /g, '_'),
        normalizedName.replace(/ /g, '')
    ];
    
    for (const variant of variations) {
        if (state.brainrotImages && state.brainrotImages[variant]) {
            return `${BRAINROT_IMAGES_BASE}/${state.brainrotImages[variant]}`;
        }
    }
    
    return 'https://via.placeholder.com/60';
}

// Balance Chart instance
let balanceChart = null;
let currentChartPeriod = null;
let isFirstChartRender = true; // v9.12.0: Track first render for animation

// Load saved chart period
function loadChartPeriod() {
    try {
        const saved = localStorage.getItem(CHART_PERIOD_KEY);
        if (saved) {
            const period = parseInt(saved);
            if (Object.values(PERIODS).includes(period)) {
                currentChartPeriod = period;
                return;
            }
        }
    } catch (e) {}
    currentChartPeriod = PERIODS.day;
}

// Save chart period
function saveChartPeriod(period) {
    try {
        localStorage.setItem(CHART_PERIOD_KEY, period.toString());
    } catch (e) {}
}

// Debounce timer for chart updates
let chartUpdateTimer = null;
let lastChartDataHash = null; // Track if data actually changed
let isChartUpdating = false; // Prevent concurrent updates
let chartRetryCount = 0; // v9.11.24: Moved here for proper reset
let chartNotVisibleLogged = false; // v9.12.29: Prevent spam when chart not visible

// Update balance chart with debounce (non-blocking)
function updateBalanceChart(period = currentChartPeriod) {
    // Clear pending update
    if (chartUpdateTimer) {
        clearTimeout(chartUpdateTimer);
    }
    
    // v9.11.24: Reset retry count on new user-initiated update
    chartRetryCount = 0;
    chartNotVisibleLogged = false; // Reset log flag
    
    // v9.11.22: Don't skip if updating - queue instead
    // Debounce chart updates to prevent flickering
    chartUpdateTimer = setTimeout(() => {
        // Use requestAnimationFrame for non-blocking UI
        requestAnimationFrame(() => {
            _doUpdateBalanceChart(period);
        });
    }, 50); // v9.11.22: Faster debounce (50ms instead of 100ms)
}

// Simple hash for chart data to detect changes
function getChartDataHash(chartData) {
    if (!chartData || !chartData.values) return '';
    const vals = chartData.values;
    // Use first, last, length and sum for quick comparison
    const sum = vals.reduce((a, b) => a + b, 0);
    return `${vals.length}_${vals[0]?.toFixed(2)}_${vals[vals.length-1]?.toFixed(2)}_${sum.toFixed(2)}`;
}

// v9.11.24: MAX_CHART_RETRIES - increased back, retry count is now reset properly
const MAX_CHART_RETRIES = 20;

// Actual chart update implementation
function _doUpdateBalanceChart(period) {
    // v9.11.22: Skip if already updating (moved here for better control)
    if (isChartUpdating) {
        return;
    }
    
    // Mark as updating to prevent concurrent calls
    isChartUpdating = true;
    
    const chartContainer = document.getElementById('balanceChart');
    const chartSection = document.getElementById('balanceChartSection');
    const chartEmpty = document.querySelector('.chart-empty');
    const chartStats = document.querySelector('.chart-stats');
    
    if (!chartContainer || !state.currentKey) {
        isChartUpdating = false;
        return;
    }
    
    // v9.11.25: Check if section is visible (parent may be hidden)
    const isVisible = chartSection && chartSection.offsetParent !== null;
    
    // v9.12.31: Check chartSection size instead of chartContainer (which may be display:none)
    // chartContainer can be hidden when showing "Collecting data..." state
    const rect = chartSection ? chartSection.getBoundingClientRect() : { width: 0, height: 0 };
    const hasSize = rect.width > 0 && rect.height > 0;
    
    // Check if canvas is properly sized - retry later if not ready yet (with limit)
    if (!hasSize) {
        if (chartRetryCount < MAX_CHART_RETRIES) {
            chartRetryCount++;
            isChartUpdating = false;
            // v9.11.25: Longer delay if section not visible (waiting for tab switch)
            const retryDelay = isVisible ? 100 : 300;
            setTimeout(() => _doUpdateBalanceChart(period), retryDelay);
        } else {
            // v9.12.29: Only log once until chart becomes visible again
            if (!chartNotVisibleLogged) {
                console.warn('Chart container not visible, will retry when tab is active');
                chartNotVisibleLogged = true;
            }
            chartRetryCount = 0;
            isChartUpdating = false;
            // Don't render - container not visible
            return;
        }
        // Only return if we're still retrying
        if (chartRetryCount > 0) {
            return;
        }
    }
    
    // Reset retry count and log flag on success
    chartRetryCount = 0;
    chartNotVisibleLogged = false;
    
    // При ручном рефреше НЕ обновляем график - оставляем как есть
    if (state.isManualPriceRefresh) {
        console.log('Skip chart update during manual price refresh');
        isChartUpdating = false;
        return;
    }
    
    // Load period if not set
    if (!currentChartPeriod) {
        loadChartPeriod();
        period = currentChartPeriod;
    }
    
    // v9.11.22: Track if period changed (force redraw)
    const periodChanged = currentChartPeriod !== period;
    currentChartPeriod = period;
    saveChartPeriod(period);
    
    // Update active tab
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.period) === period);
    });
    
    // v2.1: При смене периода НЕ загружаем с сервера - данные уже есть (30d)
    // getChartData сам отфильтрует по текущему периоду
    // Это экономит запросы и ускоряет переключение вкладок
    
    const chartData = getChartData(state.currentKey, period);
    
    // v9.11.22: Check if data actually changed - skip update if same AND period didn't change
    const newHash = `${period}_${getChartDataHash(chartData)}`; // Include period in hash
    if (newHash === lastChartDataHash && balanceChart && !periodChanged) {
        isChartUpdating = false;
        return; // Data hasn't changed, skip redraw
    }
    lastChartDataHash = newHash;
    
    console.log(`Chart update: period=${period}, points=${chartData.labels.length}, history=${state.balanceHistory[state.currentKey]?.length || 0}`);
    
    // v2.5: RT нужно минимум 2 точки, остальные периоды - 5
    const isRealtimePeriod = period <= PERIODS.realtime;
    const minPoints = isRealtimePeriod ? 2 : 5;
    
    if (chartData.labels.length < minPoints) {
        console.log(`Not enough chart data (need ${minPoints}+), showing empty state`);
        chartContainer.style.display = 'none';
        if (chartEmpty) chartEmpty.style.display = 'flex';
        if (chartStats) chartStats.innerHTML = '';
        isChartUpdating = false;
        return;
    }
    
    chartContainer.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';
    
    // Calculate period change
    const firstValue = chartData.values[0];
    const lastValue = chartData.values[chartData.values.length - 1];
    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 ? ((change / firstValue) * 100).toFixed(2) : 0;
    const isPositive = change >= 0;
    
    // Update chart stats
    if (chartStats) {
        const periodName = period === PERIODS.realtime ? t('period_5min') :
                          period === PERIODS.hour ? t('period_hour') : 
                          period === PERIODS.day ? t('period_day') : 
                          period === PERIODS.week ? t('period_week') : t('period_month');
        chartStats.innerHTML = `
            <div class="chart-stat">
                <span class="chart-stat-label">${t('change_for')} ${periodName}:</span>
                <span class="chart-stat-value ${isPositive ? 'change-positive' : 'change-negative'}">
                    ${isPositive ? '+' : ''}$${Math.abs(change).toFixed(2)} (${isPositive ? '+' : ''}${changePercent}%)
                </span>
            </div>
        `;
    }
    
    const ctx = chartContainer.getContext('2d');
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    const chartColor = isPositive ? '#22c55e' : '#ef4444';
    
    // v9.12.0: Animation only on first render or period change
    const shouldAnimate = isFirstChartRender || periodChanged;
    if (isFirstChartRender) {
        isFirstChartRender = false;
    }
    
    if (balanceChart) {
        balanceChart.destroy();
    }
    
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Balance',
                data: chartData.values,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                // v2.3: Точки маленькие, увеличиваются при наведении
                pointRadius: 0,
                pointHitRadius: 15,
                pointHoverRadius: 5,
                pointBackgroundColor: chartColor,
                pointBorderColor: chartColor,
                pointBorderWidth: 0,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: chartColor,
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: shouldAnimate ? { duration: 400 } : false,
            resizeDelay: 50,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(20, 20, 30, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    titleFont: { size: 11, weight: '600' },
                    bodyFont: { size: 13, weight: 'bold' },
                    borderColor: chartColor,
                    borderWidth: 1,
                    padding: { top: 8, bottom: 8, left: 12, right: 12 },
                    cornerRadius: 6,
                    displayColors: false,
                    // v2.3: Убираем мерцание
                    animation: { duration: 100 },
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            return '$' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: {
                            size: 10
                        },
                        maxRotation: 0,
                        maxTicksLimit: 6
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'x'
            },
            hover: {
                mode: 'nearest',
                intersect: false,
                animationDuration: 0 // Убираем задержку анимации при hover
            }
        }
    });
    
    isChartUpdating = false;
}

// Dynamic tooltip for mutation badges (to escape overflow containers)
function initMutationTooltips() {
    // Create tooltip element if not exists
    let tooltip = document.getElementById('mutation-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'mutation-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 700;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s, visibility 0.15s;
            pointer-events: none;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(tooltip);
    }
    
    // Event delegation for mutation badges
    document.addEventListener('mouseover', function(e) {
        const badge = e.target.closest('.brainrot-mini-mutation');
        if (badge && badge.dataset.mutation) {
            const rect = badge.getBoundingClientRect();
            tooltip.textContent = badge.dataset.mutation;
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            
            // Position above the badge
            const tooltipRect = tooltip.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2 - tooltipRect.width / 2) + 'px';
            tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        const badge = e.target.closest('.brainrot-mini-mutation');
        if (badge) {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        }
    });
}

// Initialize period tab listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load saved chart period
    loadChartPeriod();
    
    // Initialize mutation tooltips
    initMutationTooltips();
    
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const period = parseInt(this.dataset.period);
            if (period) {
                updateBalanceChart(period);
            }
        });
    });
});