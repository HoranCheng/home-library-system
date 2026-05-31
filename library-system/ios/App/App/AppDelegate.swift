import UIKit
import Capacitor
import GoogleSignIn
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // 检查是否有待执行的 Scan Intent
        let defaults = UserDefaults.standard
        if defaults.bool(forKey: "pendingScanIntent") {
            defaults.removeObject(forKey: "pendingScanIntent")
            defaults.removeObject(forKey: "pendingScanIntentAt")
            // 通过 NotificationCenter 通知 WebView
            NotificationCenter.default.post(name: NSNotification.Name("LibraryScanIntentTriggered"), object: nil)
            // WebView 启动后可能还没准备好接收 notification，所以再用 JS evaluate 兜底（延迟 0.3s）
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.triggerScanInWebView()
            }
        }
    }

    private func triggerScanInWebView() {
        // 找到 Capacitor 的 WKWebView，调用 window.handleNativeScanIntent()
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = scene.windows.first?.rootViewController else { return }
        findWebView(in: rootVC)?.evaluateJavaScript("window.handleNativeScanIntent && window.handleNativeScanIntent()", completionHandler: nil)
    }

    private func findWebView(in vc: UIViewController) -> WKWebView? {
        if let webView = vc.view.subviews.compactMap({ $0 as? WKWebView }).first {
            return webView
        }
        for child in vc.children {
            if let w = findWebView(in: child) { return w }
        }
        return nil
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }

        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
