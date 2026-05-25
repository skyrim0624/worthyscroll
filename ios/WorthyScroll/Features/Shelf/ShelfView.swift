import SwiftUI

struct ShelfView: View {
    @StateObject private var viewModel = ShelfViewModel()

    var body: some View {
        List {
            Section {
                Picker("来源", selection: $viewModel.sourceFilter) {
                    ForEach(ShelfViewModel.SourceFilter.allCases) { filter in
                        Text(filter.label).tag(filter)
                    }
                }
                .pickerStyle(.segmented)

                Toggle("隐藏已读", isOn: $viewModel.hidesReadItems)
            }

            if case .failed(let message) = viewModel.state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ForEach(viewModel.filteredItems) { item in
                NavigationLink {
                    ReaderView(item: item) {
                        viewModel.markRead(item)
                    } onFeedback: { rating in
                        viewModel.giveFeedback(item, rating: rating)
                    } onArchive: {
                        viewModel.archive(item)
                    }
                } label: {
                    ContentRowView(item: item)
                }
            }
        }
        .navigationTitle("值得刷")
        .searchable(text: $viewModel.query, prompt: "搜索未读库存")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await viewModel.load()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("刷新内容")
            }
        }
        .overlay {
            if viewModel.state == .loading {
                ProgressView("正在整理库存")
            }
        }
        .task {
            await viewModel.load()
        }
    }
}

private struct ContentRowView: View {
    let item: ContentItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(item.status == .read ? .secondary : .primary)
                Spacer(minLength: 12)
                if item.status == .read {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }

            Text(item.excerpt)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            HStack(spacing: 10) {
                Label(item.sourceName, systemImage: "tray.full")
                Label("\(item.estimatedMinutes) 分钟", systemImage: "clock")
                if let author = item.author, author.isEmpty == false {
                    Label(author, systemImage: "person")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    NavigationStack {
        ShelfView()
    }
}
