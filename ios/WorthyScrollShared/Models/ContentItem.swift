import Foundation

enum ContentSource: String, Codable, CaseIterable, Sendable {
    case wechatArticle = "wechat_article"
    case wechatVideo = "wechat_video"
    case wechatNote = "wechat_note"
    case xBookmark = "x_bookmark"
    case substack
}

enum ReadingStatus: String, Codable, Sendable {
    case unread
    case read
    case archived
}

struct ContentItem: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var title: String
    var sourceType: ContentSource
    var sourceName: String
    var author: String?
    var url: URL?
    var savedAt: Date?
    var estimatedMinutes: Int
    var wordCount: Int?
    var markdown: String?
    var plainText: String?
    var excerpt: String
    var status: ReadingStatus
}

extension ContentItem {
    static let previewItems: [ContentItem] = [
        ContentItem(
            id: "preview-wechat-harness",
            title: "一文读懂 Harness Engineering",
            sourceType: .wechatArticle,
            sourceName: "微信公众号",
            author: nil,
            url: nil,
            savedAt: nil,
            estimatedMinutes: 32,
            wordCount: nil,
            markdown: nil,
            plainText: "这是一篇用于原生 App 骨架预览的未读库存内容。后续会由 Obsidian 和 Supabase 同步真实正文。",
            excerpt: "从工程文章中整理 AI 应用层的 Harness 思路，适合放进项目方法库。",
            status: .unread
        ),
        ContentItem(
            id: "preview-wechat-video",
            title: "未来战胜人工智能后的某一时刻",
            sourceType: .wechatVideo,
            sourceName: "视频号",
            author: nil,
            url: nil,
            savedAt: nil,
            estimatedMinutes: 1,
            wordCount: nil,
            markdown: nil,
            plainText: "轻量娱乐内容也可以被 WorthyScroll 收进来，重点是不回到无限短视频流。",
            excerpt: "一个关于机械打字、计算机、青春电影和人与人羁绊的 AI MV。",
            status: .unread
        )
    ]
}
