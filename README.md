# NocoBase 表格单元格直接编辑

插件名：`@ning/plugin-excel-inline-table`  
适用版本：NocoBase 2.1.35

基于 NocoBase 内置表格区块的“启用快速编辑”能力：单击单元格即可原地编辑，不再弹出编辑小窗；按 Enter 或失去焦点保存，按 Esc 取消。

同时兼容默认旧版页面 `/admin/...` 与新版页面 `/v/admin/...`。当前优先支持文本、数字和日期字段；复杂字段可在此仓库继续扩展。

## 开发与打包

本仓库只保存插件源码，不包含 NocoBase 官方源码、`node_modules`、构建产物或运行数据。

开发时，将此目录放入 NocoBase 源码目录：

```text
<NocoBase>\source\packages\plugins\@ning\plugin-excel-inline-table
```

在 NocoBase 源码根目录安装依赖并构建：

```powershell
yarn install
yarn build @ning/plugin-excel-inline-table --tar
```

构建得到的 `.tgz` 包可在 NocoBase 后台“插件管理 → 上传插件”安装。上传或升级后，用管理员 PowerShell 执行：

```powershell
nb app upgrade --env testnb1 --skip-code-update
```

然后在表格区块设置中启用“快速编辑”即可使用。
