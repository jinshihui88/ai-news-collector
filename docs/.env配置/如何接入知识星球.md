# 知识星球采集配置指南

> 更新时间: 2025-11-03

本文档提供将知识星球接入 AI 新闻采集器的最小可行步骤, 便于在 README 中保持简洁。

## 准备信息

- **星球 ID (`groupId`)**: 访问星球首页, URL 形如 `https://wx.zsxq.com/dweb2/index/group/{groupId}`。
- **话题 ID (`hashtags[].id`)**: 在星球页面点击某个话题, 从地址栏 `hashtags/{id}/topics` 获取。
- **Cookie (`ZSXQ_COOKIE`)**: 登录 https://wx.zsxq.com 后, 在浏览器开发者工具的 Network 面板中复制任一 `https://api.zsxq.com` 请求的 `Cookie` 请求头。确保包含 `zsxq_access_token`。

## 配置步骤

1. 复制示例配置: `cp config/zsxq-groups.example.json config/zsxq-groups.json` (若示例不存在, 可参考下方 JSON 结构手动创建)。
2. 在 `config/zsxq-groups.json` 中添加星球与话题:

```json
[
  {
    "groupId": "15552545485212",
    "groupName": "AI风向标",
    "hashtags": [
      { "id": "15555541155522", "name": "AI风向标" },
      { "id": "15555541155523", "name": "中标" }
    ]
  }
]
```

3. 根据需要调整 `src/config/datasources.js` 中 `ZSXQ_CONFIG.maxItems` 或 `config/collection-window.json` 中 `recentDays`。
4. 在 `.env` 写入 `ZSXQ_COOKIE`。

## 验证

运行 `npm start` 并关注日志:

```
[知识星球] 正在采集星球: AI风向标 (15552545485212)
[知识星球]   采集话题: AI风向标
```

若遇到 `API 返回格式不符合预期` 或 `未采集到任何新闻`, 请检查 Cookie 是否过期、话题 ID 是否正确, 或参考 `src/collectors/zsxq.js` 中的调试日志定位问题。

## 常见问题

- **Cookie 过期**: 重新登录网页端并复制新的 Cookie。
- **接口返回 1059**: 该错误通常表示请求过于频繁, 程序会自动降级为分页拉取。可适当降低 `maxItems` 或增大运行间隔。
- **未配置话题**: 若不填写 `hashtags`, 将默认使用星球首页内容, 但推荐明确列出以确保结果可控。

欢迎在 `docs/` 下补充更多示例或截图, 也欢迎提交 PR 更新本文档。
