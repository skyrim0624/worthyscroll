import SwiftUI

struct ShelfView: View {
    private let items = ContentItem.previewItems

    var body: some View {
        List(items) { item in
            NavigationLink {
                ReaderView(item: item)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    Text(item.title)
                        .font(.headline)
                    Text(item.excerpt)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    HStack(spacing: 10) {
                        Label(item.sourceName, systemImage: "tray.full")
                        Label("\(item.estimatedMinutes) 分钟", systemImage: "clock")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            }
        }
        .navigationTitle("值得刷")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    // NOTE: 后续接入 Supabase 拉取和本地缓存刷新。
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("刷新内容")
            }
        }
    }
}

#Preview {
    NavigationStack {
        ShelfView()
    }
}
