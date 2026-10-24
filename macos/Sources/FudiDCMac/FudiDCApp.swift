import AppKit
import Foundation
import MLXHuggingFace
import MLXLMCommon
import MLXVLM
import SwiftUI
import Tokenizers
import WebKit

private let modelID = "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit"

@main
struct FudiDCApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 1040, minHeight: 720)
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1340, height: 900)
    }
}

@MainActor
struct ContentView: View {
    @State private var webView: FUDIWebView?
    @State private var localModelState = "Local AI downloads on first use"

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "function")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(red: 0.27, green: 0.43, blue: 0.32))
                Text("FUDI-DC")
                    .font(.system(size: 14, weight: .semibold))
                Spacer()
                Label(localModelState, systemImage: "cpu")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))

            if let webView {
                WebViewSurface(webView: webView)
            } else {
                ProgressView("Opening your on-device workspace…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task {
            guard webView == nil else { return }
            let view = FUDIWebView(onState: { localModelState = $0 })
            webView = view
            view.openBundledApp()
        }
    }
}

struct WebViewSurface: NSViewRepresentable {
    let webView: FUDIWebView
    func makeNSView(context: Context) -> WKWebView { webView.view }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

@MainActor
final class FUDIWebView: NSObject, WKScriptMessageHandler {
    let view: WKWebView
    private let engine = LocalFeedbackEngine()
    private let onState: @MainActor (String) -> Void

    init(onState: @escaping @MainActor (String) -> Void) {
        self.onState = onState
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let controller = WKUserContentController()
        configuration.userContentController = controller
        view = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        controller.add(self, name: "fudiLocalAI")
        view.setValue(false, forKey: "drawsBackground")
    }

    func openBundledApp() {
        guard let webDirectory = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
              let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web")
        else {
            onState("The bundled learning app could not be found")
            return
        }
        view.loadFileURL(page, allowingReadAccessTo: webDirectory)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "fudiLocalAI",
              let body = message.body as? [String: Any],
              let requestID = body["requestId"] as? String,
              let imageURL = body["imageDataURL"] as? String,
              let question = body["question"] as? String
        else { return }

        onState("Reviewing locally · experimental feedback")
        Task {
            let response: [String: Any]
            do {
                let resultData = try await engine.review(imageDataURL: imageURL, question: question)
                let result = (try? JSONSerialization.jsonObject(with: resultData)) as? [String: Any] ?? ["marks": []]
                response = ["requestId": requestID, "result": result]
                onState("Qwen3-VL is ready on this Mac · verify feedback")
            } catch {
                response = ["requestId": requestID, "result": ["error": error.localizedDescription, "marks": []]]
                onState("Local review failed · your page is unchanged")
            }
            guard let encoded = try? JSONSerialization.data(withJSONObject: response["result"] ?? [:]),
                  let value = String(data: encoded, encoding: .utf8)
            else { return }
            let resultBase64 = Data(value.utf8).base64EncodedString()
            let requestBase64 = Data(requestID.utf8).base64EncodedString()
            let script = "if (window.FudiAIResult) window.FudiAIResult(atob('\(requestBase64)'), JSON.parse(atob('\(resultBase64)')));"
            view.evaluateJavaScript(script)
        }
    }
}

actor LocalFeedbackEngine {
    private var session: ChatSession?

    func review(imageDataURL: String, question: String) async throws -> Data {
        #if !arch(arm64)
        throw LocalAIError.appleSiliconRequired
        #else
        guard let comma = imageDataURL.firstIndex(of: ","),
              let image = Data(base64Encoded: String(imageDataURL[imageDataURL.index(after: comma)...]))
        else { throw LocalAIError.invalidImage }

        if session == nil {
            let model = try await loadModel(
                from: #hubDownloader(),
                using: #huggingFaceTokenizerLoader(),
                id: modelID
            )
            session = ChatSession(model)
        }

        let temporaryImage = FileManager.default.temporaryDirectory
            .appendingPathComponent("fudi-review-\(UUID().uuidString).png")
        try image.write(to: temporaryImage, options: .atomic)
        defer { try? FileManager.default.removeItem(at: temporaryImage) }

        let prompt = """
        Review this handwritten math work for the question: \(question.prefix(500))
        Return JSON only, shaped like {"summary":"short supportive feedback","marks":[{"type":"note","x":0.5,"y":0.5,"text":"short note"}]}. Use at most 4 marks. Coordinates are fractions from 0 to 1 across the page. Point to the first likely incorrect step when visible. Never invent steps; if uncertain, say so and leave marks empty. Keep each note under 120 characters.
        """
        let answer = try await session!.respond(to: prompt, image: .url(temporaryImage))
        guard let json = extractJSONObject(answer.data(using: .utf8) ?? Data()) else {
            throw LocalAIError.invalidFeedback
        }
        var result = try JSONSerialization.jsonObject(with: json) as? [String: Any] ?? [:]
        result["marks"] = normalizeMarks(result["marks"] as? [[String: Any]] ?? [])
        result["summary"] = String((result["summary"] as? String ?? "Check each suggested step carefully.").prefix(300))
        return try JSONSerialization.data(withJSONObject: result)
        #endif
    }

    private func extractJSONObject(_ data: Data) -> Data? {
        guard let text = String(data: data, encoding: .utf8),
              let start = text.firstIndex(of: "{"),
              let end = text.lastIndex(of: "}"), start <= end
        else { return nil }
        return String(text[start...end]).data(using: .utf8)
    }

    private func normalizeMarks(_ marks: [[String: Any]]) -> [[String: Any]] {
        marks.prefix(6).map { mark in
            let x = Double(mark["x"] as? Double ?? 0.5)
            let y = Double(mark["y"] as? Double ?? 0.5)
            return [
                "type": (mark["type"] as? String) == "highlight" ? "highlight" : "note",
                "x": max(0, min(1, x)),
                "y": max(0, min(1, y)),
                "text": String((mark["text"] as? String ?? "Review this step").filter { $0 != "<" && $0 != ">" }.prefix(140)),
            ]
        }
    }
}

enum LocalAIError: LocalizedError {
    case invalidImage
    case invalidFeedback
    case appleSiliconRequired

    var errorDescription: String? {
        switch self {
        case .invalidImage: "The notebook snapshot could not be read."
        case .invalidFeedback: "The local model returned feedback in an unreadable format."
        case .appleSiliconRequired: "Local Qwen3-VL feedback requires an Apple Silicon Mac."
        }
    }
}
