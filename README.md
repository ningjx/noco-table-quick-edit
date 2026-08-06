# 表格快捷编辑

插件名：`@ning/plugin-table-quick-edit`
当前版本：`0.2.10`
适用版本：NocoBase 2.1.35

基于 NocoBase 内置表格区块的“启用快速编辑”能力：单击单元格即可编辑，不再显示带“取消/提交”按钮的快速编辑小窗。直接输入字段失焦保存，Enter 保存，Esc 取消。

插件同时兼容旧版 `/admin/...` 和新版 `/v/admin/...` 页面，当前包含：

- 普通文本、邮箱、手机号、密码、网址、数字、整数、百分比、颜色、日期和时间等直接编辑字段
- 多行文本的浮层编辑框
- 单选、复选、下拉单选和下拉多选编辑器
- 图标搜索及选择编辑器
- 附件字段直接打开系统文件选择窗口
- 其他复杂字段回退到 NocoBase 原生快速编辑器

## 开发与打包

本仓库只保存插件源码，不包含 NocoBase 官方源码、`node_modules`、构建产物或运行数据。

开发时，将此目录放入对应版本的 NocoBase 源码目录：

```text
<NocoBase>\source\packages\plugins\@ning\plugin-table-quick-edit
```

在 NocoBase `source` 目录安装依赖并构建：

```powershell
yarn install
yarn build @ning/plugin-table-quick-edit --tar
```

构建得到的 `.tgz` 包位于 `source/storage/tar/@ning/`。它可以在 NocoBase 后台“插件管理 → 上传插件”安装。上传或升级后，用管理员 PowerShell 执行：

```powershell
nb app upgrade --env testnb1 --skip-code-update
```

然后在表格区块设置中启用“快速编辑”即可使用。

## GitHub Actions 自动发布

仓库中的 `.github/workflows/release.yml` 支持两种运行方式：

- 在 GitHub Actions 页面手动运行：构建插件、上传工作流产物，并预热 NocoBase 依赖缓存，但不创建 Release。
- 推送 `v*` 标签：构建插件，并把 `.tgz` 和 SHA-256 校验文件发布到对应的 GitHub Release。

发布前，先让 `package.json` 中的版本号与标签保持一致。例如当前版本为 `0.2.10`：

```powershell
git tag v0.2.10
git push origin v0.2.10
```

工作流固定使用 NocoBase `v2.1.35`、Node.js `20.16.0` 和 Yarn `1.22.22`。第一次构建需要安装完整的 NocoBase 依赖；成功后会缓存 Yarn 下载内容和 `node_modules`，后续发布直接复用。工作流使用 GitHub 自动提供的 `GITHUB_TOKEN` 创建 Release，无需额外配置密钥。
