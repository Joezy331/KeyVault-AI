# Vault UML 图说明

## 图表列表

| 文件 | 类型 | 说明 |
|------|------|------|
| `01-class-diagram.puml` | 类图 | 系统架构、模块结构、类与数据模型 |
| `02-state-diagram.puml` | 状态机图 | 应用页面状态流转 (Setup → Lock → Main) |
| `03-sequence-setup.puml` | 时序图 | 首次设置流程 (密码+手势创建) |
| `04-sequence-unlock.puml` | 时序图 | 解锁流程 (手势/密码/免密三种方式) |
| `05-sequence-keymgmt.puml` | 时序图 | API Key CRUD + 搜索 + 导出 |
| `06-component-diagram.puml` | 组件图 | 系统组件关系与依赖 |
| `07-data-flow-diagram.puml` | 数据流图 | 密钥层次与加密数据流 |

## 渲染方式

### 在线渲染
- 复制 `.puml` 文件内容粘贴到 [PlantUML Online Server](https://www.plantuml.com/plantuml/uml/)

### VS Code 插件
- 安装 [PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) 插件
- 打开 `.puml` 文件后按 `Alt+D` 预览

### 命令行
```bash
# 需要 Java + Graphviz
java -jar plantuml.jar uml/*.puml
```
