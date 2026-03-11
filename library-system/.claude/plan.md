# ISBN 识别方案优化 + 多语言字母排序

## 问题分析

### 当前ISBN查询链 (串行，慢且命中率低)
1. Open Library → 2. Google Books (仅在OL缺失时) → 3. Crossref (仅在GB也缺失时)

### 核心问题
- **串行查询**：每个API等前一个完成才开始，慢
- **中文书覆盖差**：Open Library中文书极少，Google Books经常返回英文版
- **封面来源单一**：仅用OpenLibrary封面，中文书基本没有
- **没有ISBN-10/13互转查询**：有些API只认一种格式
- **排序只有按时间**：没有字母排序，更没有拼音排序

---

## 实现方案

### 一、ISBN查询引擎重写 (preview/index.html)

#### 1. 并行查询 + 智能合并
```
所有API同时发起请求（Promise.allSettled）
→ 收集所有结果
→ 按优先级合并（语言匹配的结果优先）
```

#### 2. API源扩展（全部免费，无需API key）

| API | 优势 | 用途 |
|-----|------|------|
| Open Library | 英文书好，有封面 | 英文书首选 |
| Google Books | 覆盖广，有缩略图 | 通用补充 |
| Google Books + langRestrict | 中文/日文结果更准 | CJK书首选 |
| Crossref | 学术书 | 补充出版年份/作者 |
| Open Library Works API | 用edition查works获取更多subject | 补充分类 |

#### 3. 语言感知的优先级
- ISBN 978-7 (中文)：Google Books `langRestrict=zh` 结果优先
- ISBN 978-4 (日文)：`langRestrict=ja` 优先
- ISBN 978-89 (韩文)：`langRestrict=ko` 优先
- 其他：Open Library 优先

#### 4. ISBN-10 ↔ ISBN-13 互转查询
如果ISBN-13查不到，自动转ISBN-10再查一次（反之亦然）

#### 5. 封面图片链
```
OpenLibrary封面 → Google Books缩略图 → 无封面占位
```
- 存储 `coverUrl` 到book数据中（不再动态计算）
- Google Books返回的 `imageLinks.thumbnail` 作为备选

#### 6. 数据合并策略
```javascript
// 优先级：语言匹配的源 > 通用源 > 兜底
// 每个字段独立选最优：
// title:  优先匹配语言的API结果
// author: 优先匹配语言的API结果
// category: 合并所有源的subjects/categories，取最相关的
// year: 任意源有即可
// description: 最长的描述优先
// coverUrl: 有效URL中分辨率最高的
```

### 二、封面图片存储

#### 修改 book 数据模型
在保存书籍时增加 `coverUrl` 字段：
- 查询成功时：保存Google Books thumbnail或OpenLibrary URL
- 手动录入时：不设置，展示时回退到 OpenLibrary ISBN查询

#### 修改 coverUrl() 函数
```javascript
function coverUrl(book) {
  if (book.coverUrl) return book.coverUrl;
  const isbn = String(book?.isbn || '').replace(/[^0-9Xx]/g, '');
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : '';
}
```

### 三、多语言字母排序

#### 排序逻辑
```javascript
function sortBooksByTitle(books) {
  return books.slice().sort((a, b) => {
    const ta = String(a.title || '');
    const tb = String(b.title || '');
    return ta.localeCompare(tb, 'zh-CN-u-co-pinyin');
  });
}
```

`localeCompare('zh-CN-u-co-pinyin')` 特性：
- 中文自动按拼音排序（爱→ai, 百→bai）
- 英文按字母排序
- 中英混排时自然融合到A-Z中
- 日文平假名/片假名也有合理排序

#### UI改动
- 书架默认改为按标题字母排序
- 添加排序切换：「按字母」|「按时间」
- 按字母排序时，显示分组字母头（A, B, C...）

### 四、排序分组字母头

按字母排序时，在书架网格中插入字母分隔符：
```
[A]
《阿甘正传》  《An Introduction to...》
[B]
《百年孤独》  《Brief History of Time》
```

获取排序首字母的方法：
```javascript
function getSortKey(title) {
  // 用Intl.Collator生成sortKey，提取首字母
  const first = String(title || '').trim().charAt(0);
  if (!first) return '#';
  // 中文→拼音首字母：利用localeCompare二分查找
  if (/[\u4e00-\u9fff]/.test(first)) {
    return getPinyinInitial(first);
  }
  // 其他语言直接取大写首字母
  return first.toUpperCase();
}
```

对于拼音首字母，使用轻量级映射表（约2KB），覆盖常用3000汉字的拼音首字母。

---

## 修改文件清单

### preview/index.html（主要改动）
1. **新增 `isbnLookupEngine` 函数** — 替换当前的 `fillBookMetaByIsbn`
   - 并行查询所有API
   - 智能合并结果
   - ISBN-10/13互转
2. **新增 `isbn10To13` / `isbn13To10` 转换函数**
3. **修改 `coverUrl()` 函数** — 优先用存储的coverUrl
4. **修改 `saveCurrentBook()`** — 保存coverUrl字段
5. **新增 `sortBooksByTitle()` 函数** — 拼音排序
6. **新增 `getSortKey()` + 拼音首字母表**
7. **修改 `render()` 中书架渲染** — 按字母排序+分组头
8. **新增排序切换UI** — 「按字母」|「按时间」按钮

### src/domain/book.ts（TypeScript模型，保持同步）
- 添加 `coverUrl?: string` 字段

---

## 不需要API key，全部免费
- Open Library：无限制
- Google Books：无key也能用（有每日限额但足够个人使用）
- Crossref：无限制
- 所有API都支持CORS
