## MODIFIED Requirements
### Requirement: Twitter 数据源采集
系统必须(SHALL)能够通过 Composio Twitter 工具检索并返回符合 NewsItem 结构的推文数据。
#### Scenario: 按关注推主采集近 7 天内容
- **GIVEN** `config/collection-window.json` 定义了 `recentDays`
- **AND** `config/twitter-accounts.json` 配置了至少一个推主(包含 `handle`)
- **WHEN** TwitterCollector 执行采集流程
- **THEN** 应根据全局 `recentDays` 计算查询的 `start_time`
- **AND** 为每个推主构造 `from:<handle>` 查询并追加默认或配置的后缀(如 `-is:retweet`)
- **AND** 仅保留 `created_at` 落在最近 `recentDays` 天窗口内的推文
- **AND** 输出结果应继续遵循 `NewsItem` 结构
- **AND** 当全局配置缺失或无效时,应回退至默认 7 天并记录提示日志
