// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorMlkitBarcodeScanning",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorMlkitBarcodeScanning",
            targets: ["CapacitorMlkitBarcodeScanning"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0"),
        .package(url: "https://github.com/d-date/google-mlkit-swiftpm", exact: "9.0.0-1")
    ],
    targets: [
        .target(
            name: "CapacitorMlkitBarcodeScanning",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "MLKitBarcodeScanning", package: "google-mlkit-swiftpm")
            ],
            path: "ios/Plugin",
            sources: [
                "BarcodeScanner.swift",
                "BarcodeScannerHelper.swift",
                "BarcodeScannerPlugin.swift",
                "BarcodeScannerView.swift",
                "Classes/Options/SetZoomRatioOptions.swift",
                "Classes/Results/GetMaxZoomRatioResult.swift",
                "Classes/Results/GetMinZoomRatioResult.swift",
                "Classes/Results/GetZoomRatioResult.swift",
                "Protocols/Result.swift",
                "ScanSettings.swift"
            ],
            publicHeadersPath: "."
        )
    ]
)
