## ADDED Requirements
### Requirement: 统一采集时间窗口配置
系统必须(SHALL)通过集中配置控制所有数据源采集的最近天数,并在缺省情况下提供安全的默认值。

#### Scenario: 全局配置生效
- **GIVEN** `config/collection-window.json` 中配置了 `recentDays`
- **WHEN** 任一采集器执行抓取
- **THEN** 应读取该配置以确定采集时间窗口
- **AND** 仅保留在最近 `recentDays` 天内发布的内容
- **AND** 若配置缺失或无效,应使用默认天数并记录提示日志

#### Scenario: 多数据源一致性
- **GIVEN** 系统同时启用 AIBase、知识星球、微信公众号、Twitter 等数据源
- **WHEN** 更新全局时间窗口配置
- **THEN** 所有采集器应采用相同的天数过滤内容
- **AND** 不需要逐一修改各自的配置文件
