# App Store 上架准备 — 毛毛书房

## 技术架构

```
preview/index.html (Web App)
    ↓
Capacitor (Native Bridge)
    ↓
ios/App/ (Xcode Project)
    ↓
App Store
```

## 已完成

- [x] Capacitor iOS 项目初始化 (`npx cap add ios`)
- [x] Bundle ID: `com.horancheng.library`
- [x] App Name: 毛毛书房
- [x] 相机权限声明 (NSCameraUsageDescription)
- [x] 竖屏锁定 (UIInterfaceOrientationPortrait)
- [x] PWA manifest + Service Worker
- [x] 数据库设计文档

## 待完成清单

### 1. Apple Developer Account
- [ ] 注册 Apple Developer Program ($99/年)
- [ ] 创建 App ID: `com.horancheng.library`
- [ ] 创建 Provisioning Profile

### 2. Xcode 配置
- [ ] 打开 `ios/App/App.xcworkspace`
- [ ] 设置 Team (Signing & Capabilities)
- [ ] 设置 Bundle Identifier
- [ ] 设置 Version: 1.0.0, Build: 1

### 3. App Icon
- [ ] 生成 1024x1024 App Icon (需要实际 PNG，不能用 SVG)
- [ ] 使用 Asset Catalog 生成所有尺寸
- [ ] 推荐工具: https://appicon.co

### 4. Launch Screen
- [ ] 自定义 LaunchScreen.storyboard
- [ ] 配合 app 主色调 #3D5E4C + #F6F3ED

### 5. App Store Connect
- [ ] 创建 App 条目
- [ ] 填写元数据:
  - 名称: 毛毛书房
  - 副标题: 个人藏书管理 · ISBN扫码识别
  - 描述: (见下方)
  - 关键词: 图书管理,书房,ISBN,条码扫描,藏书,阅读记录
  - 分类: 工具
  - 年龄分级: 4+
- [ ] 截图 (6.7" + 6.1" + iPad)
- [ ] 隐私政策 URL

### 6. App 描述（建议）

```
📚 毛毛书房 — 你的私人图书管理助手

扫一扫 ISBN 条码，自动识别书名、作者、分类。
轻松管理家里的每一本书。

功能亮点：
• 📷 ISBN 条码扫描，秒速录入
• 🤖 自动补全书目信息（Open Library + Google Books）
• 📂 智能分类 + 存放位置记录
• 📖 阅读状态追踪：要读 / 在读 / 读完
• 💾 数据备份导出（JSON + CSV）
• 🔍 全库搜索 + 分类筛选
• 🌐 离线可用，数据存在本地

完全免费，无广告，不收集个人数据。
```

### 7. 隐私政策

需要创建一个简单的隐私政策页面，核心要点：
- 不收集任何个人数据
- 数据全部存储在用户设备本地
- 相机仅用于 ISBN 条码扫描
- 不使用第三方分析/广告 SDK

### 8. 发布命令

```bash
# 同步 web 内容到 iOS
npx cap sync ios

# 打开 Xcode
npx cap open ios

# 在 Xcode 中：
# 1. Product > Archive
# 2. Distribute App > App Store Connect
# 3. Upload
```

## 开发迭代流程

```bash
# 修改 preview/index.html
# 测试完成后：
npx cap copy ios    # 复制 web 到 iOS
npx cap open ios    # 打开 Xcode 测试
```
