import Foundation

struct ReaderBlock: Identifiable, Hashable, Sendable {
    let id: UUID
    var kind: Kind

    init(id: UUID = UUID(), kind: Kind) {
        self.id = id
        self.kind = kind
    }

    enum Kind: Hashable, Sendable {
        case heading(String)
        case paragraph(String)
        case image(source: String, alt: String)
        case section(String)
    }
}

enum MarkdownReaderParser {
    static func parse(item: ContentItem) -> [ReaderBlock] {
        guard let markdown = item.markdown?.trimmingCharacters(in: .whitespacesAndNewlines), markdown.isEmpty == false else {
            return fallbackBlocks(from: item.plainText ?? item.excerpt)
        }

        var blocks: [ReaderBlock] = []
        var paragraphLines: [String] = []

        func flushParagraph() {
            let text = cleanInlineMarkdown(paragraphLines.joined(separator: " "))
            if text.isEmpty == false {
                blocks.append(ReaderBlock(kind: .paragraph(text)))
            }
            paragraphLines.removeAll()
        }

        for rawLine in markdown.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.isEmpty {
                flushParagraph()
                continue
            }

            if let image = parseMarkdownImage(line) {
                flushParagraph()
                blocks.append(ReaderBlock(kind: .image(source: image.source, alt: image.alt)))
                continue
            }

            if line.hasPrefix("#") {
                flushParagraph()
                let text = line.replacingOccurrences(of: #"^#{1,6}\s*"#, with: "", options: .regularExpression)
                blocks.append(ReaderBlock(kind: .heading(cleanInlineMarkdown(text))))
                continue
            }

            if Int(line) != nil, line.count <= 2 {
                flushParagraph()
                blocks.append(ReaderBlock(kind: .section(line)))
                continue
            }

            paragraphLines.append(line)
        }

        flushParagraph()
        return blocks.isEmpty ? fallbackBlocks(from: item.excerpt) : blocks
    }

    private static func fallbackBlocks(from text: String) -> [ReaderBlock] {
        text.components(separatedBy: CharacterSet(charactersIn: "。！？.!?"))
            .map { cleanInlineMarkdown($0) }
            .filter { $0.isEmpty == false }
            .map { ReaderBlock(kind: .paragraph($0)) }
    }

    private static func parseMarkdownImage(_ line: String) -> (alt: String, source: String)? {
        guard let match = line.range(of: #"^!\[([^\]]*)\]\(([^)]+)\)$"#, options: .regularExpression) else {
            return nil
        }

        let matched = String(line[match])
        let alt = matched.replacingOccurrences(of: #"^!\[([^\]]*)\].*$"#, with: "$1", options: .regularExpression)
        let source = matched.replacingOccurrences(of: #"^!\[[^\]]*\]\(([^)]+)\)$"#, with: "$1", options: .regularExpression)
        return (alt, source)
    }

    private static func cleanInlineMarkdown(_ text: String) -> String {
        text.replacingOccurrences(of: #"\[([^\]]+)\]\([^)]+\)"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"[`*_~]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\\([_*>#-])"#, with: "$1", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
