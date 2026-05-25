import SwiftUI

struct ReaderView: View {
    let item: ContentItem

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

                Text(item.plainText ?? item.excerpt)
                    .font(.body)
                    .lineSpacing(7)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("阅读")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        ReaderView(item: .previewItems[0])
    }
}
