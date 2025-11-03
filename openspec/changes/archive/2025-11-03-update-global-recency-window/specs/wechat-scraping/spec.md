## MODIFIED Requirements
### Requirement: 微信公众号文章列表采集
系统必须(SHALL)通过公众号后台接口采集文章并返回符合 NewsItem 结构的数据。
#### Scenario: 成功采集指定公众号的文章列表
- **GIVEN** 用户已配置有效的 `token`(公众号后台 token)和 `fakeid`(公众号 ID)
- **AND** 全局时间窗口配置提供 `recentDays`
- **WHEN** 执行采集任务
- **THEN** 系统应成功调用 `/cgi-bin/appmsgpublish` 接口
- **AND** 应正确解析多层嵌套的 JSON 响应
- **AND** 每篇文章应包含标题、摘要、文章 URL、发布时间
- **AND** 默认获取最新 10-20 篇文章
- **AND** 仅保留最近 `recentDays` 天内的文章,超出范围的文章应记录调试日志并跳过
- **AND** 若全局配置缺失或无效,应回退至默认 7 天
