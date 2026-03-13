// ── Lightweight i18n framework ──
// Supports zh-CN (default) and en
// Usage: t('key') or t('key', { count: 5 })

const LANG_KEY = 'lib:lang:v1';

const translations = {
  'zh-CN': {
    // Navigation
    'nav.home': '书房',
    'nav.search': '搜索',
    'nav.organize': '整理',
    'nav.settings': '设置',

    // Dashboard
    'dashboard.title': '{name}的书房',
    'dashboard.bookCount': '书架上整理了 {count} 本书',
    'dashboard.allSorted': '每一本书的信息都已经整理好了',
    'dashboard.mostSorted': '大部分书都已经整理得很完整了',
    'dashboard.needsWork': '还有一些书可以补充更多信息',

    // Entry
    'entry.scanHint': '自动从 Open Library · Google Books 补全书目信息',
    'entry.sessionCount': '连续录入中：本轮已添加 {count} 本',
    'entry.save': '导入库中',
    'entry.saveEdit': '保存修改',
    'entry.finishScan': '结束扫描',
    'entry.finishEntry': '返回总览',

    // API messages
    'api.querying': '已识别 ISBN：{isbn}，正在查询…',
    'api.notFound': '在 Google Books 和 Open Library 中均未找到此书，请手动补充后保存。',
    'api.networkError': '网络连接失败，请检查网络后重试，或手动补充。',
    'api.timeout': '查询超时，请检查网络后重试，或手动补充。',
    'api.partial': '已拿到部分书目信息，审阅后可导入。',

    // Backup
    'backup.neverExported': '⚠️ 还没有导出过备份',
    'backup.newBooks': '新增了 {count} 本书，建议更新备份',
    'backup.daysSince': '距上次备份已经 {days} 天了，建议导出一下',
    'backup.firstReminder': '你已经有 {count} 本书了，建议导出备份一下',
    'backup.goBackup': '去备份',

    // Sync
    'sync.synced': '已同步',
    'sync.syncing': '同步中…',
    'sync.error': '同步失败',
    'sync.offline': '📴 离线缓存中',
    'sync.networkRestored': '网络已恢复，正在同步…',

    // Import/Export
    'import.replace': '覆盖本地（原样替换）',
    'import.merge': '合并导入（按 ISBN 去重，较新记录优先）',
    'import.success': '导入成功',
    'import.mergeSuccess': '合并导入成功：新增 {added} 本，更新 {updated} 本，跳过 {skipped} 本。',

    // Empty state
    'empty.title': '欢迎来到你的书房',
    'empty.subtitle': '扫一扫书背面的条形码，\\n或手动输入 ISBN，开始整理你的藏书吧',
    'empty.cta': '开始录入第一本书',

    // Settings
    'settings.cloudSync': '☁️ 数据已开启云同步，会自动备份到云端。',
    'settings.localStorage': '💡 数据保存在你的浏览器本地，建议定期备份。登录后可开启云同步。',
    'settings.exportJson': '备份数据',
    'settings.exportCsv': '导出表格',
  },

  'en': {
    'nav.home': 'Library',
    'nav.search': 'Search',
    'nav.organize': 'Organize',
    'nav.settings': 'Settings',

    'dashboard.title': "{name}'s Library",
    'dashboard.bookCount': '{count} books on the shelf',
    'dashboard.allSorted': 'All books are fully organized',
    'dashboard.mostSorted': 'Most books are well organized',
    'dashboard.needsWork': 'Some books could use more info',

    'entry.scanHint': 'Auto-fill from Open Library · Google Books',
    'entry.sessionCount': 'Batch entry: {count} added this session',
    'entry.save': 'Add to Library',
    'entry.saveEdit': 'Save Changes',
    'entry.finishScan': 'Stop Scanning',
    'entry.finishEntry': 'Back to Overview',

    'api.querying': 'ISBN detected: {isbn}, looking up…',
    'api.notFound': 'Not found in Google Books or Open Library. Please fill in details manually.',
    'api.networkError': 'Network error. Please check your connection and try again.',
    'api.timeout': 'Request timed out. Please check your connection and try again.',
    'api.partial': 'Partial info found. Review and save.',

    'backup.neverExported': '⚠️ No backup exported yet',
    'backup.newBooks': '{count} new books since last backup',
    'backup.daysSince': '{days} days since last backup',
    'backup.firstReminder': 'You have {count} books — consider backing up',
    'backup.goBackup': 'Backup',

    'sync.synced': 'Synced',
    'sync.syncing': 'Syncing…',
    'sync.error': 'Sync failed',
    'sync.offline': '📴 Offline (cached)',
    'sync.networkRestored': 'Back online, syncing…',

    'import.replace': 'Replace local data',
    'import.merge': 'Merge (dedupe by ISBN, newer wins)',
    'import.success': 'Import successful',
    'import.mergeSuccess': 'Merge complete: {added} added, {updated} updated, {skipped} skipped.',

    'empty.title': 'Welcome to your library',
    'empty.subtitle': 'Scan a barcode or enter an ISBN\\nto start organizing your books',
    'empty.cta': 'Add your first book',

    'settings.cloudSync': '☁️ Cloud sync active. Data is backed up automatically.',
    'settings.localStorage': '💡 Data stored locally. Sign in to enable cloud sync.',
    'settings.exportJson': 'Backup Data',
    'settings.exportCsv': 'Export CSV',
  },
};

let currentLang = localStorage.getItem(LANG_KEY) || 'zh-CN';

export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
  }
}

export function getLang() {
  return currentLang;
}

export function getAvailableLangs() {
  return Object.keys(translations);
}

/**
 * Translate a key with optional interpolation.
 * t('dashboard.bookCount', { count: 42 }) → '书架上整理了 42 本书'
 */
export function t(key, params = {}) {
  const dict = translations[currentLang] || translations['zh-CN'];
  let str = dict[key] || translations['zh-CN'][key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return str;
}
