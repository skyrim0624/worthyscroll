import SwiftUI

struct ReaderView: View {
    let item: ContentItem
    var onMarkRead: () -> Void = {}
    var onFeedback: (FeedbackRating) -> Void = { _ in }
    var onArchive: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    private let readingEventStore = ReadingEventStore()

    private var blocks: [ReaderBlock] {
        MarkdownReaderParser.parse(item: item)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(item.title)
                    .font(.largeTitle.bold())
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 12) {
                    Text(item.sourceName)
                    Text("\(item.estimatedMinutes) 分钟")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)

                ForEach(blocks) { block in
                    ReaderBlockView(block: block)
                }

                Button {
                    readingEventStore.record(
                        ReadingEvent(itemID: item.id, eventType: .completed, progressRatio: 1)
                    )
                    onMarkRead()
                    dismiss()
                } label: {
                    Label("读完了", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 18)

                HStack {
                    Button {
                        onFeedback(.liked)
                    } label: {
                        Label("喜欢", systemImage: "hand.thumbsup")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        onFeedback(.disliked)
                    } label: {
                        Label("不喜欢", systemImage: "hand.thumbsdown")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                Button(role: .destructive) {
                    readingEventStore.record(
                        ReadingEvent(itemID: item.id, eventType: .archived, progressRatio: nil)
                    )
                    onArchive()
                    dismiss()
                } label: {
                    Label("隐藏这条", systemImage: "archivebox")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("阅读")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            readingEventStore.record(
                ReadingEvent(itemID: item.id, eventType: .opened, progressRatio: nil)
            )
        }
        .onDisappear {
            readingEventStore.record(
                ReadingEvent(itemID: item.id, eventType: .progressed, progressRatio: 0.5)
            )
        }
    }
}

private struct ReaderBlockView: View {
    let block: ReaderBlock

    var body: some View {
        switch block.kind {
        case .heading(let text):
            Text(text)
                .font(.title2.bold())
                .padding(.top, 8)
                .fixedSize(horizontal: false, vertical: true)
        case .paragraph(let text):
            Text(text)
                .font(.body)
                .lineSpacing(7)
                .fixedSize(horizontal: false, vertical: true)
        case .image(let source, let alt):
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.quaternary)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.title)
                            .foregroundStyle(.secondary)
                    }
                Text(alt.isEmpty ? source : alt)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .section(let text):
            Text(text)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
                .padding(.top, 10)
        }
    }
}

#Preview {
    NavigationStack {
        ReaderView(item: .previewItems[0])
    }
}
