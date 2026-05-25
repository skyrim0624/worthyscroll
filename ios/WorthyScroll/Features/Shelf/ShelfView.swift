import SwiftUI

struct ShelfView: View {
    @StateObject private var viewModel = ShelfViewModel()

    var body: some View {
        List {
            if case .failed(let message) = viewModel.state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ForEach(viewModel.items) { item in
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
        }
        .navigationTitle("值得刷")
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

#Preview {
    NavigationStack {
        ShelfView()
    }
}
