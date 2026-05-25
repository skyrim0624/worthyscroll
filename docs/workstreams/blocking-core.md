# P5/P6 Screen Time 授权与屏蔽核心

状态：进行中
建议分支：`codex/blocking-core`  
责任范围：`ios/WorthyScrollBlocking/**`、`ios/WorthyScrollShared/**`、`docs/workstreams/blocking-core.md`

## 目标

实现 one sec 能起作用的“堵”：授权、选择目标 App / 网站、应用系统级 Shield。

## 验收标准

- [x] App 能请求 Screen Time / FamilyControls 授权。
- [x] 用户能用系统选择器选择要屏蔽的 App / 网站 / 类别。
- [x] 选择结果能保存在 App Group 可访问的位置。
- [x] Manual Block 能立即应用 Shield。
- [x] 能清除当前 Shield。
- [ ] 成功提交并推送本功能块。

## 步骤

- [x] 创建授权服务。
- [x] 创建 FamilyActivityPicker 页面。
- [x] 创建屏蔽目标持久化模型。
- [x] 创建 `ManagedSettingsStore` 屏蔽服务。
- [x] 创建 Manual Block 页面。
- [ ] 更新本日志勾选状态并提交推送。

## 接口依赖

- Shield 扩展依赖同一份 App Group 存储。
- DeviceActivity 依赖屏蔽目标和当前屏蔽配置。
