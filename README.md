# Claude Status Pet（个人改版）

桌面宠物，实时显示 Claude Code 正在做什么：读文件、改代码、跑命令、等你审批……

本仓库 fork 自 [moeyui1/claude-status-pet](https://github.com/moeyui1/claude-status-pet) v1.1.13，之后按个人需求改造，**不再跟随上游更新**。上游的安装、更新方式（`/pet on`、`/pet update`、下载 Release）不适用于本版本，以本文为准。

## 和上游的区别

| 功能 | 上游 | 本版本 |
|---|---|---|
| 多会话 | 每个会话各开一只宠物，窗口重叠在同一位置 | **一只宠物汇总所有会话**，按紧急程度显示 |
| 启动 | 每个会话手动执行 `/pet on` | 开新会话时由钩子自动启动，全局只会有一只 |
| 状态动作 | 程序给每个状态加晃动、抖动 | 可以关掉；角色包可自带逐帧动画并声明不要程序晃动 |
| 置顶 | 只在启动时设一次 | 每 2 秒重新确认，被其他置顶窗口盖住也会浮回来 |

### 汇总模式（`run --all`）

- 几个会话同时活动时，按优先级挑一个显示：**等你审批 > 2 分钟内出错 > 干活中 > 思考中 > 空闲**。同一优先级显示最近有动静的那个。
- 标签显示会话所在目录名，同名时加会话 ID 前 4 位；其余在忙的会话数显示为「+N」。
- 右键 → Sessions：列出全部会话的状态和更新时间；点某个会话可以固定显示它，点 Auto 恢复自动挑选。
- 会话失效的判断：「干活中」超过 10 分钟没更新按空闲处理（会话崩溃时收不到结束事件）；超过 6 小时没更新的会话不显示；没有会话时显示 offline。

### 关闭晃动

- 右键 → Settings → Motion：对所有角色生效。
- 角色包的 `character.json` 写 `"motion": "none"`：只对这个角色关闭，适合本身就是逐帧动画（APNG、GIF）的角色。

## 安装（Windows）

1. **装插件**（提供写状态的钩子）：

   ```
   /plugin marketplace add LittleCrowDrinkWater/claude-status-pet
   /plugin install claude-status-pet
   ```

2. **编译程序**：需要 Rust 1.88 以上、Node.js、VS Build Tools（MSVC）。

   ```bash
   cd pet-app
   npm install
   npx tauri build --no-bundle
   ```

   必须用 `npx tauri build`，直接 `cargo build` 不会把前端打包进 exe。

3. **放到插件约定的位置**：把 `pet-app/src-tauri/target/release/claude-status-pet.exe` 复制成下面两个文件（钩子用无后缀的那个，启动用 `.exe` 那个）：

   ```
   %USERPROFILE%\.claude\pet-data\bin\claude-status-pet-windows-x64.exe
   %USERPROFILE%\.claude\pet-data\bin\claude-status-pet
   ```

4. **加自动启动钩子**：在 Claude Code 用户配置 `settings.json` 的 `hooks.SessionStart` 里加一条：

   ```json
   {
     "type": "command",
     "command": "powershell -NoProfile -Command 'Start-Process -FilePath \"$env:USERPROFILE\\.claude\\pet-data\\bin\\claude-status-pet-windows-x64.exe\" -ArgumentList \"run\",\"--all\" -WindowStyle Hidden'",
     "async": true,
     "timeout": 15
   }
   ```

   重复启动无害：已有一只在运行时，新进程发现全局锁 `pet-all.lock` 后直接退出。

**不要执行 `/pet update`**，它会下载上游的原版程序覆盖本版本；也不要再用 `/pet on`，它会额外开一只只跟单个会话的宠物。

## 自定义角色

角色包放在 `%USERPROFILE%\.claude\pet-data\characters\<角色名>\`，格式见 [docs/CUSTOM-CHARACTERS.md](docs/CUSTOM-CHARACTERS.md)。

注意：自定义角色只读取 `character.json` 里明确写出的状态键，缺失的状态一律用 idle 的图；文档里提到的 `working` 键对自定义角色不生效。

## 工作原理

```
Claude Code ──钩子──▶ write-status ──▶ status-<会话ID>.json ──文件监听──▶ 宠物窗口
                      （写完立即退出）                              （汇总模式下读取全部会话）
```

钩子事件到状态的对应关系见 [docs/HOOKS.md](docs/HOOKS.md)，开发说明见 [CLAUDE.md](CLAUDE.md)。

## 致谢

- 上游项目：[moeyui1/claude-status-pet](https://github.com/moeyui1/claude-status-pet)
- **Ferris**：[free-ferris-pack](https://github.com/MariaLetta/free-ferris-pack)，Maria Letta（CC0）
- **Go Gopher**：[gophers](https://github.com/egonelbre/gophers)，Egon Elbre（CC0），原始设计 Renee French
- **Fluent Emoji**：[fluentui-emoji](https://github.com/microsoft/fluentui-emoji)，Microsoft（MIT）
- **Mona**：[GitHub on GIPHY](https://giphy.com/GitHub)（运行时下载）
- **Kuromi**：[Sanrio Korea on GIPHY](https://giphy.com/SanrioKorea)（运行时下载）
- **ASCII 角色**：参考 cpaczek 的 [any-buddy](https://github.com/cpaczek/any-buddy)
- 基于 [Tauri](https://tauri.app/) 构建

## 许可

[AGPL-3.0-only](LICENSE)，与上游一致。修改后的版本如果分发给他人，需要同样以 AGPL-3.0 公开源码。
